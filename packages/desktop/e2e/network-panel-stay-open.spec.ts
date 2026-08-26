/**
 * Real Electron/Renderer E2E: Network panel stays open for 3 seconds.
 *
 * PREREQUISITES (all MUST be met or tests FAIL):
 *   - HSCode Desktop running with --remote-debugging-port=9222
 *   - At least one session available
 *
 * COMMAND:
 *   bun test packages/desktop/e2e/network-panel-stay-open.spec.ts
 *
 * If prerequisites are missing, this test FAILS (not PASS).
 */
import { describe, expect, test, beforeAll } from "bun:test"
import http from "node:http"
import fs from "node:fs"
import path from "node:path"

const CDP_HOST = "127.0.0.1"
const CDP_PORT = 9222
const ARTIFACTS_DIR = path.join(import.meta.dirname, "../../../artifacts/runtime")

interface CDPPage {
  webSocketDebuggerUrl: string
  type: string
}

function cdpGet(subpath: string): Promise<CDPPage[]> {
  return new Promise((res, rej) =>
    http
      .get({ host: CDP_HOST, port: CDP_PORT, path: subpath }, (r) => {
        let d = ""
        r.on("data", (c) => (d += c))
        r.on("end", () => {
          try { res(JSON.parse(d)) } catch { rej(new Error("CDP parse failed")) }
        })
      })
      .on("error", rej),
  )
}

class CDPSession {
  private ws: WebSocket
  private id = 0
  private pending = new Map<number, (msg: any) => void>()

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl)
  }

  async connect(): Promise<void> {
    await new Promise<void>((r) => (this.ws.onopen = r))
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string)
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)!(m)
        this.pending.delete(m.id)
      }
    }
  }

  async send(method: string, params?: Record<string, unknown>): Promise<any> {
    return new Promise((r) => {
      const id = ++this.id
      this.pending.set(id, r)
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expr: string): Promise<any> {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    return r.result?.result?.value
  }

  async click(x: number, y: number): Promise<void> {
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
  }

  async screenshot(filename: string): Promise<void> {
    const r = await this.send("Page.captureScreenshot", { format: "png" })
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
    fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), Buffer.from(r.result.data, "base64"))
  }

  close(): void {
    this.ws.close()
  }
}

async function getButtonPos(session: CDPSession, text: string): Promise<{ x: number; y: number }> {
  const raw = await session.evaluate(
    `JSON.stringify((() => { const b = [...document.querySelectorAll("button")].find(x => (x.textContent||"").trim() === ${JSON.stringify(text)}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })())`,
  )
  const pos = raw ? JSON.parse(raw) : null
  if (!pos) throw new Error(`Button "${text}" not found in DOM`)
  return pos
}

async function getPanelGeometry(session: CDPSession, selector: string) {
  const raw = await session.evaluate(
    `JSON.stringify((() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return { exists: false, width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 }
      const r = el.getBoundingClientRect()
      return {
        exists: true,
        width: Math.round(r.width),
        height: Math.round(r.height),
        left: Math.round(r.left),
        right: Math.round(r.right),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })())`,
  )
  return JSON.parse(raw)
}

function assertVisibleInViewport(geom: any, label: string, minWidth = 300, minHeight = 100) {
  expect(geom.exists, label + " should exist").toBe(true)
  expect(geom.width, label + " width should be >= " + minWidth).toBeGreaterThanOrEqual(minWidth)
  expect(geom.height, label + " height should be >= " + minHeight).toBeGreaterThanOrEqual(minHeight)
  expect(geom.left, label + " left < viewport width").toBeLessThan(geom.viewportWidth)
  expect(geom.right, label + " right > 0").toBeGreaterThan(0)
  expect(geom.top, label + " top < viewport height").toBeLessThan(geom.viewportHeight)
  expect(geom.bottom, label + " bottom > 0").toBeGreaterThan(0)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe("Network panel 3-second stay-open E2E", () => {
  let session: CDPSession

  beforeAll(async () => {
    // FAIL if CDP is unavailable — no silent skip
    const pages = await cdpGet("/json/list")
    const page = pages.find((p) => p.type === "page")
    if (!page) throw new Error("CDP: no page found. Is HSCode Desktop running with --remote-debugging-port=9222?")
    session = new CDPSession(page.webSocketDebuggerUrl)
    await session.connect()
  })

  test("Case A: Direct click 网络抓包 — initial state + 3-second stay-open", async () => {
    // Navigate to session
    await session.evaluate('(() => { const a = document.querySelector("a[href*=session]"); if (a) a.click(); return !!a })()')
    await sleep(5000)

    // Verify initial state: both panels hidden
    const netBefore = await getPanelGeometry(session, "#network-panel")
    expect(netBefore.exists, "Network panel should not exist initially").toBe(false)

    // Real click via CDP Input.dispatchMouseEvent
    const pos = await getButtonPos(session, "网络抓包")
    const clickStart = Date.now()
    await session.click(pos.x, pos.y)

    // True elapsed checkpoints
    const checkpoints = [50, 500, 1500, 3000]
    for (const target of checkpoints) {
      const elapsed = Date.now() - clickStart
      if (elapsed < target) await sleep(target - elapsed)
      const state = await getPanelGeometry(session, "#network-panel")
      assertVisibleInViewport(state, `Network at ${target}ms`)
    }

    await session.screenshot("network-direct-3s.png")
  })

  test("Case B: Terminal → Network — state switch + 3-second stay-open", async () => {
    // First ensure we're in a known state: click Network to close if open
    const netState = await isPanelVisible(session, "#network-panel")
    if (netState.visible) {
      const netPos = await getButtonPos(session, "网络抓包")
      await session.click(netPos.x, netPos.y)
      await sleep(500)
    }

    // Click Terminal — must be found
    const termPos = await getButtonPos(session, "终端")
    await session.click(termPos.x, termPos.y)
    await sleep(1000)

    // Assert: Terminal visible, Network hidden
    const termAfter = await isPanelVisible(session, "#terminal-panel")
    expect(termAfter.visible, "Terminal panel should be visible after clicking 终端").toBe(true)
    const netAfterTerm = await getPanelGeometry(session, "#network-panel")
    expect(netAfterTerm.exists, "Network panel should not exist after clicking 终端").toBe(false)

    // Click Network
    const netPos = await getButtonPos(session, "网络抓包")
    const clickStart = Date.now()
    await session.click(netPos.x, netPos.y)

    // True elapsed checkpoints: verify Network visible AND Terminal hidden
    const checkpoints = [50, 500, 1500, 3000]
    for (const target of checkpoints) {
      const elapsed = Date.now() - clickStart
      if (elapsed < target) await sleep(target - elapsed)
      const net = await getPanelGeometry(session, "#network-panel")
      const term = await getPanelGeometry(session, "#terminal-panel")
      assertVisibleInViewport(net, `Network at ${target}ms`)
      expect(term.exists, `Terminal hidden at ${target}ms`).toBe(false)
    }

    await session.screenshot("network-terminal-to-network-3s.png")
  })
})

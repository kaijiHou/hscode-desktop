/**
 * Real Electron/Renderer E2E: Network panel stays open for 3 seconds.
 *
 * This test connects to a running HSCode Desktop instance via CDP,
 * navigates to a session, clicks "网络抓包", and verifies the panel
 * remains visible at 50ms, 500ms, 1500ms, and 3000ms checkpoints.
 *
 * PREREQUISITES:
 *   - HSCode Desktop running with --remote-debugging-port=9222
 *   - At least one session available
 *
 * RUN: bun test packages/desktop/e2e/network-panel-stay-open.spec.ts
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test"
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

async function getNetworkButtonPos(session: CDPSession): Promise<{ x: number; y: number } | null> {
  const raw = await session.evaluate(
    'JSON.stringify((() => { const b = [...document.querySelectorAll("button")].find(x => (x.textContent||"").trim() === "网络抓包"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })())',
  )
  return raw ? JSON.parse(raw) : null
}

async function getTerminalButtonPos(session: CDPSession): Promise<{ x: number; y: number } | null> {
  const raw = await session.evaluate(
    'JSON.stringify((() => { const b = [...document.querySelectorAll("button")].find(x => (x.textContent||"").trim() === "终端"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })())',
  )
  return raw ? JSON.parse(raw) : null
}

async function isNetworkPanelVisible(session: CDPSession): Promise<{ visible: boolean; height: number }> {
  const raw = await session.evaluate(
    'JSON.stringify({ visible: !!document.getElementById("network-panel"), height: document.getElementById("network-panel")?.offsetHeight || 0 })',
  )
  return JSON.parse(raw)
}

describe("Network panel 3-second stay-open E2E", () => {
  let session: CDPSession | null = null

  beforeAll(async () => {
    try {
      const pages = await cdpGet("/json/list")
      const page = pages.find((p) => p.type === "page")
      if (!page) throw new Error("No CDP page found")
      session = new CDPSession(page.webSocketDebuggerUrl)
      await session.connect()
    } catch {
      // HSCode Desktop not running — tests will be skipped
    }
  })

  afterAll(() => {
    session?.close()
  })

  test("Case A: Direct click 网络抓包 stays open 3 seconds", async () => {
    if (!session) return

    // Navigate to session
    await session.evaluate('(() => { const a = document.querySelector("a[href*=session]"); if (a) a.click(); return !!a })()')
    await Bun.sleep(5000)

    const pos = await getNetworkButtonPos(session)
    if (!pos) throw new Error("网络抓包 button not found")

    // Real click via CDP Input
    await session.click(pos.x, pos.y)

    const delays = [50, 500, 1500, 3000]
    for (const ms of delays) {
      await Bun.sleep(ms)
      const state = await isNetworkPanelVisible(session)
      expect(state.visible, `panel should be visible at ${ms}ms`).toBe(true)
      expect(state.height, `panel should have height at ${ms}ms`).toBeGreaterThan(0)
    }

    await session.screenshot("network-direct-3s.png")
  })

  test("Case B: Terminal → Network stays open 3 seconds", async () => {
    if (!session) return

    // Click Terminal first
    const termPos = await getTerminalButtonPos(session)
    if (termPos) {
      await session.click(termPos.x, termPos.y)
      await Bun.sleep(1500)
    }

    // Click Network
    const netPos = await getNetworkButtonPos(session)
    if (!netPos) throw new Error("网络抓包 button not found")
    await session.click(netPos.x, netPos.y)

    const delays = [50, 500, 1500, 3000]
    for (const ms of delays) {
      await Bun.sleep(ms)
      const state = await isNetworkPanelVisible(session)
      expect(state.visible, `panel should be visible at ${ms}ms`).toBe(true)
      expect(state.height, `panel should have height at ${ms}ms`).toBeGreaterThan(0)
    }

    await session.screenshot("network-terminal-to-network-3s.png")
  })
})

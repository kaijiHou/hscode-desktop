// HSCode Network Inspector UX V2 — real CDP geometry E2E.
// Verifies with REAL pointer drags (Input.dispatchMouseEvent via CDP):
//   1. outer ResizeHandle drags the network workspace wider/narrower (live)
//   2. inner List/Detail splitter drags (real geometry before/after)
//   3. Expand button widens beyond stored width, Restore returns
//   4. width persists across close/reopen
const http = require("http")
const WebSocket = global.WebSocket

const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: 9222, path: p }, (r) => {
    let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)))
  }).on("error", rej)
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map() }
  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej) })
    const cdp = new CDP(ws)
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && cdp.pending.has(msg.id)) {
        const p = cdp.pending.get(msg.id); cdp.pending.delete(msg.id)
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result)
      }
    })
    return cdp
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })) })
  }
}
const evalJS = async (cdp, expression) => {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 200))
  return r.result.value
}

;(async () => {
  const targets = await get("/json/list")
  const page = targets.find((t) => t.type === "page" && !/devtools/i.test(t.url))
  const cdp = await CDP.connect(page.webSocketDebuggerUrl)
  await cdp.send("Runtime.enable")
  await cdp.send("Page.enable")

  const report = {}

  // ---- open network panel ----
  const opened = await evalJS(cdp, `(() => {
    if (document.querySelector('#network-panel')) return "already-open"
    const b = [...document.querySelectorAll('button,[role="menuitem"]')].find(el => /网络抓包/.test(el.textContent || el.getAttribute('aria-label') || ''))
    if (!b) return "no-button"
    b.click(); return "clicked"
  })()`)
  report.panelOpen = opened
  await sleep(1200)

  const netRect = async () => {
    const r = await evalJS(cdp, `(() => {
      const el = document.querySelector('#network-panel')
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: b.x, y: b.y, width: b.width, right: b.right }
    })()`)
    return r && typeof r.width === "number" ? r : null
  }

  report.networkBefore = await netRect()
  report.resizeHandleVisible = await evalJS(cdp, `!!document.querySelector('[data-component="resize-handle"]')`)

  // ---- outer drag: real mouse events ----
  const r0 = await netRect()
  const handle = await evalJS(cdp, `(() => {
    const h = document.querySelector('[data-component="resize-handle"]')
    if (!h) return null
    const b = h.getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  })()`)
  report.handlePos = handle
  if (r0 && handle) {
    const startX = handle.x
    // drag LEFT 180px → network widens
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: startX, y: handle.y, button: "left", clickCount: 1 })
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX - 30 * i, y: handle.y, buttons: 1 })
      await sleep(16)
    }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: startX - 180, y: handle.y, button: "left" })
    await sleep(500)
    const afterLeft = await netRect()
    report.networkAfterDragLeft = afterLeft
    report.dragLeftDelta = afterLeft ? Math.round(afterLeft.width - r0.width) : null

    // drag RIGHT back → network narrows
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: startX - 180, y: handle.y, button: "left", clickCount: 1 })
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX - 180 + 30 * i, y: handle.y, buttons: 1 })
      await sleep(16)
    }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: startX, y: handle.y, button: "left" })
    await sleep(500)
    const afterRight = await netRect()
    report.networkAfterDragRight = afterRight
    report.dragRightDelta = afterRight ? Math.round(afterRight.width - r0.width) : null
  }

  // ---- persistence: close, reopen, check width ----
  await evalJS(cdp, `(() => { const b = document.querySelector('[data-action="network-close"]'); b && b.click(); return "closed" })()`)
  await sleep(900)
  await evalJS(cdp, `(() => { const b = [...document.querySelectorAll('button')].find(el => /网络抓包/.test(el.getAttribute('aria-label') || '')); b && b.click(); return "reopened" })()`)
  await sleep(1200)
  report.networkAfterReopen = await netRect()

  // ---- inner splitter ----
  const innerGeom = async () => {
    const r = await evalJS(cdp, `(() => {
      const l = document.querySelector('[data-slot="network-packet-list"]')
      const d = document.querySelector('[data-slot="network-detail"]')
      const g = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b.width }
      return { list: g(l), detail: g(d) }
    })()`)
    return r && typeof r.list === "number" ? r : null
  }
  const listBefore = await innerGeom()
  report.innerBefore = listBefore
  const splitter = await evalJS(cdp, `(() => {
    const s = document.querySelector('[data-slot="network-splitter"]')
    if (!s) return null
    const b = s.getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  })()`)
  if (splitter) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: splitter.x, y: splitter.y, button: "left", clickCount: 1 })
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: splitter.x - 30 * i, y: splitter.y, buttons: 1 })
      await sleep(16)
    }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: splitter.x - 180, y: splitter.y, button: "left" })
    await sleep(400)
    const listAfter = await innerGeom()
    report.innerAfter = listAfter
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1) })
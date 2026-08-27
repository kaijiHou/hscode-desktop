// TCP-only runtime check (admin): filter → start → real traffic → rows.
const http = require("http")
const WebSocket = global.WebSocket
const { execSync } = require("child_process")
const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: 9222, path: p }, (r) => {
    let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)))
  }).on("error", rej)
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const targets = await get("/json/list")
  const page = targets.find((t) => t.type === "page" && !/devtools/i.test(t.url))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener("open", r))
  let id = 0
  const call = (m, p = {}) => new Promise((res, rej) => {
    const i = ++id
    const h = (ev) => {
      const x = JSON.parse(ev.data)
      if (x.id === i) { ws.removeEventListener("message", h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result) }
    }
    ws.addEventListener("message", h)
    ws.send(JSON.stringify({ id: i, method: m, params: p }))
  })
  const ev = async (e) => {
    const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200))
    return r.result.value
  }
  const report = {}

  report.panel = await ev(`(() => {
    if (document.querySelector('#network-panel')) return "open"
    const b = [...document.querySelectorAll('button,[role="menuitem"]')].find(el => /网络抓包/.test(el.textContent || el.getAttribute('aria-label') || ''))
    if (b) { b.click(); return "clicked" }
    return "no-button"
  })()`)
  await sleep(1000)

  await ev(`(() => {
    const panel = document.querySelector('#network-panel')
    const ip = panel.querySelector('input[aria-label="IP 筛选"]')
    const port = panel.querySelector('input[aria-label="端口筛选"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(ip, '10.199.194.75'); ip.dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(port, '8080'); port.dispatchEvent(new Event('input', { bubbles: true }))
    return "ok"
  })()`)
  report.stateBefore = await ev(`document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)
  report.statusText = await ev(`(() => { const s = document.querySelector('#network-panel [data-slot="network-state"]'); return s ? s.textContent : "no-el" })()`)
  console.log("panel:", report.panel, "| state:", report.statusText)
  process.exit(0)
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1) })
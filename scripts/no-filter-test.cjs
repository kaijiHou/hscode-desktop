const http = require("http")
const WebSocket = global.WebSocket
const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: 9222, path: p }, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d))) }).on("error", rej)
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const targets = await get("/json/list")
  const page = targets.find((t) => t.type === "page" && !/devtools/i.test(t.url))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener("open", r))
  let id = 0
  const call = (m, p = {}) => new Promise((res, rej) => {
    const i = ++id; const h = (ev) => { const x = JSON.parse(ev.data); if (x.id === i) { ws.removeEventListener("message", h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result) } }
    ws.addEventListener("message", h); ws.send(JSON.stringify({ id: i, method: m, params: p }))
  })
  const ev = async (e) => { const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200)); return r.result.value }

  // ensure open
  await ev(`(() => { if (document.querySelector('#network-panel')) return; const b = [...document.querySelectorAll('button')].find(el => /网络抓包/.test(el.getAttribute('aria-label') || '')); b && b.click() })()`)
  await sleep(800)

  // clear all filters
  await ev(`(() => {
    const p = document.querySelector('#network-panel')
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const ip = p.querySelector('input[aria-label="IP 筛选"]')
    const port = p.querySelector('input[aria-label="端口筛选"]')
    const adv = p.querySelector('input[aria-label="Network filter"]')
    s.call(ip, ''); ip.dispatchEvent(new Event('input', { bubbles: true }))
    s.call(port, ''); port.dispatchEvent(new Event('input', { bubbles: true }))
    if (adv) { s.call(adv, ''); adv.dispatchEvent(new Event('input', { bubbles: true })) }
  })()`)

  // click clear first to reset
  await ev(`(() => { const b = [...document.querySelectorAll('#network-panel button')].find(b => b.textContent.trim() === '清空'); b && b.click() })()`)
  await sleep(300)

  // start with no filter
  await ev(`(() => { const b = [...document.querySelectorAll('#network-panel button')].find(b => b.textContent.trim() === '开始抓包'); if (b) { b.click(); return 'clicked' }; return 'no-btn' })()`)
  await sleep(5000)

  const state = await ev(`document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)
  const count = await ev(`(() => { const el = document.querySelector('#network-panel [data-slot="network-count"]'); return el ? el.textContent : 'N/A' })()`)
  const firstRow = await ev(`(() => { const r = document.querySelector('#network-panel tbody tr'); return r ? [...r.querySelectorAll('td')].map(td => td.textContent.trim()).join(' | ') : null })()`)

  console.log("State:", state)
  console.log("Count:", count)
  console.log("First row:", firstRow)
  process.exit(0)
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1) })
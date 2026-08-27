const http = require("http")
const WebSocket = global.WebSocket
const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: 9222, path: p }, (r) => {
    let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)))
  }).on("error", rej)
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const ts = await get("/json/list")
  const page = ts.find((t) => t.type === "page" && !/devtools/i.test(t.url))
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
  const ev = async (e) => (await call("Runtime.evaluate", { expression: e, returnByValue: true })).result.value
  const netRects = async () => {
    const r = await ev(`(() => {
      const chat = document.querySelector('[data-slot=session-panel], .session-panel')
      const net = document.querySelector('#network-panel')
      const out = {}
      if (chat) { const b = chat.getBoundingClientRect(); out.chatW = Math.round(b.width); out.chatX = Math.round(b.x) }
      if (net) { const b = net.getBoundingClientRect(); out.netW = Math.round(b.width); out.netX = Math.round(b.x) }
      return out
    })()`)
    return r
  }
  console.log("before:", JSON.stringify(await netRects()))
  // JS click on expand
  const clicked = await ev(`(() => { const b = document.querySelector("[data-action=network-expand]"); if (!b) return "no-btn"; b.click(); return "clicked" })()`)
  console.log("expand via JS click:", clicked)
  await sleep(900)
  console.log("after expand:", JSON.stringify(await netRects()))
  // restore
  await ev(`(() => { const b = document.querySelector("[data-action=network-expand]"); b && b.click(); return 1 })()`)
  await sleep(700)
  console.log("after restore:", JSON.stringify(await netRects()))
  process.exit(0)
})().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
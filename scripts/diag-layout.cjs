const http = require("http")
const WebSocket = global.WebSocket
const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: 9222, path: p }, (r) => {
    let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)))
  }).on("error", rej)
})
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
  console.log("handles:", await ev(`JSON.stringify([...document.querySelectorAll("[data-component=resize-handle]")].map(h=>{const b=h.getBoundingClientRect();return {x:Math.round(b.x),w:Math.round(b.width),y:Math.round(b.y),h:Math.round(b.height)}}))`))
  console.log("expand btn:", await ev(`!!document.querySelector("[data-action=network-expand]")`))
  console.log("splitters:", await ev(`JSON.stringify([...document.querySelectorAll("[data-slot=network-splitter]")].map(h=>{const b=h.getBoundingClientRect();return {x:Math.round(b.x),w:Math.round(b.width)}}))`))
  console.log("network rects:", await ev(`JSON.stringify([...document.querySelectorAll("#network-panel")].map(el=>{const b=el.getBoundingClientRect();return {x:Math.round(b.x),w:Math.round(b.width),h:Math.round(b.height)}}))`))
  console.log("win:", await ev(`[window.innerWidth, window.innerHeight].join("x")`))
  process.exit(0)
})().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
// CDP Input event sanity check: does a synthetic mouse click work in Electron?
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
  const netW = async () => {
    const r = await ev(`(() => { const el = document.querySelector("#network-panel"); if (!el) return -1; return Math.round(el.getBoundingClientRect().width) })()`)
    return r
  }
  const btn = await ev(`(() => { const b = document.querySelector("[data-action=network-expand]"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), disabled: b.disabled } })()`)
  console.log("expand btn:", JSON.stringify(btn))
  const w0 = await netW()
  console.log("width before:", w0)
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: btn.x, y: btn.y, button: "left", clickCount: 1 })
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: btn.x, y: btn.y, button: "left", clickCount: 1 })
  await sleep(800)
  const w1 = await netW()
  console.log("width after CDP click expand:", w1, "delta:", w1 - w0)
  // now restore
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: btn.x, y: btn.y, button: "left", clickCount: 1 })
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: btn.x, y: btn.y, button: "left", clickCount: 1 })
  await sleep(600)
  console.log("width after restore:", await netW())
  process.exit(0)
})().catch((e) => { console.error("ERR:", e.message); process.exit(1) })
// Light/Dark theme button screenshots via CDP (Emulation.setEmulatedMedia).
const http = require("http")
const WebSocket = global.WebSocket

const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: 9222, path: p }, r => {
    let d = ""; r.on("data", c => d += c); r.on("end", () => res(JSON.parse(d)))
  }).on("error", rej)
})
;(async () => {
  const targets = await get("/json/list")
  const page = targets.find(t => t.type === "page" && !/devtools/i.test(t.url))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener("open", r))
  let id = 0
  const call = (m, p = {}) => new Promise((res, rej) => {
    const i = ++id
    const h = ev => {
      const msg = JSON.parse(ev.data)
      if (msg.id === i) { ws.removeEventListener("message", h); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result) }
    }
    ws.addEventListener("message", h)
    ws.send(JSON.stringify({ id: i, method: m, params: p }))
  })
  const evalJS = async expr => {
    const r = await call("Runtime.evaluate", { expression: expr, returnByValue: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200))
    return r.result.value
  }
  const fs = require("fs")
  fs.mkdirSync("D:\\hscode\\artifacts\\runtime", { recursive: true })

  // ensure panel open
  await evalJS(`(() => { if (!document.querySelector('#network-panel')) {
    const b = [...document.querySelectorAll('button')].find(el => /网络抓包/.test(el.textContent || el.getAttribute('aria-label') || ''))
    if (b) b.click()
  } return "ok" })()`)
  await new Promise(r => setTimeout(r, 1000))

  for (const scheme of ["light", "dark"]) {
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] })
    await new Promise(r => setTimeout(r, 600))
    const shot = await call("Page.captureScreenshot", { format: "png" })
    fs.writeFileSync(`D:\\hscode\\artifacts\\runtime\\network-buttons-${scheme}.png`, Buffer.from(shot.data, "base64"))
    // contrast probe: read computed styles of the three action buttons
    const probe = await evalJS(`(() => {
      const panel = document.querySelector('#network-panel')
      if (!panel) return "no-panel"
      return ['开始抓包','停止抓包','清空'].map(label => {
        const btn = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === label)
        if (!btn) return label + ": NOT FOUND"
        const cs = getComputedStyle(btn)
        return label + " | bg=" + cs.backgroundColor + " | color=" + cs.color + " | disabled=" + btn.disabled
      }).join("\\n")
    })()`)
    console.log(`=== ${scheme} ===`)
    console.log(probe)
  }
  process.exit(0)
})().catch(e => { console.error("FATAL:", e.message); process.exit(1) })

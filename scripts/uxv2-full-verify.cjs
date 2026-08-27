// CHANGE-024 full runtime: TCP capture → detail inspection → UDP → stop/clear
const http = require("http")
const WebSocket = global.WebSocket
const { execSync } = require("child_process")
const dgram = require("dgram")
const fs = require("fs")

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
    const h = (ev) => { const x = JSON.parse(ev.data); if (x.id === i) { ws.removeEventListener("message", h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result) } }
    ws.addEventListener("message", h); ws.send(JSON.stringify({ id: i, method: m, params: p }))
  })
  const ev = async (e) => {
    const r = await call("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  const R = {}

  // --- TCP: set filter + start ---
  await ev(`(() => {
    const p = document.querySelector('#network-panel')
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const ip = p.querySelector('input[aria-label="IP 筛选"]')
    const port = p.querySelector('input[aria-label="端口筛选"]')
    s.call(ip, '10.199.194.75'); ip.dispatchEvent(new Event('input', { bubbles: true }))
    s.call(port, '8080'); port.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await ev(`(() => { const b = [...document.querySelectorAll('#network-panel button')].find(b => b.textContent.trim() === '开始抓包'); b && b.click() })()`)
  await sleep(3000)
  R.tcpState = await ev(`document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)

  // generate traffic
  try { execSync(`curl -s -m 4 telnet://10.199.194.75:8080 </dev/null >/dev/null 2>&1 || true`, { timeout: 6000 }) } catch {}
  await sleep(3000)
  R.tcpRowCount = await ev(`document.querySelectorAll('#network-panel tbody tr').length`)
  R.tcpFirstRow = await ev(`(() => { const r = document.querySelector('#network-panel tbody tr'); return r ? [...r.querySelectorAll('td')].map(td => td.textContent.trim()) : null })()`)

  // click row → 协议头
  await ev(`(() => { const r = document.querySelector('#network-panel tbody tr'); if (r) r.click() })()`)
  await sleep(1200)
  await ev(`(() => { const t = document.querySelector('[data-slot="detail-tab-headers"]'); t && t.click() })()`)
  await sleep(800)
  R.tcpHeader = await ev(`document.querySelector('[data-slot="network-detail-body"]')?.textContent?.slice(0, 2000)`)
  // screenshot TCP detail
  const s1 = await call("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-tcp-detail.png", Buffer.from(s1.data, "base64"))

  // --- UDP: stop, clear, set port 8081, start, send local UDP ---
  await ev(`(() => { const p = document.querySelector('#network-panel'); const b = [...p.querySelectorAll('button')].find(b => b.textContent.trim() === '停止抓包'); b && b.click() })()`)
  await sleep(1200)
  await ev(`(() => { const p = document.querySelector('#network-panel'); const b = [...p.querySelectorAll('button')].find(b => b.textContent.trim() === '清空'); b && b.click() })()`)
  await sleep(800)
  await ev(`(() => {
    const p = document.querySelector('#network-panel')
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const ip = p.querySelector('input[aria-label="IP 筛选"]')
    const port = p.querySelector('input[aria-label="端口筛选"]')
    s.call(ip, '127.0.0.1'); ip.dispatchEvent(new Event('input', { bubbles: true }))
    s.call(port, '8081'); port.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await ev(`(() => { const b = [...document.querySelectorAll('#network-panel button')].find(b => b.textContent.trim() === '开始抓包'); b && b.click() })()`)
  await sleep(2000)

  // send local UDP x3
  for (let i = 0; i < 3; i++) {
    try {
      const sock = dgram.createSocket("udp4")
      await new Promise((resolve) => {
        sock.send(Buffer.from("HSCode-UDP-test-" + i + "-" + Date.now()), 8081, "127.0.0.1", () => setTimeout(() => { sock.close(); resolve() }, 200))
      })
    } catch {}
    await sleep(400)
  }
  await sleep(3000)

  R.udpState = await ev(`document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)
  R.udpCount = await ev(`document.querySelectorAll('#network-panel tbody tr').length`)
  R.udpFirstRow = await ev(`(() => { const r = [...document.querySelectorAll('#network-panel tbody tr')].find(tr => [...tr.querySelectorAll('td')][4]?.textContent.trim() === 'UDP'); return r ? [...r.querySelectorAll('td')].map(td => td.textContent.trim()) : null })()`)

  // click UDP row → 协议头
  await ev(`(() => { const r = [...document.querySelectorAll('#network-panel tbody tr')].find(tr => [...tr.querySelectorAll('td')][4]?.textContent.trim() === 'UDP'); if (r) r.click() })()`)
  await sleep(1200)
  await ev(`(() => { const t = document.querySelector('[data-slot="detail-tab-headers"]'); t && t.click() })()`)
  await sleep(800)
  R.udpHeader = await ev(`document.querySelector('[data-slot="network-detail-body"]')?.textContent?.slice(0, 1500)`)
  const s2 = await call("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-udp-detail.png", Buffer.from(s2.data, "base64"))

  // --- stop + clear regression ---
  await ev(`(() => { const p = document.querySelector('#network-panel'); const b = [...p.querySelectorAll('button')].find(b => b.textContent.trim() === '停止抓包'); b && b.click() })()`)
  await sleep(1500)
  R.stopState = await ev(`document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)
  await ev(`(() => { const p = document.querySelector('#network-panel'); const b = [...p.querySelectorAll('button')].find(b => b.textContent.trim() === '清空'); b && b.click() })()`)
  await sleep(800)
  R.clearRows = await ev(`document.querySelectorAll('#network-panel tbody tr').length`)

  console.log(JSON.stringify(R, null, 2))
  process.exit(0)
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1) })
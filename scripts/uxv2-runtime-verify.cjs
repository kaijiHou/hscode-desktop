// CHANGE-024 runtime verification (admin mode): real TCP capture to
// 10.199.194.75:8080 + local UDP sender, then TCP/UDP detail inspection
// via the 协议头 tab, plus payload/hex/ascii checks.
const http = require("http")
const WebSocket = global.WebSocket
const { execSync } = require("child_process")
const net = require("net")
const dgram = require("dgram")

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
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 300))
  return r.result.value
}

;(async () => {
  const targets = await get("/json/list")
  const page = targets.find((t) => t.type === "page" && !/devtools/i.test(t.url))
  const cdp = await CDP.connect(page.webSocketDebuggerUrl)
  await cdp.send("Runtime.enable")
  await cdp.send("Page.enable")

  const report = {}
  const fs = require("fs")

  // ---- ensure panel open ----
  await evalJS(cdp, `(() => {
    if (document.querySelector('#network-panel')) return "open"
    const b = [...document.querySelectorAll('button,[role="menuitem"]')].find(el => /网络抓包/.test(el.textContent || el.getAttribute('aria-label') || ''))
    if (b) b.click()
    return "clicked"
  })()`)
  await sleep(1000)

  // ---- set filter: IP + port 8080 ----
  await evalJS(cdp, `(() => {
    const panel = document.querySelector('#network-panel')
    const ip = panel.querySelector('input[aria-label="IP 筛选"]')
    const port = panel.querySelector('input[aria-label="端口筛选"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(ip, '10.199.194.75'); ip.dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(port, '8080'); port.dispatchEvent(new Event('input', { bubbles: true }))
    return "filter-set"
  })()`)

  // ---- start TCP capture (admin now, so WinDivertOpen succeeds) ----
  const started = await evalJS(cdp, `(() => {
    const panel = document.querySelector('#network-panel')
    const btn = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '开始抓包')
    if (!btn) return "no-start"
    if (btn.disabled) return "disabled"
    btn.click()
    return "clicked"
  })()`)
  report.start = started
  await sleep(2500)
  report.state = await evalJS(cdp, `document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)

  // ---- generate REAL TCP traffic to 10.199.194.75:8080 ----
  try {
    execSync(`curl -s -m 6 --connect-timeout 5 telnet://10.199.194.75:8080 </dev/null >/dev/null 2>&1 || true`, { timeout: 9000 })
    report.tcpTraffic = "sent"
  } catch { report.tcpTraffic = "curl-failed" }
  await sleep(2500)

  const rows = await evalJS(cdp, `(() => {
    return [...document.querySelectorAll('#network-panel tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim())).slice(0, 5)
  })()`)
  report.tcpRows = rows

  // ---- click first TCP row, switch to 协议头 tab ----
  const detailOpened = await evalJS(cdp, `(() => {
    const row = document.querySelector('#network-panel tbody tr')
    if (!row) return "no-row"
    row.click()
    return "row-clicked"
  })()`)
  await sleep(1200)
  report.detailOpened = detailOpened
  await evalJS(cdp, `(() => {
    const tab = document.querySelector('[data-slot="detail-tab-headers"]')
    if (tab) tab.click()
    return 1
  })()`)
  await sleep(800)
  const headerText = await evalJS(cdp, `document.querySelector('[data-slot="network-detail-body"]')?.textContent?.slice(0, 1500)`)
  report.tcpHeaderText = headerText

  // screenshot TCP detail
  const shot1 = await cdp.send("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-tcp-detail.png", Buffer.from(shot1.data, "base64"))

  // ---- generate REAL UDP traffic locally ----
  const udpResult = await new Promise((resolve) => {
    const socket = dgram.createSocket("udp4")
    socket.bind(0, "127.0.0.1", () => {
      const msg = Buffer.from("HSCode-UDP-runtime-" + Date.now())
      socket.send(msg, 8081, "127.0.0.1", () => {
        setTimeout(() => { socket.close(); resolve({ sent: msg.length }) }, 500)
      })
    })
    socket.on("error", (e) => resolve({ error: e.message }))
  })
  report.udpLocal = udpResult

  // clear TCP filter, start empty capture to catch loopback UDP
  await evalJS(cdp, `(() => {
    const panel = document.querySelector('#network-panel')
    const stop = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '停止抓包')
    if (stop) stop.click()
    return 1
  })()`)
  await sleep(1200)
  await evalJS(cdp, `(() => {
    const panel = document.querySelector('#network-panel')
    const ip = panel.querySelector('input[aria-label="IP 筛选"]')
    const port = panel.querySelector('input[aria-label="端口筛选"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(ip, ''); ip.dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(port, '8081'); port.dispatchEvent(new Event('input', { bubbles: true }))
    const clr = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '清空')
    if (clr) clr.click()
    const start = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '开始抓包')
    if (start) start.click()
    return "udp-capture-started"
  })()`)
  await sleep(1500)
  // send MORE UDP
  const socket2 = dgram.createSocket("udp4")
  await new Promise((resolve) => {
    socket2.send(Buffer.from("udp-packet-two-" + Date.now()), 8081, "127.0.0.1", () => setTimeout(() => { socket2.close(); resolve() }, 400))
  })
  await sleep(2000)

  const udpRows = await evalJS(cdp, `(() => {
    return [...document.querySelectorAll('#network-panel tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim())).filter(r => r[4] === 'UDP').slice(0, 3)
  })()`)
  report.udpRows = udpRows

  // click a UDP row → headers tab
  await evalJS(cdp, `(() => {
    const rows = [...document.querySelectorAll('#network-panel tbody tr')]
    const udpRow = rows.find(tr => tr.querySelectorAll('td')[4]?.textContent.trim() === 'UDP')
    if (udpRow) udpRow.click()
    return udpRow ? "udp-row-clicked" : "no-udp-row"
  })()`)
  await sleep(1200)
  await evalJS(cdp, `(() => {
    const tab = document.querySelector('[data-slot="detail-tab-headers"]')
    if (tab) tab.click()
    return 1
  })()`)
  await sleep(800)
  report.udpHeaderText = await evalJS(cdp, `document.querySelector('[data-slot="network-detail-body"]')?.textContent?.slice(0, 1200)`)
  const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync("D:\\hscode\\artifacts\\runtime\\network-v2-udp-detail.png", Buffer.from(shot2.data, "base64"))

  // ---- stop + clear (regression) ----
  await evalJS(cdp, `(() => {
    const panel = document.querySelector('#network-panel')
    const stop = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '停止抓包')
    if (stop) stop.click()
    return 1
  })()`)
  await sleep(1500)
  report.stateAfterStop = await evalJS(cdp, `document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)
  await evalJS(cdp, `(() => {
    const panel = document.querySelector('#network-panel')
    const clr = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '清空')
    if (clr) clr.click()
    return 1
  })()`)
  await sleep(800)
  report.rowsAfterClear = await evalJS(cdp, `document.querySelectorAll('#network-panel tbody tr').length`)

  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1) })
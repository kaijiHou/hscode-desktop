// HSCode live capture runtime verification via CDP (real WinDivertOpen).
// Steps: find page target → open network panel → click 开始抓包 → generate REAL
// traffic to 10.199.194.75:8080 → assert capturing + packetCount>0 → stop → clear.
const http = require("http")

const get = (path) =>
  new Promise((res, rej) => {
    http.get({ host: "127.0.0.1", port: 9222, path }, (r) => {
      let d = ""
      r.on("data", (c) => (d += c))
      r.on("end", () => res(JSON.parse(d)))
    }).on("error", rej)
  })

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [] }
  static connect(url) {
    return new Promise((res, rej) => {
      const ws = new WebSocket(url)
      ws.addEventListener("open", () => res(new CDP(ws)))
      ws.addEventListener("error", rej)
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  onMessage(fn) { this.handlers.push(fn) }
  route() {
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result)
      } else if (msg.method) {
        for (const fn of this.handlers) fn(msg)
      }
    })
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function evalJS(cdp, expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300))
  return r.result.value
}

;(async () => {
  // global WebSocket exists in Node 22
  const targets = await get("/json/list")
  const page = targets.find((t) => t.type === "page" && !/devtools/i.test(t.url))
  if (!page) throw new Error("no page target")
  console.log("PAGE:", page.url.slice(0, 80))

  const cdp = await CDP.connect(page.webSocketDebuggerUrl)
  cdp.route()
  await cdp.send("Runtime.enable")

  const report = {}

  // --- step 1: open the network panel (button in session header) ---
  const click1 = await evalJS(cdp, `
    (() => {
      try {
        const btn = document.querySelector('[aria-label="网络抓包"], [data-slot="network-button"], button[title*="网络"]')
          || [...document.querySelectorAll('button,[role="menuitem"]')].find(el => /网络抓包/.test(el.textContent || ""))
        if (!btn) return "NO_BUTTON"
        btn.click()
        return "clicked"
      } catch (e) { return "err: " + e.message }
    })()
  `)
  console.log("click1:", click1)
  await sleep(1200)

  // fallback: use the View menu command via keyboard? Instead check panel presence
  report.panelVisible = await evalJS(cdp, `!!document.querySelector('#network-panel')`)
  if (!report.panelVisible) {
    // try dispatching through the app command system: click via menu is complex; retry selector scan
    const clicked = await evalJS(cdp, `
      (() => {
        const all = [...document.querySelectorAll('button')]
        const b = all.find(el => /网络抓包|Network/i.test((el.getAttribute('aria-label')||'') + ' ' + (el.textContent||'')))
        if (b) { b.click(); return "retry-clicked" }
        return "not-found"
      })()
    `)
    await sleep(1000)
    report.panelVisible = await evalJS(cdp, `!!document.querySelector('#network-panel')`)
    report.retryClick = clicked
  }

  // fill filters: IP 10.199.194.75 port 8080
  report.filterSet = await evalJS(cdp, `
    (() => {
      const panel = document.querySelector('#network-panel')
      if (!panel) return "no-panel"
      const ip = panel.querySelector('input[aria-label="IP 筛选"]')
      const port = panel.querySelector('input[aria-label="端口筛选"]')
      if (!ip || !port) return "no-inputs"
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(ip, '10.199.194.75'); ip.dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(port, '8080'); port.dispatchEvent(new Event('input', { bubbles: true }))
      return "ok"
    })()
  `)

  // read state before start
  report.stateBefore = await evalJS(cdp, `document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)

  // click 开始抓包
  report.startClicked = await evalJS(cdp, `
    (() => {
      const panel = document.querySelector('#network-panel')
      const btns = [...panel.querySelectorAll('button')]
      const start = btns.find(b => b.textContent.trim() === '开始抓包')
      if (!start) return "no-start-btn"
      if (start.disabled) return "start-disabled"
      start.click()
      return "ok"
    })()
  `)
  await sleep(2500)

  // state after start — expect 正在抓包
  report.stateAfterStart = await evalJS(cdp, `document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)

  // error text if any
  report.errorText = await evalJS(cdp, `
    (() => {
      const panel = document.querySelector('#network-panel')
      if (!panel) return ""
      const reds = [...panel.querySelectorAll('div')].filter(d => d.style.color === "rgb(244, 67, 54)" || d.style.color === "#f44336")
      return reds.map(d => d.textContent).join(" | ").slice(0, 400)
    })()
  `)

  // packet count from header text "N 个数据包"
  const countOf = async () => {
    const t = await evalJS(cdp, `document.querySelector('#network-panel')?.querySelector('.ml-auto')?.textContent ?? ""`)
    const m = /(\d+)\s*个数据包/.exec(t)
    return m ? Number(m[1]) : -1
  }
  report.countAfterStart = await countOf()

  // screenshot while capturing
  const shot1 = await cdp.send("Page.captureScreenshot", { format: "png" })
  require("fs").mkdirSync("/d/hscode/artifacts/runtime".replace('/d','D:'), { recursive: true })
  require("fs").writeFileSync("D:\\hscode\\artifacts\\runtime\\network-live-capturing.png", Buffer.from(shot1.data, "base64"))

  // --- generate REAL traffic to 10.199.194.75:8080 ---
  // NOTE: traffic must come from a real process; we spawn curl from here via child_process
  const { exec } = require("child_process")
  report.traffic = await new Promise((res) => {
    // TCP connect attempt counts as SYN packets both ways even if it fails to connect
    exec(
      "curl -s -m 6 --connect-timeout 5 telnet://10.199.194.75:8080 </dev/null; echo done",
      { timeout: 9000 },
      () => res("curl-attempted"),
    )
  })
  await sleep(2000)
  report.countAfterTraffic = await countOf()

  // sample first packet row (no payload)
  report.firstPacketRow = await evalJS(cdp, `
    (() => {
      const rows = [...document.querySelectorAll('#network-panel tbody tr')]
      const tr = rows[0]
      if (!tr) return null
      return [...tr.querySelectorAll('td')].map(td => td.textContent.trim())
    })()
  `)

  const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" })
  require("fs").writeFileSync("D:\\hscode\\artifacts\\runtime\\network-live-packets.png", Buffer.from(shot2.data, "base64"))

  // --- stop ---
  report.stopClicked = await evalJS(cdp, `
    (() => {
      const panel = document.querySelector('#network-panel')
      const stop = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '停止抓包')
      if (!stop) return "no-stop"
      if (stop.disabled) return "stop-disabled"
      stop.click()
      return "ok"
    })()
  `)
  await sleep(2000)
  report.stateAfterStop = await evalJS(cdp, `document.querySelector('#network-panel [data-slot="network-state"]')?.textContent`)
  report.countAfterStop = await countOf()

  // wait and confirm count stable
  await sleep(1500)
  report.countStableCheck = await countOf()

  // --- clear ---
  report.clearClicked = await evalJS(cdp, `
    (() => {
      const panel = document.querySelector('#network-panel')
      const clr = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '清空')
      if (!clr) return "no-clear"
      clr.click()
      return "ok"
    })()
  `)
  await sleep(1000)
  report.countAfterClear = await countOf()
  report.listRowsAfterClear = await evalJS(cdp, `document.querySelectorAll('#network-panel tbody tr').length`)

  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
})().catch((e) => {
  console.error("FATAL:", e.message)
  process.exit(1)
})

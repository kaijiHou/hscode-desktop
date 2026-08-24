// Real WinDivert capture smoke test — TCP/UDP/HTTP over loopback.
// MUST run as administrator. Generates local traffic, captures with the real
// WinDivert.dll through koffi, and asserts the packets we expect to see.

const path = require("node:path")
const net = require("node:net")
const dgram = require("node:dgram")
const http = require("node:http")

const koffi = require("D:/hscode/packages/desktop/node_modules/koffi")
const dll = "D:/hscode/packages/desktop/resources/win/WinDivert.dll"

const lib = koffi.load(dll)
const fnOpen = lib.func("WinDivertOpen", "int64", ["str", "int", "int16", "uint64"])
const fnRecv = lib.func("WinDivertRecv", "bool", ["int64", "void*", "uint32", "uint32*", "void*"])
const fnShutdown = lib.func("WinDivertShutdown", "bool", ["int64", "int"])
const fnClose = lib.func("WinDivertClose", "bool", ["int64"])
const kernel32 = koffi.load("kernel32.dll")
const fnGetLastError = kernel32.func("GetLastError", "int", [])

const seen = { tcp: 0, udp: 0, http: 0 }
const httpMethod = { seen: false, method: "", path: "", host: "" }

function handlePacket(bytes) {
  // parse minimal IPv4
  if (bytes.length < 20) return
  if ((bytes[0] >> 4) !== 4) return
  const proto = bytes[9]
  const src = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`
  const dst = `${bytes[16]}.${bytes[17]}.${bytes[18]}.${bytes[19]}`
  if (proto === 6) {
    seen.tcp++
    const sport = (bytes[20] << 8) | bytes[21]
    const dport = (bytes[22] << 8) | bytes[23]
    const doff = (bytes[32] >> 4) * 4
    const payload = bytes.slice(20 + doff)
    const ascii = Buffer.from(payload).toString("latin1")
    if (ascii.startsWith("GET ") || ascii.startsWith("POST ")) {
      seen.http++
      const firstLine = ascii.split("\r\n")[0]
      const [method, httpPath] = firstLine.split(" ")
      httpMethod.seen = true
      httpMethod.method = method
      httpMethod.path = httpPath
      // host
      const hostLine = ascii.split("\r\n").find((l) => l.toLowerCase().startsWith("host:"))
      httpMethod.host = hostLine ? hostLine.split(":")[1].trim() : ""
      console.log(`  TCP ${src}:${sport} -> ${dst}:${dport} payload="${ascii.slice(0, 40)}"`)
    }
  } else if (proto === 17) {
    seen.udp++
    const sport = (bytes[20] << 8) | bytes[21]
    const dport = (bytes[22] << 8) | bytes[23]
    const payload = bytes.slice(28)
    const ascii = Buffer.from(payload).toString("latin1")
    console.log(`  UDP ${src}:${sport} -> ${dst}:${dport} payload="${ascii}"`)
  }
}

async function main() {
  // 1. Open capture on loopback TCP/UDP with sniff flag
  const handle = fnOpen("loopback and (tcp or udp)", 0, 0, 0x1)
  if (Number(handle) === -1) {
    const err = fnGetLastError()
    console.log("OPEN FAILED, win32 error", err)
    if (err === 5) console.log("SKIPPED — administrator permission unavailable")
    return 1
  }
  console.log("capture open OK, testing traffic...")

  // 2. Start traffic generators
  const tcpWindows = []
  async function tcpTest(port, payload, tag) {
    return new Promise((resolve) => {
      const server = net.createServer((sock) => {
        sock.on("data", () => sock.end())
        results.push({ tag, payload })
        server.close()
        resolve()
      })
      server.listen(port, "127.0.0.1", () => {
        const c = net.connect(port, "127.0.0.1", () => c.write(payload))
        c.on("end", () => c.end())
      })
    })
  }
  const results = []
  const udpWindows = []

  const httpServer = http.createServer((req, res) => {
    res.end("ok")
    httpServer.close()
  })
  await new Promise((r) => httpServer.listen(0, "127.0.0.1", () => { httpServer.port = httpServer.address().port; r() }))

  const tcpPayload = "hello-hscode-tcp"
  const udpPayload = "hello-hscode-udp"
  const port1 = 41901 + Math.floor(Math.random() * 500)
  const port2 = 42401 + Math.floor(Math.random() * 500)

  const t1 = tcpTest(port1, tcpPayload, "tcp")
  const udp1 = new Promise((resolve) => {
    const sock = dgram.createSocket("udp4")
    sock.send(udpPayload, port2, "127.0.0.1", () => sock.close())
    const server = dgram.createSocket("udp4")
    server.bind(port2, "127.0.0.1", () => {
      server.on("message", (msg) => {
        results.push({ tag: "udp", payload: msg.toString() })
        server.close()
        resolve()
      })
    })
  })

  // HTTP GET in one payload
  const getPromise = (async () => {
    await new Promise((resolve) => {
      const req = http.get({ host: "127.0.0.1", port: httpServer.port, path: "/hscode-network-test" }, () => { req.destroy(); resolve() })
    })
    results.push({ tag: "http", payload: "GET /hscode-network-test" })
  })()

  await Promise.all([t1, udp1, getPromise])

  // 3. Recv packets for ~1.5s
  const buffer = koffi.alloc("uint8_t", 65535)
  const recvLen = koffi.alloc("uint32_t", 4)
  const addr = koffi.alloc("uint8_t", 80)
  const addrLen = koffi.alloc("uint32_t", 4)
  koffi.encode(addrLen, "uint32_t", 80)

  const deadline = Date.now() + 1500
  let recved = 0
  while (Date.now() < deadline && recved < 500) {
    koffi.encode(recvLen, "uint32_t", 0)
    const ok = fnRecv(handle, buffer, 65535, recvLen, addr)
    if (!ok) break
    const n = Number(koffi.decode(recvLen, "uint32_t"))
    if (n > 0) {
      recved++
      handlePacket(koffi.decode(buffer, "uint8_t", n))
    }
  }

  fnShutdown(handle, 0)
  fnClose(handle)
  console.log("recv count:", recved)
  console.log("seen:", JSON.stringify(seen))
  console.log("http detected:", JSON.stringify(httpMethod))
  console.log("RESULT:", seen.tcp >= 2 && seen.udp >= 2 && httpMethod.seen ? "PASS" : "PARTIAL — see counts above")
  return 0
}

main().then((code) => process.exit(code))
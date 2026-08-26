import { describe, expect, test } from "bun:test"
import { buildDetail, detectHttp, formatAscii, formatHex, parsePacket } from "./parser"
import { FilterValidationError, parseFilter } from "./filter"
import { CaptureStateMachine, DetailCache, PacketRingBuffer, ReentrantStartError, StopWhenIdleError } from "./capture-service-core"

// --- N2 / N3 / N4: real byte fixtures --------------------------------------

// IPv4 + TCP, SYN-ACK, 20B IPv4 header + 20B TCP header + payload "hello-hscode-tcp"
function makeIpv4Tcp(): Uint8Array {
  const raw = new Uint8Array(20 + 20 + 16)
  // IPv4 header
  raw[0] = 0x45 // version 4, IHL 5
  raw[1] = 0x00
  raw[2] = 0x00
  raw[3] = 56 // total length
  raw[8] = 64 // TTL
  raw[9] = 6 // protocol TCP
  raw[10] = 0x00
  raw[11] = 0x00
  raw[12] = 192 // src 192.168.1.10
  raw[13] = 168
  raw[14] = 1
  raw[15] = 10
  raw[16] = 192 // dst 192.168.1.20
  raw[17] = 168
  raw[18] = 1
  raw[19] = 20
  // TCP header
  raw[20] = 0x1a; raw[21] = 0x0a // src port 6666
  raw[22] = 0x1f; raw[23] = 0x90 // dst port 8080
  raw[24] = 0x00; raw[25] = 0x00; raw[26] = 0x00; raw[27] = 0x01 // seq 1
  raw[28] = 0x00; raw[29] = 0x00; raw[30] = 0x00; raw[31] = 0x02 // ack 2
  raw[32] = 0x50 // data offset 5
  raw[33] = 0x12 // SYN+ACK
  raw[34] = 0x00; raw[35] = 0x00
  // payload
  const payload = "hello-hscode-tcp"
  for (let i = 0; i < payload.length; i++) raw[40 + i] = payload.charCodeAt(i)
  return raw
}

// IPv4 + UDP, payload "hello-hscode-udp"
function makeIpv4Udp(): Uint8Array {
  const payload = "hello-hscode-udp"
  const raw = new Uint8Array(20 + 8 + payload.length)
  raw[0] = 0x45
  raw[2] = 0x00
  raw[3] = 20 + 8 + payload.length
  raw[9] = 17 // UDP
  raw[12] = 127 // src 127.0.0.1
  raw[13] = 0
  raw[14] = 0
  raw[15] = 1
  raw[16] = 127 // dst 127.0.0.1
  raw[17] = 0
  raw[18] = 0
  raw[19] = 1
  raw[20] = 0x13; raw[21] = 0x88 // src port 5000
  raw[22] = 0x17; raw[23] = 0x70 // dst port 6000
  raw[24] = 0x00; raw[25] = 0x00 // UDP length placeholder
  for (let i = 0; i < payload.length; i++) raw[28 + i] = payload.charCodeAt(i)
  return raw
}

// IPv6 + TCP (minimal realistic header: 40B v6 + 20B tcp)
function makeIpv6Tcp(): Uint8Array {
  const raw = new Uint8Array(40 + 20 + 4)
  raw[0] = 0x60 // version 6
  raw[4] = 0x00
  raw[5] = 24 // payload length (tcp header + 4)
  raw[6] = 6 // next header TCP
  raw[7] = 64 // hop limit
  // src fe80::1 (16 bytes at offset 8)
  raw[8] = 0xfe; raw[9] = 0x80
  raw[10] = 0; raw[11] = 0
  raw[12] = 0; raw[13] = 0
  raw[14] = 0; raw[15] = 0
  raw[16] = 0; raw[17] = 0
  raw[18] = 0; raw[19] = 0
  raw[20] = 0; raw[21] = 0
  raw[22] = 0; raw[23] = 1
  // dst fe80::2 (16 bytes at offset 24)
  raw[24] = 0xfe; raw[25] = 0x80
  raw[26] = 0; raw[27] = 0
  raw[28] = 0; raw[29] = 0
  raw[30] = 0; raw[31] = 0
  raw[32] = 0; raw[33] = 0
  raw[34] = 0; raw[35] = 0
  raw[36] = 0; raw[37] = 0
  raw[38] = 0; raw[39] = 2
  // TCP header
  raw[40] = 0x1f; raw[41] = 0x90 // src 8080
  raw[42] = 0x1a; raw[43] = 0x0a // dst 6666
  raw[44] = 0x00; raw[45] = 0x00; raw[46] = 0x00; raw[47] = 0x01
  raw[48] = 0x00; raw[49] = 0x00; raw[50] = 0x00; raw[51] = 0x00
  raw[52] = 0x50
  raw[53] = 0x18 // PSH+ACK
  raw[54] = 0x00; raw[55] = 0x00
  // payload "ping"
  const payload = "ping"
  for (let i = 0; i < payload.length; i++) raw[60 + i] = payload.charCodeAt(i)
  return raw
}

// HTTP request in a single TCP payload
function makeHttpPacket(): Uint8Array {
  const request = "GET /api/test HTTP/1.1\r\nHost: localhost:8080\r\nUser-Agent: test\r\n\r\n"
  const payload = new TextEncoder().encode(request)
  const raw = new Uint8Array(20 + 20 + payload.length)
  raw[0] = 0x45
  raw[2] = 0x00
  raw[3] = 20 + 20 + payload.length
  raw[9] = 6
  raw[12] = 127; raw[13] = 0; raw[14] = 0; raw[15] = 1
  raw[16] = 127; raw[17] = 0; raw[18] = 0; raw[19] = 1
  raw[20] = 0x1a; raw[21] = 0x0a // src 6666
  raw[22] = 0x00; raw[23] = 0x50 // dst 80
  raw[24] = 0x00; raw[25] = 0x00; raw[26] = 0x00; raw[27] = 0x01
  raw[28] = 0x00; raw[29] = 0x00; raw[30] = 0x00; raw[31] = 0x00
  raw[32] = 0x50
  raw[33] = 0x18
  raw[34] = 0x00; raw[35] = 0x00
  for (let i = 0; i < payload.length; i++) raw[40 + i] = payload[i]
  return raw
}

describe("N2 — IPv4 TCP packet parser", () => {
  test("parses IP, ports, flags, payload, length from real bytes", () => {
    const raw = makeIpv4Tcp()
    const s = parsePacket(raw, { timestamp: 1234, direction: "outbound" })
    expect(s.ipVersion).toBe(4)
    expect(s.protocol).toBe("TCP")
    expect(s.sourceIp).toBe("192.168.1.10")
    expect(s.destinationIp).toBe("192.168.1.20")
    expect(s.sourcePort).toBe(6666)
    expect(s.destinationPort).toBe(8080)
    expect(s.tcp?.syn).toBe(true)
    expect(s.tcp?.ack).toBe(true)
    expect(s.tcp?.fin).toBe(false)
    expect(s.tcp?.rst).toBe(false)
    expect(s.tcp?.sequence).toBe(1)
    expect(s.tcp?.acknowledgment).toBe(2)
    expect(s.length).toBe(56)
    expect(s.payloadLength).toBe(16)
    expect(s.timestamp).toBe(1234)
    expect(s.direction).toBe("outbound")
  })
})

describe("N3 — UDP packet parser", () => {
  test("parses src/dst/ports/payload from real bytes", () => {
    const raw = makeIpv4Udp()
    const s = parsePacket(raw)
    expect(s.ipVersion).toBe(4)
    expect(s.protocol).toBe("UDP")
    expect(s.sourceIp).toBe("127.0.0.1")
    expect(s.destinationIp).toBe("127.0.0.1")
    expect(s.sourcePort).toBe(5000)
    expect(s.destinationPort).toBe(6000)
    expect(s.payloadLength).toBe(16)
    expect(s.tcp).toBeUndefined()
  })
})

describe("N4 — IPv6 packet parser", () => {
  test("parses IPv6 addresses correctly", () => {
    const raw = makeIpv6Tcp()
    const s = parsePacket(raw)
    expect(s.ipVersion).toBe(6)
    expect(s.protocol).toBe("TCP")
    expect(s.sourceIp).toBe("fe80::1")
    expect(s.destinationIp).toBe("fe80::2")
    expect(s.sourcePort).toBe(8080)
    expect(s.destinationPort).toBe(6666)
  })
})

describe("N5 — HTTP detection", () => {
  test("detects HTTP request in a single payload", () => {
    const raw = makeHttpPacket()
    const s = parsePacket(raw)
    expect(s.protocol).toBe("TCP")
    expect(s.application).toBeDefined()
    expect(s.application?.protocol).toBe("HTTP")
    expect(s.application?.method).toBe("GET")
    expect(s.application?.path).toBe("/api/test")
    expect(s.application?.version).toBe("HTTP/1.1")
    expect(s.application?.host).toBe("localhost:8080")
  })

  test("does not misdetect binary payload as HTTP", () => {
    const raw = makeIpv4Udp()
    const s = parsePacket(raw)
    expect(s.application).toBeUndefined()
  })

  test("does not misdetect a plain TCP binary payload as HTTP", () => {
    const raw = makeIpv4Tcp()
    const s = parsePacket(raw)
    expect(s.application).toBeUndefined()
  })
})

describe("N6 — HEX / ASCII formatting", () => {
  test("formats hex dump with address, hex pairs and ascii", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x41, 0x42, 0xff, 0x48, 0x49])
    const hex = formatHex(bytes)
    expect(hex).toContain("0000")
    expect(hex).toContain("00 01 41 42 ff 48 49")
    expect(formatAscii(bytes)).toBe("..AB.HI")
  })

  test("hex table shows offsets and groups", () => {
    const bytes = new Uint8Array([0x55, 0xaa, 0x01, 0x00, 0x12, 0x34, 0x56, 0x78])
    const hex = formatHex(bytes)
    expect(hex).toContain("55 aa 01 00")
    expect(hex).toContain("12 34 56 78")
  })
})

describe("N1 — filter parser", () => {
  test("tcp maps to winDivert protocol filter", () => {
    const f = parseFilter("tcp")
    expect(f.display).toBe("tcp")
    // Real WinDivert syntax (verified via WinDivertHelperCompileFilter):
    // ip.Protocol covers IPv4; IPv6 traffic without a protocol clause still
    // matches when using layer NETWORK — see filter.ts buildProtocolClause.
    expect(f.windivert).toContain("ip.Protocol == 6")
  })

  test("udp.port == 5000 maps to winDivert ports", () => {
    const f = parseFilter("udp.port == 5000")
    expect(f.windivert).toContain("17")
    expect(f.windivert).toContain("udp.SrcPort == 5000")
    expect(f.windivert).toContain("udp.DstPort == 5000")
  })

  test("tcp.port == 22122 maps correctly", () => {
    const f = parseFilter("tcp.port == 22122")
    expect(f.windivert).toContain("6")
    expect(f.windivert).toContain("tcp.SrcPort == 22122")
  })

  test("src.ip / dst.ip map to ipv4 address fields", () => {
    const f = parseFilter("src.ip == 192.168.1.10")
    expect(f.windivert).toContain("ip.SrcAddr == 192.168.1.10")
    const g = parseFilter("dst.ip == 192.168.1.20")
    expect(g.windivert).toContain("ip.DstAddr == 192.168.1.20")
  })

  test("invalid filter raises a clear validation error", () => {
    expect(() => parseFilter("abc xyz !!!")).toThrow(FilterValidationError)
  })

  test("invalid port raises validation error", () => {
    expect(() => parseFilter("tcp.port == 99999")).toThrow(FilterValidationError)
  })

  test("invalid ip raises validation error", () => {
    expect(() => parseFilter("src.ip == 999.1.1.1")).toThrow(FilterValidationError)
  })
})

describe("N7 — capture state machine", () => {
  test("idle → starting → capturing → stopping → idle", () => {
    const m = new CaptureStateMachine()
    expect(m.current).toBe("idle")
    m.start()
    expect(m.current).toBe("starting")
    m.markCapturing()
    expect(m.current).toBe("capturing")
    m.stop()
    expect(m.current).toBe("stopping")
    m.finishStop()
    expect(m.current).toBe("idle")
  })

  test("driver load failure → error state", () => {
    const m = new CaptureStateMachine()
    m.start()
    m.fail({ code: "DLL_NOT_FOUND", message: "no dll" })
    expect(m.current).toBe("error")
    expect(m.snapshot().error?.code).toBe("DLL_NOT_FOUND")
  })

  test("reentrant start throws", () => {
    const m = new CaptureStateMachine()
    m.start()
    expect(() => m.start()).toThrow(ReentrantStartError)
  })

  test("stop when idle throws", () => {
    const m = new CaptureStateMachine()
    expect(() => m.stop()).toThrow(StopWhenIdleError)
  })
})

describe("N8 — packet ring buffer", () => {
  test("drops oldest packets beyond capacity", () => {
    const ring = new PacketRingBuffer(3)
    for (let i = 0; i < 5; i++) {
      ring.push({ id: `p${i}`, timestamp: i } as never)
    }
    expect(ring.length).toBe(3)
    expect(ring.all[0].id).toBe("p2")
    expect(ring.all[2].id).toBe("p4")
  })
})

describe("Detail cache", () => {
  test("evicts oldest entries beyond capacity", () => {
    const cache = new DetailCache(2)
    cache.set({ summary: { id: "a" }, payload: new Uint8Array() } as never)
    cache.set({ summary: { id: "b" }, payload: new Uint8Array() } as never)
    cache.set({ summary: { id: "c" }, payload: new Uint8Array() } as never)
    expect(cache.size).toBe(2)
    expect(cache.get("a")).toBeUndefined()
    expect(cache.get("c")).toBeDefined()
  })
})

describe("Packet detail builder", () => {
  test("extracts payload, hex and ascii from raw bytes", () => {
    const raw = makeIpv4Tcp()
    const s = parsePacket(raw)
    const detail = buildDetail(s, raw)
    expect(detail.payload.length).toBe(16)
    expect(detail.hex).toContain("hello-hscode-tcp".split("").map((c) => c.charCodeAt(0).toString(16)).slice(0, 2).join(" "))
    expect(detail.ascii).toBe("hello-hscode-tcp")
  })
})

// N5 HTTP direct function coverage (single payload boundary)
describe("detectHttp edge cases", () => {
  test("rejects payload without a request line", () => {
    expect(detectHttp(new TextEncoder().encode("random binary data here"))).toBeUndefined()
  })
  test("detects POST requests", () => {
    const pkt = new TextEncoder().encode("POST /upload HTTP/1.1\r\nHost: x\r\n\r\n")
    const info = detectHttp(pkt)
    expect(info?.method).toBe("POST")
    expect(info?.path).toBe("/upload")
  })
})
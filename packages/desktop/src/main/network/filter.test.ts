import { describe, expect, test } from "bun:test"
import { parseFilter, FilterValidationError } from "./filter"

describe("parseFilter — empty / basic", () => {
  test("empty string → display empty, windivert true", () => {
    const r = parseFilter("")
    expect(r.display).toBe("")
    expect(r.windivert).toBe("true")
  })

  test("tcp → protocol clause", () => {
    const r = parseFilter("tcp")
    expect(r.display).toBe("tcp")
    expect(r.windivert).toContain("ip.Protocol == 6")
  })

  test("udp → protocol clause", () => {
    const r = parseFilter("udp")
    expect(r.display).toBe("udp")
    expect(r.windivert).toContain("ip.Protocol == 17")
  })

  test("icmp → protocol clause", () => {
    const r = parseFilter("icmp")
    expect(r.display).toBe("icmp")
    expect(r.windivert).toContain("ip.Protocol == 1")
  })
})

describe("parseFilter — generic port / ip / direction", () => {
  test("port == 22122 → valid", () => {
    const r = parseFilter("port == 22122")
    expect(r.display).toBe("port == 22122")
    expect(r.windivert).toContain("tcp.SrcPort == 22122")
    expect(r.windivert).toContain("udp.SrcPort == 22122")
  })

  test("ip == 192.168.1.10 → valid", () => {
    const r = parseFilter("ip == 192.168.1.10")
    expect(r.display).toBe("ip == 192.168.1.10")
    expect(r.windivert).toContain("ip.SrcAddr == 192.168.1.10")
    expect(r.windivert).toContain("ip.DstAddr == 192.168.1.10")
  })

  test("direction == inbound → valid", () => {
    const r = parseFilter("direction == inbound")
    expect(r.display).toBe("direction == inbound")
    expect(r.windivert).toContain("inbound")
    expect(r.windivert).not.toContain("direction == 1")
  })

  test("direction == outbound → valid", () => {
    const r = parseFilter("direction == outbound")
    expect(r.display).toBe("direction == outbound")
    expect(r.windivert).toContain("outbound")
    expect(r.windivert).not.toContain("direction == 0")
  })
})

describe("parseFilter — specific port / ip", () => {
  test("tcp.port == 22122 → valid", () => {
    const r = parseFilter("tcp.port == 22122")
    expect(r.windivert).toContain("tcp.SrcPort == 22122")
    expect(r.windivert).toContain("tcp.DstPort == 22122")
  })

  test("udp.port == 53 → valid", () => {
    const r = parseFilter("udp.port == 53")
    expect(r.windivert).toContain("udp.SrcPort == 53")
  })

  test("src.ip == 10.0.0.1 → valid", () => {
    const r = parseFilter("src.ip == 10.0.0.1")
    expect(r.windivert).toContain("ip.SrcAddr == 10.0.0.1")
  })

  test("dst.ip == 10.0.0.2 → valid", () => {
    const r = parseFilter("dst.ip == 10.0.0.2")
    expect(r.windivert).toContain("ip.DstAddr == 10.0.0.2")
  })
})

describe("parseFilter — compound AND", () => {
  test("tcp and port == 22122 → AND semantics", () => {
    const r = parseFilter("tcp and port == 22122")
    expect(r.windivert).toContain(" and ")
    expect(r.windivert).toContain("ip.Protocol == 6")
    expect(r.windivert).toContain("tcp.SrcPort == 22122")
  })

  test("tcp and ip == 192.168.1.10 → AND semantics", () => {
    const r = parseFilter("tcp and ip == 192.168.1.10")
    expect(r.windivert).toContain(" and ")
    expect(r.windivert).toContain("ip.SrcAddr == 192.168.1.10")
  })

  test("udp and direction == outbound → AND semantics", () => {
    const r = parseFilter("udp and direction == outbound")
    expect(r.windivert).toContain(" and ")
    expect(r.windivert).toContain("outbound")
    expect(r.windivert).not.toContain("direction == 0")
  })

  test("ip == 192.168.1.10 and port == 22122 → AND semantics", () => {
    const r = parseFilter("ip == 192.168.1.10 and port == 22122")
    expect(r.windivert).toContain(" and ")
  })

  test("tcp and ip == 1.2.3.4 and port == 80 and direction == outbound → full compound", () => {
    const r = parseFilter("tcp and ip == 1.2.3.4 and port == 80 and direction == outbound")
    expect(r.windivert).toContain(" and ")
    expect(r.windivert).toContain("ip.Protocol == 6")
    expect(r.windivert).toContain("ip.SrcAddr == 1.2.3.4")
    expect(r.windivert).toContain("tcp.SrcPort == 80")
    expect(r.windivert).toContain("outbound")
    expect(r.windivert).not.toContain("direction == 0")
  })
})

describe("parseFilter — validation errors", () => {
  test("invalid IP → error", () => {
    expect(() => parseFilter("ip == 999.999.999.999")).toThrow(FilterValidationError)
  })

  test("port == -1 → error", () => {
    expect(() => parseFilter("port == -1")).toThrow(FilterValidationError)
  })

  test("port == 65536 → error", () => {
    expect(() => parseFilter("port == 65536")).toThrow(FilterValidationError)
  })

  test("port == abc → error", () => {
    expect(() => parseFilter("port == abc")).toThrow(FilterValidationError)
  })

  test("unknown field → error", () => {
    expect(() => parseFilter("bogus == 123")).toThrow(FilterValidationError)
  })
})

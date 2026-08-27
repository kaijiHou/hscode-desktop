/**
 * CaptureService core unit tests — PacketRingBuffer eviction, DetailCache lifecycle.
 */
import { describe, expect, test } from "bun:test"
import { PacketRingBuffer, DetailCache } from "./capture-service-core"
import type { PacketSummary } from "./parser"

function makeSummary(id: string): PacketSummary {
  return {
    id,
    timestamp: Date.now(),
    direction: "inbound",
    ipVersion: 4,
    protocol: "TCP",
    sourceIp: "127.0.0.1",
    destinationIp: "127.0.0.1",
    sourcePort: 80,
    destinationPort: 12345,
    length: 60,
    payloadLength: 0,
  }
}

describe("PacketRingBuffer — synchronized eviction", () => {
  test("push returns empty array when under capacity", () => {
    const ring = new PacketRingBuffer(3)
    const evicted = ring.push(makeSummary("a"))
    expect(evicted).toEqual([])
    expect(ring.length).toBe(1)
  })

  test("push returns evicted items when over capacity", () => {
    const ring = new PacketRingBuffer(3)
    ring.push(makeSummary("a"))
    ring.push(makeSummary("b"))
    ring.push(makeSummary("c"))
    expect(ring.length).toBe(3)

    // Push 4th — should evict "a"
    const evicted = ring.push(makeSummary("d"))
    expect(evicted.length).toBe(1)
    expect(evicted[0].id).toBe("a")
    expect(ring.length).toBe(3)

    // Remaining: b, c, d
    const ids = ring.all.map((s) => s.id)
    expect(ids).toEqual(["b", "c", "d"])
  })

  test("capacity=1 evicts on second push", () => {
    const ring = new PacketRingBuffer(1)
    ring.push(makeSummary("first"))
    const evicted = ring.push(makeSummary("second"))
    expect(evicted.length).toBe(1)
    expect(evicted[0].id).toBe("first")
    expect(ring.all[0].id).toBe("second")
  })
})

describe("DetailCache — delete", () => {
  test("delete removes entry", () => {
    const cache = new DetailCache(10)
    const summary = makeSummary("x")
    cache.set({ summary, raw: new Uint8Array(0), payload: new Uint8Array(0), hex: "", ascii: "" })
    expect(cache.get("x")).toBeDefined()
    cache.delete("x")
    expect(cache.get("x")).toBeUndefined()
  })

  test("delete returns false for non-existent key", () => {
    const cache = new DetailCache(10)
    expect(cache.delete("nonexistent")).toBe(false)
  })
})

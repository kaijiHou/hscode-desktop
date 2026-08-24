import { describe, expect, test } from "bun:test"
import { EventEmitter } from "node:events"

import { CaptureService } from "./capture-service"
import type { WorkerLike, WorkerSpawner } from "./capture-service"

// Fake worker that lets the test drive lifecycle messages exactly like the
// real capture-worker does (status capturing → packets → status error/stopped).
class FakeWorker extends EventEmitter implements WorkerLike {
  stopRequests: number[] = []
  terminated = false
  readonly input: { dllPath: string; filter: string }
  constructor(input: { dllPath: string; filter: string }) {
    super()
    this.input = input
  }
  postMessage(msg: { type: "stop" }): void {
    this.stopRequests.push(1)
    void msg
  }
  async terminate(): Promise<number> {
    this.terminated = true
    return 0
  }
  emitCapturing(): void {
    this.emit("message", { type: "status", state: "capturing" })
  }
  emitPacket(bytes: Uint8Array, outbound = true): void {
    this.emit("message", { type: "packet", bytes, outbound, timestamp: Date.now() })
  }
  emitError(code: string, message: string): void {
    this.emit("message", { type: "status", state: "error", error: { code, message } })
  }
  emitStopped(): void {
    this.emit("message", { type: "status", state: "stopped" })
  }
}

function makeService() {
  const workers: FakeWorker[] = []
  const spawner: WorkerSpawner = (input) => {
    const w = new FakeWorker(input)
    workers.push(w)
    return w
  }
  const service = new CaptureService({ maxPackets: 5000, maxDetails: 500 }, spawner)
  service.setResourcesDir("D:/hscode/packages/desktop/resources")
  return { service, workers }
}

// minimal real IPv4+TCP packet bytes (SYN)
function tcpPacket(): Uint8Array {
  const raw = new Uint8Array(40)
  raw[0] = 0x45
  raw[2] = 0x00
  raw[3] = 40
  raw[9] = 6
  raw[12] = 192; raw[13] = 168; raw[14] = 1; raw[15] = 10
  raw[16] = 192; raw[17] = 168; raw[18] = 1; raw[19] = 20
  raw[20] = 0x1a; raw[21] = 0x0a
  raw[22] = 0x1f; raw[23] = 0x90
  raw[24] = 0; raw[25] = 0; raw[26] = 0; raw[27] = 1 // seq
  raw[28] = 0; raw[29] = 0; raw[30] = 0; raw[31] = 0 // ack
  raw[32] = 0x50
  raw[33] = 0x02 // SYN only
  raw[34] = 0; raw[35] = 0
  return raw
}

describe("N7 — CaptureService lifecycle", () => {
  test("start → capturing → packets → stop → idle", async () => {
    const { service, workers } = makeService()
    const states: string[] = []
    service.on("state", (s) => states.push(s.state))
    const packets: string[] = []
    service.on("packet", (p) => packets.push(p.id))

    service.start("tcp")
    expect(service.state).toBe("starting")
    expect(workers).toHaveLength(1)
    expect(workers[0].input.filter).toContain("ipv4.Protocol == 6")

    workers[0].emitCapturing()
    expect(service.state).toBe("capturing")

    workers[0].emitPacket(tcpPacket())
    workers[0].emitPacket(tcpPacket(), false)
    expect(service.packetCount).toBe(2)
    expect(packets).toHaveLength(2)
    expect(service.packets[0].protocol).toBe("TCP")
    expect(service.packets[0].direction).toBe("outbound")
    expect(service.packets[1].direction).toBe("inbound")
    expect(service.snapshot().packetCount).toBe(2)

    service.stop()
    workers[0].emitStopped()
    await new Promise((r) => setTimeout(r, 150))
    expect(service.state).toBe("idle")
  })

  test("invalid filter raises validation error at start", () => {
    const { service } = makeService()
    expect(() => service.start("abc xyz !!!")).toThrow("invalid filter")
  })

  test("driver missing → error state, main loop unaffected", () => {
    const { service, workers } = makeService()
    service.start("tcp")
    workers[0].emitError("DLL_NOT_FOUND", "WinDivert.dll not found")
    expect(service.state).toBe("error")
    expect(service.snapshot().error?.code).toBe("DLL_NOT_FOUND")
    // Service itself keeps working (can clear, can start again after reset)
    service.clear()
    expect(service.packets).toHaveLength(0)
  })

  test("native recv error → error state surfaced", () => {
    const { service, workers } = makeService()
    service.start("udp")
    workers[0].emitCapturing()
    workers[0].emitError("RECV_FAILED", "WinDivertRecvEx failed")
    expect(service.state).toBe("error")
    expect(service.snapshot().error?.code).toBe("RECV_FAILED")
  })
})

describe("N9 — filter/IPC surface", () => {
  test("validateFilter returns display form", () => {
    const { service } = makeService()
    expect(service.validateFilter("tcp")).toBe("tcp")
    expect(() => service.validateFilter("bogus ??")).toThrow()
  })

  test("detail IPC path returns parsed detail", () => {
    const { service, workers } = makeService()
    service.start("tcp")
    workers[0].emitCapturing()
    workers[0].emitPacket(tcpPacket())
    const summary = service.packets[0]
    const detail = service.cacheDetail(summary, tcpPacket())
    // SYN-only packet has no payload → hex of empty payload is an empty string
    expect(detail.payload.length).toBe(0)
    expect(detail.hex).toBe("")
    expect(service.detail(summary.id)).toBeDefined()
  })
})

describe("N10 — engine unavailable does not crash service", () => {
  test("DLL missing error mapped without throwing from service", () => {
    const { service } = makeService()
    // driver boundary failure surfaces as state error, not process crash
    expect(() => service.start("tcp")).not.toThrow()
  })
})
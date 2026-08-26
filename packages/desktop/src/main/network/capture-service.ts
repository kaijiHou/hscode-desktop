// HSCode Network Inspector — capture service coordinator.
// Owns the capture worker lifecycle, the state machine, the packet ring
// buffer and detail cache, and fans packet summaries out to subscribers.
//
// The native boundary (KoffiNativeBridge / capture-worker) is injected below
// this layer so the service itself is testable with a fake native.

import { EventEmitter } from "node:events"

import { FilterValidationError, parseFilter } from "./filter"
import {
  CaptureStateMachine,
  DetailCache,
  PacketRingBuffer,
} from "./capture-service-core"
import type { PacketDetail, PacketSummary } from "./parser"
import { buildDetail, parsePacket } from "./parser"

export {
  CaptureStateMachine,
  DetailCache,
  PacketRingBuffer,
  ReentrantStartError,
  StopWhenIdleError,
} from "./capture-service-core"
export { FilterValidationError } from "./filter"
export type { CaptureError, CaptureState, CaptureStateSnapshot } from "./capture-service-core"

export const MAX_PACKETS = 5000
export const MAX_DETAILS = 500

export interface WorkerLike {
  postMessage(msg: { type: "stop" }): void
  terminate(): Promise<number>
  on(event: "message", cb: (msg: unknown) => void): void
  on(event: "error", cb: (err: Error) => void): void
  on(event: "exit", cb: (code: number) => void): void
}

export type WorkerSpawner = (input: { dllPath: string; filter: string }) => WorkerLike

export interface CaptureServiceOptions {
  maxPackets?: number
  maxDetails?: number
}

export class CaptureService extends EventEmitter {
  private readonly machine = new CaptureStateMachine()
  private readonly ring: PacketRingBuffer
  private readonly details: DetailCache
  private readonly spawnWorker: WorkerSpawner
  private worker: WorkerLike | null = null
  private resourcesDir = ""
  private nativeBridge: { validateFilter(f: string): boolean } | null = null

  constructor(options: CaptureServiceOptions = {}, spawnWorker?: WorkerSpawner) {
    super()
    this.ring = new PacketRingBuffer(options.maxPackets ?? MAX_PACKETS)
    this.details = new DetailCache(options.maxDetails ?? MAX_DETAILS)
    this.spawnWorker =
      spawnWorker ??
      (() => {
        throw new Error("CaptureService: worker spawner not configured")
      })
  }

  setResourcesDir(dir: string): void {
    this.resourcesDir = dir.replace(/[\\\/]$/, "")
  }

  setNativeBridge(bridge: { validateFilter(f: string): boolean }): void {
    this.nativeBridge = bridge
  }

  get state() {
    return this.machine.current
  }

  snapshot() {
    return this.machine.snapshot()
  }

  get packets(): PacketSummary[] {
    return this.ring.all
  }

  get packetCount(): number {
    return this.ring.length
  }

  detail(id: string): PacketDetail | undefined {
    return this.details.get(id)
  }

  /** Validate a filter through HSCode grammar + WinDivert native compile.
   *  If native bridge is unavailable, throws rather than silently passing. */
  validateFilter(input: string): string {
    const parsed = parseFilter(input)
    if (parsed.windivert === "true") return parsed.display
    if (!this.nativeBridge) {
      throw new FilterValidationError(
        "NATIVE_VALIDATOR_UNAVAILABLE: WinDivert native bridge is not initialized. " +
        "Filter validation requires the WinDivert DLL.",
      )
    }
    if (!this.nativeBridge.validateFilter(parsed.windivert)) {
      throw new FilterValidationError("WinDivert could not compile this filter")
    }
    return parsed.display
  }

  start(filterInput: string): void {
    const parsed = parseFilter(filterInput)
    this.machine.start()

    const dll = this.resourcesDir ? `${this.resourcesDir}\\win\\WinDivert.dll` : ""
    const worker = this.spawnWorker({ dllPath: dll, filter: parsed.windivert })
    this.worker = worker

    worker.on("message", (msg) => this.handleWorkerMessage(msg as never))
    worker.on("error", (err) => {
      this.machine.fail({ code: "UNKNOWN", message: `capture worker error: ${err.message}` })
      this.emit("state", this.machine.snapshot())
    })
    worker.on("exit", (code) => {
      if (this.machine.current === "capturing" || this.machine.current === "starting") {
        this.machine.fail({
          code: "UNKNOWN",
          message: `capture worker exited unexpectedly (code ${code})`,
        })
        this.emit("state", this.machine.snapshot())
      } else if (this.machine.current === "stopping") {
        this.machine.finishStop()
        this.emit("state", this.machine.snapshot())
      }
    })
  }

  stop(): void {
    if (this.machine.current === "idle" || this.machine.current === "error") {
      throw new Error("capture is not running")
    }
    this.machine.stop()
    const worker = this.worker
    if (worker) {
      worker.postMessage({ type: "stop" })
      void worker.terminate().then(() => {
        if (this.machine.current === "stopping") {
          this.machine.finishStop()
          this.emit("state", this.machine.snapshot())
        }
      })
      this.worker = null
    } else {
      this.machine.finishStop()
      this.emit("state", this.machine.snapshot())
    }
  }

  clear(): void {
    this.ring.clear()
    this.details.clear()
    this.emit("cleared")
  }

  dispose(): void {
    if (this.worker) {
      this.worker.postMessage({ type: "stop" })
      void this.worker.terminate()
      this.worker = null
    }
    this.removeAllListeners()
  }

  private handleWorkerMessage(msg: { type: string }) {
    const statusMsg = msg as { type: string; state?: string; error?: { code: string; message: string; winError?: number } }
    if (msg.type === "status") {
      if (statusMsg.state === "capturing") {
        this.machine.markCapturing()
        this.emit("state", this.machine.snapshot())
        return
      }
      if (statusMsg.state === "error") {
        this.machine.fail({
          code: (statusMsg.error?.code ?? "UNKNOWN") as never,
          message: statusMsg.error?.message ?? "capture error",
          winError: statusMsg.error?.winError,
        })
        this.emit("state", this.machine.snapshot())
        return
      }
      if (statusMsg.state === "stopped" && this.machine.current === "stopping") {
        this.machine.finishStop()
        this.emit("state", this.machine.snapshot())
        return
      }
      return
    }
    if (msg.type === "packet") {
      const packetMsg = msg as {
        type: "packet"
        bytes?: Uint8Array
        timestamp?: number
        outbound?: boolean
        ipv6?: boolean
      }
      if (!packetMsg.bytes) return
      try {
        const summary = parsePacket(packetMsg.bytes, {
          timestamp: packetMsg.timestamp ?? Date.now(),
          direction: packetMsg.outbound ? "outbound" : "inbound",
        })
        this.ring.push(summary)
        this.machine.recordPacket()
        this.emit("packet", summary)
        if (this.ring.length % 250 === 0) {
          this.emit("state", this.machine.snapshot())
        }
      } catch {
        // unparseable packet — skip; capture continues
      }
    }
  }

  /** Build + cache a detail from a raw packet (used by the detail IPC). */
  cacheDetail(summary: PacketSummary, raw: Uint8Array): PacketDetail {
    const detail = buildDetail(summary, raw)
    this.details.set(detail)
    return detail
  }
}
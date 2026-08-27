// HSCode Network Inspector — capture lifecycle state machine + ring buffer.
// Pure logic (no Electron/native imports) so it's fully unit-testable.

import type { NativeErrorCode } from "./native"
import type { PacketDetail, PacketSummary } from "./parser"

export type CaptureState = "idle" | "starting" | "capturing" | "stopping" | "error"

export interface CaptureError {
  code: NativeErrorCode | "UNKNOWN"
  message: string
  winError?: number
}

export interface CaptureStateSnapshot {
  state: CaptureState
  error?: CaptureError
  packetCount: number
  startTime?: number
}

export class ReentrantStartError extends Error {
  constructor() {
    super("capture already running")
    this.name = "ReentrantStartError"
  }
}

export class StopWhenIdleError extends Error {
  constructor() {
    super("capture is not running")
    this.name = "StopWhenIdleError"
  }
}

export class CaptureStateMachine {
  private state: CaptureState = "idle"
  private error: CaptureError | undefined
  private startTime: number | undefined
  private packetCount = 0

  get current(): CaptureState {
    return this.state
  }

  snapshot(): CaptureStateSnapshot {
    return {
      state: this.state,
      error: this.error,
      packetCount: this.packetCount,
      startTime: this.startTime,
    }
  }

  start(): number {
    if (this.state === "capturing" || this.state === "starting" || this.state === "stopping") {
      throw new ReentrantStartError()
    }
    this.state = "starting"
    this.error = undefined
    this.startTime = Date.now()
    this.packetCount = 0
    return this.startTime
  }

  markCapturing(): void {
    this.state = "capturing"
  }

  recordPacket(): void {
    this.packetCount += 1
  }

  stop(): number {
    if (this.state === "idle" || this.state === "error") {
      throw new StopWhenIdleError()
    }
    this.state = "stopping"
    return Date.now()
  }

  finishStop(): void {
    this.state = "idle"
    this.startTime = undefined
  }

  fail(error: CaptureError): void {
    this.state = "error"
    this.error = error
  }

  reset(): void {
    this.state = "idle"
    this.error = undefined
    this.startTime = undefined
    this.packetCount = 0
  }
}

/** Fixed-capacity packet store: drops oldest summaries beyond the cap. */
export class PacketRingBuffer {
  private items: PacketSummary[] = []
  readonly capacityValue: number

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error("capacity must be a positive integer")
    this.capacityValue = capacity
  }

  get length(): number {
    return this.items.length
  }

  /** Push a packet; returns any evicted summaries (for synchronized cleanup). */
  push(packet: PacketSummary): PacketSummary[] {
    this.items.push(packet)
    if (this.items.length > this.capacityValue) {
      const evicted = this.items.splice(0, this.items.length - this.capacityValue)
      return evicted
    }
    return []
  }

  get all(): PacketSummary[] {
    return [...this.items]
  }

  clear(): void {
    this.items = []
  }
}

/** Bounded detail cache with FIFO eviction. */
export class DetailCache {
  private readonly map = new Map<string, PacketDetail>()

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error("capacity must be a positive integer")
  }

  get size(): number {
    return this.map.size
  }

  set(detail: PacketDetail): void {
    this.map.set(detail.summary.id, detail)
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  get(id: string): PacketDetail | undefined {
    return this.map.get(id)
  }

  delete(id: string): boolean {
    return this.map.delete(id)
  }

  clear(): void {
    this.map.clear()
  }
}
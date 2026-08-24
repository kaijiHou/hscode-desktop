// HSCode Network Inspector — capture worker thread.
// Runs the blocking WinDivert recv loop off the Electron main thread.
// Loaded via `new Worker(new URL("./capture-worker.ts", import.meta.url))`.

import { parentPort, workerData } from "node:worker_threads"

export interface CaptureWorkerInput {
  dllPath: string
  filter: string
}

export interface PacketMessage {
  type: "packet"
  bytes: Uint8Array
  timestamp: number
  outbound: boolean
  loopback: boolean
  ipv6: boolean
}

export interface WorkerStatusMessage {
  type: "status"
  state: "capturing" | "error" | "stopped"
  error?: { code: string; message: string; winError?: number }
}

const { dllPath: workerDll, filter } = workerData as CaptureWorkerInput

let running = true

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { KoffiNativeBridge } = require("./native") as typeof import("./native")
  const bridge = new KoffiNativeBridge(workerDll)
  const handle = bridge.open(filter)

  parentPort?.postMessage({ type: "status", state: "capturing" } satisfies WorkerStatusMessage)

  const loop = () => {
    if (!running) {
      try {
        bridge.shutdown(handle)
        bridge.close(handle)
      } catch {
        // ignore
      }
      parentPort?.postMessage({ type: "status", state: "stopped" } satisfies WorkerStatusMessage)
      return
    }
    try {
      const result = bridge.recv(handle)
      const msg: PacketMessage = {
        type: "packet",
        bytes: result.bytes,
        timestamp: Number(result.timestamp) || Date.now(),
        outbound: result.outbound,
        loopback: result.loopback,
        ipv6: result.ipv6,
      }
      parentPort?.postMessage(msg)
    } catch (error) {
      const err = error as { code?: string; message?: string; winError?: number }
      parentPort?.postMessage({
        type: "status",
        state: "error",
        error: { code: err.code ?? "RECV_FAILED", message: err.message ?? String(error), winError: err.winError },
      } satisfies WorkerStatusMessage)
      running = false
      return
    }
    setImmediate(loop)
  }
  setImmediate(loop)
} catch (error) {
  const err = error as { code?: string; message?: string; winError?: number }
  parentPort?.postMessage({
    type: "status",
    state: "error",
    error: { code: err.code ?? "UNKNOWN", message: err.message ?? String(error), winError: err.winError },
  } satisfies WorkerStatusMessage)
}

parentPort?.on("message", (msg: { type: string }) => {
  if (msg.type === "stop") {
    running = false
  }
})
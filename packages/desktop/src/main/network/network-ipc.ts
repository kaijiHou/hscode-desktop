// HSCode Network Inspector — IPC wiring between renderer and main.
// Registers ipcMain handlers on a bridge injected by the desktop main.

import { BrowserWindow, ipcMain } from "electron"
import { Worker } from "node:worker_threads"

import { CaptureService } from "./capture-service"
import type { WorkerSpawner } from "./capture-service"

export interface NetworkIpcDeps {
  service: CaptureService
  getResourcesDir: () => string
  getNativeBridge?: () => { validateFilter(f: string): boolean } | null
}

export function registerNetworkIpc(deps: NetworkIpcDeps): () => void {
  const { service } = deps
  service.setResourcesDir(deps.getResourcesDir())
  const bridge = deps.getNativeBridge?.()
  if (bridge) service.setNativeBridge(bridge)

  const onState = (snapshot: unknown) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("network-state", snapshot)
    }
  }
  const onPacket = (summary: unknown) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("network-packet", summary)
    }
  }
  const onCleared = () => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("network-cleared")
    }
  }

  service.on("state", onState)
  service.on("packet", onPacket)
  service.on("cleared", onCleared)

  ipcMain.handle("network-get-state", () => service.snapshot())
  ipcMain.handle("network-get-packets", () => service.packets)
  ipcMain.handle("network-get-detail", (_event, id: string) => {
    const detail = service.detail(id)
    if (!detail) return null
    const bytes = detail.payload
    // Text heuristic: ≥90% printable/whitespace → treat as text payload.
    let printable = 0
    for (const b of bytes) {
      if ((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d) printable++
    }
    const isText = bytes.length > 0 && printable / bytes.length >= 0.9
    return {
      summary: detail.summary,
      hex: detail.hex,
      ascii: detail.ascii,
      payloadLength: bytes.length,
      payloadPreview: new TextDecoder().decode(bytes.slice(0, 512)),
      isText,
      ip: detail.ip,
      tcp: detail.tcp,
      udp: detail.udp,
    }
  })
  ipcMain.handle("network-start", (_event, filter: string) => {
    // Defensive re-validation at the IPC boundary: the renderer validates
    // before start, but nothing else should be able to bypass it.
    // An empty filter is explicitly allowed (parseFilter("") → "true" → capture all).
    service.validateFilter(filter ?? "")
    service.start(filter ?? "")
    return service.snapshot()
  })
  ipcMain.handle("network-stop", () => {
    service.stop()
    return service.snapshot()
  })
  ipcMain.handle("network-clear", () => {
    service.clear()
    return service.snapshot()
  })
  ipcMain.handle("network-validate-filter", (_event, filter: string) => {
    try {
      return { ok: true as const, display: service.validateFilter(filter) }
    } catch (error) {
      return { ok: false as const, error: (error as Error).message }
    }
  })

  return () => {
    service.removeAllListeners()
    for (const channel of [
      "network-get-state",
      "network-get-packets",
      "network-get-detail",
      "network-start",
      "network-stop",
      "network-clear",
      "network-validate-filter",
    ]) {
      ipcMain.removeHandler(channel)
    }
  }
}

/** Default worker spawner using node:worker_threads (used by desktop main).
 *  Points at the bundled out/main/capture-worker.js entry (see
 *  electron.vite.config.ts build.rollupOptions.input) — NOT the .ts source,
 *  which does not exist at runtime. */
export function createWorkerSpawner(): WorkerSpawner {
  return (input) => {
    const worker = new Worker(new URL("./capture-worker.js", import.meta.url), {
      workerData: input,
    })
    return worker as unknown as ReturnType<WorkerSpawner>
  }
}
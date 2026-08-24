// HSCode Network Inspector — renderer panel.
// Accessible via the command palette ("network.toggle") and rendered as an
// overlay panel inside the app chrome. Talks only to window.api.network.

import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"

// ---- HSCode Network Inspector renderer-side types (mirror of preload) ----
export type NetworkCaptureState = "idle" | "starting" | "capturing" | "stopping" | "error"
export type NetworkDirection = "inbound" | "outbound"
export type NetworkProtocol = "TCP" | "UDP" | "ICMP" | "OTHER"

export type NetworkPacketSummary = {
  id: string
  timestamp: number
  direction: NetworkDirection
  ipVersion: 4 | 6
  protocol: NetworkProtocol
  sourceIp: string
  destinationIp: string
  sourcePort?: number
  destinationPort?: number
  length: number
  tcp?: { syn: boolean; ack: boolean; fin: boolean; rst: boolean; psh: boolean; urg: boolean }
  payloadLength: number
  application?: { protocol?: "HTTP"; method?: string; path?: string; host?: string; version?: string }
}

export type NetworkStateSnapshot = {
  state: NetworkCaptureState
  error?: { code: string; message: string; winError?: number }
  packetCount: number
  startTime?: number
}

export type NetworkDetailPayload = {
  summary: NetworkPacketSummary
  hex: string
  ascii: string
  payloadLength: number
  payloadPreview: string
}

export type NetworkApiSurface = {
  getState: () => Promise<NetworkStateSnapshot>
  getPackets: () => Promise<NetworkPacketSummary[]>
  getDetail: (id: string) => Promise<NetworkDetailPayload | null>
  start: (filter: string) => Promise<NetworkStateSnapshot>
  stop: () => Promise<NetworkStateSnapshot>
  clear: () => Promise<NetworkStateSnapshot>
  validateFilter: (filter: string) => Promise<{ ok: boolean; display?: string; error?: string }>
  onPacket: (cb: (packet: NetworkPacketSummary) => void) => () => void
  onState: (cb: (snapshot: NetworkStateSnapshot) => void) => () => void
  onCleared: (cb: () => void) => () => void
}

function networkApi(): NetworkApiSurface {
  const api = (window as unknown as { api?: { network?: NetworkApiSurface } }).api
  if (!api?.network) {
    throw new Error("network engine unavailable")
  }
  return api.network
}

type ViewTab = "overview" | "payload" | "hex" | "ascii"

export function NetworkPanel(props: { open: () => boolean; close: () => void }) {
  const api = networkApi()
  void api // used inside effects; keep a stable reference

  const [snapshot, setSnapshot] = createStore<NetworkStateSnapshot>({ state: "idle", packetCount: 0 })
  const [packets, setPackets] = createSignal<NetworkPacketSummary[]>([])
  const [filter, setFilter] = createSignal("")
  const [filterError, setFilterError] = createSignal("")
  const [selectedId, setSelectedId] = createSignal<string | undefined>()
  const [detail, setDetail] = createSignal<NetworkDetailPayload | undefined>()
  const [viewTab, setViewTab] = createSignal<ViewTab>("overview")

  const isCapturing = () => snapshot.state === "capturing" || snapshot.state === "starting"

  const loadPackets = async () => {
    try {
      setPackets(await api.getPackets())
    } catch {
      setPackets([])
    }
  }

  const loadDetail = async (id: string) => {
    try {
      const d = await api.getDetail(id)
      setDetail(d ?? undefined)
    } catch {
      setDetail(undefined)
    }
  }

  onMount(() => {
    void (async () => {
      try {
        setSnapshot(await api.getState())
        await loadPackets()
      } catch {
        // network engine unavailable — panel still shows the error state
        setSnapshot({ state: "error", packetCount: 0, error: { code: "UNSUPPORTED_PLATFORM", message: "Network capture engine is unavailable." } })
      }
    })()

    const offPacket = api.onPacket((packet) => {
      setPackets((prev) => {
        const next = [...prev, packet]
        if (next.length > 5000) next.splice(0, next.length - 5000)
        return next
      })
    })
    const offState = api.onState((state) => {
      setSnapshot(state)
    })
    const offCleared = api.onCleared(() => {
      setPackets([])
      setSelectedId(undefined)
      setDetail(undefined)
    })
    onCleanup(() => {
      offPacket()
      offState()
      offCleared()
    })
  })

  const start = async () => {
    setFilterError("")
    if (filter().trim()) {
      const validation = await api.validateFilter(filter())
      if (!validation.ok) {
        setFilterError(validation.error ?? "invalid filter")
        return
      }
    }
    try {
      setSnapshot(await api.start(filter()))
    } catch (error) {
      setFilterError(String(error))
    }
  }
  const stop = async () => setSnapshot(await api.stop())
  const clear = async () => {
    await api.clear()
    setPackets([])
    setSelectedId(undefined)
    setDetail(undefined)
  }

  const selectPacket = async (id: string) => {
    setSelectedId(id)
    await loadDetail(id)
  }

  const selected = createMemo(() => packets().find((p) => p.id === selectedId()))

  const fmtTime = (t: number) => {
    const d = new Date(t)
    return d.toTimeString().slice(0, 8) + "." + String(t % 1000).padStart(3, "0")
  }
  const fmtEndpoint = (ip: string, port?: number) => (port !== undefined ? `${ip}:${port}` : ip)
  const protoLabel = (p: NetworkPacketSummary) => p.application?.protocol ?? p.protocol

  const detailRows = createMemo(() => {
    const s = selected()
    const d = detail()
    if (!s) return []
    const rows: Array<[string, string]> = [
      ["Protocol", protoLabel(s)],
      ["Source", fmtEndpoint(s.sourceIp, s.sourcePort)],
      ["Destination", fmtEndpoint(s.destinationIp, s.destinationPort)],
      ["Length", String(s.length)],
      ["Payload Length", String(s.payloadLength)],
      ["Direction", s.direction],
      ["IP Version", String(s.ipVersion)],
    ]
    if (s.tcp) {
      rows.push(["TCP Flags", `SYN=${s.tcp.syn} ACK=${s.tcp.ack} FIN=${s.tcp.fin} RST=${s.tcp.rst} PSH=${s.tcp.psh} URG=${s.tcp.urg}`])
    }
    if (s.application) {
      rows.push(["HTTP", `${s.application.method ?? ""} ${s.application.path ?? ""} ${s.application.version ?? ""}`])
      if (s.application.host) rows.push(["Host", s.application.host])
    }
    if (d && d.payloadPreview) rows.push(["Payload Preview", d.payloadPreview.slice(0, 200)])
    return rows
  })

  return (
    <Show when={props.open()}>
      <div class="network-panel" style={{ position: "fixed", inset: "0 0 40% 0", "z-index": 90, display: "flex", "flex-direction": "column", background: "var(--surface-1, #1e1e1e)", color: "var(--text-1, #e8e8e8)", "font-family": "var(--font-mono, monospace)", "font-size": "12px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "6px 10px", "border-bottom": "1px solid var(--border-1, #333)", "flex-shrink": "0" }}>
          <span style={{ "font-weight": 600 }}>Network Inspector</span>
          <span style={{ opacity: 0.7 }}>·</span>
          <span class="network-state" style={{ color: isCapturing() ? "#4caf50" : snapshot.state === "error" ? "#f44336" : "inherit" }}>
            {snapshot.state}
          </span>
          <span style={{ "margin-left": "auto", opacity: 0.7 }}>{packets().length} packets</span>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "6px 10px", "border-bottom": "1px solid var(--border-1, #333)", "flex-shrink": "0" }}>
          <input
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
            placeholder="filter: tcp · udp · tcp.port == 22122 · src.ip == 192.168.1.10"
            style={{ flex: 1, background: "var(--surface-2, #2a2a2a)", color: "inherit", border: "1px solid var(--border-1, #444)", "border-radius": "4px", padding: "4px 8px" }}
          />
          <button onClick={start} disabled={isCapturing()} style={btnStyle}>Start</button>
          <button onClick={stop} disabled={!isCapturing()} style={btnStyle}>Stop</button>
          <button onClick={clear} style={btnStyle}>Clear</button>
          <button onClick={props.close} title="Close" style={btnStyle}>✕</button>
        </div>

        <Show when={filterError()}>
          <div style={{ padding: "4px 10px", color: "#f44336", "border-bottom": "1px solid var(--border-1, #333)" }}>{filterError()}</div>
        </Show>

        <Show when={snapshot.state === "error" && snapshot.error}>
          <div style={{ padding: "6px 10px", color: "#f44336", "border-bottom": "1px solid var(--border-1, #333)" }}>
            {snapshot.error?.message}
          </div>
        </Show>

        <div style={{ display: "flex", flex: 1, "min-height": 0 }}>
          {/* packet list */}
          <div style={{ flex: 1, overflow: "auto", "border-right": "1px solid var(--border-1, #333)" }}>
            <table style={{ width: "100%", "border-collapse": "collapse" }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "var(--surface-1, #1e1e1e)", "text-align": "left" }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Dir</th>
                  <th style={thStyle}>Src</th>
                  <th style={thStyle}>Dst</th>
                  <th style={thStyle}>Proto</th>
                  <th style={thStyle}>Len</th>
                </tr>
              </thead>
              <tbody>
                <For each={packets()}>
                  {(p) => (
                    <tr
                      onClick={() => void selectPacket(p.id)}
                      style={{ cursor: "pointer", background: p.id === selectedId() ? "var(--accent-1, #2f5f8f)" : undefined }}
                    >
                      <td style={tdStyle}>{fmtTime(p.timestamp)}</td>
                      <td style={tdStyle}>{p.direction === "outbound" ? "→" : "←"}</td>
                      <td style={tdStyle}>{fmtEndpoint(p.sourceIp, p.sourcePort)}</td>
                      <td style={tdStyle}>{fmtEndpoint(p.destinationIp, p.destinationPort)}</td>
                      <td style={tdStyle}>{protoLabel(p)}</td>
                      <td style={tdStyle}>{p.length}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* detail */}
          <div style={{ width: "38%", "min-width": "280px", display: "flex", "flex-direction": "column" }}>
            <div style={{ display: "flex", gap: "4px", padding: "4px 8px", "border-bottom": "1px solid var(--border-1, #333)" }}>
              {(["overview", "payload", "hex", "ascii"] as ViewTab[]).map((tab) => (
                <button
                  onClick={() => setViewTab(tab)}
                  style={{
                    ...btnSmallStyle,
                    background: viewTab() === tab ? "var(--accent-1, #2f5f8f)" : undefined,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "8px", "white-space": "pre-wrap", "word-break": "break-all" }}>
              <Show when={viewTab() === "overview" && detailRows().length > 0} fallback={<span style={{ opacity: 0.5 }}>select a packet</span>}>
                <For each={detailRows()}>
                  {([k, v]) => (
                    <div style={{ display: "flex", gap: "8px", "margin-bottom": "4px" }}>
                      <span style={{ width: "120px", opacity: 0.7, "flex-shrink": 0 }}>{k}</span>
                      <span>{v}</span>
                    </div>
                  )}
                </For>
              </Show>
              <Show when={viewTab() === "payload" && detail()}>
                <pre style={{ margin: 0 }}>{detail()?.payloadPreview ?? ""}</pre>
              </Show>
              <Show when={viewTab() === "hex" && detail()}>
                <pre style={{ margin: 0 }}>{detail()?.hex ?? ""}</pre>
              </Show>
              <Show when={viewTab() === "ascii" && detail()}>
                <pre style={{ margin: 0 }}>{detail()?.ascii ?? ""}</pre>
              </Show>
              <Show when={["payload", "hex", "ascii"].includes(viewTab()) && !detail()}>
                <span style={{ opacity: 0.5 }}>no payload data</span>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}

const btnStyle: JSX.CSSProperties = {
  padding: "4px 12px",
  background: "var(--surface-2, #2a2a2a)",
  color: "inherit",
  border: "1px solid var(--border-1, #444)",
  "border-radius": "4px",
  cursor: "pointer",
}
const btnSmallStyle: JSX.CSSProperties = { padding: "2px 10px", background: "transparent", color: "inherit", border: "1px solid var(--border-1, #444)", "border-radius": "3px", cursor: "pointer" }
const thStyle: JSX.CSSProperties = { padding: "4px 8px", "font-weight": 600 }
const tdStyle: JSX.CSSProperties = { padding: "3px 8px", "max-width": "220px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }
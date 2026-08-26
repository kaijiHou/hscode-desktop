// HSCode Network Inspector — bottom tool panel content.
// Rendered by the session layout (Terminal │ Network). The parent controls
// visibility via view().network; this panel fills the given space (100% w/h).

import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { useSessionLayout } from "@/pages/session/session-layout"

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

function networkApi(): NetworkApiSurface | undefined {
  const api = (window as unknown as { api?: { network?: NetworkApiSurface } }).api
  return api?.network
}

type ViewTab = "overview" | "payload" | "hex" | "ascii"
const tabLabels: Record<ViewTab, string> = { overview: "概览", payload: "Payload", hex: "HEX", ascii: "ASCII" }

export function NetworkPanel() {
  const { view } = useSessionLayout()
  const api = networkApi()
  const engineUnavailable = !api

  const [snapshot, setSnapshot] = createStore<NetworkStateSnapshot>({ state: "idle", packetCount: 0 })
  const [packets, setPackets] = createSignal<NetworkPacketSummary[]>([])
  const [filter, setFilter] = createSignal("")
  const [filterError, setFilterError] = createSignal("")
  const [selectedId, setSelectedId] = createSignal<string | undefined>()
  const [detail, setDetail] = createSignal<NetworkDetailPayload | undefined>()
  const [viewTab, setViewTab] = createSignal<ViewTab>("overview")
  const [loadError, setLoadError] = createSignal("")
  const [protoFilter, setProtoFilter] = createSignal<string>("")
  const [ipFilter, setIpFilter] = createSignal("")
  const [portFilter, setPortFilter] = createSignal("")
  const [dirFilter, setDirFilter] = createSignal<string>("")

  const isCapturing = () => snapshot.state === "capturing" || snapshot.state === "starting"

  const loadPackets = async () => {
    if (!api) return
    try {
      setPackets(await api.getPackets())
      setLoadError("")
    } catch (error) {
      // Real engine errors must be surfaced, not swallowed as "no data".
      setLoadError(`Failed to load packets: ${String(error)}`)
    }
  }

  const loadDetail = async (id: string) => {
    if (!api) return
    try {
      const d = await api.getDetail(id)
      setDetail(d ?? undefined)
    } catch (error) {
      setLoadError(`Failed to load packet detail: ${String(error)}`)
      setDetail(undefined)
    }
  }

  onMount(() => {
    if (!api) {
      setSnapshot({
        state: "error",
        packetCount: 0,
        error: { code: "ENGINE_UNAVAILABLE", message: "Network capture engine is unavailable in this environment." },
      })
      return
    }
    void (async () => {
      try {
        setSnapshot(await api.getState())
        await loadPackets()
      } catch (error) {
        setSnapshot({ state: "error", packetCount: 0, error: { code: "UNKNOWN", message: String(error) } })
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

  function buildBaseFilter(): string {
    const parts: string[] = []
    if (protoFilter()) parts.push(protoFilter())
    if (ipFilter().trim()) parts.push(`ip == ${ipFilter().trim()}`)
    if (portFilter().trim()) {
      const port = portFilter().trim()
      parts.push(`tcp.port == ${port}`)
      parts.push(`udp.port == ${port}`)
    }
    if (dirFilter()) parts.push(dirFilter())
    if (parts.length === 0) return ""
    return parts.join(" and ")
  }

  const start = async () => {
    if (!api) return
    setFilterError("")
    const base = buildBaseFilter()
    const adv = filter().trim()
    const combined = [base, adv].filter(Boolean).join(" and ")
    if (combined) {
      const validation = await api.validateFilter(combined)
      if (!validation.ok) {
        setFilterError(validation.error ?? "invalid filter")
        return
      }
    }
    try {
      setSnapshot(await api.start(combined))
      setLoadError("")
    } catch (error) {
      setFilterError(String(error))
    }
  }
  const stop = async () => {
    if (!api) return
    try {
      setSnapshot(await api.stop())
    } catch (error) {
      setLoadError(`Stop failed: ${String(error)}`)
    }
  }
  const clear = async () => {
    if (!api) return
    try {
      await api.clear()
      setPackets([])
      setSelectedId(undefined)
      setDetail(undefined)
    } catch (error) {
      setLoadError(`Clear failed: ${String(error)}`)
    }
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
      ["协议", protoLabel(s)],
      ["源地址", fmtEndpoint(s.sourceIp, s.sourcePort)],
      ["目标地址", fmtEndpoint(s.destinationIp, s.destinationPort)],
      ["长度", String(s.length)],
      ["载荷长度", String(s.payloadLength)],
      ["方向", s.direction],
      ["IP 版本", String(s.ipVersion)],
    ]
    if (s.tcp) {
      rows.push(["TCP 标志", `SYN=${s.tcp.syn} ACK=${s.tcp.ack} FIN=${s.tcp.fin} RST=${s.tcp.rst} PSH=${s.tcp.psh} URG=${s.tcp.urg}`])
    }
    if (s.application) {
      rows.push(["HTTP", `${s.application.method ?? ""} ${s.application.path ?? ""} ${s.application.version ?? ""}`])
      if (s.application.host) rows.push(["主机", s.application.host])
    }
    if (d && d.payloadPreview) rows.push(["载荷预览", d.payloadPreview.slice(0, 200)])
    return rows
  })

  return (
    <div
      id="network-panel"
      data-component="network-panel"
      role="region"
      aria-label="网络抓包"
      class="network-panel relative w-full h-full min-h-0 flex flex-col overflow-hidden bg-background-stronger text-14-regular border-t border-border-weak-base"
    >
      <div class="px-2 py-1 text-12-regular opacity-60 border-b border-border-weaker-base">
        捕获并分析当前电脑的 TCP / UDP / ICMP 网络数据包
      </div>
      <div class="flex items-center gap-2 px-2 h-9 border-b border-border-weaker-base bg-background-stronger shrink-0">
        <span class="font-semibold">网络抓包</span>
        <span
          data-slot="network-state"
          class="text-12-regular"
          style={{ color: isCapturing() ? "#4caf50" : snapshot.state === "error" ? "#f44336" : undefined }}
        >
          {{ "idle": "未开始", "starting": "正在启动", "capturing": "正在抓包", "stopping": "正在停止", "error": "抓包失败" }[snapshot.state] ?? snapshot.state}
        </span>
        <span class="ml-auto opacity-70">{packets().length} 个数据包</span>
        <button
          onClick={() => view().network.close()}
          aria-label="关闭网络抓包"
          class="titlebar-icon w-6 h-6 p-0 box-border shrink-0"
        >
          ✕
        </button>
      </div>

      <div class="flex items-center gap-1 px-2 py-1 border-b border-border-weaker-base shrink-0">
        <select
          value={protoFilter()}
          onChange={(e) => setProtoFilter(e.currentTarget.value)}
          aria-label="协议筛选"
          class="bg-surface-base border border-border-weak-base rounded px-2 py-1 text-13-regular"
        >
          <option value="">全部协议</option>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="ICMP">ICMP</option>
        </select>
        <input
          value={ipFilter()}
          onInput={(e) => setIpFilter(e.currentTarget.value)}
          placeholder="IP"
          aria-label="IP 筛选"
          class="w-36 bg-surface-base border border-border-weak-base rounded px-2 py-1 text-13-regular"
        />
        <input
          value={portFilter()}
          onInput={(e) => setPortFilter(e.currentTarget.value)}
          placeholder="端口"
          aria-label="端口筛选"
          class="w-24 bg-surface-base border border-border-weak-base rounded px-2 py-1 text-13-regular"
        />
        <select
          value={dirFilter()}
          onChange={(e) => setDirFilter(e.currentTarget.value)}
          aria-label="方向筛选"
          class="bg-surface-base border border-border-weak-base rounded px-2 py-1 text-13-regular"
        >
          <option value="">全部方向</option>
          <option value="inbound">入站</option>
          <option value="outbound">出站</option>
        </select>
      </div>

      <div class="flex items-center gap-2 px-2 h-9 border-b border-border-weaker-base shrink-0">
        <input
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          placeholder="高级筛选: tcp / udp / tcp.port == 22122"
          aria-label="Network filter"
          class="flex-1 min-w-0 bg-surface-base border border-border-weak-base rounded px-2 py-1 text-14-regular"
        />
        <button onClick={() => void start()} disabled={isCapturing() || !api} class="btn-outline btn-sm" style={btnStyle}>
          开始抓包
        </button>
        <button onClick={() => void stop()} disabled={!isCapturing() || !api} class="btn-outline btn-sm" style={btnStyle}>
          停止抓包
        </button>
        <button onClick={() => void clear()} class="btn-outline btn-sm" style={btnStyle}>
          清空
        </button>
      </div>

      <Show when={engineUnavailable}>
        <div class="px-3 py-2 text-12-regular" style={{ color: "#f44336" }}>
          网络抓包引擎不可用。此功能需要 HSCode 桌面版。
        </div>
      </Show>
      <Show when={filterError()}>
        <div class="px-3 py-1" style={{ color: "#f44336" }}>{filterError()}</div>
      </Show>
      <Show when={loadError()}>
        <div class="px-3 py-1" style={{ color: "#f44336" }}>{loadError()}</div>
      </Show>
      <Show when={snapshot.state === "error" && snapshot.error}>
        <div class="px-3 py-2 border-b border-border-weaker-base" style={{ color: "#f44336", "white-space": "pre-wrap" }}>
          {snapshot.error?.message ?? "抓包错误"}
        </div>
      </Show>

      <div class="flex-1 min-h-0 flex">
        {/* packet list */}
        <div class="flex-1 overflow-auto" data-slot="network-packet-list">
          <Show when={packets().length === 0 && snapshot.state === "idle"}>
            <div class="p-3 text-12-regular opacity-50">点击「开始抓包」捕获本机 TCP/UDP/ICMP 网络数据</div>
          </Show>
          <Show when={snapshot.state === "capturing" && packets().length === 0}>
            <div class="p-3 text-12-regular opacity-50">正在监听网络流量，暂未捕获到数据包</div>
          </Show>
          <table class="w-full border-collapse text-13-regular">
            <thead>
              <tr class="sticky top-0 bg-background-stronger text-left">
                <th class="px-2 py-1 font-semibold">时间</th>
                <th class="px-2 py-1 font-semibold">方向</th>
                <th class="px-2 py-1 font-semibold">源地址</th>
                <th class="px-2 py-1 font-semibold">目标地址</th>
                <th class="px-2 py-1 font-semibold">协议</th>
                <th class="px-2 py-1 font-semibold">长度</th>
              </tr>
            </thead>
            <tbody>
              <For each={packets()}>
                {(p) => (
                  <tr
                    onClick={() => void selectPacket(p.id)}
                    class="cursor-pointer"
                    style={{ background: p.id === selectedId() ? "var(--accent-1, #2f5f8f)" : undefined }}
                  >
                    <td class="px-2 py-0.5">{fmtTime(p.timestamp)}</td>
                    <td class="px-2 py-0.5">{p.direction === "outbound" ? "→" : "←"}</td>
                    <td class="px-2 py-0.5 max-w-56 truncate">{fmtEndpoint(p.sourceIp, p.sourcePort)}</td>
                    <td class="px-2 py-0.5 max-w-56 truncate">{fmtEndpoint(p.destinationIp, p.destinationPort)}</td>
                    <td class="px-2 py-0.5">{protoLabel(p)}</td>
                    <td class="px-2 py-0.5">{p.length}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        {/* detail */}
        <div class="w-[38%] min-w-70 flex flex-col border-l border-border-weaker-base" data-slot="network-detail">
          <div class="flex gap-1 px-2 py-1 border-b border-border-weaker-base">
            {(["overview", "payload", "hex", "ascii"] as ViewTab[]).map((tab) => (
              <button
                onClick={() => setViewTab(tab)}
                class="px-2 py-0.5 rounded text-12-regular"
                style={{ background: viewTab() === tab ? "var(--accent-1, #2f5f8f)" : undefined }}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
          <div class="flex-1 overflow-auto p-2 whitespace-pre-wrap break-all" data-slot="network-detail-body">
            <Show when={viewTab() === "overview" && detailRows().length > 0} fallback={<span class="opacity-50">请选择数据包</span>}>
              <For each={detailRows()}>
                {([k, v]) => (
                  <div class="flex gap-2 mb-1">
                    <span class="w-30 opacity-70 shrink-0">{k}</span>
                    <span>{v}</span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={viewTab() === "payload" && detail()}>
              <pre class="m-0">{detail()?.payloadPreview ?? ""}</pre>
            </Show>
            <Show when={viewTab() === "hex" && detail()}>
              <pre class="m-0">{detail()?.hex ?? ""}</pre>
            </Show>
            <Show when={viewTab() === "ascii" && detail()}>
              <pre class="m-0">{detail()?.ascii ?? ""}</pre>
            </Show>
            <Show when={["payload", "hex", "ascii"].includes(viewTab()) && !detail()}>
              <span class="opacity-50">无载荷数据</span>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnStyle: JSX.CSSProperties = {
  padding: "2px 10px",
  background: "var(--surface-2, #2a2a2a)",
  color: "inherit",
  border: "1px solid var(--border-1, #444)",
  "border-radius": "4px",
  cursor: "pointer",
}
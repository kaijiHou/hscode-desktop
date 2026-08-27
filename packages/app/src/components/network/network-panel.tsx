// HSCode Network Inspector — bottom tool panel content (UX v2).
// Rendered by the session layout. Agent/IDE-style workbench:
//   Header │ Filter Toolbar │ Packet List ⇄ Detail Inspector
// The outer width is controlled by the session ResizeHandle; the inner
// List/Detail split is draggable here (persisted via layout.network.detailWidth).

import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { useLayout } from "@/context/layout"
import type {
  NetworkDetailPayload,
  NetworkPacketSummary,
  NetworkStateSnapshot,
} from "@opencode-ai/app/network-types"
import { useSessionLayout } from "@/pages/session/session-layout"
import { buildFilter, type FilterState } from "./filter-builder"
import { PacketList } from "./network-packet-list"
import { DetailInspector } from "./network-packet-detail"

export type NetworkCaptureState = NetworkStateSnapshot["state"]
export type { NetworkPacketSummary, NetworkStateSnapshot, NetworkDetailPayload }

export function networkApi(): NetworkApiSurface | undefined {
  const api = (window as unknown as { api?: { network?: NetworkApiSurface } }).api
  return api?.network
}

export interface NetworkApiSurface {
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

type ViewTab = "overview" | "headers" | "payload" | "hex" | "ascii"
const tabLabels: Record<ViewTab, string> = {
  overview: "概览",
  headers: "协议头",
  payload: "Payload",
  hex: "HEX",
  ascii: "ASCII",
}

const DETAIL_MIN_WIDTH = 300
const DETAIL_DEFAULT_WIDTH = 380

export function NetworkPanel(props: { expanded?: boolean; onExpand?: () => void; onRestore?: () => void }) {
  const { view } = useSessionLayout()
  const layout = useLayout()
  const api = networkApi()
  const engineUnavailable = !api

  const [snapshot, setSnapshot] = createStore<NetworkStateSnapshot>({ state: "idle", packetCount: 0 })
  const [packets, setPackets] = createSignal<NetworkPacketSummary[]>([])
  const [filterState, setFilterState] = createSignal<FilterState>({ protocol: "", ip: "", port: "", direction: "", advanced: "" })
  const [filterError, setFilterError] = createSignal("")
  const [selectedId, setSelectedId] = createSignal<string | undefined>()
  const [detail, setDetail] = createSignal<NetworkDetailPayload | undefined>()
  const [viewTab, setViewTab] = createSignal<ViewTab>("overview")
  const [loadError, setLoadError] = createSignal("")

  // Inner splitter state — persisted through the layout store.
  const detailWidth = () => Math.max(DETAIL_MIN_WIDTH, layout?.network.detailWidth() ?? DETAIL_DEFAULT_WIDTH)
  const detailCollapsed = () => layout?.network.detailCollapsed() ?? false

  const isCapturing = () => snapshot.state === "capturing" || snapshot.state === "starting"

  const loadPackets = async () => {
    if (!api) return
    try {
      setPackets(await api.getPackets())
      setLoadError("")
    } catch (error) {
      setLoadError(`Failed to load packets: ${String(error)}`)
    }
  }

  const loadDetail = async (id: string) => {
    if (!api) return
    try {
      const d = await api.getDetail(id)
      setDetail(d ?? undefined)
      if (d && detailCollapsed()) layout?.network.collapseDetail(false)
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

  const start = async () => {
    if (!api) return
    setFilterError("")
    const combined = buildFilter(filterState())
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

  // --- inner splitter drag ---
  let workspaceRef: HTMLDivElement | undefined
  const onSplitterPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    const bar = workspaceRef
    if (!bar) return
    const startX = e.clientX
    const startWidth = detailWidth()
    document.body.style.userSelect = "none"
    document.body.style.cursor = "col-resize"
    const move = (ev: PointerEvent) => {
      // Detail sits at the RIGHT edge: dragging left grows it.
      const next = startWidth + (startX - ev.clientX)
      const maxAllowed = bar.getBoundingClientRect().width - 400
      layout?.network.resizeDetail(Math.min(Math.max(DETAIL_MIN_WIDTH, next), Math.max(DETAIL_MIN_WIDTH, maxAllowed)))
    }
    const up = () => {
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const stateDotColor = () =>
    snapshot.state === "capturing" ? "var(--v2-state-fg-success)" :
    snapshot.state === "starting" || snapshot.state === "stopping" ? "var(--v2-state-fg-warning)" :
    snapshot.state === "error" ? "var(--v2-state-fg-danger)" : "var(--v2-text-text-muted)"
  const stateLabel = () =>
    ({ idle: "未开始", starting: "正在启动", capturing: "正在抓包", stopping: "正在停止", error: "抓包失败" })[snapshot.state] ?? snapshot.state

  return (
    <div
      id="network-panel"
      data-component="network-panel"
      role="region"
      aria-label="网络抓包"
      class="network-panel relative w-full h-full min-h-0 flex flex-col overflow-hidden bg-background-stronger text-14-regular border-t border-border-weaker-base"
    >
      {/* A. Header */}
      <div class="flex items-center gap-2 px-3 h-10 shrink-0" data-slot="network-header">
        <span class="font-semibold text-13-regular">网络抓包</span>
        <span class="inline-flex items-center gap-1.5 text-12-regular" data-slot="network-state">
          <span
            aria-hidden="true"
            style={{
              width: "7px",
              height: "7px",
              "border-radius": "50%",
              background: stateDotColor(),
              display: "inline-block",
            }}
          />
          {stateLabel()}
        </span>
        <Show when={snapshot.state === "capturing"}>
          <span class="text-12-regular opacity-60 hidden lg:inline">筛选修改将在重新开始后生效</span>
        </Show>
        <span class="ml-auto text-12-regular opacity-70" data-slot="network-count">{packets().length} 个数据包</span>
        <ButtonV2 size="small" variant={isCapturing() ? "danger" : "neutral"} onClick={() => void (isCapturing() ? stop() : start())} disabled={!api || snapshot.state === "starting" || snapshot.state === "stopping"} data-action="network-toggle-capture">
          {isCapturing() ? "停止抓包" : "开始抓包"}
        </ButtonV2>
        <ButtonV2 size="small" variant="ghost" onClick={() => void clear()} disabled={packets().length === 0}>
          清空
        </ButtonV2>
        <Show when={props.expanded !== undefined}>
          <ButtonV2 size="small" variant="ghost" onClick={() => props.expanded ? props.onRestore?.() : props.onExpand?.()} aria-label={props.expanded ? "恢复布局" : "扩大工作区"} title={props.expanded ? "恢复布局" : "扩大工作区"} data-action="network-expand">
            <IconV2 name={props.expanded ? "collapse" : "expand"} />
          </ButtonV2>
        </Show>
        <button
          onClick={() => view().network.close()}
          aria-label="关闭网络抓包"
          class="titlebar-icon w-6 h-6 p-0 box-border shrink-0"
          data-action="network-close"
        >
          ✕
        </button>
      </div>

      {/* B. Filter Toolbar — compact single row, wraps on narrow widths */}
      <div class="flex items-center gap-1.5 px-3 py-1.5 flex-wrap shrink-0" data-slot="network-toolbar">
        <select
          value={filterState().protocol}
          onChange={(e) => setFilterState({ ...filterState(), protocol: e.currentTarget.value as FilterState["protocol"] })}
          aria-label="协议筛选"
          disabled={isCapturing()}
          class="h-7 bg-surface-base border border-border-weaker-base rounded px-1.5 text-12-regular disabled:opacity-50"
        >
          <option value="">全部协议</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
          <option value="icmp">ICMP</option>
        </select>
        <input
          value={filterState().ip}
          onInput={(e) => setFilterState({ ...filterState(), ip: e.currentTarget.value })}
          placeholder="IP"
          aria-label="IP 筛选"
          disabled={isCapturing()}
          class="w-36 h-7 bg-surface-base border border-border-weaker-base rounded px-1.5 text-12-regular disabled:opacity-50"
        />
        <input
          value={filterState().port}
          onInput={(e) => setFilterState({ ...filterState(), port: e.currentTarget.value })}
          placeholder="端口"
          aria-label="端口筛选"
          disabled={isCapturing()}
          class="w-20 h-7 bg-surface-base border border-border-weaker-base rounded px-1.5 text-12-regular disabled:opacity-50"
        />
        <select
          value={filterState().direction}
          onChange={(e) => setFilterState({ ...filterState(), direction: e.currentTarget.value as FilterState["direction"] })}
          aria-label="方向筛选"
          disabled={isCapturing()}
          class="h-7 bg-surface-base border border-border-weaker-base rounded px-1.5 text-12-regular disabled:opacity-50"
        >
          <option value="">全部方向</option>
          <option value="inbound">入站</option>
          <option value="outbound">出站</option>
        </select>
        <input
          value={filterState().advanced}
          onInput={(e) => setFilterState({ ...filterState(), advanced: e.currentTarget.value })}
          placeholder="高级筛选：tcp / udp / tcp.port == 22122"
          aria-label="Network filter"
          disabled={isCapturing()}
          class="flex-1 min-w-40 h-7 bg-surface-base border border-border-weaker-base rounded px-1.5 text-12-regular disabled:opacity-50"
        />
        <ButtonV2
          size="small"
          variant="ghost"
          disabled={isCapturing() || (!filterState().protocol && !filterState().ip && !filterState().port && !filterState().direction && !filterState().advanced)}
          onClick={() => setFilterState({ protocol: "", ip: "", port: "", direction: "", advanced: "" })}
        >
          重置
        </ButtonV2>
      </div>

      <Show when={engineUnavailable}>
        <div class="px-3 py-2 text-12-regular" style={{ color: "var(--v2-state-fg-danger)" }}>
          网络抓包引擎不可用。此功能需要 HSCode 桌面版。
        </div>
      </Show>
      <Show when={filterError()}>
        <div class="px-3 py-1 text-12-regular" style={{ color: "var(--v2-state-fg-danger)", "white-space": "pre-wrap" }}>{filterError()}</div>
      </Show>
      <Show when={loadError()}>
        <div class="px-3 py-1 text-12-regular" style={{ color: "var(--v2-state-fg-danger)" }}>{loadError()}</div>
      </Show>
      <Show when={snapshot.state === "error" && snapshot.error}>
        <div class="px-3 py-2 text-12-regular border-b border-border-weaker-base" style={{ color: "var(--v2-state-fg-danger)", "white-space": "pre-wrap" }}>
          {networkErrorText(snapshot.error?.code, snapshot.error?.message)}
        </div>
      </Show>

      {/* C+D. Packet Workspace: list ⇄ splitter ⇄ detail inspector */}
      <div ref={workspaceRef} class="flex-1 min-h-0 flex" data-slot="network-workspace">
        <PacketList
          packets={packets}
          snapshot={snapshot}
          selectedId={selectedId}
          onSelect={(id) => void selectPacket(id)}
          fmtTime={fmtTime}
          collapsed={detailCollapsed()}
        />
        <Show when={!detailCollapsed()}>
                  <div
                    data-slot="network-splitter"
                    data-component="network-splitter"
                    onPointerDown={onSplitterPointerDown}
                    onDblClick={() => layout?.network.resizeDetail(DETAIL_DEFAULT_WIDTH)}
                    aria-orientation="vertical"
                    title="拖动调整详情宽度，双击重置"
                    style={{
                      width: "6px",
                      cursor: "col-resize",
                      "flex-shrink": "0",
                      background: "var(--border-weaker-base, transparent)",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent-1, rgba(63,185,80,0.35))")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--border-weaker-base, transparent)")}
                  />
                  <div style={{ width: `${detailWidth()}px`, "flex-shrink": "0", "min-width": "0", overflow: "hidden" }} data-slot="network-detail-wrap">
                    <DetailInspector
                      packet={selected()}
                      detail={detail()}
                      tab={viewTab()}
                      onTab={setViewTab}
                      onCollapse={() => layout?.network.collapseDetail(true)}
                    />
                  </div>
                </Show>
      </div>
    </div>
  )
}

// Chinese error mapping — readable reason, not raw codes.
export function networkErrorText(code: string | undefined, message: string | undefined): string {
  const devHint = message ? `\n${message}` : ""
  switch (code) {
    case "DLL_NOT_FOUND":
      return `网络抓包组件缺失，请重新安装或修复 HSCode。${devHint}`
    case "DLL_LOAD_FAILED":
      return `网络抓包组件加载失败。${devHint}`
    case "ADMIN_REQUIRED":
      return "网络抓包需要管理员权限，请以管理员身份重新启动 HSCode。"
    case "DRIVER_MISSING":
      return `WinDivert 驱动未找到或启动失败。${devHint}`
    case "NATIVE_VALIDATOR_UNAVAILABLE":
      return `网络抓包引擎未初始化。${devHint}`
    default:
      return message || code || "未知错误"
  }
}

// HSCode Network Inspector — packet list (left pane of the workbench).
// IDE-style table: nowrap monospace endpoints, protocol badge, right-aligned
// length/payload, horizontal scroll when narrow.

import { For, Show } from "solid-js"
import type {
  NetworkPacketSummary,
  NetworkStateSnapshot,
} from "@opencode-ai/app/network-types"

export function protoBadge(packet: NetworkPacketSummary): string {
  if (packet.application?.protocol === "HTTP") return "HTTP"
  return packet.protocol
}

export function PacketList(props: {
  packets: () => NetworkPacketSummary[]
  snapshot: NetworkStateSnapshot
  selectedId: () => string | undefined
  onSelect: (id: string) => void
  fmtTime: (t: number) => string
  collapsed: boolean
}) {
  return (
    <div class="flex-1 min-w-0 overflow-auto" data-slot="network-packet-list">
      <Show when={props.packets().length === 0 && props.snapshot.state === "idle"}>
        <div class="p-4 text-12-regular opacity-50 leading-5">
          点击「开始抓包」捕获本机 TCP/UDP/ICMP 网络数据。
          <br />
          捕获并分析当前电脑的网络数据包（需管理员权限）。
        </div>
      </Show>
      <Show when={props.snapshot.state === "capturing" && props.packets().length === 0}>
        <div class="p-4 text-12-regular opacity-50">正在监听网络流量，暂未捕获到数据包</div>
      </Show>
      <table class="w-full border-collapse text-12-regular" style={{ "table-layout": "auto" }}>
        <thead>
          <tr class="sticky top-0 bg-background-stronger text-left text-11-regular opacity-70">
            <th class="px-2 py-1.5 font-medium whitespace-nowrap">时间</th>
            <th class="px-2 py-1.5 font-medium w-8 text-center">⇄</th>
            <th class="px-2 py-1.5 font-medium whitespace-nowrap">源地址</th>
            <th class="px-2 py-1.5 font-medium whitespace-nowrap">目标地址</th>
            <th class="px-2 py-1.5 font-medium whitespace-nowrap">协议</th>
            <th class="px-2 py-1.5 font-medium whitespace-nowrap text-right">长度</th>
            <th class="px-2 py-1.5 font-medium whitespace-nowrap text-right">Payload</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.packets()}>
            {(p) => (
              <tr
                data-slot="network-row"
                onClick={() => props.onSelect(p.id)}
                class="cursor-pointer"
                classList={{
                  "network-row-selected": p.id === props.selectedId(),
                }}
                style={{
                  "border-left": p.id === props.selectedId() ? "2px solid var(--accent-1, #3fb950)" : "2px solid transparent",
                  background: p.id === props.selectedId() ? "var(--surface-base-hover, var(--v2-state-bg-success, rgba(63,185,80,0.08)))" : undefined,
                }}
              >
                <td class="px-2 py-1 whitespace-nowrap opacity-80">{props.fmtTime(p.timestamp)}</td>
                <td class="px-2 py-1 text-center">{p.direction === "outbound" ? "→" : "←"}</td>
                <td class="px-2 py-1 whitespace-nowrap" style={{ "font-family": "var(--font-mono, ui-monospace, monospace)" }}>
                  {p.sourcePort !== undefined ? `${p.sourceIp}:${p.sourcePort}` : p.sourceIp}
                </td>
                <td class="px-2 py-1 whitespace-nowrap" style={{ "font-family": "var(--font-mono, ui-monospace, monospace)" }}>
                  {p.destinationPort !== undefined ? `${p.destinationIp}:${p.destinationPort}` : p.destinationIp}
                </td>
                <td class="px-2 py-1">
                  <span
                    data-slot="protocol-badge"
                    class="inline-block px-1.5 rounded-sm text-11-regular"
                    style={{
                      background: p.protocol === "UDP" ? "var(--v2-state-bg-warning, rgba(210,153,34,0.15))" : "var(--v2-state-bg-success, rgba(63,185,80,0.12))",
                      color: p.protocol === "UDP" ? "var(--v2-state-fg-warning)" : "var(--v2-state-fg-success)",
                      border: "1px solid transparent",
                    }}
                  >
                    {protoBadge(p)}
                  </span>
                </td>
                <td class="px-2 py-1 text-right whitespace-nowrap">{p.length}</td>
                <td class="px-2 py-1 text-right whitespace-nowrap opacity-70">{p.payloadLength > 0 ? p.payloadLength : ""}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

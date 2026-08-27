// HSCode Network Inspector — detail inspector (right pane).
// Five tabs: 概览 / 协议头 / Payload / HEX / ASCII.
// 协议头 shows the structured IPv4/IPv6 + TCP/UDP headers parsed by the
// desktop parser (real fields, not a flags string).

import { For, Show, type Accessor } from "solid-js"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import type {
  NetworkDetailPayload,
  NetworkPacketSummary,
} from "@opencode-ai/app/network-types"

type ViewTab = "overview" | "headers" | "payload" | "hex" | "ascii"
const tabLabels: Record<ViewTab, string> = {
  overview: "概览",
  headers: "协议头",
  payload: "Payload",
  hex: "HEX",
  ascii: "ASCII",
}

function Row(props: { k: string; v: string; mono?: boolean }) {
  return (
    <div class="flex gap-2 py-0.5 text-12-regular">
      <span class="w-32 shrink-0 opacity-60">{props.k}</span>
      <span style={props.mono ? { "font-family": "var(--font-mono, ui-monospace, monospace)" } : undefined}>{props.v}</span>
    </div>
  )
}

function Section(props: { title: string; children?: import("solid-js").JSX.Element }) {
  return (
    <div class="mb-3" data-slot="detail-section" data-section={props.title}>
      <div class="text-11-regular font-semibold opacity-70 pb-1 mb-1" style={{ "border-bottom": "1px solid var(--border-weaker-base, rgba(128,128,128,0.2))" }}>
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

const hex = (n: number) => `0x${n.toString(16).padStart(4, "0")}`

export function DetailInspector(props: {
  packet: NetworkPacketSummary | undefined
  detail: NetworkDetailPayload | undefined
  tab: ViewTab
  onTab: (tab: ViewTab) => void
  onCollapse: () => void
}) {
  const tcpFlagsTrue = (): string[] => {
    const f = props.detail?.tcp?.flags ?? props.packet?.tcp
    if (!f) return []
    const out: string[] = []
    if ("cwr" in f && f.cwr) out.push("CWR")
    if ("ece" in f && f.ece) out.push("ECE")
    if (f.urg) out.push("URG")
    if (f.ack) out.push("ACK")
    if (f.psh) out.push("PSH")
    if (f.rst) out.push("RST")
    if (f.syn) out.push("SYN")
    if (f.fin) out.push("FIN")
    return out
  }

  return (
    <div class="flex flex-col border-l border-border-weaker-base min-h-0 h-full" data-slot="network-detail">
      {/* tabs + collapse */}
      <div class="flex items-center gap-1 px-2 py-1 shrink-0">
        {(["overview", "headers", "payload", "hex", "ascii"] as ViewTab[]).map((tab) => (
          <button
            data-slot={`detail-tab-${tab}`}
            onClick={() => props.onTab(tab)}
            class="px-2 py-0.5 rounded-sm text-12-regular"
            style={{
              background: props.tab === tab ? "var(--surface-base-hover, rgba(63,185,80,0.15))" : undefined,
              opacity: props.tab === tab ? 1 : 0.6,
              cursor: "pointer",
            }}
          >
            {tabLabels[tab]}
          </button>
        ))}
        <ButtonV2 size="small" variant="ghost" onClick={() => props.onCollapse()} class="ml-auto" aria-label="收起详情" title="收起详情">
          »
        </ButtonV2>
      </div>

      <div class="flex-1 overflow-auto p-2 whitespace-pre-wrap break-all" data-slot="network-detail-body">
        <Show when={props.packet} fallback={<span class="text-12-regular opacity-50">选择一个数据包查看详情</span>}>
          {/* ---- 概览 ---- */}
          <Show when={props.tab === "overview"}>
            <Section title="General">
              <Row k="时间" v={new Date(props.packet!.timestamp).toLocaleString()} />
              <Row k="方向" v={props.packet!.direction === "outbound" ? "出站 →" : "入站 ←"} />
              <Row k="包长度" v={`${props.packet!.length} bytes`} />
              <Row k="Payload 长度" v={`${props.packet!.payloadLength} bytes`} />
            </Section>
            <Section title="Endpoints">
              <Row k="Source" v={props.packet!.sourcePort !== undefined ? `${props.packet!.sourceIp}:${props.packet!.sourcePort}` : props.packet!.sourceIp} mono />
              <Row k="Destination" v={props.packet!.destinationPort !== undefined ? `${props.packet!.destinationIp}:${props.packet!.destinationPort}` : props.packet!.destinationIp} mono />
            </Section>
            <Show when={props.packet!.tcp}>
              <Section title="Transport — TCP">
                <For each={tcpFlagsTrue()}>{(f) => (
                  <span class="inline-block px-1.5 mr-1 rounded-sm text-11-regular" style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950" }}>{f}</span>
                )}</For>
              </Section>
            </Show>
            <Show when={props.detail?.udp}>
              <Section title="Transport — UDP">
                <Row k="Length" v={`${props.detail!.udp!.udpLength} bytes`} />
              </Section>
            </Show>
            <Show when={props.packet!.application}>
              <Section title="Application">
                <Row k="Protocol" v={props.packet!.application!.protocol ?? ""} />
                <Row k="Request" v={`${props.packet!.application!.method ?? ""} ${props.packet!.application!.path ?? ""} ${props.packet!.application!.version ?? ""}`} mono />
                <Show when={props.packet!.application!.host}>
                  <Row k="Host" v={props.packet!.application!.host!} mono />
                </Show>
                <div class="text-11-regular opacity-40 mt-1">单包解析（未做跨包流重组）</div>
              </Section>
            </Show>
          </Show>

          {/* ---- 协议头 ---- */}
          <Show when={props.tab === "headers"}>
            <Show when={!props.detail?.ip} fallback={<HeadersBody detail={props.detail} />}>
              <span class="text-12-regular opacity-50">该包无协议头数据</span>
            </Show>
          </Show>

          {/* ---- Payload ---- */}
          <Show when={props.tab === "payload"}>
            <PayloadView detail={props.detail} />
          </Show>

          {/* ---- HEX ---- */}
          <Show when={props.tab === "hex"}>
            <HexView detail={props.detail} />
          </Show>

          {/* ---- ASCII ---- */}
          <Show when={props.tab === "ascii"}>
            <div class="text-12-regular opacity-70 mb-1">Payload bytes: {props.detail?.payloadLength ?? 0}</div>
            <pre class="m-0 text-12-regular" style={{ "font-family": "var(--font-mono, ui-monospace, monospace)", "white-space": "pre-wrap", "word-break": "break-word" }}>{props.detail?.ascii ?? ""}</pre>
          </Show>
        </Show>
      </div>
    </div>
  )
}

function HeadersBody(props: { detail: NetworkDetailPayload | undefined }) {
  const ip = () => props.detail?.ip
  const v4 = (): (NonNullable<ReturnType<typeof ip>> & { version: 4 }) | undefined => {
    const value = ip()
    return value && value.version === 4 ? (value as NonNullable<typeof value> & { version: 4 }) : undefined
  }
  const v6 = (): (NonNullable<ReturnType<typeof ip>> & { version: 6 }) | undefined => {
    const value = ip()
    return value && value.version === 6 ? (value as NonNullable<typeof value> & { version: 6 }) : undefined
  }
  return (
    <div>
      <Show when={v4()}>
        <Section title={`IPv4 — ${v4()!.protocolName}`}>
          <Row k="Version" v="4" />
          <Row k="Header Length" v={`${v4()!.ihlBytes} bytes`} />
          <Row k="DSCP / ECN" v={`${v4()!.dscp} / ${v4()!.ecn}`} />
          <Row k="Total Length" v={`${v4()!.totalLength} bytes`} />
          <Row k="Identification" v={hex(v4()!.identification)} mono />
          <Row k="Flags" v={[v4()!.flags.reserved ? "R" : null, v4()!.flags.dontFragment ? "DF" : null, v4()!.flags.moreFragments ? "MF" : null].filter(Boolean).join(" ") || "—"} />
          <Row k="Fragment Offset" v={String(v4()!.fragmentOffset)} />
          <Row k="TTL" v={String(v4()!.ttl)} />
          <Row k="Protocol" v={`${v4()!.protocolNumber} (${v4()!.protocolName})`} />
          <Row k="Header Checksum" v={hex(v4()!.checksum)} mono />
          <Row k="Source IP" v={v4()!.sourceIp} mono />
          <Row k="Destination IP" v={v4()!.destinationIp} mono />
        </Section>
      </Show>
      <Show when={v6()}>
        <Section title={`IPv6 — ${v6()!.nextHeaderName}`}>
          <Row k="Version" v="6" />
          <Row k="Traffic Class" v={String(v6()!.trafficClass)} />
          <Row k="Flow Label" v={hex(v6()!.flowLabel)} mono />
          <Row k="Payload Length" v={`${v6()!.payloadLength} bytes`} />
          <Row k="Next Header" v={`${v6()!.nextHeader} (${v6()!.nextHeaderName})`} />
          <Row k="Hop Limit" v={String(v6()!.hopLimit)} />
          <Row k="Source IP" v={v6()!.sourceIp} mono />
          <Row k="Destination IP" v={v6()!.destinationIp} mono />
        </Section>
      </Show>
      <Show when={props.detail?.tcp}>
        <Section title="TCP">
          <Row k="Source Port" v={String(props.detail!.tcp!.sourcePort)} />
          <Row k="Destination Port" v={String(props.detail!.tcp!.destinationPort)} />
          <Row k="Sequence Number" v={String(props.detail!.tcp!.sequence)} mono />
          <Row k="Acknowledgment" v={String(props.detail!.tcp!.acknowledgment)} mono />
          <Row k="Header Length" v={`${props.detail!.tcp!.dataOffset} bytes`} />
          <Row k="Window Size" v={String(props.detail!.tcp!.windowSize)} />
          <Row k="Checksum" v={hex(props.detail!.tcp!.checksum)} mono />
          <Row k="Urgent Pointer" v={String(props.detail!.tcp!.urgentPointer)} />
          <div class="py-1 text-11-regular opacity-60">Flags</div>
          <div class="flex flex-wrap gap-1 pb-1">
            {(["cwr", "ece", "urg", "ack", "psh", "rst", "syn", "fin"] as const).map((name) => (
              <span
                data-flag={name}
                class="inline-block px-1.5 rounded-sm text-11-regular"
                style={{
                  background: props.detail!.tcp!.flags[name] ? "rgba(63,185,80,0.14)" : "transparent",
                  color: props.detail!.tcp!.flags[name] ? "#3fb950" : "inherit",
                  opacity: props.detail!.tcp!.flags[name] ? 1 : 0.35,
                }}
              >
                {name.toUpperCase()}
              </span>
            ))}
          </div>
          <Show when={props.detail!.tcp!.options && props.detail!.tcp!.options.length > 0}>
            <div class="py-1 text-11-regular opacity-60">Options</div>
            <For each={props.detail!.tcp!.options}>
              {(o) => (
                <div class="text-12-regular py-0.5 flex gap-2">
                  <span class="w-28 shrink-0">{o.name ?? `Kind-${o.kind}`}</span>
                  <span class="opacity-70" style={{ "font-family": "var(--font-mono, ui-monospace, monospace)" }}>
                    {o.mss !== undefined ? `MSS=${o.mss}` :
                     o.windowScale !== undefined ? `Shift=${o.windowScale}` :
                     o.sackPermitted ? "permitted" :
                     o.timestampValue !== undefined ? `${o.timestampValue} / echo ${o.timestampEcho}` :
                     o.valueHex ?? ""}
                    <Show when={o.length !== undefined}>{" "}
                      <span class="opacity-50">({o.length}B)</span>
                    </Show>
                  </span>
                </div>
              )}
            </For>
          </Show>
        </Section>
      </Show>
      <Show when={props.detail?.udp}>
        <Section title="UDP">
          <Row k="Source Port" v={String(props.detail!.udp!.sourcePort)} />
          <Row k="Destination Port" v={String(props.detail!.udp!.destinationPort)} />
          <Row k="Length" v={`${props.detail!.udp!.udpLength} bytes`} />
          <Row k="Checksum" v={hex(props.detail!.udp!.checksum)} mono />
          <Row k="Payload Length" v={`${Math.max(0, props.detail!.udp!.udpLength - 8)} bytes`} />
        </Section>
      </Show>
    </div>
  )
}

function PayloadView(props: { detail: NetworkDetailPayload | undefined }) {
  const isText = () => props.detail?.isText ?? true
  return (
    <div>
      <div class="text-11-regular opacity-60 mb-1">
        Payload · {props.detail?.payloadLength ?? 0} bytes · {isText() ? "Text" : "Binary"}
      </div>
      <Show
        when={isText()}
        fallback={
          <pre class="m-0 text-12-regular" style={{ "font-family": "var(--font-mono, ui-monospace, monospace)", "white-space": "pre", overflow: "auto" }}>
{(props.detail?.hex ?? "").split("\n").slice(0, 24).join("\n")}
{props.detail && props.detail.payloadLength > 384 ? "\n…（二进制载荷较长，请切到 HEX 查看完整内容）" : ""}
          </pre>
        }
      >
        <pre class="m-0 text-12-regular select-text" data-slot="payload-text" style={{ "font-family": "var(--font-mono, ui-monospace, monospace)", "white-space": "pre-wrap", "word-break": "break-word" }}>{props.detail?.payloadPreview ?? ""}</pre>
      </Show>
    </div>
  )
}

function HexView(props: { detail: NetworkDetailPayload | undefined }) {
  const copy = () => {
    void navigator.clipboard?.writeText(props.detail?.hex ?? "")
  }
  return (
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-11-regular opacity-60">offset hex（payload）· ascii</span>
        <ButtonV2 size="small" variant="ghost" onClick={copy} disabled={!props.detail}>复制 HEX</ButtonV2>
      </div>
      <pre class="m-0 text-12-regular select-text" data-slot="hex-body" style={{ "font-family": "var(--font-mono, ui-monospace, monospace)", "white-space": "pre", overflow: "auto" }}>{props.detail?.hex ?? ""}</pre>
    </div>
  )
}

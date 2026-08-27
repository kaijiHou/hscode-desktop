// HSCode Network Inspector — shared serializable wire types.
//
// Single source of truth for the IPC boundary between the desktop main
// process (parser/CaptureService), the preload bridge, and the renderer
// (NetworkPanel). Previously these interfaces were hand-copied in three
// places and drifted. All three sides now import from here via
// `@opencode-ai/app/network-types`.
//
// These types MUST stay JSON-serializable (no Uint8Array in summaries).

export type NetworkCaptureState = "idle" | "starting" | "capturing" | "stopping" | "error"
export type NetworkDirection = "inbound" | "outbound"
export type NetworkProtocol = "TCP" | "UDP" | "ICMP" | "OTHER"

export interface TcpFlags {
  syn: boolean
  ack: boolean
  fin: boolean
  rst: boolean
  psh: boolean
  urg: boolean
}

export interface HttpApplicationInfo {
  protocol: "HTTP"
  method?: string
  path?: string
  version?: string
  host?: string
}

/** Lightweight per-packet summary — safe to broadcast for every packet. */
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
  tcp?: TcpFlags
  payloadLength: number
  application?: HttpApplicationInfo
}

export type NetworkStateSnapshot = {
  state: NetworkCaptureState
  error?: { code: string; message: string; winError?: number }
  packetCount: number
  startTime?: number
}

export interface TcpOption {
  kind: number
  name?: string
  length?: number
  valueHex?: string
  mss?: number
  windowScale?: number
  sackPermitted?: boolean
  timestampValue?: number
  timestampEcho?: number
}

export interface TcpHeaderInfo {
  sourcePort: number
  destinationPort: number
  sequence: number
  acknowledgment: number
  dataOffset: number
  windowSize: number
  checksum: number
  urgentPointer: number
  flags: {
    cwr: boolean
    ece: boolean
    urg: boolean
    ack: boolean
    psh: boolean
    rst: boolean
    syn: boolean
    fin: boolean
  }
  options?: TcpOption[]
}

export interface UdpHeaderInfo {
  sourcePort: number
  destinationPort: number
  udpLength: number
  checksum: number
}

export interface Ipv4HeaderInfo {
  version: 4
  ihlBytes: number
  dscp: number
  ecn: number
  totalLength: number
  identification: number
  flags: { reserved: boolean; dontFragment: boolean; moreFragments: boolean }
  fragmentOffset: number
  ttl: number
  protocolNumber: number
  protocolName: string
  checksum: number
  sourceIp: string
  destinationIp: string
}

export interface Ipv6HeaderInfo {
  version: 6
  trafficClass: number
  flowLabel: number
  payloadLength: number
  nextHeader: number
  nextHeaderName: string
  hopLimit: number
  sourceIp: string
  destinationIp: string
}

/** On-demand detail for ONE selected packet (never bulk-broadcast). */
export type NetworkDetailPayload = {
  summary: NetworkPacketSummary
  hex: string
  ascii: string
  payloadLength: number
  /** Full text payload (only when isText=true, ≤64KB). undefined for binary. */
  payloadText?: string
  /** True if payload was truncated to 64KB for display. */
  payloadTruncated?: boolean
  isText: boolean
  ip?: Ipv4HeaderInfo | Ipv6HeaderInfo
  tcp?: TcpHeaderInfo
  udp?: UdpHeaderInfo
}

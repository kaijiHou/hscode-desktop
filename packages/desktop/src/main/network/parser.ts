// HSCode Network Inspector — packet model + parser (pure TS, no native deps).
// Parse raw packet bytes (as captured by WinDivert network layer) into
// structured summaries. Fully unit-testable with byte fixtures.

export type PacketDirection = "inbound" | "outbound"
export type IpVersion = 4 | 6
export type PacketProtocol = "TCP" | "UDP" | "ICMP" | "OTHER"

export interface TcpFlags {
  syn: boolean
  ack: boolean
  fin: boolean
  rst: boolean
  psh: boolean
  urg: boolean
  sequence?: number
  acknowledgment?: number
}

/** Full TCP header fields (detail view only — summaries stay lightweight). */
export interface TcpHeaderInfo {
  sourcePort: number
  destinationPort: number
  sequence: number
  acknowledgment: number
  /** Data offset in bytes (20–60). */
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

export interface TcpOption {
  kind: number
  name?: string
  length?: number
  valueHex?: string
  // decoded convenience fields
  mss?: number
  windowScale?: number
  sackPermitted?: boolean
  timestampValue?: number
  timestampEcho?: number
}

/** Full UDP header fields (detail view only). */
export interface UdpHeaderInfo {
  sourcePort: number
  destinationPort: number
  /** UDP length field incl. the 8-byte header. */
  udpLength: number
  checksum: number
}

/** Full IPv4 header fields (detail view only). */
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

/** Full IPv6 header fields (detail view only). */
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

export interface HttpApplicationInfo {
  protocol: "HTTP"
  method: string
  path: string
  version: string
  host?: string
}

export interface PacketSummary {
  id: string
  timestamp: number
  direction: PacketDirection
  ipVersion: IpVersion
  protocol: PacketProtocol
  sourceIp: string
  destinationIp: string
  sourcePort?: number
  destinationPort?: number
  length: number
  tcp?: TcpFlags
  payloadLength: number
  application?: HttpApplicationInfo
}

export interface PacketDetail {
  summary: PacketSummary
  raw: Uint8Array
  payload: Uint8Array
  hex: string
  ascii: string
  /** Structured protocol headers for the detail inspector. */
  ip?: Ipv4HeaderInfo | Ipv6HeaderInfo
  tcp?: TcpHeaderInfo
  udp?: UdpHeaderInfo
}

export interface ParseOptions {
  timestamp?: number
  direction?: PacketDirection
}

export class PacketParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PacketParseError"
  }
}

let idCounter = 0

function nextId(): string {
  idCounter += 1
  return `pkt-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

function ipv4ToString(bytes: Uint8Array, offset: number): string {
  return `${bytes[offset]}.${bytes[offset + 1]}.${bytes[offset + 2]}.${bytes[offset + 3]}`
}

function ipv6ToString(bytes: Uint8Array, offset: number): string {
  const groups: string[] = []
  for (let i = 0; i < 16; i += 2) {
    groups.push(((bytes[offset + i] << 8) | bytes[offset + i + 1]).toString(16))
  }
  // Compress the longest run of zero groups (RFC 5952)
  let compressStart = -1
  let compressLen = 0
  let runStart = -1
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (runStart < 0) runStart = i
      const len = i - runStart + 1
      if (len > compressLen) {
        compressLen = len
        compressStart = runStart
      }
    } else {
      runStart = -1
    }
  }
  if (compressLen >= 2) {
    const head = groups.slice(0, compressStart).join(":")
    const tail = groups.slice(compressStart + compressLen).join(":")
    return `${head}::${tail}`
  }
  return groups.join(":")
}

export function formatHex(bytes: Uint8Array, bytesPerLine = 16): string {
  const lines: string[] = []
  for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
    const slice = bytes.slice(offset, offset + bytesPerLine)
    const hexPart: string[] = []
    for (let i = 0; i < bytesPerLine; i++) {
      if (i < slice.length) hexPart.push(slice[i].toString(16).padStart(2, "0"))
      else hexPart.push("  ")
    }
    const addr = offset.toString(16).padStart(4, "0")
    lines.push(`${addr}  ${hexPart.join(" ")}  ${formatAscii(slice)}`)
  }
  return lines.join("\n")
}

export function formatAscii(bytes: Uint8Array): string {
  let out = ""
  for (const b of bytes) {
    if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b)
    else out += "."
  }
  return out
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

// Packet-local HTTP request detection: complete request line + headers present
// in a single TCP payload. No stream reassembly in MVP.
export function detectHttp(payload: Uint8Array): HttpApplicationInfo | undefined {
  if (payload.length < 16) return undefined
  // Must start with a known method + space within the first 8 bytes
  for (const method of HTTP_METHODS) {
    if (payload.length < method.length + 1) continue
    let match = true
    for (let i = 0; i < method.length; i++) {
      if (payload[i] !== method.charCodeAt(i)) {
        match = false
        break
      }
    }
    if (!match || payload[method.length] !== 0x20) continue

    // Parse request line: METHOD SP path SP HTTP/x.y CRLF
    const lineEnd = indexOfCrlf(payload, method.length)
    if (lineEnd < 0) return undefined
    const line = new TextDecoder().decode(payload.slice(0, lineEnd))
    const parts = line.split(" ")
    if (parts.length < 3) return undefined
    const [, path, version] = parts
    if (!version.startsWith("HTTP/")) return undefined

    // Host header (case-insensitive), if present in this payload
    let host: string | undefined
    let cursor = lineEnd + 2
    while (cursor < payload.length) {
      const headerEnd = indexOfCrlf(payload, cursor)
      if (headerEnd < 0) break
      if (headerEnd === cursor) break // blank line = end of headers
      const headerLine = new TextDecoder().decode(payload.slice(cursor, headerEnd))
      const colon = headerLine.indexOf(":")
      if (colon > 0) {
        const name = headerLine.slice(0, colon).trim().toLowerCase()
        if (name === "host") host = headerLine.slice(colon + 1).trim()
      }
      cursor = headerEnd + 2
    }

    return { protocol: "HTTP", method, path, version, host }
  }
  return undefined
}

function indexOfCrlf(bytes: Uint8Array, from: number): number {
  for (let i = from; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) return i
  }
  return -1
}

function protocolName(num: number): string {
  if (num === 1) return "ICMP"
  if (num === 2) return "IGMP"
  if (num === 6) return "TCP"
  if (num === 17) return "UDP"
  if (num === 47) return "GRE"
  if (num === 50) return "ESP"
  if (num === 58) return "IPv6-ICMP"
  if (num === 89) return "OSPF"
  if (num === 132) return "SCTP"
  return `Proto-${num}`
}

function parseTcpHeader(segment: Uint8Array): TcpHeaderInfo {
  const sourcePort = (segment[0] << 8) | segment[1]
  const destinationPort = (segment[2] << 8) | segment[3]
  const sequence = ((segment[4] << 24) | (segment[5] << 16) | (segment[6] << 8) | segment[7]) >>> 0
  const acknowledgment = ((segment[8] << 24) | (segment[9] << 16) | (segment[10] << 8) | segment[11]) >>> 0
  const dataOffset = (segment[12] >> 4) * 4
  const flagsByte = segment[13]
  const flags = {
    cwr: (flagsByte & 0x80) !== 0,
    ece: (flagsByte & 0x40) !== 0,
    urg: (flagsByte & 0x20) !== 0,
    ack: (flagsByte & 0x10) !== 0,
    psh: (flagsByte & 0x08) !== 0,
    rst: (flagsByte & 0x04) !== 0,
    syn: (flagsByte & 0x02) !== 0,
    fin: (flagsByte & 0x01) !== 0,
  }
  const windowSize = (segment[14] << 8) | segment[15]
  const checksum = (segment[16] << 8) | segment[17]
  const urgentPointer = (segment[18] << 8) | segment[19]

  let options: TcpOption[] | undefined
  if (dataOffset > 20 && segment.length >= dataOffset) {
    options = parseTcpOptions(segment.slice(20, dataOffset))
  }

  return { sourcePort, destinationPort, sequence, acknowledgment, dataOffset, windowSize, checksum, urgentPointer, flags, options }
}

const TCP_OPTION_NAMES: Record<number, string> = {
  0: "EOL",
  1: "NOP",
  2: "MSS",
  3: "Window Scale",
  4: "SACK Permitted",
  5: "SACK",
  8: "Timestamp",
}

export function parseTcpOptions(bytes: Uint8Array): TcpOption[] {
  const options: TcpOption[] = []
  let i = 0
  while (i < bytes.length) {
    const kind = bytes[i]
    if (kind === 0) {
      options.push({ kind: 0, name: "EOL" })
      break
    }
    if (kind === 1) {
      options.push({ kind: 1, name: "NOP" })
      i += 1
      continue
    }
    // kind + length prefixed options; guard against malformed lengths
    if (i + 1 >= bytes.length) {
      // truncated option: record what we saw instead of dropping silently
      options.push({ kind, valueHex: formatHex(bytes.slice(i)) })
      break
    }
    const length = bytes[i + 1]
    if (length < 2 || i + length > bytes.length) {
      options.push({ kind, valueHex: formatHex(bytes.slice(i)) })
      break
    }
    const value = bytes.slice(i + 2, i + length)
    const option: TcpOption = { kind, name: TCP_OPTION_NAMES[kind], length, valueHex: formatHex(value) }
    if (kind === 2 && value.length === 2) option.mss = (value[0] << 8) | value[1]
    if (kind === 3 && value.length === 1) option.windowScale = value[0]
    if (kind === 4) option.sackPermitted = true
    if (kind === 8 && value.length === 8) {
      option.timestampValue =
        ((value[0] << 24) | (value[1] << 16) | (value[2] << 8) | value[3]) >>> 0
      option.timestampEcho =
        ((value[4] << 24) | (value[5] << 16) | (value[6] << 8) | value[7]) >>> 0
    }
    options.push(option)
    i += length
  }
  return options
}

function parseUdpHeader(payload: Uint8Array): UdpHeaderInfo {
  const declared = (payload[4] << 8) | payload[5]
  // A UDP length of 0 (or less than the header) is invalid — fall back to the
  // actual datagram size so the detail view never shows a bogus length.
  const udpLength = declared >= 8 && declared <= payload.length ? declared : payload.length
  return {
    sourcePort: (payload[0] << 8) | payload[1],
    destinationPort: (payload[2] << 8) | payload[3],
    udpLength,
    checksum: (payload[6] << 8) | payload[7],
  }
}

function parseIpv4Header(raw: Uint8Array): Ipv4HeaderInfo {
  const ihlBytes = (raw[0] & 0x0f) * 4
  const flagsByte = raw[6] >> 5
  return {
    version: 4,
    ihlBytes,
    dscp: raw[1] >> 2,
    ecn: raw[1] & 0x03,
    totalLength: (raw[2] << 8) | raw[3],
    identification: (raw[4] << 8) | raw[5],
    flags: {
      reserved: (flagsByte & 0x04) !== 0,
      dontFragment: (flagsByte & 0x02) !== 0,
      moreFragments: (flagsByte & 0x01) !== 0,
    },
    fragmentOffset: ((raw[6] & 0x1f) << 8) | raw[7],
    ttl: raw[8],
    protocolNumber: raw[9],
    protocolName: protocolName(raw[9]),
    checksum: (raw[10] << 8) | raw[11],
    sourceIp: ipv4ToString(raw, 12),
    destinationIp: ipv4ToString(raw, 16),
  }
}

function parseIpv6Header(raw: Uint8Array): Ipv6HeaderInfo {
  const trafficClassFlowLabel = ((raw[1] << 16) | (raw[2] << 8) | raw[3]) >>> 0
  const nextHeader = raw[6]
  return {
    version: 6,
    trafficClass: trafficClassFlowLabel >> 20,
    flowLabel: trafficClassFlowLabel & 0xfffff,
    payloadLength: (raw[4] << 8) | raw[5],
    nextHeader,
    nextHeaderName: nextHeader === 58 ? "ICMPv6" : protocolName(nextHeader),
    hopLimit: raw[7],
    sourceIp: ipv6ToString(raw, 8),
    destinationIp: ipv6ToString(raw, 24),
  }
}

export function parsePacket(raw: Uint8Array, options: ParseOptions = {}): PacketSummary {
  if (raw.length < 20) throw new PacketParseError("packet too short")

  const version = raw[0] >> 4
  if (version === 4) return parseIpv4(raw, options)
  if (version === 6) return parseIpv6(raw, options)
  throw new PacketParseError(`unsupported IP version ${version}`)
}

function parseIpv4(raw: Uint8Array, options: ParseOptions): PacketSummary {
  if (raw.length < 20) throw new PacketParseError("IPv4 header truncated")
  const ihl = (raw[0] & 0x0f) * 4
  if (ihl < 20) throw new PacketParseError("invalid IPv4 header length")
  if (raw.length < ihl) throw new PacketParseError("IPv4 header exceeds packet")

  const protocolByte = raw[9]
  const sourceIp = ipv4ToString(raw, 12)
  const destinationIp = ipv4ToString(raw, 16)
  const totalLength = (raw[2] << 8) | raw[3]
  const length = totalLength >= ihl && totalLength <= raw.length ? totalLength : raw.length

  const base: Omit<PacketSummary, "protocol"> = {
    id: nextId(),
    timestamp: options.timestamp ?? Date.now(),
    direction: options.direction ?? "outbound",
    ipVersion: 4,
    sourceIp,
    destinationIp,
    length,
    payloadLength: 0,
  }

  const payload = raw.slice(ihl, length)

  if (protocolByte === 6) return { ...base, protocol: "TCP", ...parseTcp(payload, sourceIp, destinationIp) }
  if (protocolByte === 17) return { ...base, protocol: "UDP", ...parseUdp(payload) }
  if (protocolByte === 1) return { ...base, protocol: "ICMP", payloadLength: payload.length }

  return { ...base, protocol: "OTHER", payloadLength: payload.length }
}

function parseIpv6(raw: Uint8Array, options: ParseOptions): PacketSummary {
  if (raw.length < 40) throw new PacketParseError("IPv6 header truncated")
  const sourceIp = ipv6ToString(raw, 8)
  const destinationIp = ipv6ToString(raw, 24)
  const payloadLengthField = (raw[4] << 8) | raw[5]
  const nextHeader = raw[6]
  const length = 40 + payloadLengthField

  const base: Omit<PacketSummary, "protocol"> = {
    id: nextId(),
    timestamp: options.timestamp ?? Date.now(),
    direction: options.direction ?? "outbound",
    ipVersion: 6,
    sourceIp,
    destinationIp,
    length: length <= raw.length ? length : raw.length,
    payloadLength: 0,
  }

  const payload = raw.slice(40, base.length)

  if (nextHeader === 6) return { ...base, protocol: "TCP", ...parseTcp(payload, sourceIp, destinationIp) }
  if (nextHeader === 17) return { ...base, protocol: "UDP", ...parseUdp(payload) }
  if (nextHeader === 58) return { ...base, protocol: "ICMP", payloadLength: payload.length }

  return { ...base, protocol: "OTHER", payloadLength: payload.length }
}

function parseTcp(
  payload: Uint8Array,
  sourceIp: string,
  destinationIp: string,
): Pick<PacketSummary, "sourcePort" | "destinationPort" | "tcp" | "payloadLength" | "application"> {
  if (payload.length < 20) throw new PacketParseError("TCP header truncated")
  const sourcePort = (payload[0] << 8) | payload[1]
  const destinationPort = (payload[2] << 8) | payload[3]
  const sequence = ((payload[4] << 24) | (payload[5] << 16) | (payload[6] << 8) | payload[7]) >>> 0
  const acknowledgment = ((payload[8] << 24) | (payload[9] << 16) | (payload[10] << 8) | payload[11]) >>> 0
  const dataOffset = (payload[12] >> 4) * 4
  if (dataOffset < 20) throw new PacketParseError("invalid TCP data offset")
  const flagsByte1 = payload[13]
  const urg = (flagsByte1 & 0x20) !== 0
  const ack = (flagsByte1 & 0x10) !== 0
  const psh = (flagsByte1 & 0x08) !== 0
  const rst = (flagsByte1 & 0x04) !== 0
  const syn = (flagsByte1 & 0x02) !== 0
  const fin = (flagsByte1 & 0x01) !== 0

  const appPayload = payload.slice(dataOffset)
  const application = detectHttp(appPayload)
  return {
    sourcePort,
    destinationPort,
    tcp: { syn, ack, fin, rst, psh, urg, sequence, acknowledgment },
    payloadLength: appPayload.length,
    application,
  }
}

function parseUdp(payload: Uint8Array): Pick<PacketSummary, "sourcePort" | "destinationPort" | "payloadLength"> {
  if (payload.length < 8) throw new PacketParseError("UDP header truncated")
  const sourcePort = (payload[0] << 8) | payload[1]
  const destinationPort = (payload[2] << 8) | payload[3]
  const udpLength = (payload[4] << 8) | payload[5]
  const length = udpLength >= 8 && udpLength <= payload.length ? udpLength : payload.length
  return { sourcePort, destinationPort, payloadLength: length - 8 }
}

export function buildDetail(summary: PacketSummary, raw: Uint8Array): PacketDetail {
  // Re-derive payload offset from the raw packet (same logic as parse) so the
  // detail view shows the payload bytes, not a guess. Also extract the full
  // structured protocol headers for the detail inspector.
  const version = raw[0] >> 4
  let payload: Uint8Array
  let ip: Ipv4HeaderInfo | Ipv6HeaderInfo | undefined
  let tcp: TcpHeaderInfo | undefined
  let udp: UdpHeaderInfo | undefined
  if (version === 4) {
    ip = parseIpv4Header(raw)
    const ihl = (raw[0] & 0x0f) * 4
    const total = (raw[2] << 8) | raw[3]
    const end = total >= ihl && total <= raw.length ? total : raw.length
    const protocol = raw[9]
    if (protocol === 6) {
      const segment = raw.slice(ihl, Math.min(end, raw.length))
      tcp = parseTcpHeader(segment)
      payload = raw.slice(ihl + tcp.dataOffset, end)
    } else if (protocol === 17) {
      const datagram = raw.slice(ihl, Math.min(end, raw.length))
      udp = parseUdpHeader(datagram)
      payload = raw.slice(ihl + 8, end)
    } else {
      payload = raw.slice(ihl, end)
    }
  } else {
    ip = parseIpv6Header(raw)
    const plen = (raw[4] << 8) | raw[5]
    const end = 40 + plen
    const header = raw[6]
    if (header === 6) {
      const segment = raw.slice(40)
      tcp = parseTcpHeader(segment)
      payload = raw.slice(40 + tcp.dataOffset, end)
    } else if (header === 17) {
      udp = parseUdpHeader(raw.slice(40))
      payload = raw.slice(48, end)
    } else {
      payload = raw.slice(40, end)
    }
  }
  return {
    summary,
    raw,
    payload,
    hex: formatHex(payload),
    ascii: formatAscii(payload),
    ip,
    tcp,
    udp,
  }
}
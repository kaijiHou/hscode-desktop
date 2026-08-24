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
  // detail view shows the payload bytes, not a guess.
  const version = raw[0] >> 4
  let payload: Uint8Array
  if (version === 4) {
    const ihl = (raw[0] & 0x0f) * 4
    const total = (raw[2] << 8) | raw[3]
    const end = total >= ihl && total <= raw.length ? total : raw.length
    const protocol = raw[9]
    if (protocol === 6) {
      const tcp = raw.slice(ihl, Math.min(end, raw.length))
      const dataOffset = (tcp[12] >> 4) * 4
      payload = raw.slice(ihl + dataOffset, end)
    } else {
      payload = raw.slice(ihl + 8, end)
    }
  } else {
    const plen = (raw[4] << 8) | raw[5]
    const end = 40 + plen
    const header = raw[6]
    if (header === 6) {
      const tcp = raw.slice(40)
      const dataOffset = (tcp[12] >> 4) * 4
      payload = raw.slice(40 + dataOffset, end)
    } else {
      payload = raw.slice(48, end)
    }
  }
  return {
    summary,
    raw,
    payload,
    hex: formatHex(payload),
    ascii: formatAscii(payload),
  }
}
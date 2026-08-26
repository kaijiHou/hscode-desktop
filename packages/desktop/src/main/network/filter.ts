// HSCode Network Inspector — filter language.
// A small, explicit HSCode filter grammar (NOT a Wireshark-compatible parser).
//
// Supported:
//   Protocol:   tcp | udp | icmp
//   Port:       port == 22122  |  tcp.port == 22122  |  udp.port == 5000
//   IP:         ip == 192.168.1.10  |  src.ip == ...  |  dst.ip == ...
//   Direction:  direction == inbound  |  direction == outbound
//   Compound:   tcp and port == 22122  |  ip == 1.2.3.4 and port == 80
//
// User-level AND compiles to WinDivert AND.
// Sub-expressions (e.g. srcPort OR dstPort) use OR internally.

export class FilterValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FilterValidationError"
  }
}

export interface ParsedFilter {
  /** Normalized HSCode filter (trimmed, joined by " and ") */
  display: string
  /** WinDivert filter string compiled from this filter */
  windivert: string
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function isValidIpv4(value: string): boolean {
  const m = IPV4_RE.exec(value)
  if (!m) return false
  return m
    .slice(1)
    .every((part) => {
      const n = Number(part)
      return n >= 0 && n <= 255
    })
}

function protoCode(proto: string): number {
  switch (proto) {
    case "tcp":
      return 6
    case "udp":
      return 17
    case "icmp":
      return 1
    default:
      return 0
  }
}

/** Build a WinDivert clause that matches the given protocol on either IPv4 or IPv6. */
function buildProtocolClause(proto: string): string {
  const code = protoCode(proto)
  return `(ipv4.Protocol == ${code} or ipv6.NextHeader == ${code})`
}

/** Build a WinDivert clause for generic port == N (both TCP and UDP, both directions). */
function buildGenericPortClause(port: number): string {
  return (
    `((ipv4.Protocol == 6 and (tcp.SrcPort == ${port} or tcp.DstPort == ${port})) or ` +
    `(ipv4.Protocol == 17 and (udp.SrcPort == ${port} or udp.DstPort == ${port})))`
  )
}

/** Build a WinDivert clause for generic ip == X (src OR dst). */
function buildGenericIpClause(ip: string): string {
  return `ipv4.SrcAddr == ${ip} or ipv4.DstAddr == ${ip}`
}

/** Build a WinDivert clause for direction == inbound/outbound. */
function buildDirectionClause(direction: string): string {
  if (direction === "inbound") return "inbound"
  if (direction === "outbound") return "outbound"
  throw new FilterValidationError(`invalid direction: "${direction}"`)
}

/** Parse a single filter token into a WinDivert clause. */
function parseToken(token: string): string {
  const t = token.trim().toLowerCase()

  // bare protocol: tcp / udp / icmp
  const protoOnly = /^(tcp|udp|icmp)$/.exec(t)
  if (protoOnly) {
    return buildProtocolClause(protoOnly[1])
  }

  // field == value expressions
  const expr = /^([a-z][a-z0-9_.]*)\s*(==)\s*(.+)$/i.exec(t)
  if (!expr) throw new FilterValidationError(`invalid filter clause: "${token}"`)

  const [, field, , rawValue] = expr
  const value = rawValue.trim()
  const f = field.toLowerCase()

  // tcp.port / udp.port
  const portRe = /^(tcp|udp)\.port$/i.exec(f)
  if (portRe) {
    const port = Number(value)
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new FilterValidationError(`invalid port: "${value}"`)
    }
    const proto = portRe[1].toLowerCase()
    const code = protoCode(proto)
    return (
      `((ipv4.Protocol == ${code} and (${proto}.SrcPort == ${port} or ${proto}.DstPort == ${port})) or ` +
      `(ipv6.NextHeader == ${code} and (${proto}.SrcPort == ${port} or ${proto}.DstPort == ${port})))`
    )
  }

  // generic port == N
  if (f === "port") {
    const port = Number(value)
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new FilterValidationError(`invalid port: "${value}"`)
    }
    return buildGenericPortClause(port)
  }

  // src.ip / dst.ip
  if (f === "src.ip" || f === "dst.ip") {
    if (!isValidIpv4(value)) throw new FilterValidationError(`invalid IPv4 address: "${value}"`)
    const fieldName = f === "src.ip" ? "ipv4.SrcAddr" : "ipv4.DstAddr"
    return `ipv4.Protocol != 0 and ${fieldName} == ${value}`
  }

  // generic ip == X
  if (f === "ip") {
    if (!isValidIpv4(value)) throw new FilterValidationError(`invalid IPv4 address: "${value}"`)
    return buildGenericIpClause(value)
  }

  // direction == inbound / outbound
  if (f === "direction") {
    return buildDirectionClause(value)
  }

  throw new FilterValidationError(`unknown filter field: "${field}"`)
}

/**
 * Parse an HSCode filter into WinDivert filter syntax.
 *
 * User-level AND compiles to WinDivert AND.
 * Sub-expression alternatives (e.g. srcPort OR dstPort) use OR internally.
 */
export function parseFilter(input: string): ParsedFilter {
  const trimmed = input.trim()
  if (!trimmed) {
    return { display: "", windivert: "true" }
  }

  // Single bare protocol shortcut
  const protocolOnly = /^(tcp|udp|icmp)$/i.exec(trimmed)
  if (protocolOnly) {
    return {
      display: protocolOnly[1].toLowerCase(),
      windivert: buildProtocolClause(protocolOnly[1].toLowerCase()),
    }
  }

  // Split on " and " / "&&"
  const parts = trimmed
    .split(/\s+(?:and|&&)\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (parts.length === 0) throw new FilterValidationError("empty filter")

  const clauses: string[] = []
  const displayParts: string[] = []

  for (const part of parts) {
    clauses.push(parseToken(part))
    displayParts.push(part.toLowerCase())
  }

  // User AND → WinDivert AND
  return {
    display: displayParts.join(" and "),
    windivert: clauses.join(" and "),
  }
}

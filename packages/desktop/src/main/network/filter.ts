// HSCode Network Inspector — filter language.
// A small, explicit HSCode filter grammar (NOT a Wireshark-compatible parser).
//
// Supported:
//   tcp | udp | icmp
//   tcp.port == 22122        (both directions)
//   udp.port == 5000
//   src.ip == 192.168.1.10
//   dst.ip == 192.168.1.20
//
// Unknown tokens / malformed expressions produce a structured validation error.

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
  return m.slice(1).every((part) => {
    const n = Number(part)
    return n >= 0 && n <= 255
  })
}

const TOKEN_RE = /^[a-z][a-z0-9_.]*$/i

/** Parse an HSCode filter into winDivert filter syntax. */
export function parseFilter(input: string): ParsedFilter {
  const trimmed = input.trim()
  if (!trimmed) {
    return { display: "", windivert: "true" }
  }

  const clauses: string[] = []
  // Split on " and " / "&&" — no parentheses, no OR in MVP.
  const parts = trimmed
    .split(/\s+(?:and|&&)\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (parts.length === 0) throw new FilterValidationError("empty filter")

  // Recognize a single bare protocol keyword (tcp/udp/icmp).
  const protocolOnly = /^(tcp|udp|icmp)$/i.exec(trimmed)
  if (protocolOnly) {
    return {
      display: protocolOnly[1].toLowerCase(),
      windivert: `ipv4.Protocol == ${protoCode(protocolOnly[1])} or ipv6.NextHeader == ${protoCode(protocolOnly[1])}`,
    }
  }

  for (const part of parts) {
    // Expression forms: field op value
    const expr = /^([a-z][a-z0-9_.]*)\s*(==)\s*(.+)$/i.exec(part)
    if (!expr) throw new FilterValidationError(`invalid filter clause: "${part}"`)

    const [, field, , rawValue] = expr
    const value = rawValue.trim()
    const f = field.toLowerCase()

    if (f === "tcp" || f === "udp" || f === "icmp") {
      // bare protocol inside a compound filter
      if (value !== "") throw new FilterValidationError(`protocol clause "${field}" does not take a value`)
      clauses.push(buildProtocolClause(f))
      continue
    }

    const portRe = /^(tcp|udp)\.port$/i.exec(f)
    if (portRe) {
      const port = Number(value)
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new FilterValidationError(`invalid port: "${value}"`)
      }
      const proto = portRe[1].toLowerCase()
      const code = protoCode(proto)
      // WinDivert: tcp.SrcPort / tcp.DstPort are only valid on TCP packets,
      // udp 同理。先判断协议再取端口，避免非目标协议包上字段无效。
      clauses.push(
        `((ipv4.Protocol == ${code} and (${proto}.SrcPort == ${port} or ${proto}.DstPort == ${port})) or (ipv6.NextHeader == ${code} and (${proto}.SrcPort == ${port} or ${proto}.DstPort == ${port})))`,
      )
      continue
    }

    if (f === "src.ip" || f === "dst.ip") {
      if (!isValidIpv4(value)) throw new FilterValidationError(`invalid IPv4 address: "${value}"`)
      const isSrc = f === "src.ip"
      const fieldName = isSrc ? "ipv4.SrcAddr" : "ipv4.DstAddr"
      clauses.push(`ipv4.Protocol != 0 and ${fieldName} == ${value}`)
      continue
    }

    throw new FilterValidationError(`unknown filter field: "${field}"`)
  }

  return {
    display: clauses.join(" and "),
    windivert: clauses.join(" or "),
  }
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

function buildProtocolClause(proto: string): string {
  const code = protoCode(proto)
  return `(ipv4.Protocol == ${code} or ipv6.NextHeader == ${code})`
}
/**
 * HSCode Network Capture — filter builder for the renderer.
 *
 * Converts UI filter state (protocol, IP, port, direction, advanced)
 * into an HSCode filter expression accepted by desktop parseFilter().
 */

export interface FilterState {
  protocol: "" | "tcp" | "udp" | "icmp"
  ip: string
  port: string
  direction: "" | "inbound" | "outbound"
  advanced: string
}

/**
 * Build an HSCode filter expression from UI filter state.
 * Returns empty string if no filters are set.
 */
export function buildFilter(state: FilterState): string {
  const parts: string[] = []

  if (state.protocol) {
    parts.push(state.protocol)
  }

  const ip = state.ip.trim()
  if (ip) {
    parts.push(`ip == ${ip}`)
  }

  const port = state.port.trim()
  if (port) {
    parts.push(`port == ${port}`)
  }

  if (state.direction) {
    parts.push(`direction == ${state.direction}`)
  }

  const advanced = state.advanced.trim()
  if (advanced) {
    parts.push(advanced)
  }

  return parts.join(" and ")
}

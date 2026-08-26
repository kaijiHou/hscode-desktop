/**
 * HSCode: Terminal / Network panel state transitions.
 *
 * These are pure functions — no SolidJS, no stores, no side effects.
 * Used by both layout.tsx (production) and tests (validation).
 *
 * Invariant: after any transition, terminal && network must never both be true.
 */

export interface PanelState {
  terminal: boolean
  network: boolean
}

/**
 * Compute next state when user clicks Terminal toggle.
 * - If terminal was off → turn on, close network.
 * - If terminal was on → turn off (network stays as-is).
 */
export function computeTerminalToggle(current: PanelState): PanelState {
  const nextTerminal = !current.terminal
  return {
    terminal: nextTerminal,
    network: nextTerminal ? false : current.network,
  }
}

/**
 * Compute next state when user clicks Network toggle.
 * - If network was off → turn on, close terminal.
 * - If network was on → turn off (terminal stays as-is).
 */
export function computeNetworkToggle(current: PanelState): PanelState {
  const nextNetwork = !current.network
  return {
    terminal: nextNetwork ? false : current.terminal,
    network: nextNetwork,
  }
}

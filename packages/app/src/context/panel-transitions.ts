/**
 * HSCode: Terminal / Network panel state transitions.
 *
 * Pure functions — no SolidJS, no stores, no side effects.
 * Used by layout.tsx (production) and tests (validation).
 *
 * Invariant: after any transition, terminal && network must never both be true.
 */

export interface PanelState {
  terminal: boolean
  network: boolean
}

/** Open terminal panel — always closes network. */
export function openTerminal(current: PanelState): PanelState {
  return { terminal: true, network: false }
}

/** Close terminal panel — network unchanged. */
export function closeTerminal(current: PanelState): PanelState {
  return { terminal: false, network: current.network }
}

/** Toggle terminal — if off: open & close network; if on: close. */
export function toggleTerminal(current: PanelState): PanelState {
  return current.terminal
    ? { terminal: false, network: current.network }
    : { terminal: true, network: false }
}

/** Open network panel — always closes terminal. */
export function openNetwork(current: PanelState): PanelState {
  return { terminal: false, network: true }
}

/** Close network panel — terminal unchanged. */
export function closeNetwork(current: PanelState): PanelState {
  return { terminal: current.terminal, network: false }
}

/** Toggle network — if off: open & close terminal; if on: close. */
export function toggleNetwork(current: PanelState): PanelState {
  return current.network
    ? { terminal: current.terminal, network: false }
    : { terminal: false, network: true }
}

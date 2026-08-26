import { describe, expect, test } from "bun:test"
import { computeTerminalToggle, computeNetworkToggle, type PanelState } from "./panel-transitions"

/**
 * Regression test for terminal/network mutual exclusion.
 *
 * Tests the PRODUCTION panel-transitions.ts directly — no copied logic.
 * layout.tsx imports the same computeTerminalToggle/computeNetworkToggle.
 */

describe("panel-transitions (production code)", () => {
  test("Case 1: both false → click Terminal → terminal=true, network=false", () => {
    const result = computeTerminalToggle({ terminal: false, network: false })
    expect(result).toEqual({ terminal: true, network: false })
  })

  test("Case 2: terminal=true → click Network → terminal=false, network=true", () => {
    const result = computeNetworkToggle({ terminal: true, network: false })
    expect(result).toEqual({ terminal: false, network: true })
  })

  test("Case 3: network=true → click Terminal → terminal=true, network=false", () => {
    const result = computeTerminalToggle({ terminal: false, network: true })
    expect(result).toEqual({ terminal: true, network: false })
  })

  test("Case 4: network=true → click Network again → network=false", () => {
    const result = computeNetworkToggle({ terminal: false, network: true })
    expect(result).toEqual({ terminal: false, network: false })
  })

  test("Case 5: terminal=true → click Terminal again → terminal=false", () => {
    const result = computeTerminalToggle({ terminal: true, network: false })
    expect(result).toEqual({ terminal: false, network: false })
  })

  test("Case 6: rapid alternation — never both true", () => {
    let state: PanelState = { terminal: false, network: false }
    for (let i = 0; i < 20; i++) {
      state = i % 2 === 0
        ? computeTerminalToggle(state)
        : computeNetworkToggle(state)
      // Invariant: never both true
      expect(state.terminal && state.network).toBe(false)
    }
  })

  test("Case 7: arbitrary state → toggle always preserves invariant", () => {
    const states: PanelState[] = [
      { terminal: false, network: false },
      { terminal: true, network: false },
      { terminal: false, network: true },
    ]
    for (const s of states) {
      const t = computeTerminalToggle(s)
      expect(t.terminal && t.network).toBe(false)
      const n = computeNetworkToggle(s)
      expect(n.terminal && n.network).toBe(false)
    }
  })
})

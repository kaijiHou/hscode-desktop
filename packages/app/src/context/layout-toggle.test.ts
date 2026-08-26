import { describe, expect, test } from "bun:test"
import {
  openTerminal,
  closeTerminal,
  toggleTerminal,
  openNetwork,
  closeNetwork,
  toggleNetwork,
  type PanelState,
} from "./panel-transitions"

/**
 * Regression test for terminal/network mutual exclusion.
 *
 * Tests the PRODUCTION panel-transitions.ts directly — no copied logic.
 * layout.tsx imports the same open/close/toggle functions.
 */

describe("panel-transitions (production code)", () => {
  test("openTerminal: always opens terminal, closes network", () => {
    expect(openTerminal({ terminal: false, network: false })).toEqual({ terminal: true, network: false })
    expect(openTerminal({ terminal: true, network: false })).toEqual({ terminal: true, network: false })
    expect(openTerminal({ terminal: false, network: true })).toEqual({ terminal: true, network: false })
    expect(openTerminal({ terminal: true, network: true })).toEqual({ terminal: true, network: false })
  })

  test("openNetwork: always opens network, closes terminal", () => {
    expect(openNetwork({ terminal: false, network: false })).toEqual({ terminal: false, network: true })
    expect(openNetwork({ terminal: false, network: true })).toEqual({ terminal: false, network: true })
    expect(openNetwork({ terminal: true, network: false })).toEqual({ terminal: false, network: true })
    expect(openNetwork({ terminal: true, network: true })).toEqual({ terminal: false, network: true })
  })

  test("closeTerminal: closes terminal, network unchanged", () => {
    expect(closeTerminal({ terminal: true, network: false })).toEqual({ terminal: false, network: false })
    expect(closeTerminal({ terminal: true, network: true })).toEqual({ terminal: false, network: true })
  })

  test("closeNetwork: closes network, terminal unchanged", () => {
    expect(closeNetwork({ terminal: false, network: true })).toEqual({ terminal: false, network: false })
    expect(closeNetwork({ terminal: true, network: true })).toEqual({ terminal: true, network: false })
  })

  test("toggleTerminal: off→on (close network); on→off (keep network)", () => {
    expect(toggleTerminal({ terminal: false, network: false })).toEqual({ terminal: true, network: false })
    expect(toggleTerminal({ terminal: false, network: true })).toEqual({ terminal: true, network: false })
    expect(toggleTerminal({ terminal: true, network: false })).toEqual({ terminal: false, network: false })
    expect(toggleTerminal({ terminal: true, network: true })).toEqual({ terminal: false, network: true })
  })

  test("toggleNetwork: off→on (close terminal); on→off (keep terminal)", () => {
    expect(toggleNetwork({ terminal: false, network: false })).toEqual({ terminal: false, network: true })
    expect(toggleNetwork({ terminal: true, network: false })).toEqual({ terminal: false, network: true })
    expect(toggleNetwork({ terminal: false, network: true })).toEqual({ terminal: false, network: false })
    expect(toggleNetwork({ terminal: true, network: true })).toEqual({ terminal: true, network: false })
  })

  test("rapid alternation — never both true", () => {
    let state: PanelState = { terminal: false, network: false }
    const ops = [toggleTerminal, toggleNetwork, openTerminal, openNetwork]
    for (let i = 0; i < 20; i++) {
      state = ops[i % 4](state)
      expect(state.terminal && state.network).toBe(false)
    }
  })
})

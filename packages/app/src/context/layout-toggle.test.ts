import { describe, expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

/**
 * Regression test for terminal/network mutual exclusion toggle.
 *
 * Bug: old logic set state then read NEW state for the condition,
 * causing both panels to open simultaneously.
 *
 * Fix: compute next state first, use next in the condition.
 */

function createTogglePair() {
  let terminalValue = false
  let networkValue = false
  const [terminalOpened, setTerminalOpened] = createSignal(false)
  const [networkOpened, setNetworkOpened] = createSignal(false)

  function terminalToggle() {
    const next = !terminalOpened()
    setTerminalOpened(next)
    if (next) setNetworkOpened(false)
  }

  function networkToggle() {
    const next = !networkOpened()
    setNetworkOpened(next)
    if (next) setTerminalOpened(false)
  }

  return { terminalOpened, networkOpened, terminalToggle, networkToggle }
}

describe("terminal/network mutual exclusion", () => {
  test("Case 1: both false → click Terminal → terminal=true, network=false", () => {
    createRoot((dispose) => {
      const t = createTogglePair()
      expect(t.terminalOpened()).toBe(false)
      expect(t.networkOpened()).toBe(false)

      t.terminalToggle()

      expect(t.terminalOpened()).toBe(true)
      expect(t.networkOpened()).toBe(false)
      dispose()
    })
  })

  test("Case 2: terminal=true → click Network → terminal=false, network=true", () => {
    createRoot((dispose) => {
      const t = createTogglePair()
      t.terminalToggle()
      expect(t.terminalOpened()).toBe(true)

      t.networkToggle()

      expect(t.terminalOpened()).toBe(false)
      expect(t.networkOpened()).toBe(true)
      dispose()
    })
  })

  test("Case 3: network=true → click Terminal → terminal=true, network=false", () => {
    createRoot((dispose) => {
      const t = createTogglePair()
      t.networkToggle()
      expect(t.networkOpened()).toBe(true)

      t.terminalToggle()

      expect(t.terminalOpened()).toBe(true)
      expect(t.networkOpened()).toBe(false)
      dispose()
    })
  })

  test("Case 4: network=true → click Network again → network=false", () => {
    createRoot((dispose) => {
      const t = createTogglePair()
      t.networkToggle()
      expect(t.networkOpened()).toBe(true)

      t.networkToggle()

      expect(t.networkOpened()).toBe(false)
      expect(t.terminalOpened()).toBe(false)
      dispose()
    })
  })

  test("Case 5: terminal=true → click Terminal again → terminal=false", () => {
    createRoot((dispose) => {
      const t = createTogglePair()
      t.terminalToggle()
      expect(t.terminalOpened()).toBe(true)

      t.terminalToggle()

      expect(t.terminalOpened()).toBe(false)
      expect(t.networkOpened()).toBe(false)
      dispose()
    })
  })

  test("Case 6: both false → click Network → click Terminal → terminal=true, network=false", () => {
    createRoot((dispose) => {
      const t = createTogglePair()
      t.networkToggle()
      t.terminalToggle()

      expect(t.terminalOpened()).toBe(true)
      expect(t.networkOpened()).toBe(false)
      dispose()
    })
  })

  test("Case 7: rapid alternation — never both true", () => {
    createRoot((dispose) => {
      const t = createTogglePair()
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) t.terminalToggle()
        else t.networkToggle()

        // After any toggle, at most one can be true
        expect(t.terminalOpened() && t.networkOpened()).toBe(false)
      }
      dispose()
    })
  })
})

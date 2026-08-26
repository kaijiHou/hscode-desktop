// HSCode Network Inspector — UI integration contract tests (JSX-free).
// The app's test runner (bun test --conditions=solid) cannot compile Solid
// JSX, so these tests assert the RENDER CONTRACT through the real source of
// truth (the component/menu/host files) rather than a fake DOM.

import { describe, expect, test } from "bun:test"

// ---- UI-1: Network panel exists with full toolbar contract -----------------
describe("UI-1 — Network panel renders Start/Stop/Clear/filter", () => {
  test("NetworkPanel is exported as a renderable component", async () => {
    const mod = await import("./network-panel")
    expect(typeof mod.NetworkPanel).toBe("function")
  })

  test("panel source declares the visible toolbar (Start/Stop/Clear/filter input)", async () => {
    const src = await Bun.file(`${import.meta.dir}/network-panel.tsx`).text()
    expect(src).toContain("网络抓包")
    // buttons wired to real handlers
    expect(src).toContain("onClick={() => void start()}")
    expect(src).toContain("开始抓包")
    expect(src).toContain("onClick={() => void stop()}")
    expect(src).toContain("停止抓包")
    expect(src).toContain("onClick={() => void clear()}")
    expect(src).toContain("清空")
    expect(src).toContain("高级筛选")
    expect(src).toContain('aria-label="Network filter"')
    // panel is dock content, not a fixed overlay
    expect(src).toContain('class="network-panel relative w-full h-full')
    expect(src).not.toContain("position: fixed")
    // real engine errors surface in the DOM, not swallowed
    expect(src).toContain("Failed to load packets:")
    expect(src).toContain("Failed to load packet detail:")
  })
})

// ---- UI-4: command palette entry -------------------------------------------
describe("UI-4 — network.toggle command targets the unified bottom panel", () => {
  test("session commands register network.toggle that toggles view().network", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../pages/session/use-session-commands.tsx`).text()
    expect(src).toContain('id: "network.toggle"')
    expect(src).toContain("view().network.toggle()")
  })
  test("app.tsx no longer mounts a network host (crash source removed)", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../app.tsx`).text()
    // the previous overlay host called useSessionLayout outside the provider and crashed;
    // it has been removed entirely. Command registration lives in session commands.
    expect(src).not.toContain("NetworkInspectorHost")
    expect(src).not.toContain("network-host")
  })
})

// ---- UI-5: View menu contract ----------------------------------------------
describe("UI-5 — View menu wires Network Inspector to network.toggle", () => {
  test("desktop-menu view section declares the network item", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../desktop-menu.ts`).text()
    expect(src).toContain('labelKey: "desktop.menu.toggleNetwork"')
    expect(src).toContain('command: "network.toggle"')
  })
  test("i18n zh.ts provides the menu label", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../i18n/zh.ts`).text()
    expect(src).toContain('"command.network.toggle"')
    expect(src).toContain("网络抓包")
  })
})

// ---- i18n contract ----------------------------------------------------------
describe("Network command i18n", () => {
  test("command.network.toggle exists in en/zh/zht", async () => {
    for (const file of ["en.ts", "zh.ts", "zht.ts"]) {
      const src = await Bun.file(`${import.meta.dir}/../../i18n/${file}`).text()
      expect(src).toContain('"command.network.toggle"')
    }
  })
})

// ---- Terminal mutual exclusion (panel state contract) ----------------------
describe("Terminal | Network mutual exclusion", () => {
  test("layout view() uses panel-transitions for mutual exclusion", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../context/layout.tsx`).text()
    // layout.tsx must import production panel transitions
    expect(src).toContain('from "./panel-transitions"')
    expect(src).toContain("openTerminal")
    expect(src).toContain("openNetwork")
    // network and terminal blocks must use compute helpers
    expect(src).toContain("next.terminal")
    expect(src).toContain("next.network")
  })
})
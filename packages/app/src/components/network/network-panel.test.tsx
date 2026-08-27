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
    // header capture toggle wired to real handlers (start/stop merged, v2 UX)
    expect(src).toContain("void (isCapturing() ? stop() : start())")
    expect(src).toContain("开始抓包")
    expect(src).toContain("停止抓包")
    expect(src).toContain('onClick={() => void clear()}')
    expect(src).toContain("清空")
    expect(src).toContain("高级筛选")
    expect(src).toContain('aria-label="Network filter"')
    // panel is dock content, not a fixed overlay
    expect(src).toContain('class="network-panel relative w-full h-full')
    expect(src).not.toContain("position: fixed")
    // real engine errors surface in the DOM, not swallowed
    expect(src).toContain("Failed to load packets:")
    expect(src).toContain("Failed to load packet detail:")
    // expand/restore workspace controls
    expect(src).toContain("扩大工作区")
    expect(src).toContain("恢复布局")
  })

  test("packet list renders IDE-style table (nowrap endpoints, badge, right-aligned sizes)", async () => {
    const list = await Bun.file(`${import.meta.dir}/network-packet-list.tsx`).text()
    expect(list).toContain("源地址")
    expect(list).toContain("目标地址")
    expect(list).toContain("whitespace-nowrap")
    expect(list).toContain("protocol-badge")
    expect(list).toContain("text-right")
    expect(list).toContain("--font-mono")
  })

  test("detail inspector has five tabs with structured protocol headers", async () => {
    const detail = await Bun.file(`${import.meta.dir}/network-packet-detail.tsx`).text()
    // tabs are declared as a typed array rendered into data-slot attributes
    expect(detail).toContain('(["overview", "headers", "payload", "hex", "ascii"] as ViewTab[])')
    expect(detail).toContain("detail-tab-")
    // TCP full header fields
    for (const field of ["Source Port", "Destination Port", "Sequence Number", "Acknowledgment", "Header Length", "Window Size", "Checksum", "Urgent Pointer"]) {
      expect(detail).toContain(field)
    }
    // UDP full header fields
    for (const field of ["Length", "Payload Length"]) {
      expect(detail).toContain(field)
    }
    // IP layer shown before transport
    expect(detail).toContain("IPv4 —")
    expect(detail).toContain("IPv6 —")
    // options rendering
    expect(detail).toContain("Options")
    // payload text/binary distinction + copy hex
    expect(detail).toContain("Text")
    expect(detail).toContain("Binary")
    expect(detail).toContain("复制 HEX")
    // collapse control
    expect(detail).toContain("收起详情")
  })

  test("inner splitter is draggable and persisted via layout store", async () => {
    const src = await Bun.file(`${import.meta.dir}/network-panel.tsx`).text()
    expect(src).toContain("data-slot=\"network-splitter\"")
    expect(src).toContain("onPointerDown={onSplitterPointerDown}")
    expect(src).toContain("resizeDetail")
    expect(src).toContain("collapseDetail")
  })

  test("action buttons use theme-aware ButtonV2 — no dark hardcoded inline style", async () => {
    const src = await Bun.file(`${import.meta.dir}/network-panel.tsx`).text()
    // theme-aware component, not raw <button> with hardcoded dark colors
    expect(src).toContain('@opencode-ai/ui/v2/button-v2"')
    expect(src).not.toContain("#2a2a2a")
    expect(src).not.toContain('"1px solid var(--border-1')
    expect(src).not.toContain("const btnStyle")
    expect(src).not.toContain('class="btn-outline btn-sm"')
  })

  test("errors are mapped to readable Chinese text with real root cause", async () => {
    const mod = await import("./network-panel")
    expect(typeof mod.networkErrorText).toBe("function")
    expect(mod.networkErrorText("ADMIN_REQUIRED", "win32 error 5")).toBe(
      "网络抓包需要管理员权限，请以管理员身份重新启动 HSCode。",
    )
    expect(mod.networkErrorText("DLL_NOT_FOUND", "missing at C:\\x")).toContain("网络抓包组件缺失")
    expect(mod.networkErrorText("DLL_LOAD_FAILED", "boom")).toContain("网络抓包组件加载失败")
    expect(mod.networkErrorText("DRIVER_MISSING", "sys")).toContain("WinDivert 驱动未找到或启动失败")
    expect(mod.networkErrorText("NATIVE_VALIDATOR_UNAVAILABLE", undefined)).toContain("网络抓包引擎未初始化")
    // unknown codes keep the technical message visible (dev diagnosability)
    expect(mod.networkErrorText(undefined, "raw message")).toBe("raw message")
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
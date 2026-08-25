import { describe, expect, test } from "bun:test"
import { sessionPanelLayout } from "./session-panel-layout"

// Regression: the NetworkInspector renders inside the desktopV2PanelLayout
// container. Before the fix, `network` was not part of the layout input, so
// network=true with review/terminal/files=false produced visible=false and the
// parent container (and therefore NetworkPanel) never rendered.

describe("sessionPanelLayout — network participates in visibility", () => {
  test("network=true alone yields visible=true (P0 regression)", () => {
    const layout = sessionPanelLayout({ review: false, terminal: false, network: true, files: false })
    expect(layout.visible).toBe(true)
  })

  test("network=true with review=true still visible", () => {
    const layout = sessionPanelLayout({ review: true, terminal: false, network: true, files: false })
    expect(layout.visible).toBe(true)
  })

  test("all false yields visible=false", () => {
    const layout = sessionPanelLayout({ review: false, terminal: false, network: false, files: false })
    expect(layout.visible).toBe(false)
  })

  test("terminal=true alone still visible (existing behavior preserved)", () => {
    const layout = sessionPanelLayout({ review: false, terminal: true, network: false, files: false })
    expect(layout.visible).toBe(true)
  })

  test("files=true alone still visible (existing behavior preserved)", () => {
    const layout = sessionPanelLayout({ review: false, terminal: false, network: false, files: true })
    expect(layout.visible).toBe(true)
  })

  test("stacked only when review and terminal both open (network excluded)", () => {
    const stacked = sessionPanelLayout({ review: true, terminal: true, network: true, files: false })
    expect(stacked.stacked).toBe(true)
    const notStacked = sessionPanelLayout({ review: true, terminal: false, network: true, files: false })
    expect(notStacked.stacked).toBe(false)
  })
})
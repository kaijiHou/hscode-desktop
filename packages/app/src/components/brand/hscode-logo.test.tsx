// HSCode visible branding tests (JSX-free — bun test cannot compile Solid JSX).
// Asserts the branding is implemented in the real source and that the
// user-visible home/error pages no longer render the OpenCode wordmark.

import { describe, expect, test } from "bun:test"

// ---- Brand-1: HSCode wordmark, no OpenCode wordmark ------------------------
describe("Brand-1 — HSCode wordmark replaces OpenCode in user-visible pages", () => {
  test("legacy-home renders HSCodeSplash instead of OpenCode Logo", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../pages/home/legacy-home.tsx`).text()
    expect(src).toContain("HSCodeSplash")
    expect(src).not.toMatch(/<Logo/) // no OpenCode Logo usage
    expect(src).toMatch(/HSCodeSplash/)
  })

  test("error page renders HSCodeSplash instead of OpenCode Logo", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../pages/error.tsx`).text()
    expect(src).toContain("HSCodeSplash")
    expect(src).not.toMatch(/<Logo/)
  })

  test("brand component defines HSCode wordmark and splash", async () => {
    const src = await Bun.file(`${import.meta.dir}/../brand/hscode-logo.tsx`).text()
    expect(src).toContain("export function HSCodeWordmark")
    expect(src).toContain("export function HSCodeLogo")
    expect(src).toContain("export function HSCodeLoadingMark")
    expect(src).toContain("fengmian.png")
    expect(src).toContain("export function HSCodeSplash")
    expect(src).toContain("aria-label=")
  })
})

// ---- Brand-2: accessible branding ------------------------------------------
describe("Brand-2 — accessible branding via aria-label", () => {
  test("brand components expose aria-label HSCode", async () => {
    const src = await Bun.file(`${import.meta.dir}/../brand/hscode-logo.tsx`).text()
    expect(src).toContain('aria-label="HSCode"')
    // The loading mark is a bundled local image; no remote image references.
    expect(src).toContain('src={fengmianUrl}')
    expect(src).not.toMatch(/src\s*=\s*["']https?:\/\//)
    // rendered wordmark text is HSCode, not OpenCode
    expect(src).toMatch(/>\s*HSCode\s*</)
    expect(src).not.toMatch(/>\s*OpenCode\s*</)
  })
})

// ---- Brand-3: user-visible pages don't use OpenCode product wordmark -------
describe("Brand-3 — no OpenCode wordmark in core user-facing pages", () => {
  test("legacy-home has no visible OpenCode wordmark", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../pages/home/legacy-home.tsx`).text()
    expect(src).toContain("HSCodeSplash")
    expect(src).not.toMatch(/<Logo[^s]/) // Logo component (not Logo import) usage
    expect(src).not.toMatch(/>\s*OpenCode\s*</)
  })
  test("error page swaps OpenCode Logo for HSCodeSplash", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../pages/error.tsx`).text()
    expect(src).toContain("HSCodeSplash")
    expect(src).not.toMatch(/<Logo[^s]/)
    expect(src).not.toMatch(/opencode\.ai\/desktop-feedback/) // redirect target changed
  })
})

describe("Brand-4 — new session and loading states use HSCode-specific surfaces", () => {
  test("new session uses the guided empty state instead of the isolated wordmark", async () => {
    const src = await Bun.file(`${import.meta.dir}/../../pages/new-session/new-session-view.tsx`).text()
    expect(src).not.toContain("HSCodeSplash")
    expect(src).toContain('session.new.title')
    expect(src).toContain('prompt.placeholder.simple')
  })

  test("desktop loading surfaces use the geometric H mark", async () => {
    const desktop = await Bun.file(`${import.meta.dir}/../../../../desktop/src/renderer/index.tsx`).text()
    const app = await Bun.file(`${import.meta.dir}/../../app.tsx`).text()
    expect(desktop).toContain("HSCodeLoadingMark")
    expect(desktop).not.toMatch(/<Splash\b/)
    expect(app).toContain("HSCodeLoadingMark")
    expect(app).not.toMatch(/<Splash\b/)
  })
})

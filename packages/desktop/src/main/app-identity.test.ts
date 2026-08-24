import { describe, expect, test } from "bun:test"
import { APP_IDS, APP_NAMES, resolveAppId } from "./app-identity"

describe("HSCode desktop app identity (Phase 1.9 regression)", () => {
  test("APP_IDS use the hscode namespace for every channel", () => {
    expect(APP_IDS).toEqual({
      dev: "ai.hscode.desktop.dev",
      beta: "ai.hscode.desktop.beta",
      prod: "ai.hscode.desktop",
    })
  })

  test("no app id references the opencode namespace", () => {
    for (const id of Object.values(APP_IDS)) {
      expect(id.startsWith("opencode")).toBe(false)
      expect(id.includes("opencode")).toBe(false)
    }
  })

  test("APP_NAMES use the HSCode brand for every channel", () => {
    expect(APP_NAMES).toEqual({
      dev: "HSCode Dev",
      beta: "HSCode Beta",
      prod: "HSCode",
    })
  })

  test("resolveAppId returns hscode dev id for unpackaged (dev) mode", () => {
    expect(resolveAppId("dev", false)).toBe("ai.hscode.desktop.dev")
  })

  test("resolveAppId returns channel id for packaged mode", () => {
    expect(resolveAppId("beta", true)).toBe("ai.hscode.desktop.beta")
    expect(resolveAppId("prod", true)).toBe("ai.hscode.desktop")
  })
})
import { describe, expect, test } from "bun:test"
import { Global, Path } from "./global"

describe("HSCode core data path isolation (Phase 1.9 regression)", () => {
  test("Global.Path.data is under the hscode namespace", () => {
    const segments = Path.data.split(/[\\/]/)
    expect(segments).toContain("hscode")
    expect(segments).not.toContain("opencode")
  })

  test("Global.Path.cache is under the hscode namespace", () => {
    const segments = Path.cache.split(/[\\/]/)
    expect(segments).toContain("hscode")
    expect(segments).not.toContain("opencode")
  })

  test("Global.Path.config is under the hscode namespace", () => {
    const segments = Path.config.split(/[\\/]/)
    expect(segments).toContain("hscode")
    expect(segments).not.toContain("opencode")
  })

  test("Global.Path.state is under the hscode namespace", () => {
    const segments = Path.state.split(/[\\/]/)
    expect(segments).toContain("hscode")
    expect(segments).not.toContain("opencode")
  })

  test("Global.Path.tmp is under the hscode namespace", () => {
    const segments = Path.tmp.split(/[\\/]/)
    expect(segments).toContain("hscode")
    expect(segments).not.toContain("opencode")
  })

  test("Global.Path.log and repos stay under hscode data dir", () => {
    expect(Path.log.startsWith(Path.data)).toBe(true)
    expect(Path.repos.startsWith(Path.data)).toBe(true)
  })

  test("Global service exposes isolated paths", () => {
    const g = Global.make()
    for (const key of ["data", "cache", "config", "state", "tmp"] as const) {
      const segments = g[key].split(/[\\/]/)
      expect(segments).toContain("hscode")
      expect(segments).not.toContain("opencode")
    }
  })
})
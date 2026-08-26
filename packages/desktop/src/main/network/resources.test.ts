/**
 * Network resources dir helper — production logic tests (no path duplication).
 * Windows dev: networkResourcesDir() must resolve to packages/desktop/resources
 * and the real WinDivert.dll / WinDivert64.sys must exist there.
 */
import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"

import { networkResourcesDir } from "./resources"
import { dllPath, makeNativeBridge, NativeBridgeError } from "./native"

const DESKTOP_ROOT = join(import.meta.dir, "..", "..", "..")

describe("networkResourcesDir — production helper", () => {
  test("packaged → process.resourcesPath verbatim", () => {
    expect(
      networkResourcesDir({ isPackaged: true, appPath: "C:\\app", resourcesPath: "C:\\app\\resources" }),
    ).toBe("C:\\app\\resources")
  })

  test("dev → appPath/resources (packages/desktop in real dev runtime)", () => {
    const dir = networkResourcesDir({
      isPackaged: false,
      appPath: DESKTOP_ROOT,
      resourcesPath: "IGNORED",
    })
    expect(dir).toBe(join(DESKTOP_ROOT, "resources"))
  })

  test("dev DLL exists on this machine (real file check)", () => {
    const dir = networkResourcesDir({ isPackaged: false, appPath: DESKTOP_ROOT, resourcesPath: "" })
    expect(existsSync(dllPath(dir))).toBe(true)
  })

  test("WinDivert64.sys exists next to the DLL (real file check)", () => {
    const dir = networkResourcesDir({ isPackaged: false, appPath: DESKTOP_ROOT, resourcesPath: "" })
    expect(existsSync(join(dir, "win", "WinDivert64.sys"))).toBe(true)
  })

  test("makeNativeBridge succeeds with correct dev resources dir", () => {
    const dir = networkResourcesDir({ isPackaged: false, appPath: DESKTOP_ROOT, resourcesPath: "" })
    if (process.platform !== "win32") return
    const bridge = makeNativeBridge(dir)
    // Real WinDivert compile check through koffi FFI
    expect(bridge.validateFilter("true")).toBe(true)
    expect(bridge.validateFilter("tcp")).toBe(true)
    expect(bridge.validateFilter("(bogus~~~")).toBe(false)
  })

  test("makeNativeBridge throws DLL_NOT_FOUND (not silent) for wrong dir", () => {
    if (process.platform !== "win32") return
    let caught: unknown
    try {
      makeNativeBridge(join(DESKTOP_ROOT, "does-not-exist"))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(NativeBridgeError)
    expect((caught as NativeBridgeError).code).toBe("DLL_NOT_FOUND")
  })
})

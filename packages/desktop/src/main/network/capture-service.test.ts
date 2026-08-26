/**
 * CaptureService unit tests — behavior when native bridge is unavailable.
 */
import { describe, expect, test } from "bun:test"
import { CaptureService } from "./capture-service"
import { FilterValidationError } from "./filter"

function makeService(): CaptureService {
  // Minimal construction without worker spawner — we only test validateFilter
  return new CaptureService({}, () => {
    throw new Error("not used")
  })
}

describe("CaptureService.validateFilter — native bridge unavailable", () => {
  test("throws NATIVE_VALIDATOR_UNAVAILABLE when no bridge set", () => {
    const service = makeService()
    expect(() => service.validateFilter("tcp")).toThrow(FilterValidationError)
    expect(() => service.validateFilter("tcp")).toThrow("NATIVE_VALIDATOR_UNAVAILABLE")
  })

  test("setNativeBridgeError → validateFilter throws the REAL root cause, not generic", () => {
    const service = makeService()
    service.setNativeBridgeError({ code: "DLL_NOT_FOUND", message: "WinDivert.dll not found: C:\\bad\\path.dll" })
    let message = ""
    try {
      service.validateFilter("tcp")
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain("DLL_NOT_FOUND")
    expect(message).toContain("C:\\bad\\path.dll")
    expect(message).not.toContain("NATIVE_VALIDATOR_UNAVAILABLE")
  })

  test("setNativeBridge clears the recorded error", () => {
    const service = makeService()
    service.setNativeBridgeError({ code: "DLL_LOAD_FAILED", message: "load failed" })
    expect(service.nativeInitError?.code).toBe("DLL_LOAD_FAILED")
    service.setNativeBridge({ validateFilter: () => true })
    expect(service.nativeInitError).toBeNull()
    expect(service.validateFilter("tcp")).toBeTruthy()
  })

  test("empty filter still passes (no native validation needed)", () => {
    const service = makeService()
    // Empty filter → windivert is "true" → skip native validation
    expect(service.validateFilter("")).toBe("")
  })

  test("grammar error still throws before native validation", () => {
    const service = makeService()
    expect(() => service.validateFilter("bogus_field == 123")).toThrow(FilterValidationError)
  })
})

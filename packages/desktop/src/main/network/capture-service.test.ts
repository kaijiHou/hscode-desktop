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

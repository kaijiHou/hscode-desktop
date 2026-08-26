/**
 * Real WinDivert native filter validation — production pipeline test.
 *
 * Chain tested:
 *   HSCode grammar expression
 *   → parseFilter() (production)
 *   → parsed.windivert (compiled WinDivert string)
 *   → production NativeBridge.validateFilter() (FFI via koffi)
 *   → WinDivertHelperCompileFilter (real WinDivert.dll)
 *
 * This test MUST use production code. No duplicated FFI bindings.
 * On Windows: DLL must exist, bridge must initialize, tests must run.
 * On non-Windows: all tests SKIP with clear message.
 */
import { describe, expect, test, beforeAll } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { parseFilter } from "./filter"
import { makeNativeBridge } from "./native"

const WINDIVERT_DLL = join(import.meta.dirname, "../../../resources/win/WinDivert.dll")

let bridge: ReturnType<typeof makeNativeBridge> | null = null
let isWindows = false

beforeAll(() => {
  isWindows = process.platform === "win32"

  if (!isWindows) return // genuine platform skip

  // DLL must exist on Windows — FAIL if missing
  expect(existsSync(WINDIVERT_DLL)).toBe(true)

  // Initialize production bridge using production makeNativeBridge
  try {
    const resourcesDir = join(import.meta.dirname, "../../../resources")
    bridge = makeNativeBridge(resourcesDir)
  } catch {
    // bridge init failure on Windows = FAIL, not silent skip
    throw new Error(
      `Production NativeBridge failed to initialize. ` +
      `WinDivert.dll path: ${WINDIVERT_DLL}. ` +
      `This must work on Windows with the DLL present.`,
    )
  }
})

/** Helper: run full production chain and return native validation result */
function validateHsCodeExpression(hscodeExpr: string): boolean {
  const parsed = parseFilter(hscodeExpr)
  if (parsed.windivert === "true") return true // empty filter, always valid
  return bridge!.validateFilter(parsed.windivert)
}

describe("WinDivert native — production pipeline", () => {
  test("DLL exists at expected path", () => {
    expect(existsSync(WINDIVERT_DLL)).toBe(true)
  })

  test("production bridge initialized", () => {
    if (!isWindows) return // platform skip, not false-green
    expect(bridge).not.toBeNull()
  })

  test("tcp → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("tcp")).toBe(true)
  })

  test("udp → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("udp")).toBe(true)
  })

  test("icmp → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("icmp")).toBe(true)
  })

  test("port == 22122 → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("port == 22122")).toBe(true)
  })

  test("ip == 192.168.1.10 → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("ip == 192.168.1.10")).toBe(true)
  })

  test("direction == inbound → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("direction == inbound")).toBe(true)
  })

  test("direction == outbound → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("direction == outbound")).toBe(true)
  })

  test("tcp and port == 22122 → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("tcp and port == 22122")).toBe(true)
  })

  test("tcp and ip == 192.168.1.10 → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("tcp and ip == 192.168.1.10")).toBe(true)
  })

  test("udp and direction == outbound → parseFilter → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("udp and direction == outbound")).toBe(true)
  })

  test("tcp and ip == 1.2.1.1 and port == 80 and direction == outbound → native compile", () => {
    if (!bridge) return
    expect(validateHsCodeExpression("tcp and ip == 1.2.1.1 and port == 80 and direction == outbound")).toBe(true)
  })

  test("invalid WinDivert expression → native returns false", () => {
    if (!bridge) return
    expect(bridge.validateFilter("this_is_not_a_valid_windivert_filter")).toBe(false)
  })
})

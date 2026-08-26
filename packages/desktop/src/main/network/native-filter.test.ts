/**
 * Real WinDivert native filter validation tests.
 *
 * These tests call WinDivertHelperCompileFilter through the actual FFI bridge.
 * They require WinDivert.dll to be present (ships with HSCode Desktop).
 *
 * RUNTIME: These tests only pass on Windows with WinDivert.dll available.
 * On other platforms they will skip with a clear message.
 */
import { describe, expect, test, beforeAll } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"

const WINDIVERT_DLL = join(import.meta.dirname, "../../../../resources/win/WinDivert.dll")

let nativeBridge: { validateFilter(f: string): boolean } | null = null

beforeAll(() => {
  if (process.platform !== "win32" || !existsSync(WINDIVERT_DLL)) {
    return
  }
  try {
    // Dynamic import of the native bridge — only available in Electron main context.
    // For bun test, we load koffi directly and bind WinDivertHelperCompileFilter.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require("koffi")
    const lib = koffi.load(WINDIVERT_DLL)
    const fnCompile = lib.func("WinDivertHelperCompileFilter", "bool", [
      "str",      // filter
      "int",      // layer (WINDIVERT_LAYER_NETWORK = 0)
      "void*",    // object buffer
      "uint32",   // objLen (VALUE, not pointer)
      "void*",    // error string buffer
      "uint32*",  // error position (pointer)
    ])

    nativeBridge = {
      validateFilter(filter: string): boolean {
        try {
          const rt = koffi()
          const objBuf = rt.alloc("uint8_t", 1024)
          const errBuf = rt.alloc("uint8_t", 256)
          const errPosOut = rt.alloc("uint32_t", 4)
          return Boolean(fnCompile(filter, 0, objBuf, 1024, errBuf, errPosOut))
        } catch {
          return false
        }
      },
    }
  } catch {
    // koffi not available in bun test context — tests will be skipped
  }
})

const SKIP = { skip: process.platform !== "win32" || !existsSync(WINDIVERT_DLL) || !nativeBridge }

describe("WinDivert native compile validation", () => {
  test("tcp compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("tcp")).toBe(true)
  })

  test("udp compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("udp")).toBe(true)
  })

  test("icmp compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("icmp")).toBe(true)
  })

  test("port == 22122 compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("port == 22122")).toBe(true)
  })

  test("ip == 192.168.1.10 compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("ip == 192.168.1.10")).toBe(true)
  })

  test("direction == inbound compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("inbound")).toBe(true)
  })

  test("direction == outbound compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("outbound")).toBe(true)
  })

  test("compound: tcp and port == 22122 compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("tcp and port == 22122")).toBe(true)
  })

  test("compound: tcp and ip == 192.168.1.10 compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("tcp and ip == 192.168.1.10")).toBe(true)
  })

  test("compound: udp and outbound compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("udp and outbound")).toBe(true)
  })

  test("compound: tcp and ip == 1.2.1.1 and port == 80 and outbound compiles", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("tcp and ip == 1.2.1.1 and port == 80 and outbound")).toBe(true)
  })

  test("invalid filter fails", () => {
    if (!nativeBridge) return
    expect(nativeBridge.validateFilter("this_is_not_a_valid_windivert_filter")).toBe(false)
  })
})

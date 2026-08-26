// HSCode Network Inspector — WinDivert native boundary via koffi FFI.
//
// Why koffi: prebuilt N-API binaries, no MSVC toolchain required (this dev
// machine has no C++ build environment). WinDivert.dll ships in
// resources/win and its C API is bound as FFI functions.
//
// All blocking capture calls happen on a capture worker thread
// (capture-worker.ts); the Electron main process never blocks.

import { existsSync } from "node:fs"
import { join } from "node:path"

export type NativeErrorCode =
  | "DLL_NOT_FOUND"
  | "DLL_LOAD_FAILED"
  | "OPEN_FAILED"
  | "ADMIN_REQUIRED"
  | "INVALID_FILTER"
  | "RECV_FAILED"
  | "DRIVER_MISSING"
  | "UNSUPPORTED_PLATFORM"

export class NativeBridgeError extends Error {
  readonly code: NativeErrorCode
  readonly winError?: number
  constructor(code: NativeErrorCode, message: string, winError?: number) {
    super(message)
    this.name = "NativeBridgeError"
    this.code = code
    this.winError = winError
  }
}

export interface RecvResult {
  readonly bytes: Uint8Array
  readonly timestamp: bigint
  readonly outbound: boolean
  readonly loopback: boolean
  readonly ipv6: boolean
}

export interface NativeBridge {
  open(filter: string): number
  recv(handle: number, bufferSize?: number): RecvResult
  shutdown(handle: number): void
  close(handle: number): void
  validateFilter(filter: string): boolean
}

const WINDIVERT_LAYER_NETWORK = 0
const WINDIVERT_SHUTDOWN_RECV = 0
const WINDIVERT_FLAG_SNIFF = 0x1
const ERROR_ACCESS_DENIED = 5
const ERROR_INSUFFICIENT_BUFFER = 122
const ERROR_SERVICE_DOES_NOT_EXIST = 1060

// WINDIVERT_ADDRESS (x64): INT64 Timestamp @0; packed flags @8; UINT32
// Reserved2 @12; union body @16 (64 bytes). sizeof = 80.
const ADDRESS_SIZE = 80

export function dllPath(resourcesDir: string): string {
  return join(resourcesDir, "win", "WinDivert.dll")
}

interface KoffiLib {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-generics
  func(signatureOrName: string, ret?: string, args?: string[]): (...args: unknown[]) => unknown
}

type KoffiRuntime = {
  load(path: string): KoffiLib
  alloc(type: string, size: number): bigint
  encode(ptr: bigint, type: string, value: number): void
  decode(ptr: bigint, type: string, count?: number): Uint8Array | Uint32Array | number
}

function koffi(): KoffiRuntime {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("koffi") as unknown as KoffiRuntime
}

export class KoffiNativeBridge implements NativeBridge {
  private readonly lib: KoffiLib
  private readonly fnOpen: (filter: string, layer: number, priority: number, flags: number) => bigint
  private readonly fnRecvEx: (
    handle: bigint,
    buffer: unknown,
    bufferLen: number,
    recvLen: unknown,
    flags: number,
    addr: unknown,
    addrLen: unknown,
    overlapped: null,
  ) => boolean
  private readonly fnShutdown: (handle: bigint, how: number) => boolean
  private readonly fnClose: (handle: bigint) => boolean
  private readonly fnValidateFilter: (filter: string, layer: number, buf: unknown, bufLen: number, err: unknown, errLen: unknown) => boolean
  private readonly fnGetLastError: () => number

  constructor(private readonly dll: string) {
    if (process.platform !== "win32") {
      throw new NativeBridgeError("UNSUPPORTED_PLATFORM", `WinDivert is Windows-only (current: ${process.platform})`)
    }
    if (!existsSync(this.dll)) {
      throw new NativeBridgeError("DLL_NOT_FOUND", `WinDivert.dll not found: ${this.dll}`)
    }

    const rt = koffi()
    let lib: KoffiLib
    try {
      lib = rt.load(this.dll)
    } catch (error) {
      throw new NativeBridgeError("DLL_LOAD_FAILED", `failed to load WinDivert.dll: ${String(error)}`)
    }
    this.lib = lib

    try {
      this.fnOpen = lib.func("WinDivertOpen", "int64", ["str", "int", "int16", "uint64"]) as never
      this.fnValidateFilter = lib.func("WinDivertHelperCompileFilter", "bool", ["str", "int", "void*", "uint32", "void*", "uint32*"]) as never
      this.fnRecvEx = lib.func("WinDivertRecvEx", "bool", [
        "int64",
        "void*",
        "uint32",
        "uint32*",
        "uint64",
        "void*",
        "uint32*",
        "void*",
      ]) as never
      this.fnShutdown = lib.func("WinDivertShutdown", "bool", ["int64", "int"]) as never
      this.fnClose = lib.func("WinDivertClose", "bool", ["int64"]) as never
    } catch (error) {
      throw new NativeBridgeError("DLL_LOAD_FAILED", `WinDivert.dll exports missing: ${String(error)}`)
    }

    // Kernel32 GetLastError for accurate error mapping. MUST use the
    // prototype form ("int __stdcall GetLastError()") — the (name, ret, args)
    // form fails to resolve the symbol on koffi 3.x. Call it immediately after
    // the failing foreign call, before any other JS work resets the TLS value.
    try {
      const kernel32 = rt.load("kernel32.dll")
      this.fnGetLastError = kernel32.func("int __stdcall GetLastError()") as never
    } catch {
      this.fnGetLastError = () => 0
    }
  }

  /** Validate a WinDivert filter string via WinDivertHelperCompileFilter.
   *  Returns true if the filter compiles without error. */
  /** Validate a WinDivert filter string via WinDivertHelperCompileFilter.
   *  Returns true if the filter compiles without error. */
  validateFilter(filter: string): boolean {
    try {
      // Pass null for errorStr (const char**) and errorPos (UINT*).
      // We only need the boolean return for validation.
      const ok = this.fnValidateFilter(filter, WINDIVERT_LAYER_NETWORK, null, 0, null, null)
      return Boolean(ok)
    } catch {
      return false
    }
  }

  open(filter: string): number {
    const handle = this.fnOpen(filter, WINDIVERT_LAYER_NETWORK, 0, WINDIVERT_FLAG_SNIFF)
    if (Number(handle) === -1) {
      const lastError = this.lastWinError()
      if (lastError === ERROR_ACCESS_DENIED) {
        throw new NativeBridgeError(
          "ADMIN_REQUIRED",
          "Network capture requires administrator privileges on Windows. " +
            "Restart HSCode as administrator to start packet capture.",
          lastError,
        )
      }
      if (lastError === ERROR_SERVICE_DOES_NOT_EXIST) {
        throw new NativeBridgeError(
          "DRIVER_MISSING",
          "WinDivert driver (WinDivert64.sys) is not installed or could not be started.",
          lastError,
        )
      }
      throw new NativeBridgeError("OPEN_FAILED", `WinDivertOpen failed (win32 error ${lastError})`, lastError)
    }
    return Number(handle)
  }

  recv(handle: number, bufferSize = 65535): RecvResult {
    const rt = koffi()
    const buffer = rt.alloc("uint8_t", bufferSize)
    const recvLen = rt.alloc("uint32_t", 4)
    const addr = rt.alloc("uint8_t", ADDRESS_SIZE)
    const addrLen = rt.alloc("uint32_t", 4)
    rt.encode(addrLen, "uint32_t", ADDRESS_SIZE)

    const ok = this.fnRecvEx(BigInt(handle), buffer, bufferSize, recvLen, 0, addr, addrLen, null)
    if (!ok) {
      const lastError = this.lastWinError()
      throw new NativeBridgeError("RECV_FAILED", `WinDivertRecvEx failed (win32 error ${lastError})`, lastError)
    }

    const received = Number(rt.decode(recvLen, "uint32_t") ?? 0)
    const decodedBytes = rt.decode(buffer, "uint8_t", received)
    const bytes =
      decodedBytes instanceof Uint8Array
        ? decodedBytes
        : new Uint8Array((decodedBytes as { length: number })?.length ?? 0)
    const flagsArr = new Uint8Array(rt.decode(addr, "uint8_t", 16) as Uint8Array)
    const packedFlags = flagsArr[8] | (flagsArr[9] << 8) | (flagsArr[10] << 16) | (flagsArr[11] << 24)
    const lo = flagsArr[0] | (flagsArr[1] << 8) | (flagsArr[2] << 16) | (flagsArr[3] << 24)
    const hi = flagsArr[4] | (flagsArr[5] << 8) | (flagsArr[6] << 16) | (flagsArr[7] << 24)
    const timestamp = BigInt(lo) | (BigInt(hi) << 32n)

    return {
      bytes,
      timestamp,
      outbound: Boolean(packedFlags & 0x10000), // bit 16
      loopback: Boolean(packedFlags & 0x20000), // bit 17
      ipv6: Boolean(packedFlags & 0x40000), // bit 18
    }
  }

  shutdown(handle: number): void {
    try {
      this.fnShutdown(BigInt(handle), WINDIVERT_SHUTDOWN_RECV)
    } catch {
      // handle already closed — ignore
    }
  }

  close(handle: number): void {
    try {
      this.fnClose(BigInt(handle))
    } catch {
      // ignore close errors
    }
  }

  private lastWinError(): number {
    try {
      return this.fnGetLastError() | 0
    } catch {
      return 0
    }
  }
}

export function makeNativeBridge(resourcesDir: string): NativeBridge {
  return new KoffiNativeBridge(dllPath(resourcesDir))
}
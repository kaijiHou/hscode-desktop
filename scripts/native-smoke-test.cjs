// Native smoke test: load the real WinDivert.dll via koffi and attempt to
// open a capture handle with the current process privileges.
// Non-admin → expect ADMIN_REQUIRED (never a crash, never a fake empty list).

const path = require("node:path")

const dll = "D:/hscode/packages/desktop/resources/win/WinDivert.dll"
const koffi = require("D:/hscode/packages/desktop/node_modules/koffi")

console.log("koffi version:", koffi.version)
console.log("DLL exists:", require("node:fs").existsSync(dll))

const lib = koffi.load(dll)
const fnOpen = lib.func("WinDivertOpen", "int64", ["str", "int", "int16", "uint64"])
const kernel32 = koffi.load("kernel32.dll")
const fnGetLastError = kernel32.func("GetLastError", "int", [])

const handle = fnOpen("true", 0, 0, 0x1) // filter=true, LAYER_NETWORK, priority 0, SNIFF flag
console.log("WinDivertOpen returned:", handle, "type:", typeof handle)

if (Number(handle) === -1) {
  const err = fnGetLastError()
  console.log("GetLastError:", err)
  if (err === 5) console.log("RESULT: ADMIN_REQUIRED (error 5 = ERROR_ACCESS_DENIED) ✔")
  else if (err === 1060) console.log("RESULT: DRIVER_MISSING (error 1060 = service does not exist)")
  else if (err === 87) console.log("RESULT: INVALID_PARAMETER — WinDivert.dll incompatible with our FFI decl")
  else console.log("RESULT: OPEN_FAILED (win32 error", err + ")")
}
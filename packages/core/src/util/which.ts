import whichPkg from "which"
import path from "path"
import { spawnSync } from "child_process"
import { accessSync, constants } from "fs"
import { Global } from "../global"

// Windows App Execution Aliases (e.g. C:\Users\<u>\AppData\Local\Microsoft\
// WindowsApps\pwsh.exe) fail statSync() with EACCES — the "which" package
// treats them as missing, so pwsh is silently never detected and legacy
// powershell.exe wins the default. `where` (always present on Windows) does
// find them. Cache per (cmd) since PATH is stable within a session.
const whereCache = new Map<string, string | null>()

function whereWin(cmd: string): string | null {
  if (whereCache.has(cmd)) return whereCache.get(cmd) ?? null
  let found: string | null = null
  try {
    const out = spawnSync("where", [cmd], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    })
    const line = (out.stdout ?? "").split("\n")[0]?.trim()
    if (out.status === 0 && line) {
      // Only accept executables that are actually openable. accessSync(R_OK)
      // works on WindowsApps aliases where statSync fails with EACCES.
      try {
        accessSync(line, constants.R_OK)
        found = line
      } catch {
        found = null
      }
    }
  } catch {
    found = null
  }
  whereCache.set(cmd, found)
  return found
}

export function which(cmd: string, env?: NodeJS.ProcessEnv) {
  const base = env?.PATH ?? env?.Path ?? process.env.PATH ?? process.env.Path ?? ""
  const full = base ? base + path.delimiter + Global.Path.bin : Global.Path.bin
  const result = whichPkg.sync(cmd, {
    nothrow: true,
    path: full,
    pathExt: env?.PATHEXT ?? env?.PathExt ?? process.env.PATHEXT ?? process.env.PathExt,
  })
  if (typeof result === "string") return result
  if (process.platform === "win32") return whereWin(cmd)
  return null
}

export function whichReset() {
  whereCache.clear()
}

import path from "path"
import { spawnSync } from "child_process"
import { accessSync, constants } from "fs"
import { Path } from "../global"

/**
 * Resolve an executable by name, using only Node built-ins.
 *
 * Windows: PATH walk with accessSync(R_OK) — finds App Execution Aliases
 *          (WindowsApps) where stat() throws EACCES. where.exe is a
 *          fallback for edge cases.
 * POSIX:   PATH walk with accessSync(X_OK).
 *
 * No dependency on the npm `which` package — the electron sidecar runtime
 * cannot resolve it (MODULE_NOT_FOUND), which silently broke pwsh detection.
 *
 * Results are cached by (cmd, PATH, PATHEXT) so repeated lookups with the
 * same environment are instant, while different environments never leak
 * stale results.
 */
const cache = new Map<string, string | undefined>()

export function which(cmd: string, env?: NodeJS.ProcessEnv): string | undefined {
  const base = env?.PATH ?? env?.Path ?? process.env.PATH ?? process.env.Path ?? ""
  const full = base ? base + path.delimiter + Path.bin : Path.bin
  const pathExt = env?.PATHEXT ?? env?.PathExt ?? process.env.PATHEXT ?? process.env.PathExt

  const key = cmd + "\0" + full + "\0" + (pathExt ?? "")
  if (cache.has(key)) return cache.get(key)

  const result = process.platform === "win32" ? whichWin(cmd, full, pathExt) : whichPosix(cmd, full)
  cache.set(key, result)
  return result
}

/** Clear the resolver cache (for tests or PATH changes). */
export function whichReset() {
  cache.clear()
}

function whichWin(cmd: string, fullPath: string, pathExt?: string): string | undefined {
  // If cmd is already an absolute path, check directly
  if (path.isAbsolute(cmd)) {
    try {
      accessSync(cmd, constants.R_OK)
      return cmd
    } catch {
      return undefined
    }
  }

  // Fast path: manual PATH walk. accessSync(R_OK) works on WindowsApps
  // App Execution Aliases where statSync throws EACCES.
  const exts = (pathExt ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean)
  const dirs = fullPath.split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext)
      try {
        accessSync(candidate, constants.R_OK)
        return candidate
      } catch {
        // try next
      }
    }
  }

  // Fallback: where.exe (handles cases where PATH walk misses, e.g.
  // unusual PATHEXT or system-level resolution differences).
  try {
    const out = spawnSync("where.exe", [cmd], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, ...({ PATH: fullPath, Path: fullPath }) },
    })
    const line = (out.stdout ?? "").split(/\r?\n/)[0]?.trim()
    if (out.status === 0 && line) {
      // where.exe confirmed it exists. Do NOT stat() — WindowsApps
      // aliases throw EACCES on stat.
      return line
    }
  } catch {
    // where.exe failed — nothing found
  }
  return undefined
}

function whichPosix(cmd: string, fullPath: string): string | undefined {
  // If cmd is already an absolute path, check directly
  if (path.isAbsolute(cmd)) {
    try {
      accessSync(cmd, constants.X_OK)
      return cmd
    } catch {
      return undefined
    }
  }

  const dirs = fullPath.split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    const candidate = path.join(dir, cmd)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // try next
    }
  }
  return undefined
}

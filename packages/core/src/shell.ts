export * as Shell from "./shell"

import path from "path"
import { spawn, type ChildProcess } from "child_process"
import { readFile } from "fs/promises"
import { statSync } from "fs"
import { setTimeout as sleep } from "node:timers/promises"
import { Flag } from "./flag/flag"
import { FSUtil } from "./fs-util"
import { which } from "./util/which"

const SIGKILL_TIMEOUT_MS = 200
const META: Record<string, { deny?: boolean; login?: boolean; posix?: boolean; ps?: boolean }> = {
  bash: { login: true, posix: true },
  dash: { login: true, posix: true },
  fish: { deny: true, login: true },
  ksh: { login: true, posix: true },
  nu: { deny: true },
  powershell: { ps: true },
  pwsh: { ps: true },
  sh: { login: true, posix: true },
  zsh: { login: true, posix: true },
}

export type Item = {
  path: string
  name: string
  acceptable: boolean
}

export async function killTree(proc: ChildProcess, opts?: { exited?: () => boolean }): Promise<void> {
  const pid = proc.pid
  if (!pid || opts?.exited?.()) return

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
        stdio: "ignore",
        windowsHide: true,
      })
      killer.once("exit", () => resolve())
      killer.once("error", () => resolve())
    })
    return
  }

  try {
    process.kill(-pid, "SIGTERM")
    await sleep(SIGKILL_TIMEOUT_MS)
    if (!opts?.exited?.()) {
      process.kill(-pid, "SIGKILL")
    }
  } catch {
    proc.kill("SIGTERM")
    await sleep(SIGKILL_TIMEOUT_MS)
    if (!opts?.exited?.()) {
      proc.kill("SIGKILL")
    }
  }
}

function stat(file: string) {
  return statSync(file, { throwIfNoEntry: false }) ?? undefined
}

function full(file: string) {
  if (process.platform !== "win32") return file
  const shell = FSUtil.windowsPath(file)
  if (path.win32.dirname(shell) !== ".") {
    if (shell.startsWith("/") && name(shell) === "bash") return gitbash() || shell
    return shell
  }
  if (name(shell) === "bash") return gitbash() || which(shell) || shell
  return which(shell) || shell
}

function meta(file: string) {
  return META[name(file)]
}

function ok(file: string) {
  return meta(file)?.deny !== true
}

function rooted(file: string) {
  return path.isAbsolute(FSUtil.windowsPath(file))
}

function resolve(file: string, opts?: { trusted?: boolean }) {
  const shell = full(file)
  if (rooted(shell)) {
    if (stat(shell)?.isFile()) return shell
    // Only trust paths that came from which() (via win()/list()) —
    // Windows App Execution Aliases fail stat() but are valid executables.
    // Do NOT trust arbitrary user-provided paths by basename alone.
    if (opts?.trusted && meta(name(shell))) return shell
    return
  }
  return which(shell) ?? undefined
}

function win() {
  return Array.from(
    new Set(
      [which("pwsh"), which("powershell"), gitbash(), process.env.COMSPEC || "cmd.exe"]
        .filter((item): item is string => Boolean(item))
        .map(full),
    ),
  )
}

async function unix() {
  const text = await readFile("/etc/shells", "utf8").catch(() => "")
  if (text) return Array.from(new Set(text.split("\n").filter((line) => line.trim() && !line.startsWith("#"))))
  return ["/bin/bash", "/bin/zsh", "/bin/sh"]
}

function select(file: string | undefined, opts?: { acceptable?: boolean }) {
  if (file && (!opts?.acceptable || ok(file))) {
    const shell = resolve(file)
    if (shell) return shell
  }
  if (process.platform === "win32") return win()[0]
  return fallback()
}

export function gitbash() {
  if (process.platform !== "win32") return
  if (Flag.OPENCODE_GIT_BASH_PATH) return Flag.OPENCODE_GIT_BASH_PATH
  const git = which("git")
  if (!git) return
  const file = path.join(git, "..", "..", "bin", "bash.exe")
  if (stat(file)?.size) return file
}

function fallback() {
  if (process.platform === "darwin") return "/bin/zsh"
  const bash = which("bash")
  if (bash) return bash
  return "/bin/sh"
}

export function name(file: string) {
  if (process.platform === "win32") return path.win32.parse(FSUtil.windowsPath(file)).name.toLowerCase()
  return path.basename(file).toLowerCase()
}

export function login(file: string) {
  return meta(file)?.login === true
}

export function posix(file: string) {
  return meta(file)?.posix === true
}

export function ps(file: string) {
  return meta(file)?.ps === true
}

// Legacy Windows PowerShell (5.1) session-local PSReadLine compatibility.
//
// Root cause (byte-level, see docs/psreadline-capture-*.txt): when PSReadLine
// is active in legacy powershell.exe, every typed character (space, argument,
// operator, quote) makes it emit ECH ("Erase Character", ESC[nX) sequences
// that grow with the line. In HSCode's light theme those erase-fills render as
// a black block that keeps extending to the right. No SGR-40 (explicit black
// background) is ever emitted — the block comes from ECH, not a background
// color escape.
//
// PSReadLine >= 2.0.3 (incl. 2.3.5) was expected to fix this, but the capture
// shows 2.3.5 STILL emits the same ECH sequences. The only proven fix is to
// drop PSReadLine for THIS session, which makes the host fall back to its
// built-in line editor (no ECH). This is session-local: it only affects the
// spawned PTY — never the user's machine, $PROFILE, or module store. Cost:
// the legacy powershell.exe terminal loses PSReadLine history-editing and
// syntax highlighting. pwsh.exe / cmd / bash are intentionally left untouched.
export const LEGACY_POWERSHELL_COMPAT_CMD =
  "try { Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue } catch {}"

/**
 * Returns the `-NoExit -EncodedCommand …` init args for legacy Windows
 * PowerShell session-local PSReadLine compatibility, or `undefined` for any
 * other shell (pwsh.exe, cmd, bash, …). Pure and side-effect free so it can
 * be unit tested without spawning a PTY.
 */
export function legacyPowerShellCompatArgs(command: string): string[] | undefined {
  const shellName = command.split(/[/\\]/).pop()?.toLowerCase() ?? ""
  if (shellName !== "powershell.exe" && shellName !== "powershell") return undefined
  const encoded = Buffer.from(LEGACY_POWERSHELL_COMPAT_CMD, "utf16le").toString("base64")
  return ["-NoExit", "-EncodedCommand", encoded]
}

// Windows-friendly display labels (UI only, not used in config persistence)
const WIN_LABELS: Record<string, string> = {
  pwsh: "PowerShell 7",
  powershell: "Windows PowerShell",
  cmd: "Command Prompt",
}

/** Returns a user-friendly display label for a shell. */
export function label(file: string): string {
  const n = name(file)
  return process.platform === "win32" ? (WIN_LABELS[n] ?? n) : n
}

function info(file: string): Item {
  const item = full(file)
  const n = name(item)
  // name stays canonical (pwsh/powershell/bash/cmd) for config persistence
  return {
    path: item,
    name: resolve(n) ? n : item,
    acceptable: ok(item),
  }
}

export function args(file: string, command: string, cwd: string) {
  const n = name(file)
  if (n === "nu" || n === "fish") return ["-c", command]
  if (n === "zsh") {
    return [
      "-l",
      "-c",
      `
        [[ -f ~/.zshenv ]] && source ~/.zshenv >/dev/null 2>&1 || true
        [[ -f "\${ZDOTDIR:-$HOME}/.zshrc" ]] && source "\${ZDOTDIR:-$HOME}/.zshrc" >/dev/null 2>&1 || true
        cd -- "$1"
        eval ${JSON.stringify(command)}
      `,
      "opencode",
      cwd,
    ]
  }
  if (n === "bash") {
    return [
      "-l",
      "-c",
      `
        shopt -s expand_aliases
        [[ -f ~/.bashrc ]] && source ~/.bashrc >/dev/null 2>&1 || true
        cd -- "$1"
        eval ${JSON.stringify(command)}
      `,
      "opencode",
      cwd,
    ]
  }
  if (n === "cmd") return ["/c", command]
  if (ps(file)) return ["-NoProfile", "-Command", command]
  return ["-c", command]
}

let defaultPreferred: string | undefined
let defaultAcceptable: string | undefined

export function preferred(configShell?: string) {
  if (configShell) return select(configShell)
  // On Windows, ignore inherited SHELL env (e.g. from Git Bash/MSYS).
  // Use native Windows shell priority: pwsh → powershell → Git Bash → cmd.
  if (process.platform === "win32") {
    defaultPreferred ??= win()[0]
    return defaultPreferred
  }
  defaultPreferred ??= select(process.env.SHELL)
  return defaultPreferred
}
preferred.reset = () => {
  defaultPreferred = undefined
}

export function acceptable(configShell?: string) {
  if (configShell) return select(configShell, { acceptable: true })
  defaultAcceptable ??= select(process.env.SHELL, { acceptable: true })
  return defaultAcceptable
}
acceptable.reset = () => {
  defaultAcceptable = undefined
}

export async function list(): Promise<Item[]> {
  const shells = process.platform === "win32" ? win() : await unix()
  // Pass trusted=true: win() returns paths from which(), safe to trust for Windows App Aliases
  return shells.filter((s) => resolve(s, { trusted: true })).map(info)
}

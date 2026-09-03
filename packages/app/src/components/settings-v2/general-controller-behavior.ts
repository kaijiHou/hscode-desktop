import { onCleanup } from "solid-js"

export type ShellOption = {
  path: string
  name: string
  acceptable: boolean
}

export type ShellSelectOption = {
  id: string
  value: string
  name: string
  terminalOnly: boolean
  legacy: boolean
}

// Windows-friendly display labels
const WIN_LABELS: Record<string, string> = {
  pwsh: "PowerShell 7",
  powershell: "Windows PowerShell",
  cmd: "Command Prompt",
}

function shellDisplayName(name: string): string {
  return typeof process !== "undefined" && process.platform === "win32"
    ? (WIN_LABELS[name] ?? name)
    : name
}

// Legacy Windows PowerShell 5.1 (canonical name "powershell") has a known
// black-background compatibility issue in the HSCode terminal. The UI marks
// it as legacy (label suffix + lightweight hint, i18n in the component).
// Display-only — the persisted value stays the full path.
export function isLegacyWindowsPowerShellOption(shell: ShellOption): boolean {
  const base = (shell.name || shell.path).split(/[\\/]/).pop()?.toLowerCase() ?? ""
  return base === "powershell" || base === "powershell.exe"
}

export function createShellOptions(input: { shells: ShellOption[]; current: string | undefined }) {
  const options: ShellSelectOption[] = [
    { id: "auto", value: "", name: "", terminalOnly: false, legacy: false },
    ...input.shells.map((shell) => ({
      id: shell.path,
      // Always persist the full path for reliable config resolution
      value: shell.path,
      // Display friendly label for known Windows shells
      name: shellDisplayName(shell.name),
      terminalOnly: !shell.acceptable,
      legacy: isLegacyWindowsPowerShellOption(shell),
    })),
  ]
  if (input.current && !options.some((option) => option.value === input.current)) {
    options.push({
      id: input.current,
      value: input.current,
      name: input.current,
      terminalOnly: false,
      legacy: isLegacyWindowsPowerShellOption({ path: input.current, name: input.current, acceptable: true }),
    })
  }
  return options
}

export function createSoundPreviewController(player: (id: string | undefined) => Promise<(() => void) | undefined>) {
  let cleanup: (() => void) | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let run = 0

  const stop = () => {
    run += 1
    cleanup?.()
    clearTimeout(timeout)
    cleanup = undefined
    timeout = undefined
  }
  const play = (id: string | undefined) => {
    stop()
    if (!id) return
    const current = ++run
    timeout = setTimeout(() => {
      timeout = undefined
      void player(id).then((next) => {
        if (run === current) {
          cleanup = next
          return
        }
        next?.()
      })
    }, 100)
  }

  onCleanup(stop)
  return { play, stop }
}

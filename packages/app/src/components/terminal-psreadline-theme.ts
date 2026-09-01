/**
 * HSCode PowerShell PSReadLine Light Theme
 *
 * Injects session-local PSReadLine colors for light theme.
 * Does NOT modify user's $PROFILE.
 * Only applies to PowerShell 7 (pwsh) and Windows PowerShell.
 * Git Bash / CMD are not affected.
 */

export function getPowerShellInitCommand(theme: "light" | "dark"): string | null {
  if (theme !== "light") return null

  // PSReadLine colors for HSCode Light Theme
  // Only override prediction/selection colors that cause black backgrounds
  const colors = {
    // Normal tokens — keep dark neutral
    Command: "#211e1e",
    Parameter: "#69717E",
    Operator: "#69717E",
    Variable: "#005cc5",
    String: "#22863a",
    Number: "#005cc5",
    Type: "#6f42c1",
    Comment: "#6a737d",
    Keyword: "#d73a49",
    // Prediction — light foreground, NO dark background
    InlinePrediction: "#9AA1AC",
    ListPrediction: "#9AA1AC",
    ListPredictionSelected: "#E7EAF0",
    // Selection — light background
    Selection: "#DDE5F5",
    // Error
    Error: "#c92828",
  }

  const colorStr = Object.entries(colors)
    .map(([k, v]) => `${k} = '${v}'`)
    .join(", ")

  // Build the Set-PSReadLineOption command
  const cmd = `if (Get-Command Set-PSReadLineOption -ErrorAction SilentlyContinue) { Set-PSReadLineOption -PredictionSource History -Colors @{${colorStr}} }`

  // Encode as Base64 for -EncodedCommand (silent, no visible init)
  const encoded = Buffer.from(cmd, "utf16le").toString("base64")
  return encoded
}

/**
 * Returns PowerShell arguments with silent PSReadLine init.
 * For pwsh/powershell: adds -EncodedCommand to inject light theme colors.
 * For other shells: returns empty args (no injection).
 */
export function getShellInitArgs(
  shellPath: string,
  theme: "light" | "dark"
): string[] {
  const shellName = shellPath.split(/[/\\]/).pop()?.toLowerCase() ?? ""

  // Only inject for PowerShell
  const isPowerShell =
    shellName === "pwsh.exe" ||
    shellName === "pwsh" ||
    shellName === "powershell.exe" ||
    shellName === "powershell"

  if (!isPowerShell) return []

  const encoded = getPowerShellInitCommand(theme)
  if (!encoded) return []

  // Use -EncodedCommand to run silently, then -NoExit to keep session open
  return ["-NoExit", "-EncodedCommand", encoded]
}

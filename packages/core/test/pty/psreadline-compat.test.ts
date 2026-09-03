import { describe, expect, test } from "bun:test"
import { Shell } from "@opencode-ai/core/shell"

// Decodes the base64 EncodedCommand payload so tests can assert on the
// actual PowerShell that will run in the spawned session.
function decodeEncodedArgs(args: string[] | undefined): string {
  if (!args) return ""
  const i = args.indexOf("-EncodedCommand")
  if (i === -1) return ""
  const b64 = args[i + 1]
  if (!b64) return ""
  const buf = Buffer.from(b64, "base64")
  // EncodedCommand is UTF-16LE
  const out: string[] = []
  for (let i = 0; i + 1 < buf.length; i += 2) out.push(String.fromCharCode(buf[i] | (buf[i + 1] << 8)))
  return out.join("")
}

describe("Shell.legacyPowerShellCompatArgs", () => {
  test("applies to legacy powershell.exe (bare name)", () => {
    const args = Shell.legacyPowerShellCompatArgs("powershell.exe")
    expect(args).toBeDefined()
    expect(args![0]).toBe("-NoExit")
    expect(args![1]).toBe("-EncodedCommand")
  })

  test("applies to full legacy powershell.exe path", () => {
    const args = Shell.legacyPowerShellCompatArgs("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
    expect(args).toBeDefined()
    expect(args!.length).toBe(3)
  })

  test("does NOT apply to pwsh.exe (PowerShell 7)", () => {
    expect(Shell.legacyPowerShellCompatArgs("pwsh.exe")).toBeUndefined()
    expect(Shell.legacyPowerShellCompatArgs("C:\\Program Files\\PowerShell\\7\\pwsh.exe")).toBeUndefined()
  })

  test("does NOT apply to cmd.exe", () => {
    expect(Shell.legacyPowerShellCompatArgs("cmd.exe")).toBeUndefined()
    expect(Shell.legacyPowerShellCompatArgs("C:\\Windows\\System32\\cmd.exe")).toBeUndefined()
  })

  test("does NOT apply to bash / git-bash", () => {
    expect(Shell.legacyPowerShellCompatArgs("bash")).toBeUndefined()
    expect(Shell.legacyPowerShellCompatArgs("/usr/bin/bash")).toBeUndefined()
    expect(Shell.legacyPowerShellCompatArgs("D:\\Git\\bin\\bash.exe")).toBeUndefined()
  })

  test("encoded command removes PSReadLine for the session only", () => {
    const cmd = decodeEncodedArgs(Shell.legacyPowerShellCompatArgs("powershell.exe"))
    expect(cmd).toContain("Remove-Module")
    expect(cmd).toContain("PSReadLine")
    // Session-local: must NOT install/update/import or touch the profile.
    expect(cmd).not.toContain("Install-Module")
    expect(cmd).not.toContain("Update-Module")
    expect(cmd).not.toContain("Import-Module")
    expect(cmd).not.toContain("$PROFILE")
    expect(cmd).not.toContain("Save-Module")
  })

  test("no global SGR-40 / background-color filter is injected", () => {
    const cmd = decodeEncodedArgs(Shell.legacyPowerShellCompatArgs("powershell.exe"))
    // The fix must not strip ESC[40m or set a console background color.
    expect(cmd).not.toContain("40m")
    expect(cmd).not.toContain("SetConsole")
    expect(cmd).not.toContain("BackgroundColor")
  })

  test("uses -NoExit so the session stays interactive after init", () => {
    const args = Shell.legacyPowerShellCompatArgs("powershell.exe")
    expect(args![0]).toBe("-NoExit")
  })
})

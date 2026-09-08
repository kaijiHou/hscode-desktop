import { describe, expect, test } from "bun:test"
import { buildPtyArgs } from "@opencode-ai/core/pty"

describe("Pty.buildPtyArgs", () => {
  test("leaves PowerShell arguments untouched", () => {
    expect(buildPtyArgs("pwsh.exe", ["-NoLogo"])).toEqual(["-NoLogo"])
    expect(buildPtyArgs("powershell.exe")).toEqual([])
  })

  test("does not add the removed PowerShell startup injection", () => {
    const args = buildPtyArgs("pwsh.exe", ["-NoLogo"])

    expect(args).not.toContain("-EncodedCommand")
    expect(args.join(" ")).not.toContain("$([char]27)")
    expect(args.join(" ")).not.toContain("[5 q")
    expect(args.join(" ")).not.toContain("Set-PSReadLineOption")
    expect(args.join(" ")).not.toContain("DarkCyan")
  })

  test("keeps login handling for POSIX shells", () => {
    expect(buildPtyArgs("bash", ["--noprofile"])).toEqual(["--noprofile", "-l"])
  })
})

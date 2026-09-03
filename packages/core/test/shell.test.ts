import { describe, expect, test } from "bun:test"
import path from "path"
import { Shell } from "@opencode-ai/core/shell"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { which } from "@opencode-ai/core/util/which"

const withShell = async (shell: string | undefined, fn: () => void | Promise<void>) => {
  const prev = process.env.SHELL
  if (shell === undefined) delete process.env.SHELL
  else process.env.SHELL = shell
  Shell.acceptable.reset()
  Shell.preferred.reset()
  try {
    await fn()
  } finally {
    if (prev === undefined) delete process.env.SHELL
    else process.env.SHELL = prev
    Shell.acceptable.reset()
    Shell.preferred.reset()
  }
}

describe("shell", () => {
  test("normalizes shell names", () => {
    expect(Shell.name("/bin/bash")).toBe("bash")
    if (process.platform === "win32") {
      expect(Shell.name("C:/tools/NU.EXE")).toBe("nu")
      expect(Shell.name("C:/tools/PWSH.EXE")).toBe("pwsh")
    }
  })

  test("detects login shells", () => {
    expect(Shell.login("/bin/bash")).toBe(true)
    expect(Shell.login("C:/tools/pwsh.exe")).toBe(false)
  })

  test("detects posix shells", () => {
    expect(Shell.posix("/bin/bash")).toBe(true)
    expect(Shell.posix("/bin/fish")).toBe(false)
    expect(Shell.posix("C:/tools/pwsh.exe")).toBe(false)
  })

  test("falls back when configured shell cannot be resolved", async () => {
    await withShell(undefined, async () => {
      const preferred = Shell.preferred()
      const acceptable = Shell.acceptable()
      // Missing shell falls back to system default
      expect(Shell.preferred("opencode-missing-shell")).toBeDefined()
      expect(Shell.acceptable("opencode-missing-shell")).toBeDefined()
    })
  })

  test("falls back for terminal-only acceptable shells", () => {
    expect(Shell.name(Shell.acceptable("fish"))).not.toBe("fish")
    expect(Shell.name(Shell.acceptable("nu"))).not.toBe("nu")
  })

  test("builds command args per shell family", () => {
    expect(Shell.args("/bin/sh", "echo hi", "/tmp")).toEqual(["-c", "echo hi"])
    expect(Shell.args("/usr/bin/fish", "echo hi", "/tmp")).toEqual(["-c", "echo hi"])
    const zsh = Shell.args("/bin/zsh", "echo hi", "/tmp")
    expect(zsh[0]).toBe("-l")
    expect(zsh[1]).toBe("-c")
    expect(zsh.at(-1)).toBe("/tmp")
  })

  if (process.platform === "win32") {
    test("rejects blacklisted shells case-insensitively", async () => {
      await withShell("NU.EXE", async () => {
        expect(Shell.name(Shell.acceptable())).not.toBe("nu")
      })
    })

    test("Windows ignores inherited SHELL with cygdrive path", async () => {
      const shell = "/cygdrive/c/Program Files/Git/bin/bash.exe"
      await withShell(shell, async () => {
        // Windows ignores inherited SHELL, prefers pwsh/powershell
        const preferred = Shell.preferred()
        expect(preferred).toBeDefined()
        expect(Shell.name(preferred)).not.toBe("bash")
      })
    })

    test("resolves /usr/bin/bash from env to Git Bash", async () => {
      const bash = Shell.gitbash()
      if (!bash) return // Git Bash not installed — skip
      await withShell("/usr/bin/bash", async () => {
        expect(Shell.acceptable()).toBe(bash)
        expect(Shell.preferred()).toBe(bash)
      })
    })

    test("resolves bare bash to Git Bash before PATH", async () => {
      const bash = Shell.gitbash()
      if (!bash) return // Git Bash not installed — skip
      expect(Shell.acceptable("bash")).toBe(bash)
      expect(Shell.preferred("bash")).toBe(bash)
      await withShell("bash", async () => {
        expect(Shell.acceptable()).toBe(bash)
        expect(Shell.preferred()).toBe(bash)
      })
    })

    test("resolves bare PowerShell shells", async () => {
      const shell = which("pwsh") || which("powershell")
      if (!shell) return // No PowerShell available — skip
      await withShell(path.win32.basename(shell), async () => {
        expect(Shell.preferred()).toBe(shell)
      })
    })

    test("Windows default prefers pwsh over inherited SHELL=bash", async () => {
      const pwsh = which("pwsh")
      if (!pwsh) return // pwsh not installed — skip (deterministic: no pwsh = no assertion)
      await withShell("/usr/bin/bash", async () => {
        const preferred = Shell.preferred()
        expect(preferred).toBe(pwsh)
      })
    })

    test("explicit config.shell always wins over Windows default", async () => {
      const bash = Shell.gitbash()
      if (!bash) return // Git Bash not installed — skip
      const preferred = Shell.preferred("bash")
      expect(preferred).toBe(bash)
    })

    test("arbitrary nonexistent shell path is not trusted", async () => {
      // Even if basename is "pwsh", a fake path must NOT be returned
      const preferred = Shell.preferred("C:/definitely-does-not-exist/pwsh.exe")
      // Must fall back to real system default, not the fake path
      const realPwsh = which("pwsh")
      if (realPwsh) {
        expect(preferred).toBe(realPwsh)
      } else {
        // No pwsh installed — must fall back to something else
        expect(preferred).toBeDefined()
        expect(preferred).not.toBe("C:/definitely-does-not-exist/pwsh.exe")
      }
    })

    test("deterministic Windows fallback priority", () => {
      // Verifies the REAL resolution: Shell.preferred() must pick the first
      // available shell in the order pwsh > Git Bash > cmd > powershell.
      // (Legacy Windows PowerShell 5.1 is demoted to the last fallback —
      // known black-background compatibility issue in the HSCode terminal.)
      const pwsh = which("pwsh")
      const bash = Shell.gitbash()
      const comspec = process.env.COMSPEC || "cmd.exe"
      const ps = which("powershell")

      const candidates = [pwsh, bash, comspec, ps].filter(Boolean)
      expect(candidates.length).toBeGreaterThan(0)
      const first = candidates[0] as string

      Shell.preferred.reset()
      const preferred = Shell.preferred()
      expect(preferred).toBe(first)

      // Legacy powershell must never win while a higher-priority shell exists
      if (preferred && (pwsh || bash || process.env.COMSPEC)) {
        expect(Shell.name(preferred)).not.toBe("powershell")
      }
    })

    test("explicit config shell resolves to itself (pwsh and powershell)", () => {
      const pwsh = which("pwsh")
      const ps = which("powershell")
      if (pwsh) {
        expect(Shell.preferred("pwsh")).toBe(pwsh)
      }
      if (ps) {
        // Legacy PowerShell stays user-selectable: an explicit saved choice
        // must be respected, even though it is not the default.
        expect(Shell.preferred("powershell")).toBe(ps)
      }
    })

    test("legacy Windows PowerShell is labeled as legacy (display only)", () => {
      const ps = which("powershell")
      if (!ps) return // no legacy powershell on this machine — skip
      expect(Shell.label(ps)).toBe("Windows PowerShell (Legacy)")
      expect(Shell.isLegacyWindowsPowerShell(ps)).toBe(true)
      // pwsh is not legacy
      const pwsh = which("pwsh")
      if (pwsh) {
        expect(Shell.label(pwsh)).toBe("PowerShell 7")
        expect(Shell.isLegacyWindowsPowerShell(pwsh)).toBe(false)
      }
      // cmd is not legacy
      expect(Shell.isLegacyWindowsPowerShell(process.env.COMSPEC || "cmd.exe")).toBe(false)
    })

    test("shell list includes canonical names", async () => {
      const shells = await Shell.list()
      expect(shells.length).toBeGreaterThan(0)
      // Names should be canonical (pwsh/powershell/cmd), not friendly labels
      const names = shells.map((s) => s.name)
      expect(names.some((n) => n === "pwsh" || n === "powershell" || n === "cmd")).toBe(true)
      // Should NOT contain friendly labels as names
      expect(names).not.toContain("PowerShell 7")
      expect(names).not.toContain("Windows PowerShell")
      expect(names).not.toContain("Command Prompt")
    })

    test("shell list options persist path not friendly name", async () => {
      const shells = await Shell.list()
      // Each shell's path should be the actual executable path
      for (const shell of shells) {
        expect(shell.path).toBeDefined()
        expect(shell.path.length).toBeGreaterThan(0)
        // path should not be a friendly label
        expect(shell.path).not.toBe("PowerShell 7")
        expect(shell.path).not.toBe("Windows PowerShell")
        expect(shell.path).not.toBe("Command Prompt")
      }
    })
  }
})

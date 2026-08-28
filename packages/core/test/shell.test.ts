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
      expect(Shell.preferred("opencode-missing-shell")).toBe(preferred)
      expect(Shell.acceptable("opencode-missing-shell")).toBe(acceptable)
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
        // Windows ignores inherited SHELL, prefers pwsh
        const preferred = Shell.preferred()
        expect(preferred).toBeDefined()
        expect(Shell.name(preferred)).not.toBe("bash")
      })
    })

    test("resolves /usr/bin/bash from env to Git Bash", async () => {
      const bash = Shell.gitbash()
      if (!bash) return
      await withShell("/usr/bin/bash", async () => {
        expect(Shell.acceptable()).toBe(bash)
        expect(Shell.preferred()).toBe(bash)
      })
    })

    test("resolves bare bash to Git Bash before PATH", async () => {
      const bash = Shell.gitbash()
      if (!bash) return
      expect(Shell.acceptable("bash")).toBe(bash)
      expect(Shell.preferred("bash")).toBe(bash)
      await withShell("bash", async () => {
        expect(Shell.acceptable()).toBe(bash)
        expect(Shell.preferred()).toBe(bash)
      })
    })

    test("resolves bare PowerShell shells", async () => {
      const shell = which("pwsh") || which("powershell")
      if (!shell) return
      await withShell(path.win32.basename(shell), async () => {
        expect(Shell.preferred()).toBe(shell)
      })
    })

    test("Windows default prefers pwsh over inherited SHELL=bash", async () => {
      const pwsh = which("pwsh")
      if (!pwsh) return
      await withShell("/usr/bin/bash", async () => {
        // Even though SHELL points to bash, Windows should prefer pwsh
        const preferred = Shell.preferred()
        expect(preferred).toBe(pwsh)
      })
    })

    test("explicit config.shell always wins over Windows default", async () => {
      const bash = Shell.gitbash()
      if (!bash) return
      // Explicit config.shell=bash should return bash, not pwsh
      const preferred = Shell.preferred("bash")
      expect(preferred).toBe(bash)
    })

    test("Windows falls back to powershell when pwsh unavailable", async () => {
      const pwsh = which("pwsh")
      if (pwsh) return // Skip if pwsh is available
      const ps = which("powershell")
      if (!ps) return // Skip if neither is available
      await withShell(undefined, async () => {
        const preferred = Shell.preferred()
        expect(preferred).toBeDefined()
      })
    })

    test("Windows falls back to Git Bash when no PowerShell", async () => {
      const pwsh = which("pwsh")
      const ps = which("powershell")
      if (pwsh || ps) return // Skip if any PowerShell is available
      const bash = Shell.gitbash()
      if (!bash) return // Skip if Git Bash not available
      await withShell(undefined, async () => {
        const preferred = Shell.preferred()
        expect(preferred).toBe(bash)
      })
    })

    test("Windows falls back to cmd when nothing else available", async () => {
      const pwsh = which("pwsh")
      const ps = which("powershell")
      const bash = Shell.gitbash()
      if (pwsh || ps || bash) return // Skip if any preferred shell exists
      await withShell(undefined, async () => {
        const preferred = Shell.preferred()
        expect(preferred).toBeDefined()
        expect(Shell.name(preferred)).toBe("cmd")
      })
    })

    test("Windows shell list includes friendly labels", async () => {
      const shells = await Shell.list()
      expect(shells.length).toBeGreaterThan(0)
      // Check that at least one shell has a friendly label
      const hasLabel = shells.some(
        (s) => s.name === "pwsh" || s.name === "powershell" || s.name === "cmd",
      )
      expect(hasLabel).toBe(true)
    })
  }
})

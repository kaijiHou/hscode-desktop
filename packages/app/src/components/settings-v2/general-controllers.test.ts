import { describe, expect, test, vi } from "bun:test"
import { createRoot } from "solid-js"
import { createShellOptions, createSoundPreviewController } from "./general-controller-behavior"

describe("settings v2 controllers", () => {
  test("normalizes shell names and preserves an unavailable configured shell", () => {
    expect(
      createShellOptions({
        shells: [
          { path: "/bin/bash", name: "bash", acceptable: true },
          { path: "/opt/bash", name: "bash", acceptable: false },
          { path: "/bin/zsh", name: "zsh", acceptable: true },
        ],
        current: "fish",
      }),
    ).toEqual([
      { id: "auto", value: "", name: "", terminalOnly: false, legacy: false },
      { id: "/bin/bash", value: "/bin/bash", name: "bash", terminalOnly: false, legacy: false },
      { id: "/opt/bash", value: "/opt/bash", name: "bash", terminalOnly: true, legacy: false },
      { id: "/bin/zsh", value: "/bin/zsh", name: "zsh", terminalOnly: false, legacy: false },
      { id: "fish", value: "fish", name: "fish", terminalOnly: false, legacy: false },
    ])
  })

  test("marks legacy Windows PowerShell 5.1 as legacy", () => {
    const options = createShellOptions({
      shells: [
        { path: "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.EXE", name: "powershell", acceptable: true },
        { path: "C:/Users/x/AppData/Local/Microsoft/WindowsApps/pwsh.exe", name: "pwsh", acceptable: true },
      ],
      current: "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.EXE",
    })
    expect(options.find((o) => o.value.endsWith("powershell.EXE"))?.legacy).toBe(true)
    expect(options.find((o) => o.value.endsWith("pwsh.exe"))?.legacy).toBe(false)
  })

  test("debounces previews and stops owned audio on disposal", async () => {
    vi.useFakeTimers()
    try {
      const played: string[] = []
      const stopped: string[] = []
      const owned = createRoot((dispose) => ({
        dispose,
        preview: createSoundPreviewController(async (id) => {
          played.push(id ?? "")
          return () => stopped.push(id ?? "")
        }),
      }))

      owned.preview.play("first")
      vi.advanceTimersByTime(99)
      expect(played).toEqual([])

      owned.preview.play("second")
      vi.advanceTimersByTime(100)
      await Promise.resolve()
      expect(played).toEqual(["second"])

      owned.dispose()
      expect(stopped).toEqual(["second"])
    } finally {
      vi.useRealTimers()
    }
  })
})

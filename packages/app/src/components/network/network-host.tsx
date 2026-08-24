// HSCode Network Inspector — minimal global controller.
// Exposes an `open()` signal + mounts the NetworkPanel once at the app root.
// Command "network.toggle" is registered via this module.

import { createSignal, onMount } from "solid-js"
import { useCommand } from "@/context/command"
import { NetworkPanel } from "./network-panel"

const [open, setOpen] = createSignal(false)

export function openNetworkInspector(): void {
  setOpen(true)
}

export function closeNetworkInspector(): void {
  setOpen(false)
}

export function NetworkInspectorHost() {
  const command = useCommand()

  onMount(() => {
    // register() 使用 Solid onCleanup 自动注销（随组件卸载）
    void command.register("network.toggle", () => [
      {
        id: "network.toggle",
        title: open() ? "Close Network Inspector" : "Open Network Inspector",
        description: "Capture and inspect TCP/UDP packets (Windows, admin)",
        category: "network",
        keywords: "network, capture, packets, sniff",
        onSelect: () => setOpen((v) => !v),
      },
    ])
  })

  return (
    <NetworkPanel
      open={open}
      close={() => {
        setOpen(false)
      }}
    />
  )
}
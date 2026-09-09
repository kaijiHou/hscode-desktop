export function isDebugToolsEnabled(channel: string | undefined, disabled: string | undefined) {
  return channel === "dev" && disabled !== "1"
}

export const debugToolsEnabled = isDebugToolsEnabled(
  import.meta.env.VITE_OPENCODE_CHANNEL,
  import.meta.env.VITE_DISABLE_DEBUG_BAR,
)

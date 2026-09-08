export function assertServerExport(serverModule: Record<string, unknown>) {
  const Server = serverModule.Server
  if (!Server || typeof Server !== "object" || typeof (Server as { listen?: unknown }).listen !== "function") {
    throw new Error(`virtual:opencode-server export contract invalid; exports=${Object.keys(serverModule).join(",")}`)
  }
}

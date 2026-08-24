// HSCode: 桌面应用身份常量（可测试的纯模块）。
// App ID 决定 Electron userData 目录，必须与 OpenCode 完全隔离。

export const APP_NAMES: Record<string, string> = {
  dev: "HSCode Dev",
  beta: "HSCode Beta",
  prod: "HSCode",
}

export const APP_IDS: Record<string, string> = {
  dev: "ai.hscode.desktop.dev",
  beta: "ai.hscode.desktop.beta",
  prod: "ai.hscode.desktop",
}

export function resolveAppId(channel: string, isPackaged: boolean): string {
  return isPackaged ? APP_IDS[channel] : "ai.hscode.desktop.dev"
}
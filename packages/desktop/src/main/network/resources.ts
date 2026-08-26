// HSCode Network Inspector — single source of truth for WinDivert resources dir.
//
// Why this exists: getResourcesDir and getNativeBridge previously each re-derived
// the path and drifted apart (dev looked in packages/desktop/win instead of
// packages/desktop/resources/win → DLL_NOT_FOUND → silently swallowed →
// NATIVE_VALIDATOR_UNAVAILABLE). All callers MUST go through this helper.
//
// dev:      <app.getAppPath()>/resources          (= packages/desktop/resources)
// packaged: process.resourcesPath                 (electron-builder copies resources/win there)

import { join } from "node:path"

export interface NetworkResourcesEnv {
  /** app.isPackaged */
  isPackaged: boolean
  /** app.getAppPath() — in dev this is packages/desktop (verified at runtime) */
  appPath: string
  /** process.resourcesPath — only meaningful when packaged */
  resourcesPath: string
}

export function networkResourcesDir(env: NetworkResourcesEnv): string {
  if (env.isPackaged) return env.resourcesPath
  return join(env.appPath, "resources")
}

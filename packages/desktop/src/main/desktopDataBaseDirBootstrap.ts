import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { IS_HSCODE_BUILD } from "@zcode/shared";
import { setDataBaseDir } from "@zcode/services/node";

export function resolveBootstrapProfileHome(
  homePath: string = homedir(),
  env: Record<string, string | undefined> = process.env,
): string {
  return IS_HSCODE_BUILD ? env.HSCODE_HOME?.trim() || join(homePath, ".hscode-v2") : homePath;
}

export function resolveBootstrapSettingsFile(homePath?: string): string {
  return join(homePath ?? resolveBootstrapProfileHome(), ".zcode", "v2", "setting.json");
}

export function extractBootstrapDataBaseDir(rawValue: unknown): string | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const dataBaseDir = (rawValue as { dataBaseDir?: unknown }).dataBaseDir;
  if (typeof dataBaseDir !== "string") {
    return null;
  }

  const trimmed = dataBaseDir.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBootstrapDataBaseDirFromDisk(
  settingsFile: string = resolveBootstrapSettingsFile(),
): string | null {
  if (!existsSync(settingsFile)) {
    return null;
  }

  try {
    const raw = readFileSync(settingsFile, "utf-8");
    return extractBootstrapDataBaseDir(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function applyEarlyDataBaseDirBootstrap(): string | null {
  const profileHome = resolveBootstrapProfileHome();
  const selectedDataBaseDir = readBootstrapDataBaseDirFromDisk(
    resolveBootstrapSettingsFile(profileHome),
  );
  const dataBaseDir = selectedDataBaseDir ?? (IS_HSCODE_BUILD ? profileHome : null);
  if (dataBaseDir) {
    // 启动早期就把 dataBaseDir 注入进来，避免 logger / crashReporter 先按默认 HOME 建目录，
    // 导致后续再切换到自定义目录时，日志和 crash dump 落在两套路径里。
    setDataBaseDir(dataBaseDir);
    if (IS_HSCODE_BUILD) {
      // Profile 和可移动业务数据根都由 HSCode 专用变量持有；通用 ZCode 值只作为
      // 下游兼容接口写入这次已从 HSCode settings 得出的结果，绝不作为输入读取。
      process.env.HSCODE_HOME = profileHome;
      process.env.HSCODE_DATA_BASE_DIR = dataBaseDir;
      process.env.ZCODE_DATA_BASE_DIR = dataBaseDir;
      process.env.ZCODE_HOME = join(dataBaseDir, ".zcode");
    }
  }
  return dataBaseDir;
}

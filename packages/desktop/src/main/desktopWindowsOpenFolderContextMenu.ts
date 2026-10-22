import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { IS_HSCODE_BUILD, type Locale } from "@zcode/shared";

const ZCODE_MENU_KEY_NAME = "ZCode.OpenInZCode";
const HSCODE_MENU_KEY_NAME = "HSCodeV2.OpenInHSCode";
const MENU_LABELS: Record<Locale, string> = {
  "zh-CN": "在ZCode中打开",
  "en-US": "Open in ZCode",
};
const HSCODE_MENU_LABELS: Record<Locale, string> = {
  "zh-CN": "在 HSCode 中打开",
  "en-US": "Open in HSCode",
};

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

export interface WindowsOpenFolderRegistryOperation {
  args: string[];
}

export function getWindowsOpenFolderMenuName(
  locale: Locale,
  isHscodeBuild = IS_HSCODE_BUILD,
): string {
  const labels = isHscodeBuild ? HSCODE_MENU_LABELS : MENU_LABELS;
  return labels[locale] ?? labels["en-US"];
}

function quoteWindowsCommandArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function buildWindowsOpenFolderCommand(
  executablePath: string,
  appArgs: readonly string[] = [],
): string {
  return [
    quoteWindowsCommandArg(executablePath),
    ...appArgs.map(quoteWindowsCommandArg),
    "--open-workspace",
    '"%1"',
  ].join(" ");
}

export function buildWindowsOpenFolderRegistryOperations(options: {
  executablePath: string;
  appArgs?: readonly string[];
  locale: Locale;
  isHscodeBuild?: boolean;
}): WindowsOpenFolderRegistryOperation[] {
  const command = buildWindowsOpenFolderCommand(options.executablePath, options.appArgs ?? []);
  const isHscodeBuild = options.isHscodeBuild ?? IS_HSCODE_BUILD;
  const menuName = getWindowsOpenFolderMenuName(options.locale, isHscodeBuild);
  const menuKeyName = isHscodeBuild ? HSCODE_MENU_KEY_NAME : ZCODE_MENU_KEY_NAME;
  const menuKeys = [
    `HKCU\\Software\\Classes\\Directory\\shell\\${menuKeyName}`,
    `HKCU\\Software\\Classes\\Drive\\shell\\${menuKeyName}`,
  ];

  return menuKeys.flatMap((menuKey) => [
    { args: ["add", menuKey, "/ve", "/d", menuName, "/f"] },
    { args: ["add", menuKey, "/v", "MUIVerb", "/t", "REG_SZ", "/d", menuName, "/f"] },
    { args: ["add", menuKey, "/v", "Icon", "/t", "REG_SZ", "/d", options.executablePath, "/f"] },
    { args: ["add", `${menuKey}\\command`, "/ve", "/d", command, "/f"] },
  ]);
}

function runRegAdd(args: readonly string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("reg.exe", [...args], {
      stdio: "ignore",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`reg.exe exited with code ${code ?? "unknown"}`));
    });
  });
}

export async function installWindowsOpenFolderContextMenu(options: {
  platform: NodeJS.Platform;
  executablePath: string;
  argv: readonly string[];
  isDefaultApp: boolean;
  locale: Locale;
  logger: Logger;
}): Promise<void> {
  if (options.platform !== "win32") {
    return;
  }

  const appArgs =
    // 开发态 Windows 的 process.execPath 是 Electron 可执行文件。
    // 注册表命令必须同时带上应用入口，否则 Explorer 右键菜单只能启动空 Electron。
    options.isDefaultApp && options.argv[1] ? [resolve(options.argv[1])] : [];
  const operations = buildWindowsOpenFolderRegistryOperations({
    executablePath: options.executablePath,
    appArgs,
    locale: options.locale,
  });

  try {
    await Promise.all(operations.map((operation) => runRegAdd(operation.args)));

    options.logger.info("[open-folder] Windows Explorer 右键菜单已安装或更新", {
      executablePath: options.executablePath,
      hasDefaultAppEntry: appArgs.length > 0,
      locale: options.locale,
    });
  } catch (error) {
    options.logger.warn("[open-folder] Windows Explorer 右键菜单安装失败", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

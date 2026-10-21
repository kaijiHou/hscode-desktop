#!/usr/bin/env node
// HSCode Preview 一键构建编排：隐私门禁 → 桌面生产构建 → Win x64 安装包。
// 统一在这里注入构建环境（避免 Windows cmd 不支持 `VAR=1 cmd` 前缀语法）：
//   ZCODE_ENV=production          连接生产后端
//   ZCODE_PREVIEW_IDENTITY=1      使用 HSCode Preview 身份（ai.hscode.zcode.preview）
//   HSCODE_BUILD=1                激活 HSCode 隐私门禁（OTLP 注入硬关闭等）
// 用法：node scripts/hscode-build.mjs [--skip-build]（仅打包已构建产物时使用）
import process from "node:process";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = resolve(import.meta.dirname, "..");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const hscodeEnv = {
  ...process.env,
  ZCODE_ENV: "production",
  ZCODE_PREVIEW_IDENTITY: "1",
  HSCODE_BUILD: "1",
  ZCODE_ARMS_RUM_ENDPOINT: "",
  ZCODE_TELEMETRY_REPORT_ENDPOINT: "",
  ZCODE_AUTO_UPDATE: "0",
  // bundle.mjs 通过环境变量读取打包目标（避免 pnpm run 传参的 "--" 分隔歧义）。
  ZCODE_TARGET_OS: "win",
  ZCODE_TARGET_ARCH: "x64",
};

function run(label, command, args, options = {}) {
  console.log(`\n[hscode-build] === ${label} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: workspaceRoot,
    env: hscodeEnv,
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    console.error(`[hscode-build] FAILED: ${label} (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

// 1. 隐私门禁
run(
  "privacy guard",
  process.execPath,
  [resolve(workspaceRoot, "scripts", "hscode-privacy-guard.mjs")],
);

// 2. 桌面生产构建（tsup + vite + runtime assets）
if (!process.argv.includes("--skip-build")) {
  run("desktop production build", pnpmCmd, ["--filter", "@zcode/desktop", "run", "build"]);
}

// 3. Win x64 安装包（目标平台由 ZCODE_TARGET_OS/ZCODE_TARGET_ARCH 指定）
run("desktop bundle win x64", pnpmCmd, ["run", "bundle:desktop"]);

console.log("\n[hscode-build] DONE. Artifacts in packages/desktop/dist/");

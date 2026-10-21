#!/usr/bin/env node
// HSCode Preview 隐私构建门禁。
// 在任何 HSCode 构建/打包命令前运行：确保遥测、事件上报、OTLP、自动更新
// 在构建期被显式关闭，且私有默认文件不存在（防止 CI/环境污染悄悄打开）。
// 用法：node scripts/hscode-privacy-guard.mjs（失败时 exit 1 并列出原因）。
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const TRUTHY_ON_VALUES = new Set(["1", "true", "yes", "on"]);

/**
 * 纯函数便于单测：evaluateHscodePrivacyGuard(env, hasPrivateDefaultsFile)
 * @returns {string[]} 违规项列表（空数组 = 通过）
 */
export function evaluateHscodePrivacyGuard(
  env = process.env,
  hasPrivateDefaultsFile = false,
) {
  const failures = [];

  // 这三个开关在 ZCode 上游就是"缺省关闭"；HSCode 构建进一步要求"显式为空/关闭"，
  // 防止上层 CI 或开发者 shell 的环境变量把采集通道带进产物。
  for (const name of [
    "ZCODE_ARMS_RUM_ENDPOINT",
    "ZCODE_TELEMETRY_REPORT_ENDPOINT",
    "ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT",
    "ZCODE_PACKAGED_AGENT_OTEL_HEADERS",
  ]) {
    if ((env[name]?.trim() ?? "") !== "") {
      failures.push(`${name} must be empty/unset for HSCode builds`);
    }
  }

  const autoUpdate = (env.ZCODE_AUTO_UPDATE ?? "").trim().toLowerCase();
  if (TRUTHY_ON_VALUES.has(autoUpdate)) {
    failures.push("ZCODE_AUTO_UPDATE must be disabled (0/false/empty) for HSCode builds");
  }

  if (hasPrivateDefaultsFile) {
    failures.push(
      "config/private/build-defaults.json must not exist in HSCode builds (upstream private defaults may enable telemetry)",
    );
  }

  if ((env.HSCODE_BUILD ?? "").trim() !== "1") {
    failures.push("HSCODE_BUILD=1 must be set so HSCode-specific gates (e.g. OTLP skip) activate");
  }

  return failures;
}

export function main() {
  const root = resolve(import.meta.dirname, "..");
  const hasPrivateDefaultsFile = existsSync(resolve(root, "config/private/build-defaults.json"));
  const failures = evaluateHscodePrivacyGuard(process.env, hasPrivateDefaultsFile);
  if (failures.length > 0) {
    console.error("[hscode-privacy-guard] FAILED:");
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }
  console.log(
    "[hscode-privacy-guard] OK: ARMS/event-report/OTLP endpoints empty, auto-update disabled, no private defaults file.",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? "")) {
  main();
}

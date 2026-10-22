import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runCommand } from "./spawn-command.mjs";

export function createHscodeEnvironment(env, root) {
  return {
    ...env,
    HSCODE_BUILD: "1",
    ZCODE_ENV: "production",
    ZCODE_ARMS_RUM_ENDPOINT: "",
    ZCODE_TELEMETRY_REPORT_ENDPOINT: "",
    ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT: "",
    ZCODE_PACKAGED_AGENT_OTEL_HEADERS: "",
    ZCODE_AUTO_UPDATE: "0",
    ZCODE_TARGET_OS:
      env.ZCODE_TARGET_OS || { win32: "win", darwin: "mac", linux: "linux" }[process.platform],
    ZCODE_TARGET_ARCH: env.ZCODE_TARGET_ARCH || process.arch,
    TEMP: resolve(root, ".agent-context/temp"),
    TMP: resolve(root, ".agent-context/temp"),
    ELECTRON_CACHE: resolve(root, ".agent-context/electron-cache"),
    ELECTRON_BUILDER_CACHE: resolve(root, ".agent-context/electron-builder-cache"),
    npm_config_cache: resolve(root, ".agent-context/npm-cache"),
  };
}

export async function verifyHscodeBuild(root) {
  const marker = JSON.parse(
    await readFile(resolve(root, "packages/desktop/out/metadata/hscode-build.json"), "utf8"),
  );
  const main = await readFile(resolve(root, "packages/desktop/out/main/index.js"));
  if (
    marker.hscodeBuild !== true ||
    marker.mainSha256 !== createHash("sha256").update(main).digest("hex")
  ) {
    throw new Error(
      "HSCode build identity does not match the current output. Run build:hscode first.",
    );
  }
}

/** 本地 Main 增量编译完成后记录其构建身份；只由已显式启用 HSCode 的构建调用。 */
export async function recordHscodeBuild(root, env = process.env) {
  if (env.HSCODE_BUILD !== "1")
    throw new Error("Only an explicit HSCode build can record its identity.");
  const main = await readFile(resolve(root, "packages/desktop/out/main/index.js"));
  await writeFile(
    resolve(root, "packages/desktop/out/metadata/hscode-build.json"),
    JSON.stringify({
      hscodeBuild: true,
      mainSha256: createHash("sha256").update(main).digest("hex"),
    }),
  );
}

async function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("HSCode requires Node 24 or newer. Use the project's pinned Node runtime.");
  const root = resolve(import.meta.dirname, "..");
  const mode = process.argv[2] ?? "dev";
  if (!["dev", "build", "bundle", "run"].includes(mode))
    throw new Error("Usage: node scripts/hscode.mjs [dev|build|bundle|run]");
  const env = createHscodeEnvironment(process.env, root);
  await mkdir(env.TEMP, { recursive: true });
  await writeFile(
    resolve(root, ".agent-context/README.md"),
    "# 本机运行产物\n\n保存构建缓存、临时文件和验证日志；不提交或打包。不要在此保存真实用户会话或凭据。\n",
    { flag: "wx" },
  ).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  if (mode === "dev" || mode === "run") {
    env.HSCODE_SKIP_SYSTEM_INTEGRATION = "1";
    env.HSCODE_HOME = env.HSCODE_HOME?.trim() || resolve(root, ".hscode-local-data");
    await mkdir(env.HSCODE_HOME, { recursive: true });
    await writeFile(
      resolve(env.HSCODE_HOME, "README.md"),
      "# HSCode 本地开发数据\n\n此目录保存本 checkout 的配置、凭据、会话与数据库，不是构建缓存。不要上传、打包或自动清理。\n",
      { flag: "wx" },
    ).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
  }
  const options = { cwd: root, env };
  if (mode === "dev") {
    runCommand("pnpm", ["dev:desktop"], options);
    return;
  }
  if (mode === "run") {
    await verifyHscodeBuild(root);
    const require = createRequire(resolve(root, "packages/desktop/package.json"));
    runCommand(require("electron"), [resolve(root, "packages/desktop")], options);
    return;
  }
  runCommand("pnpm", ["--filter", "@zcode/desktop", "build"], options);
  await recordHscodeBuild(root, env);
  if (mode === "bundle") runCommand("pnpm", ["bundle:desktop"], options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

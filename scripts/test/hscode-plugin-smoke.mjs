import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const validationRoot = join(repoRoot, ".agent-context", "plugin-validation");
const cliPath = join(
  repoRoot,
  "apps",
  "zcode-cli",
  "packages",
  "cli",
  "dist",
  "zcode.cjs",
);
const officialMarketplace = "zcode-plugins-official";
const node24Root = "D:/node24-full/node-v24.22.0-win-x64";
const npmGlobal = "D:/npm-global";
const tempRoot = join(repoRoot, ".agent-context", "temp");
const reviewedHashes = {
  excalidraw:
    "3ff2bbe7bfbf906bc19ee79cbbd3797daa5b6fb2f8b60513ca7793b7914ed7f3",
  "zcode-context-insight":
    "2d43e50f54201d5d959fec66041d998da3dae3a6a8ea352cc02d3e00b331dd3a",
};
const plugins = [
  {
    name: "excalidraw",
    version: "0.3.4",
    license: "MIT",
    server: "excalidraw",
    surface: "excalidraw",
    resourceUri: "ui://excalidraw/panel.html",
  },
  {
    name: "zcode-context-insight",
    version: "0.1.1",
    license: "Apache-2.0",
    server: "context",
    surface: "context",
    resourceUri: "ui://zcode-context-insight/context.html",
  },
];

const isWithin = (base, target) => {
  const relativePath = relative(base, target);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
};

const redactProfile = (value, profileRoot) =>
  String(value ?? "")
    .replaceAll(profileRoot, "<isolated-profile>")
    .slice(0, 1200);

async function assertInside(basePath, targetPath, label) {
  assert.ok(targetPath, `${label} path missing`);
  const resolvedBase = await realpath(basePath);
  const resolvedTarget = await realpath(targetPath);
  assert.ok(
    isWithin(resolvedBase, resolvedTarget),
    `${label} escaped the isolated profile: ${resolvedTarget}`,
  );
  return resolvedTarget;
}

function parseJsonOutput(stdout, command) {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    throw new Error(
      `${command} did not return JSON: ${stdout.trim().slice(0, 600)}`,
    );
  }
}

function createIsolatedEnv(paths) {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTHORIZATION)/iu.test(
          key,
        ),
    ),
  );
  delete inherited.HSCODE_BUILD;
  const pathValue = [node24Root, npmGlobal, process.env.PATH]
    .filter(Boolean)
    .join(";");
  return {
    ...inherited,
    PATH: pathValue,
    TEMP: tempRoot,
    TMP: tempRoot,
    HOME: paths.home,
    USERPROFILE: paths.home,
    APPDATA: paths.appData,
    LOCALAPPDATA: paths.localAppData,
    XDG_CONFIG_HOME: paths.config,
    XDG_DATA_HOME: paths.data,
    XDG_CACHE_HOME: paths.cache,
    HSCODE_HOME: paths.hscodeHome,
    ZCODE_HOME: paths.zcodeHome,
    ZCODE_DATA_BASE_DIR: paths.dataBase,
    ZCODE_STORAGE_DIR: paths.storage,
    ZCODE_PLUGIN_DATA: paths.pluginData,
    ZCODE_PROJECT_DIR: paths.workspace,
    ZCODE_CONTEXT_DATA_ROOT: paths.contextData,
    ZCODE_CONTEXT_DB_PATH: paths.contextDb,
    ZCODE_RUNTIME_ENV: "production",
    NODE_OPTIONS: "",
    NODE_PATH: "",
  };
}

function invokeCli(paths, args) {
  const command = args.join(" ");
  const result = spawnSync(
    process.execPath,
    [cliPath, "--json", "--no-color", ...args],
    {
      cwd: paths.workspace,
      encoding: "utf8",
      env: paths.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 5 * 60 * 1000,
      windowsHide: true,
    },
  );
  if (result.error)
    throw new Error(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = redactProfile(result.stderr || result.stdout, paths.runRoot);
    throw new Error(`${command} exited ${result.status}: ${detail}`);
  }
  return parseJsonOutput(result.stdout, command);
}

function interpolate(value, pluginRoot, pluginData, paths, userConfig) {
  let result = String(value);
  const replacements = {
    "${ZCODE_PLUGIN_ROOT}": pluginRoot,
    "${ZCODE_PLUGIN_DATA}": pluginData,
    "${ZCODE_PROJECT_DIR}": paths.workspace,
    "${user_config.dataRoot}": paths.contextData,
    "${user_config.dbPath}": paths.contextDb,
    "${user_config.contextWindow}": String(userConfig.contextWindow ?? 0),
    "${user_config.priceFile}": "",
    "${user_config.enableEval}": "false",
  };
  for (const [placeholder, replacement] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, replacement);
  }
  assert.ok(!result.includes("${"), `Unresolved plugin placeholder: ${result}`);
  return result;
}

function requestMcp(child, state, method, params, timeoutMs = 30_000) {
  const id = ++state.nextId;
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      rejectPromise(new Error(`MCP ${method} timed out`));
    }, timeoutMs);
    state.pending.set(id, {
      reject: (error) => {
        clearTimeout(timer);
        rejectPromise(error);
      },
      resolve: (message) => {
        clearTimeout(timer);
        if (message.error) {
          rejectPromise(
            new Error(
              `MCP ${method}: ${message.error.message ?? "request failed"}`,
            ),
          );
        } else {
          resolvePromise(message.result);
        }
      },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
    );
  });
}

async function readUiResource(plugin, pluginRoot, paths) {
  const manifestPath = join(pluginRoot, ".zcode-plugin", "plugin.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.name, plugin.name, `${plugin.name} manifest name`);
  assert.equal(
    manifest.version,
    plugin.version,
    `${plugin.name} manifest version`,
  );
  assert.equal(
    manifest.license,
    plugin.license,
    `${plugin.name} manifest license`,
  );

  const surface = manifest.ui?.surfaces?.find(
    (item) => item.id === plugin.surface,
  );
  assert.ok(surface, `${plugin.name} surface missing`);
  assert.equal(
    surface.resourceUri,
    plugin.resourceUri,
    `${plugin.name} resource URI`,
  );
  assert.equal(
    surface.availability,
    "session",
    `${plugin.name} surface availability`,
  );
  assert.equal(surface.server, plugin.server, `${plugin.name} surface server`);

  const server = manifest.mcpServers?.[plugin.server];
  assert.equal(server?.type, "stdio", `${plugin.name} server transport`);
  assert.equal(server?.command, "node", `${plugin.name} server command`);
  const pluginData = join(paths.pluginData, plugin.name);
  await mkdir(pluginData, { recursive: true });
  await assertInside(paths.runRoot, pluginData, `${plugin.name} plugin data`);
  const userConfigDefaults = Object.fromEntries(
    Object.entries(manifest.userConfig ?? {}).map(([key, field]) => [
      key,
      field.default,
    ]),
  );
  const serverArgs = server.args.map((arg) =>
    interpolate(arg, pluginRoot, pluginData, paths, userConfigDefaults),
  );
  const serverEnv = Object.fromEntries(
    Object.entries(server.env ?? {}).map(([key, value]) => [
      key,
      interpolate(value, pluginRoot, pluginData, paths, userConfigDefaults),
    ]),
  );
  const scriptArg = serverArgs.find((arg) => arg.endsWith("dist/server.mjs"));
  assert.ok(scriptArg, `${plugin.name} server entry missing`);
  await assertInside(pluginRoot, scriptArg, `${plugin.name} server entry`);

  const child = spawn(process.execPath, serverArgs, {
    cwd: paths.workspace,
    env: { ...paths.env, ZCODE_PLUGIN_ROOT: pluginRoot, ...serverEnv },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const state = {
    buffer: "",
    nextId: 0,
    pending: new Map(),
    protocolError: undefined,
  };
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    state.buffer += chunk;
    while (state.buffer.includes("\n")) {
      const newline = state.buffer.indexOf("\n");
      const line = state.buffer.slice(0, newline).trim();
      state.buffer = state.buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line);
        if (message.id !== undefined) {
          const request = state.pending.get(message.id);
          state.pending.delete(message.id);
          request?.resolve(message);
        }
      } catch {
        state.protocolError = redactProfile(line, paths.runRoot);
        for (const request of state.pending.values()) {
          request.reject(
            new Error(`Invalid MCP stdio response: ${state.protocolError}`),
          );
        }
        state.pending.clear();
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-1200);
  });
  child.on("error", (error) => {
    for (const request of state.pending.values()) request.reject(error);
    state.pending.clear();
  });
  child.stdin.on("error", (error) => {
    for (const request of state.pending.values()) request.reject(error);
    state.pending.clear();
  });
  child.on("exit", (code) => {
    for (const request of state.pending.values()) {
      request.reject(new Error(`MCP server exited with code ${code}`));
    }
    state.pending.clear();
  });

  try {
    const initialized = await requestMcp(child, state, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "hscode-plugin-smoke", version: "1.0.0" },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );
    const resource = await requestMcp(child, state, "resources/read", {
      uri: plugin.resourceUri,
    });
    const content = resource?.contents?.find(
      (item) => typeof item.text === "string" && item.text.length > 0,
    );
    assert.ok(content, `${plugin.name} returned no UI resource content`);
    assert.match(
      content.mimeType ?? "",
      /^text\/html/u,
      `${plugin.name} UI resource MIME type`,
    );
    return {
      license: manifest.license,
      surfaceId: surface.id,
      resourceUri: surface.resourceUri,
      protocolVersion: initialized.protocolVersion,
      serverName: initialized.serverInfo?.name ?? null,
      resourceMimeType: content.mimeType,
      resourceTextLength: content.text.length,
      toolCalls: 0,
    };
  } catch (error) {
    const detail = stderr
      ? `; stderr: ${redactProfile(stderr, paths.runRoot)}`
      : "";
    throw new Error(`${error.message}${detail}`);
  } finally {
    child.stdin.end();
    if (child.exitCode === null) child.kill();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    console.log("Usage: node scripts/test/hscode-plugin-smoke.mjs --install");
    console.log(
      "Creates a fresh isolated profile; refreshes only the official marketplace; installs only Excalidraw and Context Insight and reads their MCP UI resources. No Electron.",
    );
    return;
  }
  assert.deepEqual(
    args,
    ["--install"],
    "Only --install or --help is supported",
  );
  assert.equal(
    process.platform,
    "win32",
    "This smoke is for the Windows profile",
  );
  assert.ok(
    Number(process.versions.node.split(".")[0]) >= 24,
    "Node.js 24+ is required",
  );
  assert.ok(
    isWithin(resolve(node24Root), resolve(process.execPath)),
    `Run with Node from ${node24Root}`,
  );
  await access(cliPath);
  await mkdir(tempRoot, { recursive: true });
  await mkdir(join(validationRoot, "runs"), { recursive: true });

  const runsRoot = join(validationRoot, "runs");
  const runPrefix = `${new Date().toISOString().replaceAll(/[:.]/gu, "-")}-`;
  const runRoot = await mkdtemp(join(runsRoot, runPrefix));
  const paths = {
    runRoot,
    home: join(runRoot, "home"),
    appData: join(runRoot, "appdata", "roaming"),
    localAppData: join(runRoot, "appdata", "local"),
    config: join(runRoot, "config"),
    data: join(runRoot, "xdg-data"),
    cache: join(runRoot, "cache"),
    hscodeHome: join(runRoot, "hscode-home"),
    zcodeHome: join(runRoot, "zcode-home"),
    dataBase: join(runRoot, "data-base"),
    storage: join(runRoot, "zcode-storage"),
    pluginData: join(runRoot, "plugin-data"),
    contextData: join(runRoot, "context-data"),
    contextDb: join(runRoot, "context-data", "db.sqlite"),
    workspace: join(runRoot, "workspace"),
  };
  paths.env = createIsolatedEnv(paths);

  const createdPaths = Object.entries(paths).filter(
    ([, value]) => typeof value === "string",
  );
  for (const [, directory] of createdPaths) {
    if (directory === runRoot || directory === paths.contextDb) continue;
    await mkdir(directory, { recursive: true });
    assert.ok(
      isWithin(runRoot, resolve(directory)),
      `Configured path escaped: ${directory}`,
    );
  }
  await writeFile(join(paths.workspace, ".env"), "", { flag: "wx" });
  const report = {
    runRoot,
    platform: process.platform,
    node: process.version,
    cliPath,
    roots: Object.fromEntries(
      [
        "home",
        "hscodeHome",
        "zcodeHome",
        "dataBase",
        "storage",
        "pluginData",
        "contextData",
        "workspace",
      ].map((key) => [key, relative(runRoot, paths[key])]),
    ),
    plugins: [],
    electronUi:
      "NOT RUN: requires main-coordinated Electron validation after unified build",
    modelCalls: 0,
    pluginToolCalls: 0,
  };
  const readme = [
    "# 隔离插件 CLI 运行",
    "",
    "本目录由 `scripts/test/hscode-plugin-smoke.mjs` 新建，不复用、不自动删除。CLI storage、HOME、HSCode/ZCode 根、workspace、Context Insight 数据和插件数据都应位于本目录。",
    "",
    "本次只做官方 CLI 安装/启用、安装路径和 MCP initialize + 静态 UI resource read；不启动 Electron，不调用插件工具或模型，不访问真实用户数据。",
    "",
    "`result.json` 只保存脱敏验证摘要；不保存插件 UI 内容、会话、密钥或完整命令输出。",
  ].join("\n");
  await writeFile(join(runRoot, "README.md"), readme, { flag: "wx" });

  let reportWritten = false;
  const persist = async () => {
    await writeFile(
      join(runRoot, "result.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      {
        flag: reportWritten ? "w" : "wx",
      },
    );
    reportWritten = true;
  };

  try {
    for (const key of [
      "home",
      "hscodeHome",
      "zcodeHome",
      "dataBase",
      "storage",
      "pluginData",
      "contextData",
      "workspace",
    ]) {
      await assertInside(runRoot, paths[key], key);
    }
    const storagePluginRoot = join(paths.storage, "cli", "plugins");
    const refreshed = invokeCli(paths, [
      "plugins",
      "marketplace",
      "update",
      officialMarketplace,
    ]);
    assert.equal(refreshed.ok, true, "Official marketplace refresh failed");
    await assertInside(runRoot, storagePluginRoot, "CLI plugin storage");
    report.pluginStorageRoot = relative(
      runRoot,
      await realpath(storagePluginRoot),
    );
    const catalog = JSON.parse(
      await readFile(
        join(
          storagePluginRoot,
          "marketplaces",
          officialMarketplace,
          "marketplace.json",
        ),
        "utf8",
      ),
    );
    const overview = invokeCli(paths, ["plugins", "list", "--available"]);
    const available = overview.available ?? [];
    for (const plugin of plugins) {
      const listing = available.find(
        (entry) =>
          entry.name === plugin.name &&
          entry.marketplace === officialMarketplace,
      );
      assert.ok(
        listing,
        `${plugin.name} missing from official CLI marketplace`,
      );
      assert.equal(
        listing.marketplace,
        officialMarketplace,
        `${plugin.name} marketplace`,
      );
      assert.equal(
        listing.version,
        plugin.version,
        `${plugin.name} catalog version`,
      );
      const published = catalog.plugins?.find(
        (entry) => entry.name === plugin.name,
      );
      assert.equal(
        published?.source?.sha256,
        reviewedHashes[plugin.name],
        `${plugin.name} reviewed archive hash`,
      );
      assert.equal(
        published?.source?.type,
        "zip",
        `${plugin.name} archive type`,
      );
      assert.equal(
        published?.source?.url,
        `https://cdn-zcode.z.ai/zcode/official-plugin/plugins/${plugin.name}/${plugin.version}/plugin.zip`,
        `${plugin.name} official archive URL`,
      );
    }

    for (const plugin of plugins) {
      const outcome = {
        name: plugin.name,
        version: plugin.version,
        installation: "NOT RUN",
        mcpResource: "NOT RUN",
        status: "RUNNING",
      };
      report.plugins.push(outcome);
      await persist();
      console.log(
        `Installing and enabling ${plugin.name}@${officialMarketplace} in isolated profile`,
      );
      const installed = invokeCli(paths, [
        "plugins",
        "install",
        `${plugin.name}@${officialMarketplace}`,
        "--scope",
        "user",
      ]);
      assert.equal(
        installed.ok,
        true,
        `${plugin.name} install reported failure`,
      );
      outcome.installation = "PASS";
      await persist();
      invokeCli(paths, [
        "plugins",
        "enable",
        `${plugin.name}@${officialMarketplace}`,
        "--scope",
        "user",
      ]);

      const current = invokeCli(paths, ["plugins", "list"]);
      const record = current.find(
        (entry) => entry.id === `${plugin.name}@${officialMarketplace}`,
      );
      assert.ok(record, `${plugin.name} missing from installed plugin list`);
      assert.equal(
        record.version,
        plugin.version,
        `${plugin.name} installed version`,
      );
      assert.equal(record.enabled, true, `${plugin.name} not enabled`);
      const pluginRoot = await assertInside(
        storagePluginRoot,
        record.rootPath,
        `${plugin.name} install`,
      );
      const manifestPath = await assertInside(
        pluginRoot,
        record.manifestPath,
        `${plugin.name} manifest`,
      );
      let dataPath;
      if (record.dataPath) {
        dataPath = resolve(record.dataPath);
        assert.ok(
          isWithin(runRoot, dataPath),
          `${plugin.name} data path escaped the profile`,
        );
        try {
          await access(dataPath);
          dataPath = await assertInside(
            runRoot,
            dataPath,
            `${plugin.name} data`,
          );
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      Object.assign(outcome, {
        enabled: record.enabled,
        installRoot: relative(runRoot, pluginRoot),
        manifest: relative(runRoot, manifestPath),
        ...(dataPath ? { dataPath: relative(runRoot, dataPath) } : {}),
      });
      await persist();
      outcome.resource = await readUiResource(plugin, pluginRoot, paths);
      outcome.mcpResource = "PASS";
      outcome.status = "PASS";
      await persist();
      console.log(
        `PASS ${plugin.name}: isolated install path and ${plugin.resourceUri}`,
      );
    }

    report.status = "PASS";
    await persist();
    console.log(
      `All ${plugins.length} official plugin CLI/resource checks passed.`,
    );
    console.log(`Report: ${join(runRoot, "result.json")}`);
  } catch (error) {
    report.status = "FAIL";
    const active = report.plugins.find((plugin) => plugin.status === "RUNNING");
    if (active) active.status = "FAIL";
    report.failure = redactProfile(
      error?.stack ?? error?.message ?? error,
      runRoot,
    );
    await persist();
    console.error(`Isolated plugin smoke failed; profile retained: ${runRoot}`);
    console.error(redactProfile(error?.message ?? error, runRoot));
    process.exitCode = 1;
  }
}

await main();

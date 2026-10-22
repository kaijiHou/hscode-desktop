import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const validationRoot = resolve(root, ".agent-context/native-tools-validation");
const runsRoot = join(validationRoot, "runs");
const node24Root = "D:/node24-full/node-v24.22.0-win-x64";
const npmGlobal = "D:/npm-global";
const tempRoot = resolve(root, ".agent-context/temp");
const usage =
  "Usage: node scripts/test/hscode-native-tools-smoke.mjs --run\n" +
  "       node scripts/test/hscode-native-tools-smoke.mjs --help\n" +
  "Requires the current local HSCode build and Node.js 24 from D:/node24-full.\n" +
  "--run launches a fresh isolated Electron profile and synthetic workspace. No model prompt is sent.";

function isWithin(basePath, targetPath) {
  const relativePath = relative(resolve(basePath), resolve(targetPath));
  return (
    relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(".." + sep) && !isAbsolute(relativePath))
  );
}

function redactRunPath(value, runRoot) {
  return String(value ?? "")
    .replaceAll(runRoot, "<native-tools-run>")
    .slice(0, 1600);
}

async function writeIfMissing(path, contents) {
  try {
    await writeFile(path, contents, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

async function run() {
  assert.equal(process.platform, "win32", "This smoke is for the isolated Windows profile.");
  assert.ok(Number(process.versions.node.split(".")[0]) >= 24, "Node.js 24 or newer is required.");
  assert.ok(
    isWithin(node24Root, process.execPath),
    "Run with Node from D:/node24-full/node-v24.22.0-win-x64.",
  );

  const [{ _electron }, { createHscodeEnvironment, verifyHscodeBuild }] = await Promise.all([
    import("playwright-core"),
    import("../hscode.mjs"),
  ]);
  await mkdir(validationRoot, { recursive: true });
  await writeIfMissing(
    join(validationRoot, "README.md"),
    "# HSCode 原生能力验证产物\n\n" +
      "本目录只保存本脚本创建的隔离 profile、合成 workspace fixture、截图和脱敏结果。不要放入真实会话、凭据或用户项目；不用于打包或分发。\n",
  );
  await mkdir(runsRoot, { recursive: true });
  const runPrefix = new Date().toISOString().replaceAll(/[:.]/gu, "-") + "-";
  const runRoot = await mkdtemp(join(runsRoot, runPrefix));
  assert.ok(isWithin(validationRoot, runRoot), "Run output escaped validation directory.");

  const workspacePath = join(runRoot, "workspace 中文 空格");
  const emptyDirectory = join(workspacePath, "空目录 中文 空格");
  const fixtureFile = join(workspacePath, "验证 文件.md");
  const fixtureMarker = "HSCODE_NATIVE_FILE_MARKER";
  const terminalMarker = "HSCODE_NATIVE_TERMINAL_OK";
  const profile = join(runRoot, "profile");
  const hscodeDataRoot = join(profile, "hscode-home");
  const zcodeHome = join(hscodeDataRoot, ".zcode");
  const pluginStorage = join(zcodeHome, "cli", "plugins");
  const paths = {
    home: hscodeDataRoot,
    appData: join(profile, "appdata", "roaming"),
    localAppData: join(profile, "appdata", "local"),
    config: join(profile, "config"),
    data: join(profile, "data"),
    cache: join(profile, "cache"),
    hscodeHome: hscodeDataRoot,
    zcodeHome,
    dataBase: hscodeDataRoot,
    storage: zcodeHome,
    pluginData: join(pluginStorage, "data"),
    pluginStorage,
    contextData: join(profile, "context-data"),
    contextDb: join(profile, "context-data", "db.sqlite"),
    userData: join(profile, "electron", "userData"),
    electronCache: join(profile, "electron-cache"),
    electronBuilderCache: join(profile, "electron-builder-cache"),
    npmCache: join(profile, "npm-cache"),
  };
  const logPath = join(runRoot, "run.log");
  const resultPath = join(runRoot, "result.json");
  const result = {
    status: "RUNNING",
    node: process.version,
    run: basename(runRoot),
    workspace: relative(runRoot, workspacePath),
    profile: relative(runRoot, profile),
    modelPromptSubmitted: false,
    pluginInstallActions: 0,
    gitWrites: 0,
    pluginStorage: { status: "NOT RUN" },
    steps: [],
    limitations: [
      "辅助对话正向可见性未运行：本轮没有真实 task/session，也不会发送 prompt 或伪造 session。",
      "Git 面板仅在隔离的非 Git fixture 中打开；未初始化仓库或执行写操作。",
    ],
  };
  let reportWritten = false;
  let app;
  let page;

  const persist = async () => {
    await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", {
      flag: reportWritten ? "w" : "wx",
    });
    reportWritten = true;
  };
  const log = async (line) => {
    await appendFile(logPath, line + "\n", "utf8");
    console.log(line);
  };
  const step = async (name, operation) => {
    try {
      await operation();
      result.steps.push({ name, status: "PASS" });
      await log("PASS " + name);
    } catch (error) {
      result.steps.push({ name, status: "FAIL" });
      await log("FAIL " + name);
      throw error;
    }
  };
  const visible = (testId) => page.locator('[data-testid="' + testId + '"]:visible').first();
  const openToolCenter = async () => {
    if (!(await page.locator("[data-side-pane-add-tab-trigger]:visible").count())) {
      await visible("side-pane-toggle").click();
    }
    await page.locator("[data-side-pane-add-tab-trigger]:visible").first().click();
    await visible("hscode-tool-center-search").waitFor({ timeout: 30000 });
  };

  await writeFile(
    join(runRoot, "README.md"),
    "# 本轮 HSCode 原生能力验证\n\n" +
      "只含合成 workspace、隔离 Electron profile、截图、脱敏运行摘要、CLI 环境字段追踪和步骤日志。失败时保留现场，不自动删除。\n\n" +
      "workspace 中的中文空格目录和 Markdown 文件由脚本新建；不会覆盖已有文件，也不导入用户数据。\n",
    { flag: "wx" },
  );
  await writeFile(logPath, "", { flag: "wx" });
  await persist();

  try {
    await verifyHscodeBuild(root);
    await mkdir(tempRoot, { recursive: true });
    await Promise.all(
      [
        ...Object.values(paths).filter((path) => path !== paths.contextDb),
        workspacePath,
        emptyDirectory,
      ].map((path) => mkdir(path, { recursive: true })),
    );
    await writeFile(fixtureFile, "# HSCode 原生工具合成文件\n\n" + fixtureMarker + "\n", {
      flag: "wx",
    });

    await step("isolated CLI plugin storage realpath stays within this run", async () => {
      const pluginStorageRealPath = await realpath(paths.pluginStorage);
      assert.ok(
        isWithin(runRoot, pluginStorageRealPath),
        "The canonical plugin storage path escaped the isolated run.",
      );
      result.pluginStorage = {
        status: "PREFLIGHT_PASS; CLI process not yet observed",
        electronLaunchEnvSource: "_electron.launch({ env }) in this script",
        configuredFields: {
          HOME: relative(runRoot, paths.home),
          USERPROFILE: relative(runRoot, paths.home),
          HSCODE_HOME: relative(runRoot, paths.hscodeHome),
          HSCODE_DATA_BASE_DIR: relative(runRoot, paths.dataBase),
          ZCODE_HOME: relative(runRoot, paths.zcodeHome),
          ZCODE_DATA_BASE_DIR: relative(runRoot, paths.dataBase),
          ZCODE_STORAGE_DIR: relative(runRoot, paths.storage),
        },
        pluginStorageRoot: relative(runRoot, paths.pluginStorage),
        pluginStorageRealpath: relative(runRoot, pluginStorageRealPath),
        cliProcessEnvSource: "NOT OBSERVED",
      };
    });

    const env = createHscodeEnvironment(process.env, root);
    for (const key of Object.keys(env)) {
      if (/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTHORIZATION)/iu.test(key)) {
        delete env[key];
      }
    }
    Object.assign(env, {
      PATH: [node24Root, npmGlobal, process.env.PATH].filter(Boolean).join(";"),
      TEMP: tempRoot,
      TMP: tempRoot,
      // 模拟外部旧配置污染，但仍限制在本轮合成目录；Main 必须覆盖而不是原样继承。
      HOME: join(profile, "legacy-home"),
      USERPROFILE: join(profile, "legacy-home"),
      APPDATA: paths.appData,
      LOCALAPPDATA: paths.localAppData,
      XDG_CONFIG_HOME: paths.config,
      XDG_DATA_HOME: paths.data,
      XDG_CACHE_HOME: paths.cache,
      HSCODE_HOME: paths.hscodeHome,
      ZCODE_HOME: paths.zcodeHome,
      ZCODE_DATA_BASE_DIR: paths.dataBase,
      ZCODE_STORAGE_DIR: join(profile, "legacy-storage"),
      ZCODE_SESSION_DB_PATH: join(profile, "legacy-session.sqlite"),
      ZCODE_PLUGIN_DATA: paths.pluginData,
      ZCODE_CONTEXT_DATA_ROOT: paths.contextData,
      ZCODE_CONTEXT_DB_PATH: paths.contextDb,
      ELECTRON_CACHE: paths.electronCache,
      ELECTRON_BUILDER_CACHE: paths.electronBuilderCache,
      npm_config_cache: paths.npmCache,
      // Stop Git discovery at this run so it cannot walk up to the checkout's .git.
      GIT_CEILING_DIRECTORIES: runRoot,
      GIT_OPTIONAL_LOCKS: "0",
      ZCODE_RUNTIME_ENV: "production",
      HSCODE_SKIP_SYSTEM_INTEGRATION: "1",
      ZCODE_DISABLE_FIXED_REMOTE_DEBUGGING_PORT: "1",
      NODE_OPTIONS: "",
      NODE_PATH: "",
    });
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_COMMON_DIR;
    delete env.ZCODE_AGENT_SERVER_COMMAND;
    delete env.ZCODE_AGENT_SERVER_ARGS_JSON;

    const electronRequire = createRequire(join(root, "packages/desktop/package.json"));
    const executablePath = electronRequire("electron");
    app = await _electron.launch({
      executablePath,
      args: [
        join(root, "packages/desktop"),
        "--open-workspace",
        workspacePath,
        "--user-data-dir=" + paths.userData,
      ],
      env,
      timeout: 120000,
    });
    page = await app.firstWindow({ timeout: 45000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    // 真正隔离 CLI 配置后会出现首次偏好引导；通过正常关闭操作继续，不写假配置。
    await page
      .locator(
        '[data-testid="composer-workspace-trigger"]:visible, [data-testid="onboarding-page"]:visible',
      )
      .first()
      .waitFor({ timeout: 60000 });
    if (await visible("onboarding-page").count()) await page.keyboard.press("Escape");
    await visible("composer-workspace-trigger").waitFor({
      state: "visible",
      timeout: 60000,
    });

    await step(
      "tool center exposes file, terminal, review, Git and marketplace entries",
      async () => {
        await openToolCenter();
        for (const itemId of ["files", "terminal", "review", "git", "plugin-market"]) {
          await visible("hscode-tool-center-item-" + itemId).waitFor({
            state: "visible",
            timeout: 15000,
          });
        }
        assert.equal(
          await visible("hscode-tool-center-item-developer-tools").count(),
          0,
          "Developer tools must stay hidden while its preference is disabled.",
        );
        assert.equal(
          await visible("hscode-tool-center-item-selection-side-conversation").count(),
          0,
          "Auxiliary conversation must stay hidden without a real parent task.",
        );
        result.auxiliaryChat = {
          noTaskEntry: "PASS_HIDDEN",
          realTaskEntry: "NOT RUN",
        };
      },
    );

    await step("file entry reads the synthetic Chinese and spaced workspace", async () => {
      await page
        .locator(
          '[data-testid="hscode-tool-center-item-files"] [data-side-pane-open-tab-item="files"]:visible',
        )
        .click();
      await page.locator("[data-file-manager-pane]:visible").waitFor({ timeout: 30000 });
      await visible("workspace-file-tree-panel").waitFor({ timeout: 30000 });
      await page.getByText("空目录 中文 空格", { exact: true }).first().waitFor();
      await page.getByText("验证 文件.md", { exact: true }).first().waitFor();
      await page.getByText("验证 文件.md", { exact: true }).first().click();
      await page.getByText(fixtureMarker, { exact: true }).waitFor({ timeout: 30000 });
      await page.screenshot({ path: join(runRoot, "file-entry.png") });
    });

    await step("terminal runs a read-only PowerShell 7 command in the fixture", async () => {
      await openToolCenter();
      await page
        .locator(
          '[data-testid="hscode-tool-center-item-terminal"] [data-side-pane-open-tab-item="terminal"]:visible',
        )
        .click();
      const terminalShell = page.locator(".terminal-xterm-shell:visible").last();
      await terminalShell.waitFor({ state: "visible", timeout: 30000 });
      await terminalShell.locator(".xterm-helper-textarea").waitFor({
        state: "attached",
        timeout: 30000,
      });
      await terminalShell.locator(".xterm-rows").waitFor({ state: "visible", timeout: 30000 });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".terminal-xterm-shell .xterm-rows")].some((e) =>
            /PS\s[^>]*>/u.test(e.textContent ?? ""),
          ),
        null,
        { timeout: 30000 },
      );
      await terminalShell.locator(".xterm-helper-textarea").focus();
      const command = `pwsh -NoProfile -Command "if ((Get-Location).Path -eq '${workspacePath.replaceAll("/", "\\")}') { [Console]::WriteLine(('HSCODE_' + 'NATIVE_TERMINAL_OK')) }"`;
      await page.keyboard.insertText(command);
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        (expected) => {
          const text = Array.from(document.querySelectorAll(".terminal-xterm-shell .xterm-rows"))
            .map((row) => row.textContent || "")
            .join("\n");
          return text.includes(expected.marker);
        },
        {
          marker: terminalMarker,
          workspace: workspacePath.replaceAll("/", "\\"),
        },
        { timeout: 30000 },
      );
      result.terminal = { commandMarkerObserved: true, cwdMatchedFixture: true };
    });

    await step("review entry opens the native Git review pane", async () => {
      await openToolCenter();
      await page
        .locator(
          '[data-testid="hscode-tool-center-item-review"] [data-side-pane-open-tab-item="review"]:visible',
        )
        .click();
      await visible("git-pane").waitFor({ timeout: 30000 });
    });

    await step(
      "Git entry reaches the native Git pane without changing repository state",
      async () => {
        await openToolCenter();
        await page
          .locator(
            '[data-testid="hscode-tool-center-item-git"] [data-side-pane-open-tab-item="git"]:visible',
          )
          .click();
        await visible("git-pane").waitFor({ timeout: 30000 });
        result.git = {
          paneOpened: true,
          fixtureIsGitRepository: false,
          writes: 0,
        };
      },
    );

    await step("marketplace entry opens its normal read-only panel", async () => {
      await openToolCenter();
      await page
        .locator(
          '[data-testid="hscode-tool-center-item-plugin-market"] [data-side-pane-open-tab-item="plugin-market"]:visible',
        )
        .click();
      await visible("plugin-store-root").waitFor({ timeout: 60000 });
      await page
        .waitForFunction(
          () =>
            document.querySelector('[data-testid="plugin-store-list"]') ||
            document.querySelector('[data-testid="plugin-store-error"]'),
          null,
          { timeout: 45000 },
        )
        .catch(() => undefined);
      const state = await page.evaluate(() => ({
        catalog: document.querySelector('[data-testid="plugin-store-list"]')
          ? "AVAILABLE"
          : document.querySelector('[data-testid="plugin-store-error"]')
            ? "UNAVAILABLE"
            : "UNRESOLVED",
      }));
      result.marketplace = {
        panelOpened: true,
        catalog: state.catalog,
        installs: 0,
      };
      if (state.catalog !== "AVAILABLE") {
        result.limitations.push(
          "插件市场面板已打开，但目录状态为 " +
            state.catalog +
            "；未把离线或未解析状态记作目录通过。",
        );
      }
      await page.screenshot({ path: join(runRoot, "marketplace.png") });
    });

    await step("developer tools obey the isolated local preference", async () => {
      await openToolCenter();
      await page.evaluate(() => {
        localStorage.setItem("zcode:developer-tools:enabled", "1");
        window.dispatchEvent(new Event("focus"));
      });
      await page.waitForFunction(
        () => {
          const items = document.querySelectorAll(
            '[data-testid="hscode-tool-center-item-developer-tools"]',
          );
          return [...items].some((item) => item.checkVisibility());
        },
        null,
        { timeout: 8000 },
      );
      await page
        .locator(
          '[data-testid="hscode-tool-center-item-developer-tools"] [data-side-pane-open-tab-item="developer-tools"]:visible',
        )
        .click();
      await visible("developer-tools-pane").waitFor({ timeout: 30000 });
      await page.evaluate(() => {
        localStorage.setItem("zcode:developer-tools:enabled", "0");
        window.dispatchEvent(new Event("focus"));
      });
      await openToolCenter();
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="hscode-tool-center-item-developer-tools"]'),
        null,
        { timeout: 8000 },
      );
      result.developerTools = {
        hiddenByDefault: true,
        shownWhenEnabled: true,
        hiddenWhenDisabled: true,
      };
      await page.screenshot({ path: join(runRoot, "tool-center-conditions.png") });
    });

    await step("actual CLI-created plugin catalog stays in HSCode home", async () => {
      // 未写配置时 config.json 可合法不存在；验证正常控制面实际创建的目录，不人为造文件。
      const actualFiles = [
        join(pluginStorage, "known_marketplaces.json"),
        join(pluginStorage, "marketplaces/zcode-plugins-official/marketplace.json"),
      ];
      for (const file of actualFiles) {
        assert.ok(
          isWithin(hscodeDataRoot, await realpath(file)),
          "Actual CLI output escaped HSCode home",
        );
        assert.ok(Object.keys(JSON.parse(await readFile(file, "utf8"))).length > 0);
      }
      for (const file of [
        join(profile, "legacy-storage/cli/plugins/known_marketplaces.json"),
        join(profile, "legacy-home/.zcode/cli/config.json"),
        join(profile, "legacy-session.sqlite"),
      ])
        assert.equal(existsSync(file), false, "Inherited legacy path was used");
      result.pluginStorage.status = "PASS_ACTUAL_CLI_FILES";
      result.pluginStorage.cliProcessEnvSource =
        "Main → Host → unmodified CLI; actual catalog realpaths and unused legacy paths verified";
      result.pluginStorage.actualFiles = actualFiles.map((file) => relative(runRoot, file));
    });

    result.status = "PASS_WITH_LIMITATIONS";
    await persist();
    await log("PASS native tools smoke completed; see result.json for explicit limitations.");
    console.log("Report: " + resultPath);
  } catch (error) {
    result.status = "FAIL";
    result.failure = redactRunPath(error?.stack ?? error?.message ?? error, runRoot);
    if (page && !page.isClosed()) {
      await page.screenshot({ path: join(runRoot, "failure.png") }).catch(() => undefined);
      result.terminalOutput = await page
        .locator(".terminal-xterm-shell .xterm-rows")
        .allTextContents()
        .then((rows) => rows.join("\n").slice(-3500))
        .catch(() => "unavailable");
    }
    await appendFile(logPath, "FAIL " + result.failure + "\n", "utf8");
    await persist();
    console.error("Native tools smoke failed; isolated profile retained: " + runRoot);
    console.error(redactRunPath(error?.message ?? error, runRoot));
    process.exitCode = 1;
  } finally {
    await app?.close().catch(() => undefined);
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help")) {
  console.log(usage);
} else if (args.length !== 1 || args[0] !== "--run") {
  console.error("Only --help or explicit --run is supported.");
  console.error(usage);
  process.exitCode = 2;
} else {
  await run();
}

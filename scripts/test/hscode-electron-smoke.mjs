import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { _electron } from "playwright-core";
import { createHscodeEnvironment, verifyHscodeBuild } from "../hscode.mjs";

if (process.argv.includes("--help")) {
  console.log(
    "Usage: node scripts/test/hscode-electron-smoke.mjs [--tool-center-only]\nRequires the current HSCode local build. Uses a fresh D/workspace-local profile and loopback web pages; never imports real user data.\nOptional: HSCODE_ELECTRON_SMOKE_OUTPUT_DIR selects an output directory under this checkout.",
  );
  process.exit(0);
}

const root = resolve(import.meta.dirname, "../..");
await verifyHscodeBuild(root);
const output = resolve(
  root,
  process.env.HSCODE_ELECTRON_SMOKE_OUTPUT_DIR ?? ".agent-context/electron-smoke",
);
await mkdir(output, { recursive: true });
await writeFile(
  resolve(output, "README.md"),
  "# Isolated Electron validation\n\nContains synthetic test profiles, screenshots and results for this smoke run. Do not place real credentials, personal photos or user projects here. Ignored; not distributed.\n",
  { flag: "wx" },
).catch((error) => {
  if (error.code !== "EEXIST") throw error;
});
const profile = await mkdtemp(resolve(output, "profile-"));
const env = createHscodeEnvironment(process.env, root);
for (const key of Object.keys(env))
  if (/api.?key|token|secret|cookie|password/i.test(key)) delete env[key];
Object.assign(env, {
  HSCODE_HOME: profile,
  HSCODE_SKIP_SYSTEM_INTEGRATION: "1",
  APPDATA: resolve(profile, "roaming"),
  LOCALAPPDATA: resolve(profile, "local"),
  ZCODE_DISABLE_FIXED_REMOTE_DEBUGGING_PORT: "1",
});
delete env.ELECTRON_RUN_AS_NODE;
await Promise.all([env.APPDATA, env.LOCALAPPDATA].map((path) => mkdir(path, { recursive: true })));
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  fixturePaths.push(path);
  if (path.startsWith("/otel-disabled")) {
    collectorRequests.push({ method: request.method, path });
    response.writeHead(204);
    response.end();
    return;
  }
  if (path === "/redirect") {
    response.writeHead(302, { location: "/next" });
    response.end();
    return;
  }
  if (path === "/favicon.ico") {
    response.writeHead(404);
    response.end();
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Set-Cookie", "hscode_smoke=local_fixture; Path=/; SameSite=Lax");
  response.end(
    `<html><head><title>${path === "/next" ? "Fixture Next" : "Fixture Start"}</title></head><body><h1>HSCode local browser fixture</h1><a href="/next">Next page</a></body></html>`,
  );
});
const collectorRequests = [];
const fixturePaths = [];
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
Object.assign(env, {
  OTEL_EXPORTER_OTLP_ENDPOINT: `${baseUrl}/otel-disabled`,
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${baseUrl}/otel-disabled/traces`,
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: `${baseUrl}/otel-disabled/metrics`,
  OTEL_EXPORTER_OTLP_HEADERS: "x-test=local-fixture",
  ZCODE_LOCAL_TTFT_ENABLED: "1",
  ZCODE_RENDERER_ACTION_TRACE_ENABLED: "1",
});
const result = {
  status: "RUNNING",
  steps: [],
  profile,
  networkScope:
    "renderer requests observed after firstWindow attached; no payload/headers/query recorded",
  networkTargets: [],
};
const networkTargets = new Set();
let app;
let page;
const packagedBinary = process.env.HSCODE_SMOKE_EXECUTABLE?.trim();
if (
  packagedBinary &&
  !resolve(packagedBinary)
    .toLowerCase()
    .startsWith(resolve(root, "packages/desktop/dist").toLowerCase() + sep)
)
  throw new Error("Packaged smoke executable must be inside this checkout's desktop dist");
const executablePath =
  packagedBinary || createRequire(resolve(root, "packages/desktop/package.json"))("electron");
const visible = (testId) => page.locator(`[data-testid="${testId}"]:visible`).first();
const waitForGuestUrl = (url) =>
  page.waitForFunction(
    (url) =>
      [...document.querySelectorAll("webview")].some((view) => {
        try {
          return view.getURL() === url && !view.isLoading();
        } catch {
          return false;
        }
      }),
    url,
  );
async function launch() {
  app = await _electron.launch({
    executablePath,
    args: [
      ...(packagedBinary ? [] : [resolve(root, "packages/desktop")]),
      `--user-data-dir=${resolve(profile, "electron/userData")}`,
    ],
    env,
    timeout: 120000,
  });
  await app.evaluate(() => {
    globalThis.__hscodeSmokeStartupErrors = [];
    process.on("unhandledRejection", (reason) => {
      globalThis.__hscodeSmokeStartupErrors.push(
        reason instanceof Error ? reason.stack : String(reason),
      );
    });
  });
  try {
    page = await app.firstWindow({ timeout: 45000 });
  } catch (error) {
    await writeFile(
      resolve(output, "startup-diagnostic.json"),
      JSON.stringify(await app.evaluate(() => globalThis.__hscodeSmokeStartupErrors), null, 2),
    );
    throw error;
  }
  page.on("request", (request) => {
    try {
      const url = new URL(request.url());
      if (["http:", "https:"].includes(url.protocol))
        networkTargets.add(`${request.method()} ${url.origin}${url.pathname}`);
    } catch {
      /* Ignore non-URL internal resources. */
    }
  });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  // 隔离 CLI HOME 后首次偏好引导不再沿用系统用户配置；正常关闭，不绕过账户门禁。
  await page
    .locator(
      '[data-testid="composer-workspace-trigger"]:visible, [data-testid="onboarding-page"]:visible',
    )
    .first()
    .waitFor({ timeout: 60000 });
  if (await visible("onboarding-page").count()) await page.keyboard.press("Escape");
  return page;
}
async function step(name, operation) {
  try {
    await operation();
    result.steps.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    result.steps.push({ name, status: "FAIL" });
    throw error;
  }
}
try {
  await launch();
  if (!process.argv.includes("--tool-center-only")) {
    await step("cold-start HTML shows H with renderer modules blocked", async () => {
      const coldStart = await app.evaluate(
        async ({ BrowserWindow, app }, suppliedHtml) => {
          const win = new BrowserWindow({
            show: false,
            width: 700,
            height: 480,
            webPreferences: { partition: `hscode-cold-start-${Date.now()}` },
          });
          try {
            win.webContents.session.webRequest.onBeforeRequest((details, callback) =>
              callback({ cancel: details.resourceType === "script" }),
            );
            await win.loadFile(suppliedHtml || `${app.getAppPath()}/out/renderer/index.html`);
            const state = await win.webContents.executeJavaScript(`({
          brand: document.documentElement.dataset.hscodeBuild,
          zDisplay: getComputedStyle(document.querySelector('.startup-logo-zcode')).display,
          hDisplay: getComputedStyle(document.querySelector('.startup-logo-hscode')).display,
          hLoaded: document.querySelector('.startup-logo-hscode').naturalWidth > 0
        })`);
            // 仅等待既有 720ms CSS 入场动画完成，避免截图采到 opacity=0 的首动画帧。
            await new Promise((resolveFrame) => setTimeout(resolveFrame, 800));
            const screenshot = (await win.capturePage()).toDataURL();
            return { state, screenshot };
          } finally {
            win.destroy();
          }
        },
        packagedBinary ? null : resolve(root, "packages/desktop/out/renderer/index.html"),
      );
      assert.deepEqual(coldStart.state, {
        brand: "true",
        zDisplay: "none",
        hDisplay: "block",
        hLoaded: true,
      });
      await writeFile(
        resolve(output, "cold-start.png"),
        Buffer.from(coldStart.screenshot.split(",")[1], "base64"),
      );
    });
    await step("independent product identity and profile", async () => {
      const identity = await app.evaluate(({ app }) => ({
        name: app.getName(),
        userData: app.getPath("userData"),
        sessionData: app.getPath("sessionData"),
      }));
      assert.match(identity.name, /^HSCode/);
      for (const path of [identity.userData, identity.sessionData])
        assert.ok(
          path.toLowerCase().startsWith(profile.toLowerCase()),
          "Electron profile must stay inside the test root",
        );
      result.identity = identity;
    });
    await step("first-run enters workspace directly without account or API key", async () => {
      await visible("composer-workspace-trigger").waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await visible("login-use-api-key-button").count(), 0);
      assert.equal(
        await page.locator('[data-testid="chat-empty"] [data-v4-draft-logo]').count(),
        0,
        "HSCode draft home must not render a brand watermark",
      );
    });
    await step("browser navigation and one-click bookmark", async () => {
      await app.evaluate(({ BrowserWindow }, url) => {
        for (const win of BrowserWindow.getAllWindows())
          win.webContents.send("zcode:open-browser-url", { url, disposition: "foreground-tab" });
      }, `${baseUrl}/start`);
      await visible("browser-address-input").waitFor({ state: "visible", timeout: 30000 });
      await waitForGuestUrl(`${baseUrl}/start`);
      await visible("browser-bookmark-star").click();
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="browser-bookmark-star"][aria-pressed="true"]'),
      );
    });
    await step("redirect/back/forward star synchronization", async () => {
      // 通过已有 guest 的原生导航触发真实重定向，不让测试依赖表单隐式提交规则。
      await page.evaluate((url) => {
        void document
          .querySelector("webview")
          .loadURL(url)
          .catch(() => {});
      }, `${baseUrl}/redirect`);
      await waitForGuestUrl(`${baseUrl}/next`);
      assert.equal(await visible("browser-bookmark-star").getAttribute("aria-pressed"), "false");
      await visible("browser-back-button").click();
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="browser-bookmark-star"][aria-pressed="true"]'),
      );
      await visible("browser-forward-button").click();
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="browser-bookmark-star"][aria-pressed="false"]'),
      );
    });
    await step("Main persistence and concurrent commands", async () => {
      const snapshot = await page.evaluate(async (base) => {
        await Promise.all([
          window.zcode.bookmarks.save({ title: "Concurrent A", url: `${base}/a` }),
          window.zcode.bookmarks.save({ title: "Concurrent B", url: `${base}/b` }),
        ]);
        return window.zcode.bookmarks.list();
      }, baseUrl);
      assert.equal(snapshot.bookmarks.length, 3);
      result.bookmarkCount = snapshot.bookmarks.length;
      const stored = JSON.parse(
        await readFile(resolve(profile, "electron/userData/bookmarks-v1.json"), "utf8"),
      );
      assert.equal(stored.version, 1);
      assert.equal(stored.bookmarks.length, 3);
    });
    await step("bookmark manager and existing new-tab navigation", async () => {
      await visible("browser-bookmark-manager").click();
      await visible("browser-bookmark-search").fill("Concurrent A");
      const newTab = page.getByRole("button", { name: /在新标签打开|Open in new tab/i }).first();
      await newTab.click();
      await waitForGuestUrl(`${baseUrl}/a`);
      assert.ok((await page.locator("webview").count()) >= 2);
    });
    await step("browser Cookie partition remains functional", async () => {
      const found = await app.evaluate(async ({ session }, url) => {
        const cookies = await session
          .fromPartition("persist:zcode-embedded-browser")
          .cookies.get({ url });
        return cookies.some(
          (cookie) => cookie.name === "hscode_smoke" && cookie.value === "local_fixture",
        );
      }, baseUrl);
      assert.equal(found, true);
    });
    await page.screenshot({ path: resolve(output, "browser-bookmarks.png") });
    await app.close();
    app = null;
    await launch();
    await step("bookmarks survive an actual Electron restart", async () => {
      // 重启也必须直接进入，不点击跳过、不注入用户或凭据。
      // 首窗出现早于应用窗口完成注册；等待原有工作区就绪，不放宽 Main 的 IPC 授权。
      await visible("composer-workspace-trigger").waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await visible("login-use-api-key-button").count(), 0);
      const snapshot = await page.evaluate(() => window.zcode.bookmarks.list());
      assert.equal(snapshot.bookmarks.length, 3);
    });
    const openOptionalLogin = async () => {
      await visible("login-trigger").click();
      await visible("login-menu-item").click();
      await visible("hscode-login-return").waitFor();
    };
    await step("optional login can return without credentials", async () => {
      await openOptionalLogin();
      await visible("hscode-login-return").click();
      await visible("composer-workspace-trigger").waitFor();
    });
    await step("custom connection opens the existing provider editor", async () => {
      await openOptionalLogin();
      await visible("login-use-api-key-button").click();
      await visible("model-provider-add-provider-button").click();
      await visible("model-provider-template-item-custom").click();
      await visible("model-provider-base-url-input").waitFor();
      await visible("model-provider-base-url-input").fill(`${baseUrl}/v1`);
      await visible("model-provider-base-url-input").blur();
      assert.equal(await visible("model-provider-api-key-input").count(), 1);
      assert.equal(await visible("model-provider-add-model-button").count(), 1);
      // 不填写任何真实/虚构凭据，不发模型请求。
      await page.screenshot({ path: resolve(output, "custom-connection.png") });
    });
    let importedPhoto;
    await step("background photo import, invalid-file protection and preview", async () => {
      await visible("settings-section-nav-appearance").click();
      await visible("home-background-file").waitFor({ state: "attached" });
      const fixture = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 500;
        const context = canvas.getContext("2d");
        context.fillStyle = "#3e6383";
        context.fillRect(0, 0, 800, 500);
        context.fillStyle = "#6d9a84";
        context.fillRect(0, 260, 800, 240);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await page.getByTestId("home-background-file").setInputFiles({
        name: "local-fixture.png",
        mimeType: "image/png",
        buffer: Buffer.from(fixture, "base64"),
      });
      await visible("home-background-preview").waitFor();
      importedPhoto = await visible("home-background-preview").getAttribute("src");
      assert.match(importedPhoto, /^data:image\/jpeg;base64,/);
      await page.getByTestId("home-background-file").setInputFiles({
        name: "invalid.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      });
      await page.locator('[data-testid="home-background-settings"] [role="alert"]').waitFor();
      assert.equal(await visible("home-background-preview").getAttribute("src"), importedPhoto);
      await page.screenshot({ path: resolve(output, "appearance-invalid-photo.png") });
      await page.getByTestId("home-background-file").setInputFiles({
        name: "local-fixture.png",
        mimeType: "image/png",
        buffer: Buffer.from(fixture, "base64"),
      });
      await page
        .locator('[data-testid="home-background-settings"] [role="alert"]')
        .waitFor({ state: "detached" });
      await page.screenshot({ path: resolve(output, "appearance-background.png") });
      await visible("settings-back-button").click();
      await visible("home-background-layer").waitFor();
      await page.screenshot({ path: resolve(output, "home-cards-background.png") });
    });
    await step("home cards fit narrow and light-theme layouts", async () => {
      const assertCentered = async () => {
        await page.waitForFunction(() => {
          const group = document.querySelector('[data-hscode-centered-draft="true"]');
          if (!group || group.children.length < 2) return false;
          const viewport = group.parentElement.getBoundingClientRect();
          const first = group.children[0].getBoundingClientRect();
          const last = group.children[group.children.length - 1].getBoundingClientRect();
          return Math.abs((first.top + last.bottom) / 2 - (viewport.top + viewport.height / 2)) < 4;
        });
      };
      const cards = page.locator(
        '[data-hscode-starter-cards="true"] [data-draft-suggested-prompt]',
      );
      await cards.nth(3).waitFor();
      assert.equal(await cards.count(), 4);
      const firstCard = cards.first();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.mouse.move(0, 0);
      const idleBorder = await firstCard.evaluate(
        (element) => getComputedStyle(element).borderColor,
      );
      await firstCard.hover();
      await page.waitForFunction(
        ({ border }) => {
          const card = document.querySelector(".hscode-draft-prompt-card");
          return (
            card &&
            getComputedStyle(card).borderColor !== border &&
            getComputedStyle(card).translate === "0px -2px"
          );
        },
        { border: idleBorder },
      );
      await firstCard.click();
      assert.equal(await firstCard.getAttribute("aria-pressed"), "true");
      await visible("home-card-selected").waitFor();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: resolve(output, "home-card-feedback.png") });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await firstCard.hover();
      assert.equal(
        await firstCard.evaluate((element) => getComputedStyle(element).translate),
        "none",
      );
      await page.mouse.move(0, 0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await assertCentered();
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((win) => win.isVisible())
          .setSize(860, 900),
      );
      await page.waitForFunction(() => {
        const rows = [
          ...document.querySelectorAll("[data-hscode-starter-cards] [data-draft-suggested-prompt]"),
        ].map((item) => item.getBoundingClientRect());
        return rows.length === 4 && rows[0].y === rows[1].y && rows[2].y > rows[0].y;
      });
      await assertCentered();
      await page.screenshot({ path: resolve(output, "home-cards-narrow.png") });
      await openOptionalLogin();
      await visible("login-use-api-key-button").click();
      await visible("settings-section-nav-appearance").click();
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: /^(浅色|Light)$/ }).click();
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("theme-zai-light"),
      );
      await page.screenshot({ path: resolve(output, "appearance-light.png") });
      await visible("settings-back-button").click();
      await visible("home-background-layer").waitFor();
      await page.screenshot({ path: resolve(output, "home-cards-light-narrow.png") });
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((win) => win.isVisible())
          .setSize(1200, 800),
      );
      await page.waitForFunction(() => {
        const rows = [
          ...document.querySelectorAll("[data-hscode-starter-cards] [data-draft-suggested-prompt]"),
        ].map((item) => item.getBoundingClientRect());
        return rows.length === 4 && rows.every((row) => row.y === rows[0].y);
      });
      await assertCentered();
      await page.screenshot({ path: resolve(output, "home-cards-light-wide.png") });
    });
    await app.close();
    app = null;
    await launch();
    await step("background persists on restart and can be removed", async () => {
      await visible("composer-workspace-trigger").waitFor({ timeout: 60000 });
      await visible("home-background-layer").waitFor();
      assert.equal(
        await visible("home-background-layer").locator("img").getAttribute("src"),
        importedPhoto,
      );
      await openOptionalLogin();
      await visible("login-use-api-key-button").click();
      await visible("settings-section-nav-appearance").click();
      await visible("home-background-preview").waitFor();
      await visible("home-background-remove").click();
      assert.equal(await visible("home-background-preview").count(), 0);
      await visible("settings-back-button").click();
      await visible("composer-workspace-trigger").waitFor();
      assert.equal(await visible("home-background-layer").count(), 0);
    });
  }
  await visible("composer-workspace-trigger").waitFor({ timeout: 60000 });
  const openToolCenter = async () => {
    // 新启动默认收起侧栏；先用正常开关展开，不能假定此前标签仍可见。
    if (!(await page.locator("[data-side-pane-add-tab-trigger]:visible").count())) {
      await visible("side-pane-toggle").click();
    }
    await page.locator("[data-side-pane-add-tab-trigger]:visible").first().click();
    await visible("hscode-tool-center-search").waitFor();
  };
  await step("tool center shows exact curated set without fabricating session access", async () => {
    await openToolCenter();
    const rows = page.locator(
      '[data-testid="hscode-plugin-tools"]:visible [data-testid="hscode-plugin-tool"]',
    );
    assert.deepEqual(
      await rows.evaluateAll((elements) => elements.map((element) => element.dataset.pluginId)),
      ["excalidraw", "zcode-context-insight"].map((name) => `${name}@zcode-plugins-official`),
    );
    assert.equal(
      await rows.evaluateAll((elements) =>
        elements.some((element) => element.dataset.status === "open"),
      ),
      false,
    );
    assert.equal(
      await page
        .locator('[data-side-pane-open-tab-item="selection-side-conversation"]:visible')
        .count(),
      0,
    );
    await visible("hscode-tool-center-search").fill("Git");
    assert.equal(await visible("hscode-tool-center-item-git").count(), 1);
    assert.equal(await visible("hscode-tool-center-item-files").count(), 0);
    await visible("hscode-tool-center-search").fill("");
    await page.screenshot({ path: resolve(output, "tool-center.png") });
  });
  await step("tool center preference actions persist through an actual restart", async () => {
    const files = visible("hscode-tool-center-item-files");
    await files.getByRole("button", { name: /^(置顶|Pin):/ }).click();
    await files.getByRole("button", { name: /^(隐藏|Hide):/ }).click();
    await files.waitFor({ state: "hidden" });
    result.toolPreferencesBeforeRestart = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("hscode.tool-center.preferences.v1")),
    );
    assert.ok(result.toolPreferencesBeforeRestart.hiddenIds.includes("files"));
    await app.close();
    app = null;
    await launch();
    await visible("composer-workspace-trigger").waitFor({ timeout: 60000 });
    result.toolPreferencesAfterRestart = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("hscode.tool-center.preferences.v1")),
    );
    assert.deepEqual(result.toolPreferencesAfterRestart, result.toolPreferencesBeforeRestart);
    await openToolCenter();
    await visible("hscode-tool-center-item-files").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: /显示隐藏|Show hidden/ }).click();
    const restored = visible("hscode-tool-center-item-files");
    await restored.waitFor();
    assert.equal(
      await restored
        .getByRole("button", { name: /^(取消置顶|Unpin):/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    await restored.getByRole("button", { name: /^(显示|Show):/ }).click();
    await page.getByRole("button", { name: /恢复默认|Reset/ }).click();
    await page.screenshot({ path: resolve(output, "tool-center-restored.png") });
  });
  await step("tool center delegates Git and marketplace to native panels", async () => {
    await page.locator('[data-side-pane-open-tab-item="git"]:visible').click();
    await visible("git-pane").waitFor();
    await openToolCenter();
    await page.locator('[data-side-pane-open-tab-item="plugin-market"]:visible').click();
    await visible("plugin-store-root").waitFor({ timeout: 60000 });
    await page.screenshot({ path: resolve(output, "tool-center-native-market.png") });
  });
  await step("inherited optional collector cannot enable uploads", async () => {
    await new Promise((resolvePeriod) => setTimeout(resolvePeriod, 6000));
    assert.equal(collectorRequests.length, 0);
    result.injectedCollectorRequests = collectorRequests.length;
  });
  result.status = "PASS";
} catch (error) {
  result.status = "FAIL";
  // No raw Electron/IPC errors: they may contain local paths, page content or query values.
  result.failureType = error?.name ?? "Error";
  if (app)
    result.browserHistory = await app
      .evaluate(({ webContents }) =>
        webContents
          .getAllWebContents()
          .filter((view) => view.getType() === "webview")
          .map((view) =>
            view.navigationHistory.getAllEntries().map((entry) => {
              try {
                return new URL(entry.url).pathname;
              } catch {
                return "internal";
              }
            }),
          ),
      )
      .catch(() => []);
  await writeFile(resolve(output, "failure-diagnostic.txt"), error?.stack ?? String(error));
  if (page && !page.isClosed())
    await page.screenshot({ path: resolve(output, "failure.png") }).catch(() => {});
  console.error("FAIL Electron smoke; inspect the isolated screenshot and named step.");
  process.exitCode = 1;
} finally {
  if (app) await app.close().catch(() => {});
  await new Promise((resolveClose) => server.close(resolveClose));
  result.networkTargets = [...networkTargets].sort();
  result.fixturePaths = fixturePaths;
  await writeFile(resolve(output, "result.json"), JSON.stringify(result, null, 2));
}

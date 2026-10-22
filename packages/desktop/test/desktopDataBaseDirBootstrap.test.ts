import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  extractBootstrapDataBaseDir,
  resolveBootstrapSettingsFile,
} from "../src/main/desktopDataBaseDirBootstrap.js";

describe("desktopDataBaseDirBootstrap", () => {
  it("应从 bootstrap setting 中提取并裁剪 dataBaseDir", () => {
    expect(
      extractBootstrapDataBaseDir({
        dataBaseDir: "  /tmp/zcode-data  ",
      }),
    ).toBe("/tmp/zcode-data");
  });

  it("应忽略无效的 bootstrap 配置", () => {
    expect(extractBootstrapDataBaseDir(null)).toBeNull();
    expect(extractBootstrapDataBaseDir({ dataBaseDir: "" })).toBeNull();
    expect(extractBootstrapDataBaseDir({ dataBaseDir: 123 })).toBeNull();
  });

  it("应拼出默认 bootstrap setting 路径", () => {
    const result = resolveBootstrapSettingsFile("/Users/tester");
    // Windows 下 path.join 使用反斜杠，统一为正斜杠后再比较
    expect(result.replace(/\\/g, "/")).toBe("/Users/tester/.zcode/v2/setting.json");
  });

  it("HSCode bootstrap 只读取 HSCode profile，忽略旧 ZCode 根并传播专用路径", async () => {
    const profileHome = mkdtempSync(join(tmpdir(), "hscode-bootstrap-profile-"));
    const oldProfileHome = mkdtempSync(join(tmpdir(), "zcode-bootstrap-profile-"));
    const envKeys = [
      "HSCODE_HOME",
      "HSCODE_DATA_BASE_DIR",
      "ZCODE_DESKTOP_HOME_DIR",
      "ZCODE_HOME",
      "ZCODE_DATA_BASE_DIR",
    ];
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

    try {
      const oldSettingsDir = join(oldProfileHome, ".zcode", "v2");
      mkdirSync(oldSettingsDir, { recursive: true });
      writeFileSync(
        join(oldSettingsDir, "setting.json"),
        JSON.stringify({ dataBaseDir: join(oldProfileHome, "old-data") }),
      );
      process.env.HSCODE_HOME = profileHome;
      process.env.HSCODE_DATA_BASE_DIR = join(oldProfileHome, "stale-hscode-override");
      process.env.ZCODE_DESKTOP_HOME_DIR = oldProfileHome;
      process.env.ZCODE_HOME = join(oldProfileHome, ".zcode");
      process.env.ZCODE_DATA_BASE_DIR = join(oldProfileHome, "old-data");
      vi.stubGlobal("__HSCODE_BUILD__", true);
      vi.resetModules();

      const { applyEarlyDataBaseDirBootstrap } =
        await import("../src/main/desktopDataBaseDirBootstrap.js");
      const services = await import("@zcode/services/node");

      expect(applyEarlyDataBaseDirBootstrap()).toBe(profileHome);
      expect(services.getDataBaseDir()).toBe(profileHome);
      expect(process.env.HSCODE_HOME).toBe(profileHome);
      expect(process.env.HSCODE_DATA_BASE_DIR).toBe(profileHome);
      expect(process.env.ZCODE_DATA_BASE_DIR).toBe(profileHome);
      expect(process.env.ZCODE_HOME).toBe(join(profileHome, ".zcode"));
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      vi.unstubAllGlobals();
      vi.resetModules();
      rmSync(profileHome, { recursive: true, force: true });
      rmSync(oldProfileHome, { recursive: true, force: true });
    }
  });
});

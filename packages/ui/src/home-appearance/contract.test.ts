// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach } from "vitest";
import { HomeBackgroundSettings, HomeBackgroundLayer } from "./contract.js";
vi.mock("@zcode/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@zcode/shared")>()),
  IS_HSCODE_BUILD: true,
}));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({ intl: { formatMessage: ({ id }: { id: string }) => id } }),
}));
import {
  HOME_BACKGROUND_KEY,
  normalizeHomeBackground,
  readHomeBackground,
  saveHomeBackground,
} from "./contract.js";

import { hscodeHomeAppearanceModule } from "./module.js";

// 契约测试只 import contract 与 module，不知道实现是谁；同一份测试应同时跑真实现与跨进程代理。
describe("hscode-home-appearance contract", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    localStorage.removeItem(HOME_BACKGROUND_KEY);
    vi.restoreAllMocks();
  });
  it("declares its module manifest", () => {
    expect(hscodeHomeAppearanceModule.id).toBe("hscode-home-appearance");
  });

  it("仅接受受限本地位图 data URL，拒绝远程/文件 URL、SVG、超限值", () => {
    const valid = "data:image/jpeg;base64,/9j/AA==";
    expect(normalizeHomeBackground(valid)).toBe(valid);
    for (const value of [
      "https://example.org/private.jpg",
      "file:///D:/private.jpg",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,",
      `data:image/png;base64,${"A".repeat(2 * 1024 * 1024)}`,
      null,
    ]) {
      expect(normalizeHomeBackground(value)).toBeNull();
    }
  });

  it("保存/重读/移除只变更本机照片偏好", () => {
    const value = "data:image/png;base64,iVBORw0KGgo=";
    saveHomeBackground(value);
    expect(readHomeBackground()).toBe(value);
    expect(() => saveHomeBackground("https://example.org/photo.jpg")).toThrow();
    expect(readHomeBackground()).toBe(value);
    saveHomeBackground(null);
    expect(readHomeBackground()).toBeNull();
  });

  it("配额失败不清除旧值或发布成功事件", () => {
    const old = "data:image/png;base64,iVBORw0KGgo=";
    saveHomeBackground(old);
    const event = vi.spyOn(window, "dispatchEvent");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveHomeBackground("data:image/jpeg;base64,/9j/AA==")).toThrow();
    expect(readHomeBackground()).toBe(old);
    expect(event).not.toHaveBeenCalled();
  });

  it("损坏偏好安全回到默认，不覆盖原始记录", () => {
    localStorage.setItem(HOME_BACKGROUND_KEY, "invalid");
    expect(readHomeBackground()).toBeNull();
    expect(localStorage.getItem(HOME_BACKGROUND_KEY)).toBe("invalid");
  });

  it("非法图片明确报错并保留旧背景，移除同步全部投影", async () => {
    const photo = "data:image/png;base64,iVBORw0KGgo=";
    saveHomeBackground(photo);
    render(
      createElement(
        "div",
        null,
        createElement(HomeBackgroundSettings),
        createElement(HomeBackgroundLayer),
      ),
    );
    expect(screen.getByTestId("home-background-preview").getAttribute("src")).toBe(photo);
    fireEvent.change(screen.getByTestId("home-background-file"), {
      target: { files: [new File(["<svg/>"], "image.svg", { type: "image/svg+xml" })] },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("background.invalid"),
    );
    expect(readHomeBackground()).toBe(photo);
    fireEvent.click(screen.getByTestId("home-background-remove"));
    expect(screen.queryByTestId("home-background-preview")).toBeNull();
    expect(screen.queryByTestId("home-background-layer")).toBeNull();
    expect(readHomeBackground()).toBeNull();
  });

  it("移除后迟到的照片解码不能重新写入背景", async () => {
    let finishDecode: () => void = () => {};
    vi.stubGlobal("URL", { createObjectURL: () => "blob:fixture", revokeObjectURL: vi.fn() });
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = 2;
        naturalHeight = 2;
        decode() {
          return new Promise<void>((resolve) => {
            finishDecode = resolve;
          });
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,/9j/AA==",
    );
    saveHomeBackground("data:image/png;base64,iVBORw0KGgo=");
    render(createElement(HomeBackgroundSettings));
    fireEvent.change(screen.getByTestId("home-background-file"), {
      target: { files: [new File(["fixture"], "photo.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByTestId("home-background-remove"));
    await act(async () => {
      finishDecode();
    });
    expect(readHomeBackground()).toBeNull();
    expect(screen.queryByTestId("home-background-preview")).toBeNull();
  });

  it("原生 storage 事件刷新其他窗口投影", async () => {
    render(createElement(HomeBackgroundLayer));
    expect(screen.queryByTestId("home-background-layer")).toBeNull();
    await act(async () => {
      localStorage.setItem(HOME_BACKGROUND_KEY, "data:image/png;base64,iVBORw0KGgo=");
      window.dispatchEvent(new StorageEvent("storage", { key: HOME_BACKGROUND_KEY }));
    });
    expect(screen.getByTestId("home-background-layer")).toBeTruthy();
  });
});

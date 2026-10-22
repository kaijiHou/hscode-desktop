import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
const product = vi.hoisted(() => ({ hscode: false }));
vi.mock("@zcode/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@zcode/shared")>()),
  get IS_HSCODE_BUILD() {
    return product.hscode;
  },
}));
afterEach(() => {
  product.hscode = false;
});
import { RootStartupLoading, ZCodeStartupLogoBadge } from "@/root/RootStartupLoading.js";

describe("RootStartupLoading", () => {
  it("HSCode 初始化页与标题栏统一使用 H，而官方仍保留 Z", () => {
    product.hscode = true;
    for (const size of ["default", "titlebar"] as const) {
      const html = renderToStaticMarkup(createElement(ZCodeStartupLogoBadge, { size }));
      expect(html).toContain('data-app-logo="hscode"');
      expect(html).not.toContain("<svg");
    }
  });
  it("静态品牌图标不渲染呼吸动画", () => {
    const html = renderToStaticMarkup(createElement(ZCodeStartupLogoBadge, { animated: false }));
    expect(html).toContain("<svg");
    expect(html).not.toContain("<animate");
  });
  it("启动阻塞态使用整体呼吸的 ZCode SVG 而不是可见 loading 文案", () => {
    const html = renderToStaticMarkup(createElement(RootStartupLoading, { label: "加载中..." }));

    expect(html).toContain('data-testid="root-startup-loading"');
    expect(html).toContain('aria-label="加载中..."');
    expect(html).toContain("<svg");
    expect(html).toContain('attributeName="opacity"');
    expect(html).not.toContain(">加载中...<");
  });
});

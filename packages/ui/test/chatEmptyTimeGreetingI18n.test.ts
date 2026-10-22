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
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({ intl: { formatMessage: ({ id }: { id: string }) => id } }),
}));
vi.mock("@/hooks/useInterfaceMode.js", () => ({ useIsOfficeMode: () => false }));
afterEach(() => {
  product.hscode = false;
});
import {
  ConversationDraftEmptyState,
  resolveGreetingFontSizePx,
} from "@/v4/ConversationDraftEmptyState.js";

describe("chat empty time greeting i18n", () => {
  it("HSCode 首页只保留问候语，不显示 H 或回退成 Z 水印", () => {
    product.hscode = true;
    const html = renderToStaticMarkup(createElement(ConversationDraftEmptyState));
    expect(html).toContain('data-v4-draft-greeting="true"');
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<img");
  });
  it("原版 ZCode 仍保留原主题水印", () => {
    const html = renderToStaticMarkup(createElement(ConversationDraftEmptyState));
    expect(html).toContain("<svg");
    expect(html).toContain('data-v4-draft-logo="dark"');
  });
  it("标题只在自身文字真实受到水平挤压后按 1px 档位缩小", () => {
    expect(
      resolveGreetingFontSizePx({
        availableWidthPx: 406,
        naturalTextWidthPx: 360,
      }),
    ).toBe(30);
    expect(
      resolveGreetingFontSizePx({
        availableWidthPx: 359,
        naturalTextWidthPx: 360,
      }),
    ).toBe(29);
    expect(
      resolveGreetingFontSizePx({
        availableWidthPx: 300,
        naturalTextWidthPx: 360,
      }),
    ).toBe(25);
    expect(
      resolveGreetingFontSizePx({
        availableWidthPx: 120,
        naturalTextWidthPx: 360,
      }),
    ).toBe(20);
  });

  it("标题测量暂不可用时保留默认字号而不是随窗口缩小", () => {
    expect(
      resolveGreetingFontSizePx({
        availableWidthPx: 0,
        naturalTextWidthPx: 360,
      }),
    ).toBe(30);
    expect(
      resolveGreetingFontSizePx({
        availableWidthPx: 406,
        naturalTextWidthPx: Number.NaN,
      }),
    ).toBe(30);
  });

  it("手机远控保持原有 20px 紧凑标题，不启用桌面自适应测量", () => {
    expect(
      resolveGreetingFontSizePx({
        availableWidthPx: 406,
        naturalTextWidthPx: 360,
        compactForRemoteControl: true,
      }),
    ).toBe(20);
  });
});

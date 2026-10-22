import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IS_HSCODE_BUILD } from "@zcode/shared";
import { DevicePlatformIcon, getDevicePlatformLabel } from "@zcode/ui/device-platform-icon";
import { resolveAppLogo, ZCodeAppLogo } from "@zcode/ui/app-logo";
import { BottomSheet, BottomSheetTrigger } from "@zcode/ui/bottom-sheet";

describe("mobile presentation package boundary", () => {
  it.each(["darwin", "win32", "linux", "unknown"])(
    "renders platform %s without browser services",
    (platform) => {
      expect(renderToStaticMarkup(createElement(DevicePlatformIcon, { platform }))).toContain(
        "svg",
      );
      expect(getDevicePlatformLabel(platform)).toBe(
        { darwin: "macOS", win32: "Windows", linux: "Linux" }[platform],
      );
    },
  );
  it("retains logo and accessible dialog trigger exports", () => {
    expect(renderToStaticMarkup(createElement(ZCodeAppLogo))).toContain(
      `data-app-logo="${IS_HSCODE_BUILD ? "hscode" : "zcode"}"`,
    );
    expect(
      renderToStaticMarkup(
        createElement(BottomSheet, {}, createElement(BottomSheetTrigger, {}, "Choose")),
      ),
    ).toContain('aria-haspopup="dialog"');
  });

  it("selects HCode or official app logos by build identity", () => {
    expect(resolveAppLogo(false)).toMatchObject({ brand: "zcode" });
    expect(resolveAppLogo(true)).toMatchObject({ brand: "hscode" });
    expect(resolveAppLogo(false).src).not.toBe(resolveAppLogo(true).src);
  });
});

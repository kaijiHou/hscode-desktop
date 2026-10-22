// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { FolderOpenIcon, GlobeIcon } from "lucide-react";
import { createDefaultHscodeToolCenterPreferences } from "@/tool-center/contract.js";
import {
  resetHscodeToolCenterPreferenceStore,
  getHscodeToolCenterPreferences,
} from "@/tool-center/preferencesStore.js";
import {
  HscodeToolCenter,
  type HscodeToolCenterPluginControls,
} from "@/tool-center/index.js";

vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    intl: { formatMessage: ({ id }: { id: string }) => id },
  }),
}));

const items = [
  {
    id: "builtin:files",
    label: "Files",
    description: "Browse workspace files",
    icon: FolderOpenIcon,
    onOpen: vi.fn(),
  },
  {
    id: "builtin:browser",
    label: "Browser",
    description: "Browse web pages",
    icon: GlobeIcon,
    onOpen: vi.fn(),
  },
];

describe("HscodeToolCenter", () => {
  beforeEach(() => {
    resetHscodeToolCenterPreferenceStore();
    items.forEach((item) => item.onOpen.mockClear());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resetHscodeToolCenterPreferenceStore();
  });

  it("filters built-ins and forwards search text to the plugin section", () => {
    render(
      createElement(HscodeToolCenter, {
        items,
        renderPluginTools: ({ query }) =>
          createElement("output", { "data-testid": "plugin-query" }, query),
      }),
    );
    fireEvent.change(screen.getByTestId("hscode-tool-center-search"), {
      target: { value: "browser" },
    });
    expect(
      screen.getByTestId("hscode-tool-center-item-builtin:browser"),
    ).toBeTruthy();
    expect(
      screen.queryByTestId("hscode-tool-center-item-builtin:files"),
    ).toBeNull();
    expect(screen.getByTestId("plugin-query").textContent).toBe("browser");
  });

  it("persists pin, order, hide, and restore actions", () => {
    render(createElement(HscodeToolCenter, { items }));
    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.moveUp: Browser" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.pin: Browser" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.hide: Browser" }),
    );

    expect(getHscodeToolCenterPreferences().pinnedIds).toEqual([
      "builtin:browser",
    ]);
    expect(
      getHscodeToolCenterPreferences().builtinOrderIds.slice(0, 2),
    ).toEqual(["builtin:browser", "builtin:files"]);
    expect(getHscodeToolCenterPreferences().hiddenIds).toEqual([
      "builtin:browser",
    ]);
    expect(
      screen.queryByTestId("hscode-tool-center-item-builtin:browser"),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.showHidden" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.show: Browser" }),
    );
    expect(getHscodeToolCenterPreferences().hiddenIds).toEqual([]);
    expect(
      screen.getByTestId("hscode-tool-center-item-builtin:browser"),
    ).toBeTruthy();
  });

  it("opens a built-in item through its existing callback", () => {
    render(createElement(HscodeToolCenter, { items }));
    fireEvent.click(screen.getByRole("button", { name: "Browser" }));
    expect(items[1].onOpen).toHaveBeenCalledTimes(1);
    expect(createDefaultHscodeToolCenterPreferences().showHidden).toBe(false);
  });

  it("shows a visible status and keeps the old preference snapshot when persistence fails", () => {
    render(createElement(HscodeToolCenter, { items }));
    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.pin: Files" }),
    );
    const previous = getHscodeToolCenterPreferences();

    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.reset" }),
    );

    expect(screen.getByRole("status").textContent).toBe(
      "hscode.toolCenter.saveFailed",
    );
    expect(getHscodeToolCenterPreferences()).toBe(previous);
    expect(getHscodeToolCenterPreferences().pinnedIds).toEqual([
      "builtin:files",
    ]);
  });

  it("reports a failed preference update without publishing it", () => {
    render(createElement(HscodeToolCenter, { items }));
    const previous = getHscodeToolCenterPreferences();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "hscode.toolCenter.pin: Browser" }),
    );

    expect(screen.getByRole("status").textContent).toBe(
      "hscode.toolCenter.saveFailed",
    );
    expect(getHscodeToolCenterPreferences()).toBe(previous);
    expect(getHscodeToolCenterPreferences().pinnedIds).toEqual([]);
  });

  it("persists the complete plugin order while retaining hidden or unshown IDs", () => {
    let setPluginOrder:
      | HscodeToolCenterPluginControls["onOrderChange"]
      | undefined;
    render(
      createElement(HscodeToolCenter, {
        items,
        renderPluginTools: (nextControls) => {
          setPluginOrder = nextControls.onOrderChange;
          return null;
        },
      }),
    );

    act(() => setPluginOrder?.(["plugin-a", "plugin-c", "plugin-b"]));
    expect(getHscodeToolCenterPreferences().orderIds).toEqual([
      "plugin-a",
      "plugin-c",
      "plugin-b",
    ]);

    act(() => setPluginOrder?.(["plugin-c", "plugin-a", "plugin-b"]));
    expect(getHscodeToolCenterPreferences().orderIds).toEqual([
      "plugin-c",
      "plugin-a",
      "plugin-b",
    ]);

    act(() => setPluginOrder?.(["plugin-c", "plugin-a"]));
    expect(getHscodeToolCenterPreferences().orderIds).toEqual([
      "plugin-c",
      "plugin-a",
      "plugin-b",
    ]);
  });
});

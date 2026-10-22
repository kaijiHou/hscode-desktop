import { describe, expect, it } from "vitest";
import { ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID } from "@zcode/shared";
import type { ZCodePluginUiSurface } from "@zcode/shared";
import {
  buildHscodePluginToolEntries,
  buildHscodeFeaturedPluginToolItemId,
  buildHscodePluginToolItemId,
  filterAndOrderHscodePluginTools,
  HSCODE_FEATURED_UI_PLUGIN_IDS,
  moveHscodePluginToolOrder,
  type HscodePluginToolPlugin,
} from "@/plugin-ui/domain/hscodePluginTools.js";

function surface(pluginId: string, pluginName: string, id: string): ZCodePluginUiSurface {
  return {
    pluginId,
    pluginName,
    id,
    title: `${pluginName} ${id}`,
    server: `plugin:${pluginName}:main`,
    resourceUri: `ui://${pluginName}/${id}.html`,
    availability: "session",
  };
}

function options(overrides: Partial<Parameters<typeof buildHscodePluginToolEntries>[0]> = {}) {
  return {
    plugins: [],
    activeSurfaces: [],
    marketplaceState: "ready" as const,
    surfaceState: "ready" as const,
    hasSession: true,
    supported: true,
    ...overrides,
  };
}

describe("HSCode Plugin Tools model", () => {
  it("keeps the featured set exact and excludes Jupyter from dynamic UI entries", () => {
    const curated = HSCODE_FEATURED_UI_PLUGIN_IDS.map<HscodePluginToolPlugin>((name) => ({
      id: `${name}@${ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID}`,
      name,
      marketplace: ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID,
      installed: false,
      componentTypes: ["ui"],
    }));
    const jupyterSurface = surface("jupyter@personal", "Jupyter Notebook", "notebook");
    const entries = buildHscodePluginToolEntries(
      options({
        plugins: [
          ...curated,
          {
            id: "jupyter@personal",
            name: "Jupyter Notebook",
            marketplace: "personal",
            installed: true,
            enabled: true,
            uiSurfaces: [jupyterSurface],
          },
        ],
        activeSurfaces: [jupyterSurface],
      }),
    );

    expect(
      entries.filter((entry) => entry.group === "featured").map((entry) => entry.pluginName),
    ).toEqual(HSCODE_FEATURED_UI_PLUGIN_IDS);
    expect(entries.some((entry) => /jupyter/i.test(entry.pluginName))).toBe(false);
    expect(entries.filter((entry) => entry.status === "install")).toHaveLength(2);
    expect(HSCODE_FEATURED_UI_PLUGIN_IDS).toEqual(["excalidraw", "zcode-context-insight"]);
  });

  it("uses installed manifest surfaces for disabled plugins and keeps multi-surface IDs unique", () => {
    const pluginId = "canvas@personal";
    const first = surface(pluginId, "canvas", "board");
    const second = surface(pluginId, "canvas", "preview");
    const plugin: HscodePluginToolPlugin = {
      id: pluginId,
      name: "canvas",
      marketplace: "personal",
      installed: true,
      enabled: false,
      uiSurfaces: [first, second],
    };
    const entries = buildHscodePluginToolEntries(options({ plugins: [plugin] }));
    const dynamic = entries.filter((entry) => entry.group === "installed");

    expect(dynamic.map((entry) => entry.surfaceId)).toEqual(["board", "preview"]);
    expect(dynamic.map((entry) => entry.status)).toEqual(["enable", "enable"]);
    expect(new Set(dynamic.map((entry) => entry.id)).size).toBe(2);
    expect(dynamic[0]?.id).toBe(buildHscodePluginToolItemId(pluginId, "board"));
  });

  it("requires a session, supported runtime and a currently listed surface before open", () => {
    const pluginId = `excalidraw@${ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID}`;
    const actualSurface = surface(pluginId, "excalidraw", "panel");
    const plugin: HscodePluginToolPlugin = {
      id: pluginId,
      name: "excalidraw",
      marketplace: ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID,
      installed: true,
      enabled: true,
      uiSurfaces: [actualSurface],
    };
    const make = (overrides: Partial<Parameters<typeof buildHscodePluginToolEntries>[0]> = {}) =>
      buildHscodePluginToolEntries(
        options({ plugins: [plugin], activeSurfaces: [actualSurface], ...overrides }),
      ).find((entry) => entry.group === "featured" && entry.surfaceId === "panel")?.status;

    expect(make()).toBe("open");
    expect(make({ hasSession: false })).toBe("createTaskFirst");
    expect(make({ supported: false })).toBe("unsupported");
    expect(make({ surfaceState: "loading", activeSurfaces: [] })).toBe("loading");
    expect(make({ surfaceState: "error", activeSurfaces: [] })).toBe("error");
    expect(make({ activeSurfaces: [] })).toBe("unsupported");
  });

  it("keeps the featured row ID stable across install and keeps extra surfaces unique", () => {
    const pluginId = `excalidraw@${ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID}`;
    const uninstalled = buildHscodePluginToolEntries(
      options({
        plugins: [
          {
            id: pluginId,
            name: "excalidraw",
            marketplace: ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID,
            installed: false,
            componentTypes: ["ui"],
          },
        ],
      }),
    ).find((entry) => entry.pluginName === "excalidraw");
    const firstSurface = surface(pluginId, "excalidraw", "main");
    const secondSurface = surface(pluginId, "excalidraw", "preview");
    const installed = buildHscodePluginToolEntries(
      options({
        plugins: [
          {
            id: pluginId,
            name: "excalidraw",
            marketplace: ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID,
            installed: true,
            enabled: true,
            uiSurfaces: [firstSurface, secondSurface],
          },
        ],
        activeSurfaces: [firstSurface, secondSurface],
      }),
    ).filter((entry) => entry.pluginName === "excalidraw");

    expect(uninstalled?.id).toBe(buildHscodeFeaturedPluginToolItemId("excalidraw"));
    expect(installed[0]?.id).toBe(uninstalled?.id);
    expect(installed.map((entry) => entry.surfaceId)).toEqual(["main", "preview"]);
    expect(new Set(installed.map((entry) => entry.id)).size).toBe(2);
  });

  it("keeps a live UI openable when an optional update is available", () => {
    const pluginId = `excalidraw@${ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID}`;
    const actualSurface = surface(pluginId, "excalidraw", "panel");
    const [entry] = buildHscodePluginToolEntries(
      options({
        plugins: [
          {
            id: pluginId,
            name: "excalidraw",
            marketplace: ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID,
            installed: true,
            enabled: true,
            updateAvailable: true,
            uiSurfaces: [actualSurface],
          },
        ],
        activeSurfaces: [actualSurface],
      }),
    );

    expect(entry?.status).toBe("open");
    expect(entry?.updateAvailable).toBe(true);
  });

  it("reports marketplace failures instead of labeling missing featured plugins unsupported", () => {
    const entries = buildHscodePluginToolEntries(options({ marketplaceState: "error" }));
    expect(entries[0]?.status).toBe("error");
    expect(buildHscodePluginToolEntries(options({ marketplaceState: "loading" }))[0]?.status).toBe(
      "loading",
    );
    expect(buildHscodePluginToolEntries(options())[0]?.status).toBe("notListed");
  });

  it("filters hidden rows and orders pinned IDs before other items within their group", () => {
    const rows = [
      { id: "f1", group: "featured" as const, searchText: "drawing" },
      { id: "f2", group: "featured" as const, searchText: "context" },
      { id: "i1", group: "installed" as const, searchText: "pdf" },
    ];
    expect(
      filterAndOrderHscodePluginTools(rows, {
        query: "",
        pinnedIds: ["f2"],
        hiddenIds: ["f1"],
      }).map((row) => row.id),
    ).toEqual(["f2", "i1"]);
    expect(
      filterAndOrderHscodePluginTools(rows, {
        query: "drawing",
        hiddenIds: ["f1"],
        showHidden: true,
        orderIds: ["f1"],
      }).map((row) => row.id),
    ).toEqual(["f1"]);
  });

  it("swaps one adjacent visible ID when no saved order exists", () => {
    const visible = [
      { id: "f1", group: "featured" as const },
      { id: "f2", group: "featured" as const },
      { id: "i1", group: "installed" as const },
    ];

    expect(moveHscodePluginToolOrder(visible, "f2", -1)).toEqual(["f2", "f1", "i1"]);
    expect(moveHscodePluginToolOrder(visible, "f1", 1)).toEqual(["f2", "f1", "i1"]);
  });

  it("does not move across group or pinned boundaries", () => {
    const visible = [
      { id: "f1", group: "featured" as const },
      { id: "f2", group: "featured" as const },
      { id: "f3", group: "featured" as const },
      { id: "i1", group: "installed" as const },
    ];

    expect(moveHscodePluginToolOrder(visible, "f3", 1)).toBeNull();
    expect(moveHscodePluginToolOrder(visible, "f2", -1, ["f1"])).toBeNull();
    expect(moveHscodePluginToolOrder(visible, "f2", 1, ["f1"])).toEqual(["f1", "f3", "f2", "i1"]);
  });
});

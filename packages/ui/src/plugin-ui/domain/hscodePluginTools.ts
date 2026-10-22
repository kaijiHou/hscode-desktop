import { ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID } from "@zcode/shared";
import type { ZCodePluginUiSurface } from "@zcode/shared";

export const HSCODE_FEATURED_UI_PLUGIN_IDS = ["excalidraw", "zcode-context-insight"] as const;

export type HscodePluginToolStatus =
  | "install"
  | "enable"
  | "open"
  | "createTaskFirst"
  | "unsupported"
  | "notListed"
  | "loading"
  | "error";

export interface HscodePluginToolPlugin {
  id: string;
  name: string;
  marketplace: string;
  installed: boolean;
  enabled?: boolean;
  updateAvailable?: boolean;
  componentTypes?: readonly string[];
  uiSurfaces?: readonly ZCodePluginUiSurface[];
}

export interface HscodePluginToolEntry {
  id: string;
  pluginId: string;
  pluginName: string;
  group: "featured" | "installed";
  surfaceId: string | null;
  surface: ZCodePluginUiSurface | null;
  sourceId: string | null;
  updateAvailable: boolean;
  status: HscodePluginToolStatus;
}

export interface HscodePluginToolsOptions {
  plugins: readonly HscodePluginToolPlugin[];
  activeSurfaces: readonly ZCodePluginUiSurface[];
  marketplaceState: "loading" | "ready" | "error";
  surfaceState: "idle" | "loading" | "ready" | "error";
  hasSession: boolean;
  supported: boolean;
}

function isValidSurface(surface: ZCodePluginUiSurface): boolean {
  return Boolean(
    surface.pluginId &&
    surface.id &&
    surface.server &&
    surface.resourceUri &&
    surface.availability === "session",
  );
}

function isJupyterPlugin(pluginName: string, pluginId: string): boolean {
  return /jupyter/i.test(pluginName) || /jupyter/i.test(pluginId);
}

export function buildHscodePluginToolItemId(pluginId: string, surfaceId: string): string {
  return `hscode-plugin-ui:${encodeURIComponent(pluginId)}:${encodeURIComponent(surfaceId)}`;
}

export function buildHscodeFeaturedPluginToolItemId(pluginName: string): string {
  return `hscode-plugin-featured:${encodeURIComponent(pluginName)}`;
}

function resolveStatus(
  plugin: HscodePluginToolPlugin | undefined,
  surfaceIsActive: boolean,
  options: HscodePluginToolsOptions,
): HscodePluginToolStatus {
  if (!plugin) {
    if (options.marketplaceState === "loading") return "loading";
    return options.marketplaceState === "error" ? "error" : "notListed";
  }
  if (!plugin.installed) {
    return plugin.componentTypes?.includes("ui") ? "install" : "unsupported";
  }
  if (plugin.enabled === false) return "enable";
  if (plugin.enabled !== true) return "unsupported";
  if (!options.supported) return "unsupported";
  if (!options.hasSession) return "createTaskFirst";
  if (options.surfaceState === "loading") return "loading";
  if (options.surfaceState === "error") return "error";
  return options.surfaceState === "ready" && surfaceIsActive ? "open" : "unsupported";
}

function uniqueSurfaces(
  plugin: HscodePluginToolPlugin,
  activeSurfaces: readonly ZCodePluginUiSurface[],
): ZCodePluginUiSurface[] {
  const surfaces = new Map<string, ZCodePluginUiSurface>();
  for (const surface of plugin.installed ? (plugin.uiSurfaces ?? []) : []) {
    if (surface.pluginId === plugin.id && isValidSurface(surface)) {
      surfaces.set(surface.id, surface);
    }
  }
  for (const surface of activeSurfaces) {
    if (surface.pluginId === plugin.id && isValidSurface(surface)) {
      // Bridge output is the live authority and supplies the exact runtime route to open.
      surfaces.set(surface.id, surface);
    }
  }
  return [...surfaces.values()];
}

function makeEntries(
  plugin: HscodePluginToolPlugin | undefined,
  pluginName: string,
  group: HscodePluginToolEntry["group"],
  options: HscodePluginToolsOptions,
  activeSurfaces: readonly ZCodePluginUiSurface[],
): HscodePluginToolEntry[] {
  const pluginId = plugin?.id ?? `${pluginName}@${ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID}`;
  const surfaces = plugin?.installed ? uniqueSurfaces(plugin, activeSurfaces) : [];
  if (surfaces.length === 0) {
    return [
      {
        id:
          group === "featured"
            ? buildHscodeFeaturedPluginToolItemId(pluginName)
            : buildHscodePluginToolItemId(pluginId, "featured"),
        pluginId,
        pluginName,
        group,
        surfaceId: null,
        surface: null,
        sourceId: plugin?.marketplace || null,
        updateAvailable: Boolean(plugin?.updateAvailable),
        status: resolveStatus(plugin, false, options),
      },
    ];
  }
  return surfaces.map((surface, index) => {
    const liveSurface = activeSurfaces.find(
      (candidate) => candidate.pluginId === pluginId && candidate.id === surface.id,
    );
    return {
      id:
        group === "featured" && index === 0
          ? buildHscodeFeaturedPluginToolItemId(pluginName)
          : buildHscodePluginToolItemId(pluginId, surface.id),
      pluginId,
      pluginName,
      group,
      surfaceId: surface.id,
      surface: liveSurface ?? surface,
      sourceId: plugin?.marketplace || null,
      updateAvailable: Boolean(plugin?.updateAvailable),
      status: resolveStatus(plugin, Boolean(liveSurface), options),
    };
  });
}

export function buildHscodePluginToolEntries(
  options: HscodePluginToolsOptions,
): HscodePluginToolEntry[] {
  const activeByPlugin = new Map<string, ZCodePluginUiSurface[]>();
  for (const surface of options.activeSurfaces) {
    if (!isValidSurface(surface)) continue;
    const current = activeByPlugin.get(surface.pluginId) ?? [];
    current.push(surface);
    activeByPlugin.set(surface.pluginId, current);
  }

  const featured = HSCODE_FEATURED_UI_PLUGIN_IDS.flatMap((pluginName) => {
    const plugin = options.plugins.find(
      (candidate) =>
        candidate.name === pluginName &&
        candidate.marketplace === ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID,
    );
    return makeEntries(
      plugin,
      pluginName,
      "featured",
      options,
      plugin ? (activeByPlugin.get(plugin.id) ?? []) : [],
    );
  });

  const installedPlugins = new Map(
    options.plugins
      .filter((plugin) => plugin.installed && !isJupyterPlugin(plugin.name, plugin.id))
      .map((plugin) => [plugin.id, plugin]),
  );
  for (const surface of options.activeSurfaces) {
    if (
      !isValidSurface(surface) ||
      isJupyterPlugin(surface.pluginName, surface.pluginId) ||
      installedPlugins.has(surface.pluginId)
    )
      continue;
    // A live bridge surface is itself proof of an installed, enabled runtime plugin.
    installedPlugins.set(surface.pluginId, {
      id: surface.pluginId,
      name: surface.pluginName,
      marketplace: "",
      installed: true,
      enabled: true,
      uiSurfaces: [surface],
    });
  }

  const dynamic = [...installedPlugins.values()].flatMap((plugin) => {
    const activeSurfacesForPlugin = activeByPlugin.get(plugin.id) ?? [];
    const isFeatured =
      plugin.marketplace === ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID &&
      HSCODE_FEATURED_UI_PLUGIN_IDS.includes(
        plugin.name as (typeof HSCODE_FEATURED_UI_PLUGIN_IDS)[number],
      );
    if (isFeatured) return [];
    const surfaces = uniqueSurfaces(plugin, activeSurfacesForPlugin);
    if (surfaces.length === 0) return [];
    return makeEntries(plugin, plugin.name, "installed", options, activeSurfacesForPlugin);
  });

  return [...featured, ...dynamic];
}

export function filterAndOrderHscodePluginTools<
  T extends {
    id: string;
    group: HscodePluginToolEntry["group"];
    searchText: string;
  },
>(
  entries: readonly T[],
  options: {
    query?: string;
    pinnedIds?: readonly string[];
    hiddenIds?: readonly string[];
    orderIds?: readonly string[];
    showHidden?: boolean;
  },
): T[] {
  const query = options.query?.trim().toLocaleLowerCase();
  const pinned = new Set(options.pinnedIds);
  const hidden = new Set(options.hiddenIds);
  const order = new Map(options.orderIds?.map((id, index) => [id, index]));
  return entries
    .filter(
      (entry) =>
        (options.showHidden || !hidden.has(entry.id)) &&
        (!query || entry.searchText.toLocaleLowerCase().includes(query)),
    )
    .map((entry, index) => ({ entry, index }))
    .toSorted((left, right) => {
      const groupOrder =
        (left.entry.group === "featured" ? 0 : 1) - (right.entry.group === "featured" ? 0 : 1);
      if (groupOrder !== 0) return groupOrder;
      const pinOrder = Number(pinned.has(right.entry.id)) - Number(pinned.has(left.entry.id));
      if (pinOrder !== 0) return pinOrder;
      const leftOrder = order.get(left.entry.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right.entry.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ entry }) => entry);
}

/** Swap one adjacent visible plugin row, without crossing section or pin boundaries. */
export function moveHscodePluginToolOrder(
  entries: readonly Pick<HscodePluginToolEntry, "id" | "group">[],
  itemId: string,
  direction: -1 | 1,
  pinnedIds?: readonly string[],
): string[] | null {
  const index = entries.findIndex((entry) => entry.id === itemId);
  const targetIndex = index + direction;
  const current = entries[index];
  const target = entries[targetIndex];
  const pinned = new Set(pinnedIds);
  if (
    !current ||
    !target ||
    current.group !== target.group ||
    pinned.has(current.id) !== pinned.has(target.id)
  )
    return null;
  const ids = entries.map((entry) => entry.id);
  [ids[index], ids[targetIndex]] = [ids[targetIndex]!, ids[index]!];
  return ids;
}

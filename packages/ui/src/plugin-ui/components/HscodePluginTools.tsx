import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pin,
  PinOff,
  PuzzleIcon,
} from "lucide-react";
import { isRemoteWorkspaceIdentity, ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID } from "@zcode/shared";
import { useServices } from "@/hooks/useServices.js";
import { useOptionalPlatform } from "@/hooks/usePlatform.js";
import { useScopedPluginManagementStore } from "@/store/pluginManagementStore.js";
import {
  buildStoreItems,
  canUpdatePluginItem,
  isItemBusy,
  resolveItemDescription,
  resolveItemDisplayName,
  type StorePluginItem,
} from "@/settings/pluginStoreListing.js";
import { PluginStoreAvatar } from "@/settings/PluginStoreAvatar.js";
import { requestPluginStoreOpen } from "@/lib/pluginStoreNavigation.js";
import { claimMarketplaceAutoRefresh } from "@/settings/officialMarketplaceAutoRefresh.js";
import { toast } from "@/components/ui/toast.js";
import { cn } from "@/components/lib/utils.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { documentViewerInstance } from "@/plugin-ui/contract.js";
import {
  SidePaneLauncherRow,
  type PluginUiLauncherItemsProps,
} from "@/plugin-ui/components/PluginUiLauncherItems.js";
import {
  usePluginUiSurfaceSnapshot,
  resolvePluginUiSurfaceTitle,
} from "@/plugin-ui/adapters/usePluginUiSurfaces.js";
import {
  buildHscodePluginToolEntries,
  filterAndOrderHscodePluginTools,
  HSCODE_FEATURED_UI_PLUGIN_IDS,
  moveHscodePluginToolOrder,
  type HscodePluginToolEntry,
  type HscodePluginToolStatus,
} from "@/plugin-ui/domain/hscodePluginTools.js";

const FEATURED_TITLES: Record<
  (typeof HSCODE_FEATURED_UI_PLUGIN_IDS)[number],
  { zh: string; en: string }
> = {
  excalidraw: { zh: "Excalidraw", en: "Excalidraw" },
  "zcode-context-insight": { zh: "上下文洞察", en: "Context Insight" },
};

export interface HscodePluginToolsProps extends PluginUiLauncherItemsProps {
  query?: string;
  pinnedIds?: readonly string[];
  hiddenIds?: readonly string[];
  orderIds?: readonly string[];
  showHidden?: boolean;
  onTogglePinned?: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  onOrderChange?: (ids: readonly string[]) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
}

interface HscodePluginToolView extends HscodePluginToolEntry {
  title: string;
  description?: string;
  searchText: string;
  busy: boolean;
  item?: StorePluginItem;
}

function getFeaturedTitle(name: string, locale: string): string {
  const titles = FEATURED_TITLES[name as keyof typeof FEATURED_TITLES];
  if (!titles) return name;
  return locale.toLowerCase().startsWith("zh") ? titles.zh : titles.en;
}

function actionLabel(
  status: HscodePluginToolStatus,
  intl: ReturnType<typeof useZCodeIntl>["intl"],
) {
  const messageId = {
    install: "settings.plugins.store.install",
    enable: "settings.plugins.store.menu.enable",
    open: "settings.plugins.store.ui.open",
    createTaskFirst: "hscode.toolCenter.createTaskFirst",
    unsupported: "hscode.toolCenter.unsupported",
    notListed: "hscode.toolCenter.notListed",
    loading: "common.loading",
    error: "pluginUi.loadFailed",
  }[status];
  return intl.formatMessage({ id: messageId });
}

export function HscodePluginTools(props: HscodePluginToolsProps) {
  const { intl, locale } = useZCodeIntl();
  const services = useServices();
  const platform = useOptionalPlatform();
  const service = services.pluginManagementService;
  const bridge = services.pluginUiBridgeService;
  const store = useScopedPluginManagementStore(service);
  const state = store();
  const workspaceIdentity = props.workspaceIdentity?.trim() || undefined;
  const normalizedIdentity = workspaceIdentity ?? null;
  const workspaceKey = JSON.stringify([normalizedIdentity || props.workspacePath]);
  const requestKey = JSON.stringify([workspaceKey, props.sessionId, props.remoteSessionId ?? null]);
  const context = useMemo(() => ({ workspaceKey, store, service }), [service, store, workspaceKey]);
  const [readyContext, setReadyContext] = useState<typeof context | null>(null);

  useEffect(() => {
    let active = true;
    setReadyContext(null);
    void store
      .getState()
      .initialize({
        workspacePath: props.workspacePath,
        ...(workspaceIdentity ? { workspaceIdentity } : {}),
        pluginService: service,
      })
      .then(
        () => {
          if (active) setReadyContext(context);
        },
        () => {
          if (active) setReadyContext(context);
        },
      );
    return () => {
      active = false;
    };
  }, [context, props.workspacePath, service, store, workspaceIdentity]);

  const marketplaceReady =
    readyContext === context &&
    state.workspacePath === props.workspacePath &&
    state.workspaceIdentity === normalizedIdentity;
  const marketplaceState =
    !marketplaceReady || state.loading
      ? "loading"
      : state.marketplaceAvailabilityKnown && !state.error
        ? "ready"
        : "error";
  useEffect(() => {
    if (!marketplaceReady || state.loading) return;
    const official = state.marketplaces.find(
      (marketplace) => marketplace.id === ZCODE_OFFICIAL_PLUGIN_MARKETPLACE_ID,
    );
    // 初始 seed 目录不含 CDN 插件；复用市场的节流刷新，而非自行下载或静默安装。
    if (official && claimMarketplaceAutoRefresh(official.id, official.lastUpdated)) {
      void store.getState().updateMarketplace(official.id, service);
    }
  }, [marketplaceReady, service, state.loading, state.marketplaces, store]);
  const storeItems = useMemo(
    () =>
      marketplaceReady
        ? buildStoreItems({
            marketplaces: state.marketplaces,
            marketplaceAvailabilityKnown: state.marketplaceAvailabilityKnown,
            availablePlugins: state.availablePlugins,
            installedPlugins: state.installedPlugins,
            plugins: state.plugins,
            restorableBuiltins: state.restorableBuiltins,
          })
        : [],
    [marketplaceReady, state],
  );
  const itemById = useMemo(() => new Map(storeItems.map((item) => [item.id, item])), [storeItems]);
  const marketplaceNameById = useMemo(
    () => new Map(state.marketplaces.map((marketplace) => [marketplace.id, marketplace.name])),
    [state.marketplaces],
  );
  const runtimeSupported = Boolean(
    platform?.pluginSandbox &&
    bridge &&
    !props.remoteSessionId &&
    !isRemoteWorkspaceIdentity(props.workspaceIdentity ?? ""),
  );
  const surfaceSnapshot = usePluginUiSurfaceSnapshot({
    workspacePath: props.workspacePath,
    workspaceIdentity,
    enabled: props.sessionId !== null && runtimeSupported,
  });
  const operationContext = useMemo(
    // 字符串键在 A→B→A 后会重复；对象身份同时隔离旧会话和旧 bridge 的迟到结果。
    () => ({}),
    [bridge, props.onOpenPluginUi, props.workspacePath, requestKey, runtimeSupported, service],
  );
  const contextRef = useRef<typeof operationContext | null>(operationContext);
  contextRef.current = operationContext;
  useEffect(() => {
    contextRef.current = operationContext;
    return () => {
      if (contextRef.current === operationContext) contextRef.current = null;
    };
  }, [operationContext]);

  const modelEntries = useMemo(
    () =>
      buildHscodePluginToolEntries({
        plugins: storeItems.map((item) => ({
          id: item.id,
          name: item.name,
          marketplace: item.marketplace,
          installed: item.installed,
          enabled: item.info?.enabled,
          updateAvailable: canUpdatePluginItem(item),
          componentTypes: item.summary?.componentTypes ?? item.installedMeta?.componentTypes,
          uiSurfaces: item.info?.uiSurfaces,
        })),
        activeSurfaces: surfaceSnapshot.surfaces,
        marketplaceState,
        surfaceState: surfaceSnapshot.status,
        hasSession: props.sessionId !== null,
        supported: runtimeSupported,
      }),
    [
      marketplaceState,
      props.sessionId,
      runtimeSupported,
      state.loading,
      storeItems,
      surfaceSnapshot,
    ],
  );

  const viewEntries = useMemo<HscodePluginToolView[]>(
    () =>
      modelEntries.map((entry) => {
        const item = itemById.get(entry.pluginId);
        const surfaceTitle = entry.surface
          ? resolvePluginUiSurfaceTitle(entry.surface.title, locale)
          : undefined;
        const title =
          (entry.group === "featured"
            ? item
              ? resolveItemDisplayName(item, locale)
              : getFeaturedTitle(entry.pluginName, locale)
            : surfaceTitle || (item ? resolveItemDisplayName(item, locale) : entry.pluginName)) ||
          entry.pluginName;
        const itemDescription = item ? resolveItemDescription(item, locale) : undefined;
        const sourceName = entry.sourceId
          ? (marketplaceNameById.get(entry.sourceId) ?? entry.sourceId)
          : undefined;
        const sourceDescription = sourceName
          ? `${intl.formatMessage({ id: "hscode.toolCenter.source" })}: ${sourceName}`
          : undefined;
        const description =
          entry.group === "featured"
            ? [
                surfaceTitle && surfaceTitle !== title ? surfaceTitle : itemDescription,
                sourceDescription,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            : [surfaceTitle && surfaceTitle !== title ? title : itemDescription, sourceDescription]
                .filter(Boolean)
                .join(" · ") || undefined;
        return {
          ...entry,
          title,
          ...(description ? { description } : {}),
          searchText: [title, description, entry.pluginId, entry.pluginName, entry.surfaceId]
            .filter(Boolean)
            .join(" "),
          busy: Boolean(item && isItemBusy(item, state)),
          ...(item ? { item } : {}),
        };
      }),
    [intl, itemById, locale, marketplaceNameById, modelEntries, state],
  );
  const orderedEntries = useMemo(
    () =>
      filterAndOrderHscodePluginTools(viewEntries, {
        query: props.query,
        pinnedIds: props.pinnedIds,
        hiddenIds: props.hiddenIds,
        orderIds: props.orderIds,
        showHidden: props.showHidden,
      }),
    [props.hiddenIds, props.orderIds, props.pinnedIds, props.query, props.showHidden, viewEntries],
  );

  const openEntry = useCallback(
    async (entry: HscodePluginToolView) => {
      if (entry.busy) return;
      if (entry.status === "install" || entry.status === "enable") {
        requestPluginStoreOpen({ pluginId: entry.pluginId, returnScopeKey: "user" });
        return;
      }
      if (
        entry.status !== "open" ||
        !entry.surfaceId ||
        props.sessionId === null ||
        !runtimeSupported
      )
        return;
      const currentOperationContext = operationContext;
      if (!bridge) return;
      try {
        const surfaces = await bridge.listSurfaces({
          workspacePath: props.workspacePath,
          ...(workspaceIdentity ? { workspaceIdentity } : {}),
        });
        if (contextRef.current !== currentOperationContext) return;
        const surface = surfaces.find(
          (candidate) =>
            candidate.pluginId === entry.pluginId &&
            candidate.id === entry.surfaceId &&
            candidate.availability === "session" &&
            Boolean(candidate.server && candidate.resourceUri),
        );
        if (!surface) {
          toast(intl.formatMessage({ id: "settings.plugins.store.ui.unavailable" }));
          return;
        }
        props.onOpenPluginUi({
          parentSessionId: props.sessionId,
          pluginId: surface.pluginId,
          surfaceId: surface.id,
          serverName: surface.server,
          resourceUri: surface.resourceUri,
          ...documentViewerInstance(surface.resourceUri),
          title: resolvePluginUiSurfaceTitle(surface.title, locale),
          workspacePath: props.workspacePath,
          ...(workspaceIdentity ? { workspaceIdentity } : {}),
          remoteSessionId: props.remoteSessionId ?? null,
        });
      } catch {
        if (contextRef.current === currentOperationContext) {
          toast(intl.formatMessage({ id: "settings.plugins.store.ui.unavailable" }));
        }
      }
    },
    [intl, locale, props, operationContext, runtimeSupported, bridge, workspaceIdentity],
  );

  const renderGroup = (group: HscodePluginToolEntry["group"], label: string) => {
    const entries = orderedEntries.filter((entry) => entry.group === group);
    const moveEntry = (id: string, direction: -1 | 1) => {
      const nextOrder = moveHscodePluginToolOrder(orderedEntries, id, direction, props.pinnedIds);
      if (!nextOrder) return;
      if (props.onOrderChange) props.onOrderChange(nextOrder);
      else props.onMove?.(id, direction);
    };
    return (
      <section key={group} aria-label={label} className="min-w-0 space-y-1">
        <h3 className="px-2 pt-3 text-ui-sm font-semibold text-foreground-subtle">{label}</h3>
        {entries.length > 0 ? (
          <ul className="min-w-0">
            {entries.map((entry) => {
              const hidden = props.hiddenIds?.includes(entry.id) ?? false;
              const pinned = props.pinnedIds?.includes(entry.id) ?? false;
              const status = entry.busy ? "loading" : entry.status;
              const disabled =
                entry.busy || (status !== "install" && status !== "enable" && status !== "open");
              const canMoveUp = Boolean(
                moveHscodePluginToolOrder(orderedEntries, entry.id, -1, props.pinnedIds),
              );
              const canMoveDown = Boolean(
                moveHscodePluginToolOrder(orderedEntries, entry.id, 1, props.pinnedIds),
              );
              const hasMoveActions = Boolean(props.onOrderChange || props.onMove);
              const hasPreferenceActions = Boolean(props.onTogglePinned || props.onToggleHidden);
              const hasRowActions = entry.updateAvailable || hasMoveActions || hasPreferenceActions;
              return (
                <li
                  key={entry.id}
                  data-testid="hscode-plugin-tool"
                  data-plugin-id={entry.pluginId}
                  data-surface-id={entry.surfaceId ?? undefined}
                  data-status={status}
                  className={cn("flex min-w-0 items-center", hidden && "opacity-60")}
                >
                  <span className="min-w-0 flex-1">
                    <SidePaneLauncherRow
                      itemId={entry.id}
                      icon={PuzzleIcon}
                      avatar={
                        entry.item ? (
                          <PluginStoreAvatar
                            item={entry.item}
                            className="size-10 rounded-lg"
                            fallbackIcon={<PuzzleIcon className="size-5" />}
                          />
                        ) : undefined
                      }
                      label={entry.title}
                      description={entry.description}
                      actionLabel={actionLabel(status, intl)}
                      actionPlacement="below"
                      loading={status === "loading"}
                      disabled={disabled}
                      onOpen={() => void openEntry({ ...entry, status })}
                    />
                  </span>
                  {hasRowActions ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={intl.formatMessage({
                            id: "settings.plugins.store.menu.label",
                          })}
                          title={intl.formatMessage({ id: "common.more" })}
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground-subtle hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focused"
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={4} className="min-w-44">
                        {entry.updateAvailable ? (
                          <DropdownMenuItem
                            disabled={entry.busy}
                            onSelect={() =>
                              requestPluginStoreOpen({
                                pluginId: entry.pluginId,
                                returnScopeKey: "user",
                              })
                            }
                          >
                            <Download aria-hidden="true" />
                            {intl.formatMessage({ id: "settings.plugins.detail.update" })}
                          </DropdownMenuItem>
                        ) : null}
                        {entry.updateAvailable && hasPreferenceActions ? (
                          <DropdownMenuSeparator />
                        ) : null}
                        {props.onTogglePinned ? (
                          <DropdownMenuItem onSelect={() => props.onTogglePinned?.(entry.id)}>
                            {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                            {intl.formatMessage({
                              id: pinned ? "hscode.toolCenter.unpin" : "hscode.toolCenter.pin",
                            })}
                          </DropdownMenuItem>
                        ) : null}
                        {props.onToggleHidden ? (
                          <DropdownMenuItem onSelect={() => props.onToggleHidden?.(entry.id)}>
                            {hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                            {intl.formatMessage({
                              id: hidden ? "hscode.toolCenter.show" : "hscode.toolCenter.hide",
                            })}
                          </DropdownMenuItem>
                        ) : null}
                        {hasMoveActions ? (
                          <>
                            {hasPreferenceActions || entry.updateAvailable ? (
                              <DropdownMenuSeparator />
                            ) : null}
                            <DropdownMenuItem
                              disabled={!canMoveUp}
                              onSelect={() => moveEntry(entry.id, -1)}
                            >
                              <ArrowUp aria-hidden="true" />
                              {intl.formatMessage({ id: "hscode.toolCenter.moveUp" })}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!canMoveDown}
                              onSelect={() => moveEntry(entry.id, 1)}
                            >
                              <ArrowDown aria-hidden="true" />
                              {intl.formatMessage({ id: "hscode.toolCenter.moveDown" })}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : group === "installed" && !props.query?.trim() && marketplaceState === "ready" ? (
          <p className="px-2 py-1 text-ui-sm text-foreground-subtle">
            {intl.formatMessage({ id: "hscode.toolCenter.noPlugins" })}
          </p>
        ) : null}
      </section>
    );
  };

  return (
    <div
      className="min-w-0"
      data-testid="hscode-plugin-tools"
      data-marketplace-state={marketplaceState}
    >
      {marketplaceState === "error" ? (
        <p role="alert" className="px-2 py-2 text-ui-sm text-destructive">
          {intl.formatMessage({ id: "settings.plugins.marketplace.componentsError" })}
        </p>
      ) : null}
      {props.sessionId !== null && runtimeSupported && surfaceSnapshot.status === "error" ? (
        <p role="alert" className="px-2 py-2 text-ui-sm text-destructive">
          {intl.formatMessage({ id: "pluginUi.loadFailed" })}
        </p>
      ) : null}
      {orderedEntries.length === 0 && props.query?.trim() ? (
        <p role="status" className="px-2 py-3 text-ui-sm text-foreground-subtle">
          {intl.formatMessage({ id: "hscode.toolCenter.noResults" })}
        </p>
      ) : (
        <>
          {renderGroup("featured", intl.formatMessage({ id: "hscode.toolCenter.featured" }))}
          {renderGroup("installed", intl.formatMessage({ id: "hscode.toolCenter.installed" }))}
        </>
      )}
    </div>
  );
}

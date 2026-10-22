import {
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  PinIcon,
  RotateCcwIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import {
  createDefaultHscodeToolCenterPreferences,
  moveHscodeToolCenterId,
  toggleHscodeToolCenterId,
  type HscodeToolCenterPreferences,
} from "./contract.js";
import {
  getHscodeToolCenterPreferences,
  resetHscodeToolCenterPreferenceStore,
  subscribeHscodeToolCenterPreferences,
  updateHscodeToolCenterPreferences,
} from "./preferencesStore.js";

export interface HscodeToolCenterItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  onOpen: () => void;
  disabled?: boolean;
}

export interface HscodeToolCenterPluginControls {
  query: string;
  pinnedIds: readonly string[];
  hiddenIds: readonly string[];
  orderIds: readonly string[];
  showHidden: boolean;
  onTogglePinned: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onOrderChange: (orderedIds: readonly string[]) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}

export function HscodeToolCenter({
  items,
  renderPluginTools,
}: {
  items: readonly HscodeToolCenterItem[];
  renderPluginTools?: (controls: HscodeToolCenterPluginControls) => ReactNode;
}) {
  const { intl } = useZCodeIntl();
  const builtinHeadingId = useId();
  const preferences = useSyncExternalStore(
    subscribeHscodeToolCenterPreferences,
    getHscodeToolCenterPreferences,
    createDefaultHscodeToolCenterPreferences,
  );
  const [query, setQuery] = useState("");
  const [preferenceSaveFailed, setPreferenceSaveFailed] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const updatePreferences = (
    update: (current: HscodeToolCenterPreferences) => unknown,
  ) => {
    const saved = updateHscodeToolCenterPreferences(update);
    setPreferenceSaveFailed(!saved);
  };

  const resetPreferences = () => {
    const reset = resetHscodeToolCenterPreferenceStore();
    setPreferenceSaveFailed(!reset);
  };

  const sortedItems = useMemo(() => {
    const order = new Map(
      preferences.builtinOrderIds.map((id, index) => [id, index]),
    );
    const pinned = new Set(preferences.pinnedIds);
    return [...items]
      .filter(
        (item) =>
          preferences.showHidden || !preferences.hiddenIds.includes(item.id),
      )
      .filter(
        (item) =>
          !normalizedQuery ||
          `${item.label}\n${item.description}`
            .toLocaleLowerCase()
            .includes(normalizedQuery),
      )
      .sort((left, right) => {
        const pinDifference =
          Number(pinned.has(right.id)) - Number(pinned.has(left.id));
        if (pinDifference !== 0) return pinDifference;
        return (
          (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        );
      });
  }, [items, normalizedQuery, preferences]);

  const pluginControls: HscodeToolCenterPluginControls = {
    query,
    pinnedIds: preferences.pinnedIds,
    hiddenIds: preferences.hiddenIds,
    orderIds: preferences.orderIds,
    showHidden: preferences.showHidden,
    onTogglePinned: (id) =>
      updatePreferences((current) => ({
        ...current,
        pinnedIds: toggleHscodeToolCenterId(current.pinnedIds, id),
      })),
    onToggleHidden: (id) =>
      updatePreferences((current) => ({
        ...current,
        hiddenIds: toggleHscodeToolCenterId(current.hiddenIds, id),
      })),
    onOrderChange: (orderedIds) =>
      updatePreferences((current) => ({
        ...current,
        orderIds: [
          ...orderedIds,
          ...current.orderIds.filter((id) => !orderedIds.includes(id)),
        ],
      })),
    onMove: (id, direction) =>
      updatePreferences((current) => ({
        ...current,
        // Legacy callers lack the rendered order. Do not guess a neighbor when
        // the ID has no persisted position; HscodePluginTools uses onOrderChange.
        orderIds: current.orderIds.includes(id)
          ? moveHscodeToolCenterId(current.orderIds, id, direction)
          : current.orderIds,
      })),
  };

  const moveBuiltin = (id: string, direction: -1 | 1) => {
    updatePreferences((current) => {
      const pinned = new Set(current.pinnedIds);
      const visibleGroup = items
        .filter((item) => pinned.has(item.id) === pinned.has(id))
        .filter(
          (item) => current.showHidden || !current.hiddenIds.includes(item.id),
        )
        .map((item) => item.id)
        .sort((left, right) => {
          const order = new Map(
            current.builtinOrderIds.map((itemId, index) => [itemId, index]),
          );
          return (
            (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(right) ?? Number.MAX_SAFE_INTEGER)
          );
        });
      const moved = moveHscodeToolCenterId(visibleGroup, id, direction);
      const unchanged = current.builtinOrderIds.filter(
        (itemId) => !visibleGroup.includes(itemId),
      );
      return { ...current, builtinOrderIds: [...moved, ...unchanged] };
    });
  };

  const orderedForMoves = [...items]
    .filter(
      (item) =>
        preferences.showHidden || !preferences.hiddenIds.includes(item.id),
    )
    .sort((left, right) => {
      const pinned = new Set(preferences.pinnedIds);
      const pinDifference =
        Number(pinned.has(right.id)) - Number(pinned.has(left.id));
      if (pinDifference !== 0) return pinDifference;
      const order = new Map(
        preferences.builtinOrderIds.map((id, index) => [id, index]),
      );
      return (
        (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    });

  return (
    <div className="@container/tool-center flex h-full min-h-0 flex-col bg-background">
      {preferenceSaveFailed ? (
        <p
          role="status"
          aria-live="polite"
          className="shrink-0 border-b border-border px-4 py-2 text-ui-sm text-destructive"
        >
          {intl.formatMessage({ id: "hscode.toolCenter.saveFailed" })}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <h2 className="text-ui-xl font-semibold text-foreground">
            {intl.formatMessage({ id: "hscode.toolCenter.title" })}
          </h2>
          <label className="relative block">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              aria-label={intl.formatMessage({
                id: "hscode.toolCenter.search",
              })}
              placeholder={intl.formatMessage({
                id: "hscode.toolCenter.search",
              })}
              className="h-9 w-full rounded-lg border border-input-border bg-input pl-9 pr-3 text-ui-base text-foreground placeholder:text-foreground-subtlest focus-visible:border-input-border-focused focus-visible:bg-input-focused focus-visible:outline-none"
              data-testid="hscode-tool-center-search"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={preferences.showHidden}
              onClick={() =>
                updatePreferences((current) => ({
                  ...current,
                  showHidden: !current.showHidden,
                }))
              }
            >
              {preferences.showHidden ? (
                <EyeOffIcon className="size-4" aria-hidden="true" />
              ) : (
                <EyeIcon className="size-4" aria-hidden="true" />
              )}
              {intl.formatMessage({ id: "hscode.toolCenter.showHidden" })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetPreferences}
            >
              <RotateCcwIcon className="size-4" aria-hidden="true" />
              {intl.formatMessage({ id: "hscode.toolCenter.reset" })}
            </Button>
          </div>

          <section className="min-w-0" aria-labelledby={builtinHeadingId}>
            <h3
              id={builtinHeadingId}
              className="mb-2 text-ui-base font-semibold text-foreground"
            >
              {intl.formatMessage({ id: "hscode.toolCenter.builtin" })}
            </h3>
            <div
              role="list"
              className="grid min-w-0 grid-cols-1 gap-1 @min-[36rem]/tool-center:grid-cols-2"
            >
              {sortedItems.map((item) => {
                const isPinned = preferences.pinnedIds.includes(item.id);
                const isHidden = preferences.hiddenIds.includes(item.id);
                const moveGroup = orderedForMoves.filter(
                  (candidate) =>
                    preferences.pinnedIds.includes(candidate.id) === isPinned,
                );
                const index = moveGroup.findIndex(
                  (candidate) => candidate.id === item.id,
                );
                const Icon = item.icon;
                const pinAction = intl.formatMessage({
                  id: isPinned
                    ? "hscode.toolCenter.unpin"
                    : "hscode.toolCenter.pin",
                });
                const visibilityAction = intl.formatMessage({
                  id: isHidden
                    ? "hscode.toolCenter.show"
                    : "hscode.toolCenter.hide",
                });
                return (
                  <div
                    key={item.id}
                    role="listitem"
                    data-testid={`hscode-tool-center-item-${item.id}`}
                    className="grid min-w-0 grid-cols-1 items-center gap-1 rounded-xl px-1 py-1 hover:bg-hover @min-[52rem]/tool-center:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <button
                      type="button"
                      data-side-pane-open-tab-item={item.id}
                      aria-label={item.label}
                      aria-description={item.description}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focused"
                      onClick={item.onOpen}
                      disabled={item.disabled}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface">
                        <Icon
                          className="size-5 text-foreground-subtle"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui-base font-semibold text-foreground">
                          {item.label}
                        </span>
                        <span className="block truncate text-ui-sm text-foreground-subtle">
                          {item.description}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center justify-end justify-self-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-md"
                        aria-label={`${pinAction}: ${item.label}`}
                        aria-pressed={isPinned}
                        title={pinAction}
                        onClick={() => pluginControls.onTogglePinned(item.id)}
                      >
                        <PinIcon className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-md"
                        aria-label={`${intl.formatMessage({ id: "hscode.toolCenter.moveUp" })}: ${item.label}`}
                        title={intl.formatMessage({
                          id: "hscode.toolCenter.moveUp",
                        })}
                        disabled={index <= 0}
                        onClick={() => moveBuiltin(item.id, -1)}
                      >
                        <ArrowUpIcon className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-md"
                        aria-label={`${intl.formatMessage({ id: "hscode.toolCenter.moveDown" })}: ${item.label}`}
                        title={intl.formatMessage({
                          id: "hscode.toolCenter.moveDown",
                        })}
                        disabled={index < 0 || index >= moveGroup.length - 1}
                        onClick={() => moveBuiltin(item.id, 1)}
                      >
                        <ArrowDownIcon className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-md"
                        aria-label={`${visibilityAction}: ${item.label}`}
                        title={visibilityAction}
                        onClick={() => pluginControls.onToggleHidden(item.id)}
                      >
                        {isHidden ? (
                          <EyeIcon className="size-4" aria-hidden="true" />
                        ) : (
                          <EyeOffIcon className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {renderPluginTools ? renderPluginTools(pluginControls) : null}
          {normalizedQuery && sortedItems.length === 0 && !renderPluginTools ? (
            <p className="text-ui-sm text-foreground-subtle">
              {intl.formatMessage({ id: "hscode.toolCenter.noResults" })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

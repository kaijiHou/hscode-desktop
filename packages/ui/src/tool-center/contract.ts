export const HSCODE_TOOL_CENTER_PREFERENCES_KEY =
  "hscode.tool-center.preferences.v1";
export const HSCODE_TOOL_CENTER_MAX_IDS = 128;
export const HSCODE_TOOL_CENTER_MAX_ID_LENGTH = 256;
export const HSCODE_TOOL_CENTER_MAX_PREFERENCES_BYTES = 16 * 1024;

export interface HscodeToolCenterPreferences {
  version: 1;
  pinnedIds: readonly string[];
  hiddenIds: readonly string[];
  builtinOrderIds: readonly string[];
  orderIds: readonly string[];
  showHidden: boolean;
}

export interface HscodeToolCenterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const EMPTY_IDS = Object.freeze([]) as readonly string[];
const DEFAULT_PREFERENCES: HscodeToolCenterPreferences = Object.freeze({
  version: 1,
  pinnedIds: EMPTY_IDS,
  hiddenIds: EMPTY_IDS,
  builtinOrderIds: EMPTY_IDS,
  orderIds: EMPTY_IDS,
  showHidden: false,
});

function byteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeIds(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > HSCODE_TOOL_CENTER_MAX_IDS)
    return null;

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of value) {
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      id.length > HSCODE_TOOL_CENTER_MAX_ID_LENGTH ||
      id.trim() !== id ||
      /\p{Cc}/u.test(id)
    ) {
      return null;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Reads only known preference fields; manifests and plugin content are never retained. */
export function normalizeHscodeToolCenterPreferences(
  value: unknown,
): HscodeToolCenterPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.showHidden !== "boolean")
    return null;

  const pinnedIds = normalizeIds(record.pinnedIds);
  const hiddenIds = normalizeIds(record.hiddenIds);
  const builtinOrderIds = normalizeIds(record.builtinOrderIds);
  const orderIds = normalizeIds(record.orderIds);
  if (!pinnedIds || !hiddenIds || !builtinOrderIds || !orderIds) return null;

  const preferences: HscodeToolCenterPreferences = {
    version: 1,
    pinnedIds,
    hiddenIds,
    builtinOrderIds,
    orderIds,
    showHidden: record.showHidden,
  };
  return byteLength(JSON.stringify(preferences)) <=
    HSCODE_TOOL_CENTER_MAX_PREFERENCES_BYTES
    ? preferences
    : null;
}

/** Returns null for malformed or oversized records; null input represents an intentional reset. */
export function parseHscodeToolCenterPreferences(
  raw: string | null,
): HscodeToolCenterPreferences | null {
  if (raw === null) return DEFAULT_PREFERENCES;
  if (byteLength(raw) > HSCODE_TOOL_CENTER_MAX_PREFERENCES_BYTES) return null;
  try {
    return normalizeHscodeToolCenterPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readHscodeToolCenterPreferences(
  storage: Pick<HscodeToolCenterStorage, "getItem">,
): HscodeToolCenterPreferences {
  try {
    return (
      parseHscodeToolCenterPreferences(
        storage.getItem(HSCODE_TOOL_CENTER_PREFERENCES_KEY),
      ) ?? DEFAULT_PREFERENCES
    );
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writeHscodeToolCenterPreferences(
  storage: Pick<HscodeToolCenterStorage, "setItem">,
  value: unknown,
): boolean {
  const preferences = normalizeHscodeToolCenterPreferences(value);
  if (!preferences) return false;
  try {
    const serialized = JSON.stringify(preferences);
    if (byteLength(serialized) > HSCODE_TOOL_CENTER_MAX_PREFERENCES_BYTES)
      return false;
    storage.setItem(HSCODE_TOOL_CENTER_PREFERENCES_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function resetHscodeToolCenterPreferences(
  storage: Pick<HscodeToolCenterStorage, "removeItem">,
): boolean {
  try {
    storage.removeItem(HSCODE_TOOL_CENTER_PREFERENCES_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createDefaultHscodeToolCenterPreferences(): HscodeToolCenterPreferences {
  return DEFAULT_PREFERENCES;
}

export function toggleHscodeToolCenterId(
  ids: readonly string[],
  id: string,
): string[] {
  return ids.includes(id)
    ? ids.filter((candidate) => candidate !== id)
    : [...ids, id];
}

export function moveHscodeToolCenterId(
  ids: readonly string[],
  id: string,
  direction: -1 | 1,
): string[] {
  const next = [...ids];
  let index = next.indexOf(id);
  if (index === -1) {
    index = direction === -1 ? 0 : next.length;
    next.splice(index, 0, id);
  }
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

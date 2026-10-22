import {
  createDefaultHscodeToolCenterPreferences,
  HSCODE_TOOL_CENTER_PREFERENCES_KEY,
  normalizeHscodeToolCenterPreferences,
  parseHscodeToolCenterPreferences,
  readHscodeToolCenterPreferences,
  resetHscodeToolCenterPreferences as removeStoredPreferences,
  writeHscodeToolCenterPreferences,
  type HscodeToolCenterPreferences,
} from "./contract.js";

type Listener = () => void;

const listeners = new Set<Listener>();
let snapshot: HscodeToolCenterPreferences | null = null;
let listeningForStorage = false;

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function getSnapshot(): HscodeToolCenterPreferences {
  if (!snapshot) {
    const storage = getStorage();
    snapshot = storage
      ? readHscodeToolCenterPreferences(storage)
      : createDefaultHscodeToolCenterPreferences();
  }
  return snapshot;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== HSCODE_TOOL_CENTER_PREFERENCES_KEY && event.key !== null)
    return;
  const storage = getStorage();
  if (event.storageArea && storage && event.storageArea !== storage) return;
  const next = parseHscodeToolCenterPreferences(
    event.key === null ? null : event.newValue,
  );
  if (!next) return;
  snapshot = next;
  notify();
}

export function subscribeHscodeToolCenterPreferences(
  listener: Listener,
): () => void {
  // No subscriber owns the cached snapshot. Refresh before the first listener is
  // attached so an inactive window observes writes made by another window.
  if (listeners.size === 0) snapshot = null;
  getSnapshot();
  listeners.add(listener);
  if (!listeningForStorage && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    listeningForStorage = true;
  }
  return () => {
    listeners.delete(listener);
    if (
      listeners.size === 0 &&
      listeningForStorage &&
      typeof window !== "undefined"
    ) {
      window.removeEventListener("storage", handleStorage);
      listeningForStorage = false;
    }
    if (listeners.size === 0) snapshot = null;
  };
}

export function getHscodeToolCenterPreferences(): HscodeToolCenterPreferences {
  return getSnapshot();
}

export function updateHscodeToolCenterPreferences(
  update: (current: HscodeToolCenterPreferences) => unknown,
): boolean {
  let next: unknown;
  try {
    next = update(getSnapshot());
  } catch {
    return false;
  }
  const normalized = normalizeHscodeToolCenterPreferences(next);
  if (!normalized) return false;
  const storage = getStorage();
  if (!storage || !writeHscodeToolCenterPreferences(storage, normalized))
    return false;
  snapshot = normalized;
  notify();
  return true;
}

export function resetHscodeToolCenterPreferenceStore(): boolean {
  const storage = getStorage();
  if (!storage || !removeStoredPreferences(storage)) return false;
  snapshot = createDefaultHscodeToolCenterPreferences();
  notify();
  return true;
}

export const HOME_BACKGROUND_KEY = "hscode-home-background-v1";
const CHANGE_EVENT = "hscode:home-background-changed";
const MAX_DATA_URL_LENGTH = 2 * 1024 * 1024;

export function normalizeHomeBackground(value: unknown): string | null {
  return typeof value === "string" &&
    value.length <= MAX_DATA_URL_LENGTH &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : null;
}

export function readHomeBackground(): string | null {
  try {
    return normalizeHomeBackground(window.localStorage.getItem(HOME_BACKGROUND_KEY));
  } catch {
    return null;
  }
}

export function saveHomeBackground(value: string | null): void {
  if (value !== null && normalizeHomeBackground(value) === null)
    throw new Error("invalid_background");
  // 先持久化再通知，配额/权限失败时保持原图和所有订阅投影不变。
  if (value === null) window.localStorage.removeItem(HOME_BACKGROUND_KEY);
  else window.localStorage.setItem(HOME_BACKGROUND_KEY, value);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeHomeBackground(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === HOME_BACKGROUND_KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

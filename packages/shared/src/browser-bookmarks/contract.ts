export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkSnapshot {
  revision: number;
  bookmarks: Bookmark[];
}

export interface BookmarkInput {
  id?: string;
  title: string;
  url: string;
  allowSensitiveUrl?: boolean;
}

export interface BookmarkPort {
  list(): Promise<BookmarkSnapshot>;
  save(input: BookmarkInput): Promise<BookmarkSnapshot>;
  remove(id: string): Promise<BookmarkSnapshot>;
  onChanged(listener: (snapshot: BookmarkSnapshot) => void): () => void;
}

export const BOOKMARK_TITLE_MAX_LENGTH = 200;
export const BOOKMARK_URL_MAX_LENGTH = 8192;
export const BOOKMARK_ID_MAX_LENGTH = 128;

/** Canonicalizes with the URL standard while retaining fragments and non-root trailing slashes. */
export function normalizeBookmarkUrl(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("Bookmark URL must be a string.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Bookmark URL must be an absolute HTTP or HTTPS URL without credentials.");
  }

  const schemeSeparator = value.indexOf("://");
  const inputAuthority =
    schemeSeparator < 0 ? "" : (value.slice(schemeSeparator + 3).split(/[/?#]/u, 1)[0] ?? "");
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    inputAuthority.includes("@")
  ) {
    throw new TypeError("Bookmark URL must be an absolute HTTP or HTTPS URL without credentials.");
  }
  return url.href;
}

const sensitiveQueryNames = new Set([
  "access_token",
  "apikey",
  "api_key",
  "auth",
  "authorization",
  "bearer",
  "client_secret",
  "credential",
  "credentials",
  "key",
  "password",
  "refresh_token",
  "secret",
  "session",
  "session_id",
  "signature",
  "sig",
  "token",
]);

/** Detects common credential-like query names without changing or returning their values. */
export function hasSensitiveBookmarkQuery(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  for (const key of url.searchParams.keys()) {
    const normalized = key
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[.\s-]+/g, "_")
      .toLowerCase();
    if (
      sensitiveQueryNames.has(normalized) ||
      /(?:^|_)(?:access|refresh|id)?_?token(?:_|$)/.test(normalized) ||
      /(?:^|_)api_?key(?:_|$)/.test(normalized) ||
      /(?:^|_)(?:auth|authorization|signature|secret|password|credential|session)(?:_|$)/.test(
        normalized,
      )
    ) {
      return true;
    }
  }
  return false;
}

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import {
  BOOKMARK_ID_MAX_LENGTH,
  BOOKMARK_TITLE_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
  hasSensitiveBookmarkQuery,
  normalizeBookmarkUrl,
  type Bookmark,
  type BookmarkInput,
  type BookmarkPort,
  type BookmarkSnapshot,
} from "@zcode/shared/browser-bookmarks";

export type BookmarkErrorCode =
  | "invalid-bookmark"
  | "invalid-url"
  | "sensitive-url-confirmation-required"
  | "duplicate-url"
  | "bookmark-not-found"
  | "invalid-storage"
  | "storage-unavailable";

const errorMessages: Record<BookmarkErrorCode, string> = {
  "invalid-bookmark": "Bookmark details are invalid.",
  "invalid-url": "Bookmark URL must be HTTP or HTTPS and must not contain credentials.",
  "sensitive-url-confirmation-required":
    "Explicit confirmation is required to save a URL with sensitive query parameters.",
  "duplicate-url": "Another bookmark already uses this URL.",
  "bookmark-not-found": "The bookmark no longer exists.",
  "invalid-storage": "Bookmark storage is invalid and was left unchanged.",
  "storage-unavailable": "Bookmark storage could not be accessed or saved.",
};

export class BookmarkServiceError extends Error {
  constructor(readonly code: BookmarkErrorCode) {
    super(errorMessages[code]);
    this.name = "BookmarkServiceError";
  }
}

/** The narrow filesystem seam exists so storage failures can be exercised deterministically. */
export interface BookmarkFileSystem {
  readFile(path: string): Promise<string>;
  mkdir(path: string): Promise<void>;
  writeFile(path: string, contents: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

const nodeBookmarkFileSystem: BookmarkFileSystem = {
  readFile: (path) => fs.readFile(path, "utf8"),
  mkdir: async (path) => {
    await fs.mkdir(path, { recursive: true });
  },
  writeFile: (path, contents) => fs.writeFile(path, contents, { encoding: "utf8", flag: "wx" }),
  rename: (oldPath, newPath) => fs.rename(oldPath, newPath),
  unlink: (path) => fs.unlink(path),
};

const storedBookmarkKeys = new Set(["id", "title", "url", "createdAt", "updatedAt"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}

function copySnapshot(snapshot: BookmarkSnapshot): BookmarkSnapshot {
  return {
    revision: snapshot.revision,
    bookmarks: snapshot.bookmarks.map((bookmark) => ({ ...bookmark })),
  };
}

function parseStoredSnapshot(value: unknown): BookmarkSnapshot {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !Array.isArray(value.bookmarks)
  ) {
    throw new BookmarkServiceError("invalid-storage");
  }

  const ids = new Set<string>();
  const urls = new Set<string>();
  const bookmarks: Bookmark[] = [];
  for (const item of value.bookmarks) {
    if (
      !isRecord(item) ||
      Object.keys(item).length !== storedBookmarkKeys.size ||
      Object.keys(item).some((key) => !storedBookmarkKeys.has(key)) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      item.id.length > BOOKMARK_ID_MAX_LENGTH ||
      typeof item.title !== "string" ||
      item.title.trim().length === 0 ||
      item.title.length > BOOKMARK_TITLE_MAX_LENGTH ||
      typeof item.url !== "string" ||
      item.url.length > BOOKMARK_URL_MAX_LENGTH ||
      typeof item.createdAt !== "number" ||
      !Number.isFinite(item.createdAt) ||
      item.createdAt < 0 ||
      typeof item.updatedAt !== "number" ||
      !Number.isFinite(item.updatedAt) ||
      item.updatedAt < 0
    ) {
      throw new BookmarkServiceError("invalid-storage");
    }

    let url: string;
    try {
      url = normalizeBookmarkUrl(item.url);
    } catch {
      throw new BookmarkServiceError("invalid-storage");
    }
    if (url.length > BOOKMARK_URL_MAX_LENGTH) throw new BookmarkServiceError("invalid-storage");
    if (ids.has(item.id) || urls.has(url)) throw new BookmarkServiceError("invalid-storage");
    ids.add(item.id);
    urls.add(url);
    bookmarks.push({
      id: item.id,
      title: item.title,
      url,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }
  return { revision: value.revision as number, bookmarks };
}

export class BookmarkService implements BookmarkPort {
  private snapshot: BookmarkSnapshot | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(snapshot: BookmarkSnapshot) => void>();

  constructor(
    private readonly filePath: string,
    private readonly fileSystem: BookmarkFileSystem = nodeBookmarkFileSystem,
  ) {}

  list(): Promise<BookmarkSnapshot> {
    return this.enqueue(async () => copySnapshot(await this.load()));
  }

  save(input: BookmarkInput): Promise<BookmarkSnapshot> {
    return this.enqueue(async () => {
      const current = await this.load();
      if (
        !isRecord(input) ||
        typeof input.title !== "string" ||
        input.title.trim().length === 0 ||
        input.title.length > BOOKMARK_TITLE_MAX_LENGTH ||
        typeof input.url !== "string" ||
        input.url.length > BOOKMARK_URL_MAX_LENGTH ||
        (input.id !== undefined &&
          (typeof input.id !== "string" ||
            input.id.length === 0 ||
            input.id.length > BOOKMARK_ID_MAX_LENGTH)) ||
        (input.allowSensitiveUrl !== undefined && typeof input.allowSensitiveUrl !== "boolean")
      ) {
        throw new BookmarkServiceError("invalid-bookmark");
      }

      let url: string;
      try {
        url = normalizeBookmarkUrl(input.url);
      } catch {
        throw new BookmarkServiceError("invalid-url");
      }
      if (url.length > BOOKMARK_URL_MAX_LENGTH) throw new BookmarkServiceError("invalid-url");
      if (hasSensitiveBookmarkQuery(url) && input.allowSensitiveUrl !== true) {
        throw new BookmarkServiceError("sensitive-url-confirmation-required");
      }

      const title = input.title.trim();
      const existingIndex = input.id
        ? current.bookmarks.findIndex((bookmark) => bookmark.id === input.id)
        : -1;
      if (input.id && existingIndex === -1) throw new BookmarkServiceError("bookmark-not-found");

      const duplicate = current.bookmarks.find((bookmark) => bookmark.url === url);
      if (!input.id && duplicate) return copySnapshot(current);
      if (duplicate && duplicate.id !== input.id) throw new BookmarkServiceError("duplicate-url");

      const now = Date.now();
      const bookmarks = [...current.bookmarks];
      if (existingIndex >= 0) {
        const existing = current.bookmarks[existingIndex]!;
        if (existing.title === title && existing.url === url) return copySnapshot(current);
        bookmarks[existingIndex] = { ...existing, title, url, updatedAt: now };
      } else {
        bookmarks.push({ id: randomUUID(), title, url, createdAt: now, updatedAt: now });
      }

      return this.commit({ revision: current.revision + 1, bookmarks });
    });
  }

  remove(id: string): Promise<BookmarkSnapshot> {
    return this.enqueue(async () => {
      const current = await this.load();
      if (typeof id !== "string" || id.length === 0 || id.length > BOOKMARK_ID_MAX_LENGTH) {
        throw new BookmarkServiceError("invalid-bookmark");
      }
      const index = current.bookmarks.findIndex((bookmark) => bookmark.id === id);
      if (index === -1) return copySnapshot(current);
      return this.commit({
        revision: current.revision + 1,
        bookmarks: current.bookmarks.filter((_, bookmarkIndex) => bookmarkIndex !== index),
      });
    });
  }

  onChanged(listener: (snapshot: BookmarkSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async load(): Promise<BookmarkSnapshot> {
    if (this.snapshot) return this.snapshot;
    let contents: string;
    try {
      contents = await this.fileSystem.readFile(this.filePath);
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) {
        this.snapshot = { revision: 0, bookmarks: [] };
        return this.snapshot;
      }
      throw new BookmarkServiceError("storage-unavailable");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new BookmarkServiceError("invalid-storage");
    }
    this.snapshot = parseStoredSnapshot(parsed);
    return this.snapshot;
  }

  private async commit(snapshot: BookmarkSnapshot): Promise<BookmarkSnapshot> {
    await this.persist(snapshot);
    this.snapshot = snapshot;
    const published = copySnapshot(snapshot);
    for (const listener of this.listeners) {
      try {
        listener(copySnapshot(published));
      } catch {
        // A renderer listener cannot undo a successfully persisted Main-process change.
      }
    }
    return copySnapshot(snapshot);
  }

  private async persist(snapshot: BookmarkSnapshot): Promise<void> {
    let contents: string;
    try {
      contents = `${JSON.stringify(
        {
          version: 1,
          revision: snapshot.revision,
          bookmarks: snapshot.bookmarks.map(({ id, title, url, createdAt, updatedAt }) => ({
            id,
            title,
            url,
            createdAt,
            updatedAt,
          })),
        },
        null,
        2,
      )}\n`;
    } catch {
      throw new BookmarkServiceError("storage-unavailable");
    }

    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await this.fileSystem.mkdir(dirname(this.filePath));
      await this.fileSystem.writeFile(temporaryPath, contents);
      await this.fileSystem.rename(temporaryPath, this.filePath);
    } catch {
      try {
        await this.fileSystem.unlink(temporaryPath);
      } catch {
        // Cleanup is best effort; the original file is not touched unless rename succeeds.
      }
      throw new BookmarkServiceError("storage-unavailable");
    }
  }
}

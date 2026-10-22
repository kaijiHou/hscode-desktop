import {
  normalizeBookmarkUrl,
  type Bookmark,
  type BookmarkSnapshot,
} from "@zcode/shared/browser-bookmarks";

export function acceptBookmarkSnapshot(
  current: BookmarkSnapshot,
  next: BookmarkSnapshot,
): BookmarkSnapshot {
  return next.revision >= current.revision ? next : current;
}

export function bookmarkAtUrl(snapshot: BookmarkSnapshot, actualUrl: string): Bookmark | undefined {
  try {
    const normalized = normalizeBookmarkUrl(actualUrl);
    return snapshot.bookmarks.find((bookmark) => bookmark.url === normalized);
  } catch {
    return undefined;
  }
}

export function filterBookmarks(bookmarks: Bookmark[], query: string): Bookmark[] {
  const needle = query.trim().toLocaleLowerCase();
  return bookmarks.filter((bookmark) =>
    `${bookmark.title}\n${bookmark.url}`.toLocaleLowerCase().includes(needle),
  );
}

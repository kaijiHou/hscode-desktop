import type { BookmarkSnapshot } from "@zcode/shared/browser-bookmarks";
import { acceptBookmarkSnapshot, bookmarkAtUrl } from "./contract.js";

export function projectCurrentPage(snapshot: BookmarkSnapshot, actualUrl: string) {
  return bookmarkAtUrl(acceptBookmarkSnapshot(snapshot, snapshot), actualUrl);
}

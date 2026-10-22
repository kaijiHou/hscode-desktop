import { describe, expect, it } from "vitest";
import { acceptBookmarkSnapshot, bookmarkAtUrl, filterBookmarks } from "./contract.js";

const bookmark = {
  id: "one",
  title: "Docs",
  url: "https://example.com/guide#start",
  createdAt: 1,
  updatedAt: 1,
};
const snapshot = { revision: 2, bookmarks: [bookmark] };
describe("bookmark UI projection", () => {
  it("rejects late snapshots without overwriting a newer window event", () => {
    expect(acceptBookmarkSnapshot(snapshot, { revision: 1, bookmarks: [] })).toBe(snapshot);
  });
  it("matches actual navigation URL and preserves fragment meaning", () => {
    expect(bookmarkAtUrl(snapshot, "HTTPS://EXAMPLE.COM:443/guide#start")).toBe(bookmark);
    expect(bookmarkAtUrl(snapshot, "https://example.com/guide#other")).toBeUndefined();
    expect(bookmarkAtUrl(snapshot, "javascript:alert(1)")).toBeUndefined();
    expect(bookmarkAtUrl(snapshot, "about:blank")).toBeUndefined();
  });
  it("searches both title and URL without fetching site metadata", () => {
    expect(filterBookmarks([bookmark], " DOCS ")).toEqual([bookmark]);
    expect(filterBookmarks([bookmark], "example.com")).toEqual([bookmark]);
    expect(filterBookmarks([bookmark], "missing")).toEqual([]);
  });
});

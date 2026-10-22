import type { BookmarkPort } from "./contract.js";

export async function loadBrowserBookmarks(port: BookmarkPort) {
  return port.list();
}

export const exampleBookmarkInput = {
  title: "Project home",
  url: "https://example.com/projects#overview",
} as const;

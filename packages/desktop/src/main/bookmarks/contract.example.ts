import type { BookmarkPort } from "./contract.js";

export async function readBookmarks(port: BookmarkPort) {
  return port.list();
}

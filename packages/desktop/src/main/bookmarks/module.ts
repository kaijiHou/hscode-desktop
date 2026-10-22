/** Main-process persistence adapter; its root/layer are registered by the architecture owner. */
export const desktopBookmarksModule = {
  id: "desktop-bookmarks",
  requires: ["browser-bookmarks-contract"],
  provides: ["desktop-bookmarks"],
  publicEntrypoints: ["contract.ts"],
} as const;

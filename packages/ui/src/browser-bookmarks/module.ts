export const browserBookmarksUiModule = {
  id: "browser-bookmarks-ui",
  requires: ["browser-bookmarks-contract", "ui"],
  provides: ["browser-bookmarks-controls"],
  publicEntrypoints: ["contract.ts"],
} as const;

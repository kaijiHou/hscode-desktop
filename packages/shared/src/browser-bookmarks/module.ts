/** Shared browser bookmark contract; its root/layer are registered by the architecture owner. */
export const browserBookmarksContractModule = {
  id: "browser-bookmarks-contract",
  requires: [],
  provides: ["browser-bookmarks"],
  publicEntrypoints: ["contract.ts"],
} as const;

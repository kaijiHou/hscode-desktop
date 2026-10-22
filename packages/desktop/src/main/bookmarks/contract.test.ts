import { describe, expect, it } from "vitest";
import type { BookmarkPort, BookmarkSnapshot } from "./contract.js";

describe("desktop bookmark port contract", () => {
  it("provides snapshots and an unsubscribe function for change listeners", async () => {
    const snapshot: BookmarkSnapshot = { revision: 0, bookmarks: [] };
    const port: BookmarkPort = {
      list: async () => snapshot,
      save: async () => snapshot,
      remove: async () => snapshot,
      onChanged: () => () => undefined,
    };

    expect(await port.list()).toEqual(snapshot);
    expect(port.onChanged(() => undefined)).toEqual(expect.any(Function));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformChannels } from "@zcode/shared";

type Handler = (...args: unknown[]) => unknown;
const h = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  fromWebContents: vi.fn(),
  getAllWindows: vi.fn(),
}));
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: h.fromWebContents, getAllWindows: h.getAllWindows },
  ipcMain: { handle: (channel: string, handler: Handler) => h.handlers.set(channel, handler) },
}));
vi.mock("../src/main/browserDataManager.js", () => ({
  clearEmbeddedBrowserData: vi.fn(),
  importChromeBrowserData: vi.fn(),
}));
vi.mock("../src/main/embeddedBrowserSitePermissions.js", () => ({
  clearEmbeddedBrowserSitePermissions: vi.fn(),
  getEmbeddedBrowserSitePermissionSnapshot: vi.fn(),
  removeEmbeddedBrowserSitePermission: vi.fn(),
  removeEmbeddedBrowserSitePermissionOrigin: vi.fn(),
  writeEmbeddedBrowserSitePermission: vi.fn(),
}));
import { registerBookmarkIpcHandlers } from "../src/main/desktopBrowserDataIpc.js";

describe("bookmark IPC authority", () => {
  beforeEach(() => {
    h.handlers.clear();
    vi.clearAllMocks();
  });
  function setup() {
    const mainFrame = {};
    const sender = { mainFrame, isDestroyed: () => false, send: vi.fn() };
    const win = { id: 1, isDestroyed: () => false, webContents: sender };
    const second = {
      id: 2,
      isDestroyed: () => false,
      webContents: { isDestroyed: () => false, send: vi.fn() },
    };
    const auxiliary = {
      id: 3,
      isDestroyed: () => false,
      webContents: { isDestroyed: () => false, send: vi.fn() },
    };
    h.fromWebContents.mockReturnValue(win);
    h.getAllWindows.mockReturnValue([win, second, auxiliary]);
    const snapshot = { revision: 1, bookmarks: [] };
    const service = {
      list: vi.fn().mockResolvedValue(snapshot),
      save: vi.fn().mockResolvedValue(snapshot),
      remove: vi.fn().mockResolvedValue(snapshot),
    };
    registerBookmarkIpcHandlers(
      service,
      new Map([
        [1, new Set<string>()],
        [2, new Set<string>()],
      ]),
    );
    return {
      sender,
      win,
      second,
      auxiliary,
      service,
      snapshot,
      event: { sender, senderFrame: mainFrame },
    };
  }
  it("returns reads without exposing arbitrary filesystem access", async () => {
    const { service, event, snapshot } = setup();
    expect(await h.handlers.get(PlatformChannels.BookmarksList)?.(event)).toEqual(snapshot);
    expect(service.list).toHaveBeenCalledExactlyOnceWith();
  });
  it("broadcasts committed snapshots to application windows only", async () => {
    const { event, sender, second, auxiliary, snapshot } = setup();
    await h.handlers.get(PlatformChannels.BookmarksSave)?.(event, {
      title: "Docs",
      url: "https://example.com/",
    });
    expect(sender.send).toHaveBeenCalledWith(PlatformChannels.BookmarksChanged, snapshot);
    expect(second.webContents.send).toHaveBeenCalledWith(
      PlatformChannels.BookmarksChanged,
      snapshot,
    );
    expect(auxiliary.webContents.send).not.toHaveBeenCalled();
  });
  it("rejects guest, subframe and unregistered-window reads", () => {
    const { event, win, service } = setup();
    const list = h.handlers.get(PlatformChannels.BookmarksList)!;
    expect(() => list({ ...event, senderFrame: {} })).toThrow("application window");
    expect(() => list({ ...event, sender: { mainFrame: event.senderFrame } })).toThrow(
      "application window",
    );
    h.fromWebContents.mockReturnValue({ ...win, id: 999 });
    expect(() => list(event)).toThrow("application window");
    expect(service.list).not.toHaveBeenCalled();
  });
  it("does not broadcast a failed mutation or log its URL", async () => {
    const { event, service, sender } = setup();
    service.save.mockRejectedValue(new Error("Bookmark write failed"));
    await expect(
      h.handlers.get(PlatformChannels.BookmarksSave)?.(event, {
        title: "Docs",
        url: "https://example.com/",
      }),
    ).rejects.toThrow("Bookmark write failed");
    expect(sender.send).not.toHaveBeenCalled();
  });
});

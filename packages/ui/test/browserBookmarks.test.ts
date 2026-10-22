// @vitest-environment jsdom
import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BookmarkInput,
  BookmarkPort,
  BookmarkSnapshot,
} from "@zcode/shared/browser-bookmarks";

const h = vi.hoisted(() => ({ platform: {} as { bookmarks?: BookmarkPort } }));
vi.mock("@/hooks/usePlatform.js", () => ({ usePlatform: () => h.platform }));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({ intl: { formatMessage: ({ id }: { id: string }) => id } }),
}));
import { BrowserBookmarksControl } from "@/browser-bookmarks/contract.js";
import { useBookmarks } from "@/browser-bookmarks/useBookmarks.js";

const bookmark = {
  id: "one",
  title: "Example Docs",
  url: "https://example.com/guide",
  createdAt: 1,
  updatedAt: 1,
};
const label = (key: string) => `browser.bookmarks.${key}`;
let snapshot: BookmarkSnapshot;
let listeners: Set<(next: BookmarkSnapshot) => void>;
let port: BookmarkPort;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  snapshot = { revision: 1, bookmarks: [bookmark] };
  listeners = new Set();
  port = {
    list: vi.fn(async () => snapshot),
    save: vi.fn(async (input: BookmarkInput) => ({
      revision: 2,
      bookmarks: [{ ...bookmark, ...input }],
    })),
    remove: vi.fn(async () => ({ revision: 2, bookmarks: [] })),
    onChanged: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  h.platform = { bookmarks: port };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("bookmark interface", () => {
  it("updates the star for navigation, redirect and back/forward projections", async () => {
    const props = { currentUrl: bookmark.url, title: bookmark.title, onOpenCurrent: vi.fn() };
    const view = render(createElement(BrowserBookmarksControl, props));
    await waitFor(() =>
      expect(screen.getByTestId("browser-bookmark-star").getAttribute("aria-pressed")).toBe("true"),
    );
    view.rerender(
      createElement(BrowserBookmarksControl, { ...props, currentUrl: "https://example.com/other" }),
    );
    expect(screen.getByTestId("browser-bookmark-star").getAttribute("aria-pressed")).toBe("false");
    view.rerender(createElement(BrowserBookmarksControl, props));
    expect(screen.getByTestId("browser-bookmark-star").getAttribute("aria-pressed")).toBe("true");
    view.rerender(createElement(BrowserBookmarksControl, { ...props, currentUrl: "about:blank" }));
    expect((screen.getByTestId("browser-bookmark-star") as HTMLButtonElement).disabled).toBe(true);
  });
  it("opens via existing current/new-tab callbacks and supports search", async () => {
    const onOpenCurrent = vi.fn(),
      onOpenNew = vi.fn();
    render(
      createElement(BrowserBookmarksControl, {
        currentUrl: bookmark.url,
        title: bookmark.title,
        onOpenCurrent,
        onOpenNew,
      }),
    );
    await waitFor(() =>
      expect((screen.getByTestId("browser-bookmark-star") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByTestId("browser-bookmark-manager"));
    fireEvent.change(screen.getByTestId("browser-bookmark-search"), {
      target: { value: "not-found" },
    });
    expect(screen.queryByText(bookmark.title)).toBeNull();
    fireEvent.change(screen.getByTestId("browser-bookmark-search"), { target: { value: "docs" } });
    fireEvent.click(screen.getByText(label("openNew")));
    expect(onOpenNew).toHaveBeenCalledWith(bookmark.url);
    fireEvent.click(screen.getByTestId("browser-bookmark-manager"));
    fireEvent.click(screen.getByText(label("openCurrent")));
    expect(onOpenCurrent).toHaveBeenCalledWith(bookmark.url);
  });
  it("requires confirmation for list deletion", async () => {
    render(
      createElement(BrowserBookmarksControl, {
        currentUrl: bookmark.url,
        title: bookmark.title,
        onOpenCurrent: vi.fn(),
      }),
    );
    await waitFor(() =>
      expect((screen.getByTestId("browser-bookmark-star") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByTestId("browser-bookmark-manager"));
    fireEvent.click(screen.getByLabelText(label("delete")));
    expect(port.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("group", { name: label("confirmDelete") })).getByRole("button", {
        name: label("delete"),
        exact: true,
      }),
    );
    await waitFor(() => expect(port.remove).toHaveBeenCalledWith(bookmark.id));
  });
  it("does not silently save token queries and resets consent on URL edits", async () => {
    render(
      createElement(BrowserBookmarksControl, {
        currentUrl: "https://example.com/?token=example-only",
        title: "Example",
        onOpenCurrent: vi.fn(),
      }),
    );
    await waitFor(() =>
      expect((screen.getByTestId("browser-bookmark-star") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByTestId("browser-bookmark-star"));
    expect(port.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("browser-bookmark-save"));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      label("sensitiveConfirmation"),
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByTestId("browser-bookmark-url"), {
      target: { value: "https://example.com/?api_key=example-only" },
    });
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByTestId("browser-bookmark-save"));
    await waitFor(() =>
      expect(port.save).toHaveBeenCalledWith(expect.objectContaining({ allowSensitiveUrl: true })),
    );
  });
  it("keeps failed edits visible and hides raw IPC errors", async () => {
    vi.mocked(port.save).mockRejectedValue(new Error("private detail must not be rendered"));
    render(
      createElement(BrowserBookmarksControl, {
        currentUrl: bookmark.url,
        title: bookmark.title,
        onOpenCurrent: vi.fn(),
      }),
    );
    await waitFor(() =>
      expect((screen.getByTestId("browser-bookmark-star") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByTestId("browser-bookmark-manager"));
    fireEvent.click(screen.getByLabelText(label("edit")));
    fireEvent.click(screen.getByTestId("browser-bookmark-save"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(label("error")));
    expect((screen.getByTestId("browser-bookmark-title") as HTMLInputElement).value).toBe(
      bookmark.title,
    );
    expect(screen.queryByText("private detail must not be rendered")).toBeNull();
  });
  it("rejects stale reads and synchronizes two window projections", async () => {
    let resolveRead!: (value: BookmarkSnapshot) => void;
    vi.mocked(port.list).mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );
    const first = renderHook(() => useBookmarks());
    const second = renderHook(() => useBookmarks());
    const newer = { revision: 3, bookmarks: [bookmark] };
    act(() => {
      for (const listener of listeners) listener(newer);
    });
    await act(async () => resolveRead({ revision: 1, bookmarks: [] }));
    expect(first.result.current.snapshot).toEqual(newer);
    expect(second.result.current.snapshot).toEqual(newer);
    first.unmount();
    second.unmount();
    expect(listeners.size).toBe(0);
  });
});

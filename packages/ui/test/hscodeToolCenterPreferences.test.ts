// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultHscodeToolCenterPreferences,
  HSCODE_TOOL_CENTER_PREFERENCES_KEY,
} from "@/tool-center/contract.js";
import {
  getHscodeToolCenterPreferences,
  resetHscodeToolCenterPreferenceStore,
  subscribeHscodeToolCenterPreferences,
  updateHscodeToolCenterPreferences,
} from "@/tool-center/preferencesStore.js";

describe("hscode-tool-center preference owner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetHscodeToolCenterPreferenceStore();
  });

  it("projects valid storage events from other windows and ignores malformed values", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHscodeToolCenterPreferences(listener);
    const external = {
      ...createDefaultHscodeToolCenterPreferences(),
      pinnedIds: ["builtin:browser"],
    };
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: HSCODE_TOOL_CENTER_PREFERENCES_KEY,
        newValue: JSON.stringify(external),
      }),
    );
    const accepted = getHscodeToolCenterPreferences();
    expect(accepted.pinnedIds).toEqual(["builtin:browser"]);
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: HSCODE_TOOL_CENTER_PREFERENCES_KEY,
        newValue: "{broken",
      }),
    );
    expect(getHscodeToolCenterPreferences()).toBe(accepted);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("publishes same-window changes only after storage succeeds", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHscodeToolCenterPreferences(listener);
    expect(
      updateHscodeToolCenterPreferences((current) => ({
        ...current,
        hiddenIds: ["builtin:files"],
      })),
    ).toBe(true);
    const beforeFailure = getHscodeToolCenterPreferences();
    expect(listener).toHaveBeenCalledTimes(1);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(
      updateHscodeToolCenterPreferences((current) => ({
        ...current,
        hiddenIds: ["builtin:browser"],
      })),
    ).toBe(false);
    expect(getHscodeToolCenterPreferences()).toBe(beforeFailure);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("refreshes storage after the last subscriber unmounts and another window writes", () => {
    const unsubscribeFirst = subscribeHscodeToolCenterPreferences(vi.fn());
    unsubscribeFirst();
    window.localStorage.setItem(
      HSCODE_TOOL_CENTER_PREFERENCES_KEY,
      JSON.stringify({
        ...createDefaultHscodeToolCenterPreferences(),
        pinnedIds: ["builtin:browser"],
      }),
    );

    const unsubscribeSecond = subscribeHscodeToolCenterPreferences(vi.fn());
    expect(getHscodeToolCenterPreferences().pinnedIds).toEqual([
      "builtin:browser",
    ]);
    unsubscribeSecond();
  });

  it("treats a native storage clear event as a reset to defaults", () => {
    expect(
      updateHscodeToolCenterPreferences((current) => ({
        ...current,
        pinnedIds: ["builtin:browser"],
      })),
    ).toBe(true);
    const listener = vi.fn();
    const unsubscribe = subscribeHscodeToolCenterPreferences(listener);

    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: null,
        newValue: null,
        storageArea: window.localStorage,
      }),
    );

    expect(getHscodeToolCenterPreferences()).toEqual(
      createDefaultHscodeToolCenterPreferences(),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

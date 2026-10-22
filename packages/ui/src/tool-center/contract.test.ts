import { describe, expect, it } from "vitest";
import {
  createDefaultHscodeToolCenterPreferences,
  HSCODE_TOOL_CENTER_MAX_IDS,
  HSCODE_TOOL_CENTER_MAX_PREFERENCES_BYTES,
  HSCODE_TOOL_CENTER_PREFERENCES_KEY,
  normalizeHscodeToolCenterPreferences,
  readHscodeToolCenterPreferences,
  resetHscodeToolCenterPreferences,
  writeHscodeToolCenterPreferences,
  type HscodeToolCenterStorage,
} from "./contract.js";
import { hscodeToolCenterModule } from "./module.js";

function createMemoryStorage(initial: string | null = null) {
  let value = initial;
  const storage: HscodeToolCenterStorage = {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    removeItem: () => {
      value = null;
    },
  };
  return {
    storage,
    get value() {
      return value;
    },
  };
}

describe("hscode-tool-center contract", () => {
  it("declares the managed module", () => {
    expect(hscodeToolCenterModule.id).toBe("hscode-tool-center");
  });

  it("accepts only bounded entry IDs and known presentation fields", () => {
    const valid = {
      ...createDefaultHscodeToolCenterPreferences(),
      pinnedIds: ["builtin:files"],
      hiddenIds: [],
      builtinOrderIds: ["builtin:files"],
      orderIds: ["plugin-ui:excalidraw/excalidraw"],
      showHidden: true,
      pluginManifest: { secret: "must not persist" },
    };
    expect(normalizeHscodeToolCenterPreferences(valid)).toEqual({
      version: 1,
      pinnedIds: ["builtin:files"],
      hiddenIds: [],
      builtinOrderIds: ["builtin:files"],
      orderIds: ["plugin-ui:excalidraw/excalidraw"],
      showHidden: true,
    });
    expect(
      normalizeHscodeToolCenterPreferences({
        ...valid,
        hiddenIds: ["invalid\nentry"],
      }),
    ).toBeNull();
    expect(
      normalizeHscodeToolCenterPreferences({
        ...valid,
        orderIds: Array.from(
          { length: HSCODE_TOOL_CENTER_MAX_IDS + 1 },
          (_, i) => `id-${i}`,
        ),
      }),
    ).toBeNull();
  });

  it("rejects preference records larger than 16 KiB", () => {
    const oversizedIds = Array.from(
      { length: HSCODE_TOOL_CENTER_MAX_IDS },
      (_, index) => `${String(index).padStart(3, "0")}-${"x".repeat(250)}`,
    );
    expect(
      normalizeHscodeToolCenterPreferences({
        version: 1,
        pinnedIds: oversizedIds,
        hiddenIds: oversizedIds,
        builtinOrderIds: oversizedIds,
        orderIds: oversizedIds,
        showHidden: false,
      }),
    ).toBeNull();
    expect(HSCODE_TOOL_CENTER_MAX_PREFERENCES_BYTES).toBe(16 * 1024);
  });

  it("reads corrupt records as defaults without overwriting them", () => {
    const memory = createMemoryStorage("{broken");
    expect(readHscodeToolCenterPreferences(memory.storage)).toEqual(
      createDefaultHscodeToolCenterPreferences(),
    );
    expect(memory.value).toBe("{broken");
  });

  it("writes only the validated preference projection and can reset it", () => {
    const memory = createMemoryStorage();
    expect(
      writeHscodeToolCenterPreferences(memory.storage, {
        ...createDefaultHscodeToolCenterPreferences(),
        pinnedIds: ["builtin:files"],
        manifest: { content: "not persisted" },
      }),
    ).toBe(true);
    expect(memory.value).toBeTruthy();
    expect(JSON.parse(memory.value ?? "null")).toEqual({
      version: 1,
      pinnedIds: ["builtin:files"],
      hiddenIds: [],
      builtinOrderIds: [],
      orderIds: [],
      showHidden: false,
    });
    expect(resetHscodeToolCenterPreferences(memory.storage)).toBe(true);
    expect(memory.value).toBeNull();
    expect(HSCODE_TOOL_CENTER_PREFERENCES_KEY).toBe(
      "hscode.tool-center.preferences.v1",
    );
  });

  it("preserves the previous record when storage writes or reset fail", () => {
    const memory = createMemoryStorage("existing");
    const brokenStorage: HscodeToolCenterStorage = {
      ...memory.storage,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("read only");
      },
    };
    expect(
      writeHscodeToolCenterPreferences(
        brokenStorage,
        createDefaultHscodeToolCenterPreferences(),
      ),
    ).toBe(false);
    expect(resetHscodeToolCenterPreferences(brokenStorage)).toBe(false);
    expect(memory.value).toBe("existing");
  });
});

// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => {
  const surface = {
    pluginId: "excalidraw@zcode-plugins-official",
    pluginName: "excalidraw",
    id: "canvas",
    title: "Canvas",
    server: "plugin:excalidraw:main",
    resourceUri: "ui://excalidraw/canvas.html",
    availability: "session" as const,
  };
  const state = {
    workspacePath: "D:/fixture",
    workspaceIdentity: null as string | null,
    loading: false,
    marketplaceAvailabilityKnown: true,
    marketplaces: [] as { id: string; lastUpdated?: string }[],
    error: null as string | null,
    updateMarketplace: vi.fn(async () => true),
    initialize: vi.fn(async () => {}),
  };
  const store = Object.assign(() => state, { getState: () => state });
  const bridge = { listSurfaces: vi.fn(async () => [surface]) };
  const services = { pluginManagementService: {}, pluginUiBridgeService: bridge };
  return { surface, state, store, services, bridge, navigate: vi.fn(), toast: vi.fn() };
});

vi.mock("@/hooks/useServices.js", () => ({ useServices: () => fixtures.services }));
vi.mock("@/hooks/usePlatform.js", () => ({ useOptionalPlatform: () => ({ pluginSandbox: {} }) }));
vi.mock("@/store/pluginManagementStore.js", () => ({
  useScopedPluginManagementStore: () => fixtures.store,
}));
vi.mock("@/settings/pluginStoreListing.js", () => ({
  buildStoreItems: () => [
    {
      id: fixtures.surface.pluginId,
      name: "excalidraw",
      marketplace: "zcode-plugins-official",
      installed: true,
      info: { enabled: true, uiSurfaces: [fixtures.surface] },
    },
  ],
  canUpdatePluginItem: () => true,
  isItemBusy: () => false,
  resolveItemDisplayName: () => "Excalidraw",
  resolveItemDescription: () => "Drawing",
}));
vi.mock("@/settings/PluginStoreAvatar.js", () => ({ PluginStoreAvatar: () => null }));
vi.mock("@/lib/pluginStoreNavigation.js", () => ({ requestPluginStoreOpen: fixtures.navigate }));
vi.mock("@/components/ui/toast.js", () => ({ toast: fixtures.toast }));
vi.mock("@/plugin-ui/adapters/usePluginUiSurfaces.js", () => ({
  usePluginUiSurfaceSnapshot: () => ({ status: "ready", surfaces: [fixtures.surface] }),
  resolvePluginUiSurfaceTitle: (title: string) => title,
}));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({
    locale: "en-US",
    intl: { formatMessage: ({ id }: { id: string }) => id },
  }),
}));

import { HscodePluginTools } from "@/plugin-ui/components/HscodePluginTools.js";
import { resetMarketplaceAutoRefreshForTests } from "@/settings/officialMarketplaceAutoRefresh.js";

const baseProps = { workspacePath: "D:/fixture", sessionId: "A", onOpenPluginUi: vi.fn() };
const openButton = () => screen.getByRole("button", { name: /^Excalidraw/ });

beforeEach(() => {
  fixtures.state.workspacePath = "D:/fixture";
  fixtures.state.marketplaces = [];
  resetMarketplaceAutoRefreshForTests();
  fixtures.services.pluginUiBridgeService = fixtures.bridge;
  fixtures.bridge.listSurfaces.mockReset().mockResolvedValue([fixtures.surface]);
  baseProps.onOpenPluginUi.mockReset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HSCode plugin tools context admission", () => {
  it("refreshes only the official catalog through the existing throttled action", async () => {
    fixtures.state.marketplaces = [{ id: "zcode-plugins-official" }, { id: "personal" }];
    const view = render(createElement(HscodePluginTools, baseProps));
    await waitFor(() => expect(fixtures.state.updateMarketplace).toHaveBeenCalledOnce());
    expect(fixtures.state.updateMarketplace).toHaveBeenCalledWith(
      "zcode-plugins-official",
      fixtures.services.pluginManagementService,
    );
    view.rerender(createElement(HscodePluginTools, { ...baseProps, sessionId: "B" }));
    expect(fixtures.state.updateMarketplace).toHaveBeenCalledOnce();
    expect(fixtures.navigate).not.toHaveBeenCalled();
  });
  it("opens the real surface with an optional update, without installing anything", async () => {
    render(createElement(HscodePluginTools, baseProps));
    await waitFor(() => expect(openButton().hasAttribute("disabled")).toBe(false));
    fireEvent.click(openButton());
    await waitFor(() => expect(baseProps.onOpenPluginUi).toHaveBeenCalledOnce());
    expect(baseProps.onOpenPluginUi).toHaveBeenCalledWith(
      expect.objectContaining({
        parentSessionId: "A",
        pluginId: fixtures.surface.pluginId,
        surfaceId: "canvas",
        resourceUri: fixtures.surface.resourceUri,
      }),
    );
    expect(fixtures.navigate).not.toHaveBeenCalled();
  });

  it("does not create a fake session from the draft screen", async () => {
    render(createElement(HscodePluginTools, { ...baseProps, sessionId: null }));
    await waitFor(() =>
      expect(openButton().textContent).toContain("hscode.toolCenter.createTaskFirst"),
    );
    expect(openButton().hasAttribute("disabled")).toBe(true);
    fireEvent.click(openButton());
    expect(fixtures.bridge.listSurfaces).not.toHaveBeenCalled();
    expect(baseProps.onOpenPluginUi).not.toHaveBeenCalled();
  });

  it.each(["session-roundtrip", "bridge-replacement", "unmount"] as const)(
    "rejects an old open result after %s",
    async (transition) => {
      let resolveOld!: (surfaces: (typeof fixtures.surface)[]) => void;
      fixtures.bridge.listSurfaces.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      );
      const view = render(createElement(HscodePluginTools, baseProps));
      await waitFor(() => expect(openButton().hasAttribute("disabled")).toBe(false));
      fireEvent.click(openButton());
      expect(fixtures.bridge.listSurfaces).toHaveBeenCalledOnce();
      if (transition === "session-roundtrip") {
        view.rerender(createElement(HscodePluginTools, { ...baseProps, sessionId: "B" }));
        view.rerender(createElement(HscodePluginTools, baseProps));
      } else if (transition === "bridge-replacement") {
        fixtures.services.pluginUiBridgeService = {
          listSurfaces: vi.fn(async () => [fixtures.surface]),
        };
        view.rerender(createElement(HscodePluginTools, baseProps));
      } else view.unmount();
      await act(async () => {
        resolveOld([fixtures.surface]);
      });
      expect(baseProps.onOpenPluginUi).not.toHaveBeenCalled();
      expect(fixtures.toast).not.toHaveBeenCalled();
    },
  );
});

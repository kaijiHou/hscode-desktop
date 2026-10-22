import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/settings/CodingPlanEntryButton.js", () => ({
  useCodingPlanEntryGate: () => ({ status: "ready" }),
}));
vi.mock("@/i18n/IntlProvider.js", () => ({
  useZCodeIntl: () => ({ intl: { formatMessage: ({ id }: { id: string }) => id } }),
}));
vi.mock("@/components/ui/dropdown-menu.js", () => ({
  DropdownMenuItem: ({ children, ...props }: ComponentProps<"div">) =>
    createElement("div", props, children),
  DropdownMenuSeparator: () => null,
}));

import { WorkspaceSidebarFooterUsageSummaryContent } from "@/WorkspaceSidebarFooterUsageSummary.js";

it("hides only the promotional upgrade action in HSCode mode", () => {
  const state = {
    providerEntitlements: [],
    upgradeTargetProviderId: "account:bigmodel-start-plan",
  } as never;
  const render = (showUpgradeAction: boolean) =>
    renderToStaticMarkup(
      createElement(WorkspaceSidebarFooterUsageSummaryContent, {
        state,
        showUpgradeAction,
      }),
    );

  const official = render(true);
  const hscode = render(false);
  expect(official).toContain('data-testid="sidebar-coding-plan-upgrade-button"');
  expect(hscode).not.toContain('data-testid="sidebar-coding-plan-upgrade-button"');
  expect(hscode).toContain('data-testid="sidebar-coding-plan-usage-button"');
});

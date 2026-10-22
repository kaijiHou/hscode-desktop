import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

it("真实入口 JSX 在匿名时不渲染，登录后展示邀请好友和奖励徽标", async () => {
  const source = await readFile("packages/ui/src/WorkspaceSidebarFooter.tsx", "utf8");
  const end = source.indexOf("{onLogin && !user");
  const start = source.lastIndexOf("{user && !IS_HSCODE_BUILD ? (", end);
  const expression = source.slice(start, end).trim().slice(1, -1);
  const script = ts.transpileModule(`const result = (${expression}); result;`, {
    compilerOptions: { jsx: ts.JsxEmit.React },
    fileName: "entry.tsx",
  }).outputText;
  const render = (user: object | null, IS_HSCODE_BUILD: boolean) =>
    renderToStaticMarkup(
      runInNewContext(script, {
        React,
        user,
        IS_HSCODE_BUILD,
        DropdownMenuItem: "div",
        Gift: "svg",
        Badge: "span",
        intl: { formatMessage: ({ id }: { id: string }) => id },
        openRewards: () => {},
      }),
    );
  expect(render(null, false)).toBe("");
  expect(render({ id: "test-user" }, false)).toContain('data-testid="rewards-menu-item"');
  expect(render({ id: "test-user" }, false)).toContain('data-testid="rewards-reward-badge"');
  expect(render({ id: "test-user" }, true)).toBe("");
});

import { expect, test } from "bun:test"
import { isDebugToolsEnabled } from "./debug-tools"

test.each([
  ["dev", undefined, true],
  ["beta", undefined, false],
  ["prod", undefined, false],
  ["dev", "1", false],
] as const)("debug tools channel=%s disabled=%s => %s", (channel, disabled, expected) => {
  expect(isDebugToolsEnabled(channel, disabled)).toBe(expected)
})

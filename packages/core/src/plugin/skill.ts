/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeOpencodeContent from "./skill/customize-opencode.md" with { type: "text" }
import contextHandoffContent from "./skill/context-handoff.md" with { type: "text" }
import leanPackagingContent from "./skill/lean-packaging.md" with { type: "text" }
import offlineFirstContent from "./skill/offline-first.md" with { type: "text" }
import ponytailContent from "./skill/ponytail.md" with { type: "text" }
import rootCauseDebuggingContent from "./skill/root-cause-debugging.md" with { type: "text" }
import safeFileOperationsContent from "./skill/safe-file-operations.md" with { type: "text" }
import verificationGatesContent from "./skill/verification-gates.md" with { type: "text" }

export const CustomizeOpencodeContent = customizeOpencodeContent

export const BuiltinSkills = [
  {
    name: "ponytail",
    description:
      "Use for coding, refactoring, reviewing, or design work where the smallest maintainable solution should preserve all requested behavior and avoid over-engineering.",
    content: ponytailContent,
  },
  {
    name: "safe-file-operations",
    description:
      "Use for deleting, replacing, moving, cleaning, resetting, or broadly rewriting files, repositories, dependencies, caches, outputs, or user configuration.",
    content: safeFileOperationsContent,
  },
  {
    name: "lean-packaging",
    description:
      "Use when building, auditing, or reducing application artifacts without removing user-visible features.",
    content: leanPackagingContent,
  },
  {
    name: "root-cause-debugging",
    description:
      "Use for crashes, startup failures, missing files, regressions, flaky behavior, environment differences, or bugs that survived earlier fixes.",
    content: rootCauseDebuggingContent,
  },
  {
    name: "verification-gates",
    description:
      "Use when deciding whether a change, build, package, installer, migration, or recovery task is genuinely complete.",
    content: verificationGatesContent,
  },
  {
    name: "offline-first",
    description:
      "Use when network access is absent, unreliable, expensive, prohibited, or work should be reproducible from local tools and caches.",
    content: offlineFirstContent,
  },
  {
    name: "context-handoff",
    description:
      "Use for long-running work, interrupted sessions, context limits, recovery investigations, or handoff to another person or machine.",
    content: contextHandoffContent,
  },
] as const

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-opencode",
            description:
              "Use ONLY when the user is editing or creating opencode's own configuration: opencode.json, opencode.jsonc, files under .opencode/, or files under ~/.config/opencode/. Also use when creating or fixing opencode agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring opencode itself.",
            location: AbsolutePath.make("/builtin/customize-opencode.md"),
            content: CustomizeOpencodeContent,
          }),
        }),
      )
      for (const skill of BuiltinSkills) {
        draft.source(
          SkillV2.EmbeddedSource.make({
            type: "embedded",
            skill: SkillV2.Info.make({
              ...skill,
              location: AbsolutePath.make(`/builtin/${skill.name}.md`),
            }),
          }),
        )
      }
    })
  }),
})

---
name: context-handoff
description: Use for long-running work, agent changes, interrupted sessions, context limits, recovery investigations, or handoff to another person or machine.
---

# Context Handoff

Keep a small durable state instead of replaying the entire conversation.

Record:

- objective and current scope;
- repository, branch, exact commit, and worktree state;
- confirmed facts that must not be reinvestigated;
- decisions and rejected false leads with reasons;
- exact files changed and commits;
- commands/checks and concise results;
- artifact paths, versions, sizes, hashes, ports, and error codes;
- safety constraints and user-owned changes;
- open risks and one exact next action.

Update at meaningful boundaries: after a root cause, commit, test phase, build, package, runtime acceptance, or before context loss. Preserve historical evidence but place a current-status summary first so stale OPEN/FAIL entries are not mistaken for the present state.

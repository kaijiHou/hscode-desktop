---
name: root-cause-debugging
description: Use for crashes, startup failures, missing files, regressions, flaky behavior, environment differences, or bugs that survived earlier fixes.
---

# Root-Cause Debugging

- Reproduce the exact failure and preserve the first concrete error, timestamp, version, path, and boundary where it occurs.
- Build a short evidence chain from user action to UI, process, IPC/network, service, storage, and native dependency as applicable.
- Compare a known-good and failing case one variable at a time. Check stale artifacts and configuration precedence before changing code.
- Distinguish code defects from incomplete distributions, environment limitations, permissions, missing runtime dependencies, and test-harness artifacts.
- Search all callers before placing a guard. Prefer one shared invariant or contract check to repeated symptom patches.
- Do not reinstall tools, clear caches, delete dependencies, broaden shims, or rewrite configuration without evidence tying that action to the failure.
- After fixing, rerun the original reproduction and adjacent regressions. State what is code-proven, build-proven, runtime-proven, and still open.

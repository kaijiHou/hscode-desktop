---
name: ponytail
description: Use for coding, refactoring, reviewing, or design work where the smallest maintainable solution should preserve all requested behavior and avoid over-engineering.
---

# Ponytail

Be efficiently lazy, never careless. Understand the real flow first, then stop at the first solution that fully works:

1. Skip speculative requirements.
2. Reuse an existing helper or pattern.
3. Use the standard library.
4. Use a native platform feature.
5. Use an already-installed dependency.
6. Write the minimum new code.

Fix root causes at the shared boundary rather than symptoms in multiple callers. Avoid one-implementation interfaces, one-use factories, pass-through wrappers, premature configuration, and dependencies that replace a few clear lines.

Do not simplify away validation, security, accessibility, recoverability, error handling, or anything explicitly requested. Leave the smallest runnable regression check for non-trivial logic.

For a repository audit, rank candidates as `delete`, `stdlib`, `native`, `yagni`, or `shrink`; do not apply deletion until references, generated origins, package inclusion, and rollback are understood.

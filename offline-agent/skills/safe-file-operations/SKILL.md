---
name: safe-file-operations
description: Use for deleting, replacing, moving, cleaning, resetting, or broadly rewriting files, repositories, dependencies, caches, build outputs, or user configuration.
---

# Safe File Operations

Make destructive work recoverable.

- Never run `rm -rf`, forced recursive deletion, `git clean`, `git reset --hard`, `git checkout -- .`, or force push.
- Inspect and resolve each exact target first. Reject filesystem roots, home directories, repository roots, unresolved variables, broad globs, and paths outside the user-approved scope.
- Prefer the operating system recycle bin/trash API or an installed trash command.
- If trash is unavailable, move targets into a timestamped quarantine directory on the same volume when practical. Record source, destination, time, and recovery instructions.
- Back up overwritten files first. Preserve permissions and hidden files when they matter.
- Never delete dependency trees, caches, build directories, or configuration as generic troubleshooting. Establish a concrete corrupt target and a reproducible reason.
- For Git, prefer a checkpoint commit, branch, tag, stash created for the exact task, or bundle. Do not disturb unrelated changes.

After the operation, verify only the intended targets changed and tell the user how to recover them.

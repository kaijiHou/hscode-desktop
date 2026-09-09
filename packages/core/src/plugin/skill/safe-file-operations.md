# Safe File Operations

Never use `rm -rf`, forced recursive deletion, `git clean`, `git reset --hard`, `git checkout -- .`, or force push.

Resolve and verify exact targets first. Reject roots, home directories, repository roots, unresolved variables, broad globs, and paths outside scope. Prefer the operating system recycle bin/trash. If unavailable, move targets to a timestamped quarantine directory and report recovery instructions.

Preserve unrelated work and back up overwritten files. Never delete dependencies, caches, outputs, or configuration as generic troubleshooting.

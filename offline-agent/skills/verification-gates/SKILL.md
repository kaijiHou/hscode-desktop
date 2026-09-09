---
name: verification-gates
description: Use when deciding whether a code change, build, package, migration, release candidate, or recovery task is genuinely complete.
---

# Verification Gates

Choose checks by the boundary changed:

- Pure logic: focused deterministic test.
- Typed interface: typecheck plus focused test.
- Build configuration: production build and generated-output inspection.
- Packaging: real target artifact, required/forbidden file inspection, version, size, and hash.
- Process or IPC change: launch real processes and observe readiness, health, exit, and logs.
- UI change: rendered interaction, initial state, keyboard/accessibility state, layout, and repeat action.
- Installer/update change: install or update only with authorization, then launch the installed artifact rather than the source tree.

Do not substitute source grep for a behavioral test, a successful build for a successful launch, or an unpacked directory for an installer. Record baseline failures separately and avoid expanding scope unless they block the requested outcome.

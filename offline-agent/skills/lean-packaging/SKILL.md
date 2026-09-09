---
name: lean-packaging
description: Use when building, auditing, or reducing desktop, web, CLI, mobile, archive, container, or installer artifacts without removing user-visible features.
---

# Lean Packaging

Reduce shipped payload, not capability.

1. Build a baseline and measure artifact, unpacked, and major component sizes.
2. Inspect the packaging manifest and final artifact. Do not infer inclusion from the source tree alone.
3. First candidates: source maps, tests, fixtures, stories, screenshots, benchmarks, local logs, caches, intermediate outputs, development-only tools, and native binaries for operating systems that cannot run on the target.
4. Keep target runtime libraries, licenses, locales, themes, accessibility assets, drivers, update metadata, native modules, and configuration defaults unless direct runtime evidence proves they are unnecessary.
5. Make exclusions target-aware. Never break cross-compilation or another architecture to optimize one artifact.
6. Add a focused packaging assertion, rebuild from a clean logical input without destructive cleanup, inspect required files, launch the artifact, and compare sizes.

Keep source maps locally when they aid diagnosis while excluding them from public packages. Separate repository cleanup, build-speed optimization, installer-size reduction, startup performance, and memory use; they need different evidence.

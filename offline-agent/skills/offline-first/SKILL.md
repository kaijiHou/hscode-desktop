---
name: offline-first
description: Use when network access is absent, unreliable, expensive, prohibited, or when work should be reproducible from local tools and caches.
---

# Offline-First Work

- Inventory project-local executables, PATH tools, version managers, package caches, vendored archives, lockfiles, generated snapshots, and prior build artifacts.
- Prefer exact cached versions and verify hashes. Record the path actually used; do not rely on a shell alias or an assumed global install.
- Avoid network-backed commands and automatic installers. Use frozen/offline modes when the local package manager supports them.
- Do not change declared versions merely to match what happens to be installed. Record reproducibility gaps explicitly.
- For handoff to another machine, bundle source history, lockfiles, required standalone runtimes/installers, native assets, licenses, hashes, and a plain-text restore manifest.
- Test the bundle with network disabled when practical. Mark anything that still requires credentials, licensed software, or machine-specific configuration.

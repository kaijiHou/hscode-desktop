# Lean Packaging

Measure a baseline and inspect the produced artifact. Remove shipped payload, not capability.

Start with source maps, tests, fixtures, stories, screenshots, benchmarks, logs, caches, intermediate outputs, development tools, and native binaries for operating systems that cannot run on the target.

Keep runtime libraries, licenses, locales, themes, accessibility assets, drivers, update metadata, native modules, and defaults unless runtime evidence proves they are unnecessary. Make exclusions target-aware, test the rule, rebuild, inspect required files, launch the artifact, and compare sizes.

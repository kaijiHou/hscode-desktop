# HSCode Tool Center

This directory contains the HSCode-only new-tab view and its small local preference contract. Keep tab/session actions in the existing app shell and UI plugin lifecycle in the public `plugin-ui` entrypoint. Persist only bounded entry IDs and presentation preferences; do not add plugin payloads, manifests, session data, or secrets here. See [CONTRACT.md](./CONTRACT.md) for state ownership and synchronization.

# Root-Cause Debugging

Reproduce the exact failure and preserve the first concrete error, version, timestamp, path, and failing boundary. Trace the shortest evidence chain across UI, process, IPC/network, service, storage, and native dependencies as applicable.

Compare known-good and failing cases one variable at a time. Check stale artifacts and configuration precedence. Search every caller before editing and prefer one shared invariant over repeated symptom patches.

Do not reinstall tools, clear caches, delete dependencies, or add broad shims without evidence. Rerun the original reproduction and state separately what is code-, build-, package-, and runtime-proven.

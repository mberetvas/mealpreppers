# Desktop phase 2 — deferred (tracker)

**Type:** HITL  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 7 / §18 open items

## What to build

**Not v1 implementation.** Tracker for post-GA desktop work: macOS notarized and Linux signed releases, `tauri-plugin-updater`, backup/restore zip, export-all JSON, vendored fonts for fully offline UI, optional Nitro Unix socket/named pipe transport, orphan recipe-image GC. Split into separate issues when prioritized.

## Acceptance criteria

- [ ] Product owner prioritizes which deferred items ship first
- [ ] Child issues created from this tracker when a item is scheduled (not required for v1 desktop GA)

## Blocked by

- [0018-windows-authenticode-signing](./0018-windows-authenticode-signing.md) (GA baseline; individual items may start earlier by decision)

# Windows unsigned desktop installer in CI

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 5 (unsigned)

## What to build

Produce a reproducible **Windows installer artifact** (NSIS or MSI via Tauri bundler) from **GitHub Actions** on `windows-latest`, including bundled Node, Nitro sidecar, and SQLite app data layout. Unsigned builds are acceptable for this slice; signing is a follow-up. Fresh install creates DB and app data dirs; core flows from prior slices work without network.

## Acceptance criteria

- [ ] CI workflow builds desktop artifact on `windows-latest` using Bun for JS/Rust steps as documented
- [ ] Installer installs and launches app; first run creates SQLite DB and `recipe-images/` under app data
- [ ] Core offline flows (recipes, planner, Saved Weekplans, shopping lists without AI) succeed on a clean Windows VM or documented smoke procedure
- [ ] Release docs describe manual update process for v1 (no in-app updater)

## Blocked by

- [0016-settings-openrouter-keychain](./0016-settings-openrouter-keychain.md)

# Settings page with keychain-backed OpenRouter key

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 4

## What to build

Add **`/settings`** linked from **More**, with Tauri IPC for OS affordances only (thin boundary). End users save or clear an **OpenRouter API key** in the OS keychain; Rust injects it into Nitro spawn env. Surface read-only **app version**, **data directory** path (SQLite + `recipe-images/` parent), and **Open data folder** via a Tauri command. No backup/restore or export-all in v1. Document that engineers may still use `.env` `OPENROUTER_API_KEY` under `nuxt dev` without Tauri.

## Acceptance criteria

- [ ] `/settings` is reachable from More; masked key input with save/clear; connection hint links to OpenRouter
- [ ] Key persists in OS keychain via Tauri commands; never appears in client bundle or public `runtimeConfig`
- [ ] Nitro sidecar receives `OPENROUTER_API_KEY` from keychain on spawn; AI polish works when key is set and network is available
- [ ] App version and data path display correctly; “Open data folder” opens the OS file manager at the app data root
- [ ] README documents dev `.env` override for OpenRouter without desktop shell

## Blocked by

- [0015-local-principal-supabase-removal](./0015-local-principal-supabase-removal.md)

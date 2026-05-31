# Tauri desktop shell spike

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 0

## What to build

Add a minimal **Tauri** workspace (`src-tauri/` or equivalent) and desktop dev scripts so the existing Nuxt UI loads inside a Tauri WebView pointed at `nuxt dev` (fast loop A). No bundled Nitro sidecar yet; no SQLite. Prove the Windows toolchain, window lifecycle, and that the current app renders in the desktop shell.

## Acceptance criteria

- [x] `bun run desktop:dev` (or documented equivalent) opens a Tauri window showing the Mealprepper UI from the dev server
- [x] `src-tauri/` (or `tauri/`) is wired into the repo with README notes for prerequisites (Rust, Tauri CLI)
- [x] Window opens/closes cleanly; no requirement for production API or Supabase removal in this slice
- [x] CI or local docs describe how a developer runs the spike on Windows

## Blocked by

None — can start immediately

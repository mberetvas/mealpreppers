# Offline and network-required feature UX

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 6

## What to build

Make **offline vs online-only** behavior explicit in the UI: core data paths work offline; **AI shopping-list polish** and **recipe URL import** show clear states when offline, when no OpenRouter key is configured, or when external fetch fails. Tighten **CSP** for desktop (`connect-src` / `img-src` for localhost and `data:`). Reuse consolidation `ai_skipped` patterns where applicable. Document the Google Fonts CDN offline gap for v1.

## Acceptance criteria

- [ ] UI surfaces distinguish offline, missing API key, and online-only features (AI polish, recipe import) without silent failures
- [ ] Tauri CSP allows localhost API and local images; external https links open in system browser, not arbitrary WebView navigation
- [ ] Manual test checklist covers offline recipe/planner/shopping flows and online-only flows with expected messaging
- [ ] README or CONTEXT notes fonts CDN requires network for first paint in v1

## Blocked by

- [0016-settings-openrouter-keychain](./0016-settings-openrouter-keychain.md)

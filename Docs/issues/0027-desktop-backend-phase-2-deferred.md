---
labels:
  - needs-triage
---

# Desktop backend phase 2 — recipe preview and shopping-list consolidation

## Parent

[PRD: Desktop Rust Local API migration](../prd/desktop-rust-local-api-migration.md) — **Desktop backend phase 2** (deferred at planner-safe cutover).

## What to build

Re-enable the capabilities gated at cutover by implementing the remaining **Desktop Local API** routes in Rust: **recipe URL import** (preview pipeline) and **shopping-list consolidation** (merge rules, optional OpenRouter polish, **Saved consolidated shopping list** persistence). Wire the OpenRouter key from the OS keychain at runtime (not in the WebView). Remove or lift **cutover feature gates** in the UI for consolidated shopping and URL import once routes return real responses instead of `501`.

End-to-end: a meal planner can preview a recipe from a URL on add-recipe and use the consolidated shopping tab with saved consolidated list read/write, matching ADR 0002–0004 behavior.

## Acceptance criteria

- [ ] `POST` (or equivalent) recipe URL **preview** returns the same JSON shape and error behavior as today’s Nitro **Recipe Ingestion** slice (port scrapers/normalizers; Playwright bridge only if already required for parity).
- [ ] Shopping-list **consolidation** route(s) and **Saved consolidated shopping list** CRUD work against install-scoped SQLite with **Planning Principal** scoping.
- [ ] OpenRouter API key is read from **Desktop IPC** / keychain and injected server-side; key never appears in client bundle or logs (redaction per `CONTEXT.md`).
- [ ] UI gates for URL import and consolidated shopping are removed or auto-enabled when APIs return success (not `501`).
- [ ] Integration tests assert HTTP status and JSON bodies for happy paths and `desktop.api.not_implemented` is gone for these routes.
- [ ] Vitest suites that duplicated moved logic are narrowed or dropped per PRD testing matrix.

## Blocked by

- [0026 — Remove Nitro desktop bundle](./0026-remove-nitro-desktop-bundle.md)

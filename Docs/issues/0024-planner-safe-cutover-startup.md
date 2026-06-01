---
labels:
  - needs-triage
---

# Planner-safe cutover — Rust primary API startup

## Parent

[PRD: Desktop Rust Local API migration](../prd/desktop-rust-local-api-migration.md) — phase 2 **Planner-safe cutover** (startup / topology).

## What to build

At desktop launch, stop spawning the **Nitro child**; start the **Desktop Local API** as the **primary** loopback server on the port wired into desktop bootstrap (`apiBase` + per-launch token). Tauri waits on `/health` before navigating the WebView. Catalog, Saved Weekplans, and month-plans traffic goes to Rust only. Packaged app cold start no longer boots Node.

## Acceptance criteria

- [ ] No Node/Nitro child process in packaged desktop startup.
- [ ] WebView bootstrap receives correct `apiBase` and desktop token; `01.desktop-api.client.ts` attaches token on `$fetch`.
- [ ] `/health` gating completes before main navigation; startup timing summary uses Rust API milestones (document in `Docs/desktop-startup.md`).
- [ ] End-to-end manual or automated check: recipes page + Saved Weekplans + month overlay work offline against Rust-only API.
- [ ] Sidecar integration loop (loop B equivalent) runs with Rust as sole API process and passes existing or updated integration tests.
- [ ] Shadow-only spawn path removed or gated to dev-only flag documented for maintainers.

## Blocked by

- [0021 — Desktop API platform plumbing](./0021-desktop-api-platform-plumbing.md)
- [0022 — Recipe Catalog on Desktop Local API](./0022-recipe-catalog-desktop-local-api.md)
- [0023 — Planning — Saved Weekplans and month-plans](./0023-planning-saved-weekplans-desktop-local-api.md)

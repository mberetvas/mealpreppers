---
labels:
  - needs-triage
---

# Recipe Catalog on Desktop Local API

## Parent

[PRD: Desktop Rust Local API migration](../prd/desktop-rust-local-api-migration.md) — planner-safe cutover scope (catalog slice).

## What to build

Port the **Recipe Catalog** vertical slice to Rust on the **Desktop Local API**: list, read, create, update, delete recipes; recipe options (categories/tags); bulk delete; local recipe image upload and HTTP serve. Behavior and HTTP paths match existing `/api/v1/*` and recipe-image routes. Validate and persist against install-scoped SQLite via repositories (no SQL in handlers). Exercise on the **shadow port** during development; ready to become primary at cutover.

## Acceptance criteria

- [ ] All Recipe Catalog routes used by the Nuxt recipes list, detail, add, and edit flows respond from Rust with parity status codes and JSON bodies.
- [ ] Recipe images load from local storage over loopback HTTP offline.
- [ ] Bulk delete returns the same error feedback shape as today when partial failure occurs.
- [ ] Desktop token and Trace ID middleware apply; mutations scoped to install **Planning Principal** where applicable.
- [ ] Rust integration tests with temp DB cover CRUD, options, bulk delete, and image serve path.
- [ ] No dependency on Nitro for catalog routes when this slice is pointed at the shadow (or primary) Rust port in tests.

## Blocked by

- [0021 — Desktop API platform plumbing](./0021-desktop-api-platform-plumbing.md)

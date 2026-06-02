# DDD hardening issue sequence (0028 → 0039)

Execute **in numeric filename order**. Each issue’s **Blocked by** points only to the immediate predecessor (`NNNN` ← `NNNN-1`).

## Chain

| # | Issue | Depends on |
|---|--------|------------|
| 1 | [0028](./0028-ddd-phase-0-platform-foundation.md) | — |
| 2 | [0029](./0029-ddd-phase-1a-recipe-catalog-read-ports.md) | 0028 |
| 3 | [0030](./0030-ddd-phase-1b-recipe-catalog-write-ports.md) | 0029 |
| 4 | [0031](./0031-ddd-phase-1c-recipe-catalog-images.md) | 0030 |
| 5 | [0032](./0032-ddd-phase-2a-planning-ports-crud.md) | 0031 |
| 6 | [0033](./0033-ddd-phase-2b-planning-copy-on-match.md) | 0032 |
| 7 | [0034](./0034-ddd-phase-3a-get-consolidated-shopping-list.md) | 0033 |
| 8 | [0035](./0035-ddd-phase-3a-put-consolidated-fingerprint-parity.md) | 0034 |
| 9 | [0036](./0036-ddd-phase-3b-consolidate-application-ports.md) | 0035 |
| 10 | [0037](./0037-ddd-phase-3b-consolidate-ai-polish-parity.md) | 0036 |
| 11 | [0038](./0038-ddd-phase-4-recipe-url-preview-layering.md) | 0037 |
| 12 | [0039](./0039-ddd-phase-5-docs-ci-phase-gate.md) | 0038 |

## Ralph loop

`cursor-ralph-loop.ps1` sorts **all** `Docs/issues/*.md` by name, so **0021–0027 run before 0028**. That is correct if migration issues are not already merged.

To run **only** this DDD sequence, pass a folder that contains just `0028`–`0039` (copy or symlink), or run issues manually in order.

## Technical order checks (why this sequence works)

- **0028** → unified `RepoError`, `wire.rs` stub (required before any trait wiring).
- **0029–0031** → catalog read → write → images; `RecipeCatalogReader` trait stub lands in **0031**, impl in **0032**.
- **0032** → planning CRUD without copy-on-match (no dependency on consolidated-list ports).
- **0033** → copy port + SQL in `shopping_list` infrastructure (plan Phase 2 before 3a; does not require `ConsolidatedShoppingListRepository` from **0034**).
- **0034–0035** → GET layering then PUT + fingerprint (`SavedWeekplanReader` / repository ports before **0036** consolidation refactor).
- **0036–0037** → consolidate orchestration then polish port (structure before AI parity pass).
- **0038–0039** → preview layering, then docs/CI/gate script for full tree.

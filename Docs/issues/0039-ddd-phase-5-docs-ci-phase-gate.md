---
labels:
  - needs-triage
---

# DDD hardening — Phase 5 documentation, CI, and phase-gate script

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 5** (program completion).

## What to build

Finish program-level tooling and docs: complete **`Docs/architecture/desktop-domain-layers.md`** (route → use case → port per phase, dev matrix, phase legend), add **ADR 0005** (bounded contexts; verbatim: *“Consumer defines port, producer implements”*; fast-forward past historical **501** stubs; Phase 2b transaction note if decided), implement **`scripts/desktop-api-phase-gate.ps1`** (and **`.sh`** if needed) with **`-Phase`** values matching split slices (0, 1a–1c, 2a–2b, 3a-get, 3a-put, 3b-structure, 3b-polish, 4, 5) or mapped aliases to cargo filters, wire **`cargo test --test shadow_server_integration`** into GitHub Actions, document gate in **AGENTS.md** or desktop dev doc.

**Out of scope unless requested:** `shadow_server` → `desktop_api` rename; archiving **`server/`**.

## Acceptance criteria

- [ ] Full **`shadow_server_integration`** suite green locally and in CI.
- [ ] Phase gate script runs cumulative filters through Phase 5.
- [ ] **ADR 0005** and **`desktop-domain-layers.md`** match as-built code.
- [ ] Gate script documented for contributors.

## Blocked by

- [0038 — DDD Phase 4 Recipe URL preview layering](./0038-ddd-phase-4-recipe-url-preview-layering.md)

## Sequence

**12/12** — final issue in chain **0028 → 0039** ([README](./README-ddd-0028-0039.md)).

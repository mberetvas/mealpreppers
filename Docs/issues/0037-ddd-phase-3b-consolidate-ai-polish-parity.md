---
labels:
  - needs-triage
---

# DDD hardening — Phase 3b AI polish port and consolidation parity review

## Parent

[DDD Desktop Architecture plan](../../.cursor/plans/ddd_desktop_architecture_64de08fc.plan.md) — **Plan Phase 3b** (AI/polish contract + redaction).

## What to build

Introduce **`ShoppingListPolishPort`** on **`AppState`** and route OpenRouter/keychain access through it. Explicit parity pass vs **`server/services/shopping-list/consolidationService.ts`**: **`ai_skipped`**, **`polished`**, baseline fallback when AI unavailable.

PR review: **Log Redaction** for OpenRouter key and PII in consolidation logs.

Builds on 0036 application layout — no second orchestration rewrite.

## Acceptance criteria

- [ ] **`consolidate_shopping_list_*`** tests still green after polish port extraction.
- [ ] Response fields match TypeScript contract for skip/polish/fallback paths.
- [ ] OpenRouter secret not logged in clear text (**Log Redaction** / CONTEXT logging rules).
- [ ] Cumulative gates: 0036 + 0035 + Phases 0–2.
- [ ] Optional **`bun run test:component`** — not a Rust merge blocker.

## Blocked by

- [0036 — DDD Phase 3b consolidate application and ports](./0036-ddd-phase-3b-consolidate-application-ports.md)

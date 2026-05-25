# Consolidation API with baseline fallback

**Label:** `needs-triage`

## Parent

[PRD — Shopping list AI consolidation](../prd/shopping-list-ai-consolidation.md)

## What to build

End-to-end server path for **Shopping list consolidation** that works without AI: API handler, consolidation service orchestration, and the baseline/`ai_skipped` fallback — the first demoable consolidation endpoint.

**API handler:** `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list` wrapped with `withPlanningHandler` (same **Planning Principal** / **Planning Request Context** as existing saved weekplan routes). Returns the response bundle: `consolidatedLines`, `baselineLines`, `changes`, `polishStatus`, `warnings[]`.

**Consolidation service:** orchestrates load plan → resolve catalog recipes → build scaled ingredients (day ascending, breakfast → lunch → dinner) → **Shopping list exact merge** → delegate to **Shopping list polish port** → return bundle. In this slice the polish port is wired but AI is not yet integrated — when `OPENROUTER_API_KEY` is unset the service skips the invoke, logs `shopping_list.polish_skipped` (`reason: missing_api_key`), and returns `polishStatus: 'ai_skipped'` with baseline as consolidated lines (HTTP 200).

**Shopping list polish port:** define the injectable interface (`polish(context) → response | throw`). Production implementation is a no-op/skip in this slice (chain factory comes in issue #022).

**runtimeConfig:** wire `OPENROUTER_API_KEY` as a server-only key (same pattern as Supabase credentials). The service reads it from `runtimeConfig`, not `process.env`.

**Observability:** structured **Application Logger** events for consolidate start, polish skipped, and consolidate complete (latency, line counts — no full ingredient payloads).

## Acceptance criteria

- [ ] `POST /api/v1/saved-weekplans/:id/consolidate-shopping-list` exists under `withPlanningHandler`
- [ ] Response shape: `{ consolidatedLines, baselineLines, changes, polishStatus, warnings }`
- [ ] `polishStatus` is `'ai_skipped'` when `OPENROUTER_API_KEY` is unset; `consolidatedLines` equals `baselineLines`; HTTP 200
- [ ] Warning present in `warnings[]` when polish is skipped
- [ ] Anonymous session owner can consolidate own plan; cannot consolidate another user's plan
- [ ] Authenticated user scoped to own plans via **Planning Principal**
- [ ] Plan not found / forbidden returns appropriate HTTP status (consistent with existing GET)
- [ ] `OPENROUTER_API_KEY` wired through `runtimeConfig` (server-only), not `process.env`
- [ ] Structured log events emitted for consolidate start and complete/skip
- [ ] Tests: API handler auth/not-found, service orchestration with stubbed port, `ai_skipped` path, response shape validation

## Blocked by

- [019 — Shopping list exact merge](./019-shopping-list-exact-merge.md)

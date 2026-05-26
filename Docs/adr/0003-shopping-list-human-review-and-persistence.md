# ADR 0003 — Shopping list human review and persistence

**Status:** Accepted  
**Date:** 2026-05-26  
**Parent PRD:** [Shopping list human review and persistence](../../Docs/prd/shopping-list-human-review-and-persistence.md)  
**Supersedes (in part):** [ADR 0002 — Shopping list AI consolidation](./0002-shopping-list-ai-consolidation.md) — ephemeral persistence behavior  
**Domain vocabulary:** `CONTEXT.md` (Shopping list section)

---

## Context

The original **Shopping list consolidation** design (ADR 0002 / Shopping list AI consolidation PRD) treated the **Consolidated shopping list** as ephemeral: no database column stored the result, and every page visit or refresh required re-running **Consolidate action** with a new OpenRouter call — even when the underlying **Saved Weekplan** had not changed.

Additionally, the server harness acted as a gatekeeper: when AI polish output violated validation rules (unit policy, quantity caps, invented lines), the harness discarded the model result entirely and returned **Shopping list polish fallback**. Users saw "AI polish output rejected by harness validation; returning baseline" with no way to inspect or salvage the draft the model actually produced.

This created two problems:

1. **Wasted cost and latency** — households that meal-prep from a fixed weekly template paid for AI on every visit.
2. **Loss of control** — the automated harness made the accept/reject decision instead of the human shopper.

A grill-with-docs session resolved the vocabulary and design for human-gated review, persistence tied to a source fingerprint, and deprecation when the plan changes.

## Decision

We reverse the ephemeral **Consolidated shopping list** persistence behavior from ADR 0002 and move trust from the server harness gate to the human shopper via **Shopping list polish review** and **Shopping list polish confirm**.

### Key architectural choices

1. **Human as final harness.** Server validation rules remain but produce **Shopping list polish hint**s (per-line, severity `info` or `error`) rather than discarding AI output. The harness no longer triggers **Shopping list polish fallback** when the model call succeeded.

2. **`pending_review` status.** `POST consolidate` returns `polishStatus: 'pending_review'` with `polishResponse`, `baselineLines`, `hints[]`, and optional `changes` when the model succeeds. The client shows **Shopping list polish review** instead of auto-applying the result.

3. **Saved consolidated shopping list.** After the user confirms via **Shopping list polish confirm**, a `PUT` persists the **Saved consolidated shopping list** on the **Saved Weekplan** row (JSON column: confirmed `lines`, `sourceFingerprint`, `confirmedAt`). Later visits load the saved list directly without an OpenRouter call.

4. **Shopping list source fingerprint.** A server-computed canonical digest of **Saved Weekplan** `body` (sorted keys, normalized slots). Stored on save, recomputed on load. Mismatch → **Deprecated saved consolidated shopping list** (read-only warning, re-consolidate required).

5. **Planning Principal scoping.** All consolidation and persistence operations respect the same **Planning Principal** access rules as the **Saved Weekplan** itself — anonymous session owners included.

6. **Two-step save.** Consolidate (`POST`) and confirm (`PUT`) are always separate HTTP calls. Nothing is persisted until the user explicitly confirms after **Shopping list polish review**.

7. **Edit without AI.** **Edit saved consolidated shopping list** reopens the review UI pre-filled from saved lines; small corrections do not require a new OpenRouter call.

### What this supersedes

- **Ephemeral persistence from ADR 0002:** The relationship "Consolidated shopping list persistence (v1) is ephemeral; no DB column for consolidated output in the first release" is reversed. Persistence is now the default for confirmed lists.
- **Harness-as-gatekeeper:** Validation failures no longer replace AI output with baseline. The hints-only harness preserves model output for human review.

## Consequences

### Positive

- Shoppers reuse a confirmed store list across sessions without paying for AI again.
- Trust is explicit: the user sees what the model produced, edits it, and confirms — not a hidden gate.
- Harness rules remain as safety guardrails (hints) without blocking usable output.
- Source fingerprint provides reliable staleness detection without relying on timestamps alone.

### Negative

- Schema migration: nullable JSON column on `meal_week_templates` for the saved shopping list record.
- Client complexity increases: review UI, deprecated state, edit-without-AI path.
- Existing clients that expect auto-applied `consolidatedLines` from POST must be updated in the same release as the review UI.
- Storage grows per plan (one JSON blob per confirmed list).

### Neutral

- OpenRouter cost per unique plan consolidation is unchanged; cost is reduced for repeat visits to the same plan.
- **Shopping list polish retry policy (v1)** remains single-attempt; no repair loops.

## Alternatives Considered

### 1. Keep ephemeral persistence, add client-side cache

Cache the consolidated result in `localStorage` or `sessionStorage` keyed by plan ID. Rejected because:
- No cross-device or cross-session persistence.
- Fingerprint-based deprecation impossible without server involvement.
- Anonymous merge complexity increases (orphaned cache entries).

### 2. Auto-save on successful harness pass, review only on failure

Let the harness gate auto-persist valid results and show review only when violations exist. Rejected because:
- Users lose visibility into what the model changed on "happy path" — erodes trust.
- Inconsistent UX: sometimes you see review, sometimes you don't.
- Contradicts the principle of human-as-final-harness.

### 3. Separate shopping list table

Store consolidated lists in a dedicated `consolidated_shopping_lists` table rather than a JSON column on the weekplan row. Rejected for v1 because:
- One-to-one relationship (one list per plan) does not warrant a join table.
- JSON column simplifies atomic read/write with the plan.
- Future cross-plan sharing or versioning can justify extraction later.

### 4. Client-supplied fingerprint on PUT

Let the client compute and send `sourceFingerprint` to the server. Rejected because:
- Server must be authoritative on what constitutes a plan change.
- Client hash implementations may drift from server canonicalization.
- Security: client could forge a fingerprint to bypass deprecation.

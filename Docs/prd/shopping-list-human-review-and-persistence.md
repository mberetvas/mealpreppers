# PRD: Shopping list human review and persistence

**Status:** Draft  
**Supersedes (in part):** [Shopping list AI consolidation](./shopping-list-ai-consolidation.md) — ephemeral consolidation and server harness as gatekeeper  
**Related ADR (proposed):** `docs/adr/0003-shopping-list-human-review-and-persistence.md`  
**Domain vocabulary:** `CONTEXT.md` (Shopping list)

---

## Problem Statement

Mealprepper’s **Shopping list consolidation** calls OpenRouter successfully, but shoppers still lose the AI result when the server **harness** rejects polish output. They see **Shopping list polish fallback** (“AI polish output rejected by harness validation; returning baseline”) even though the model produced a usable draft. There is no way to inspect that draft beside the source data, fix minor issues (units, labels), and approve the list themselves.

Even when polish succeeds, the **Consolidated shopping list** is ephemeral: leaving the page or refreshing forces another **Consolidate action** and another API call for the same unchanged **Saved Weekplan**. Shoppers who meal-prep from a fixed weekly template must rebuild the store list every visit.

Households need to **reuse** a confirmed store list tied to the plan, be warned when the plan changes, and stay in control of the final list—not an automated gate that hides model output.

## Solution

Keep **Recipe sections view** and **Consolidated shopping list** **Shopping list view mode** as today. Add **Shopping list polish review**: after **Consolidate action**, show a two-pane review (desktop side-by-side; mobile stacked with reference on top):

- **Left — Shopping list polish reference:** tabs for **Recipe sections view** (per-recipe source) and **Shopping list polish baseline** (post–exact-merge, stable line IDs).
- **Right — editable AI column:** canonicalized **Shopping list polish response** whenever the model call succeeds. Former harness rules become **Shopping list polish hint**s (inline, non-blocking). The user edits `name`, `quantity`, and `unit` on existing baseline line IDs, then **Shopping list polish confirm** saves via a dedicated API.

**POST consolidate** always returns polish for review (`pending_review`) when the model succeeds; it no longer discards AI lines on harness failure. Timeout, parse, and missing-key failures still use **Shopping list polish fallback**.

**Saved consolidated shopping list** is stored on the **Saved Weekplan** with a server-computed **Shopping list source fingerprint** (canonical hash of `body`). On later visits, a valid saved list is shown directly; review appears only for **Consolidate action** or **Edit saved consolidated shopping list**. If the plan `body` hash changed, the saved list is **Deprecated saved consolidated shopping list**: warning, read-only old lines for comparison, re-consolidate required to save a new list.

---

## User Stories

### Human review and trust

1. As a shopper, I want to see the AI polish draft after **Consolidate action** even when automated checks would have failed, so that I am not blocked by harness rejection when OpenRouter succeeded.
2. As a shopper, I want harness violations shown as **Shopping list polish hint**s on specific lines, so that I understand what the system flagged without losing the draft.
3. As a shopper, I want to edit `name`, `quantity`, and `unit` on each line before confirming, so that I can fix labels and amounts the model got wrong.
4. As a skeptical shopper, I want **Recipe sections view** available in a reference tab during review, so that I can verify quantities against per-recipe sources.
5. As a shopper, I want **Shopping list polish baseline** in a reference tab during review, so that I can compare against post–exact-merge lines with stable IDs.
6. As a shopper, I want desktop layout with reference left and editable AI right, so that I can compare while editing.
7. As a shopper, I want mobile layout stacked with reference tabs on top, so that review works on a phone in the store.
8. As a shopper, I want to confirm the list only after reviewing, so that the last check is mine—not the server harness.
9. As a shopper, I want to acknowledge remaining **error**-level hints before confirm when I choose to ignore them, so that I explicitly accept responsibility for flagged lines.
10. As a shopper, I want **info**-level hints never to block confirm, so that explanatory diffs do not add friction.

### Consolidate and review flow

11. As a shopper, I want **Consolidate action** to run AI and open **Shopping list polish review**, not auto-save the result, so that I always get a review step after a new polish run.
12. As a shopper, I want consolidate and save to be separate steps (`POST` then `PUT`), so that nothing is persisted until I confirm.
13. As a shopper, I want clear loading state during consolidate, so that I know the model is running.
14. As a shopper, I want to retry consolidate after timeout or provider failure, so that transient errors do not strand me.
15. As a shopper, I want baseline-only fallback when AI cannot run (no key, timeout, parse error), so that I still have a merged list without polish.

### Persistence and reuse

16. As a shopper returning to the same **Saved Weekplan**, I want my previously confirmed **Consolidated shopping list** shown immediately, so that I do not pay for or wait on AI again.
17. As a shopper, I want **Edit list** on a saved consolidated view to fix typos without re-running OpenRouter, so that small corrections are cheap.
18. As a shopper, I want confirmed lists stored on the plan in the database, so that refresh and new sessions keep my list.
19. As a shopper, I want the server to compute **Shopping list source fingerprint** on save and load, so that stale detection is trustworthy.
20. As a planner, I want the fingerprint based on canonical **Saved Weekplan** `body`, so that immaterial JSON ordering does not false-trigger stale warnings.

### Plan changes and deprecation

21. As a shopper, I want a clear warning when my plan changed and the saved list is **deprecated**, so that I know the old list may be wrong.
22. As a shopper, I want the deprecated list shown read-only for comparison, so that I can see what I had before re-consolidating.
23. As a shopper, I want to run **Consolidate action** to create a replacement after plan edits, so that I can save a new confirmed list.
24. As a shopper, I want confirm/save disabled or ineffective for deprecated lists until I re-consolidate, so that I cannot treat a stale list as current.

### API and access

25. As a client, I want `GET`/`PUT` on a dedicated consolidated-shopping-list resource, so that list persistence is separate from plan name/body PATCH.
26. As a client, I want **Saved Weekplan** `GET` to include `hasSavedShoppingList` and `shoppingListDeprecated`, so that the shopping page can render state without an extra round-trip when possible.
27. As an anonymous session owner, I want the same persistence and review flows as authenticated users for my own plans, so that consolidation stays usable without an account.
28. As a developer, I want consolidation access aligned with **Planning Principal** rules, so that authorization stays consistent with plan GET.

### Partial plans and parity

29. As a user with **Shopping list partial consolidation**, I want review and persistence to use only loaded **Recipe section**s, so that behavior matches today’s partial merge.
30. As a user with partial failure, I want the incomplete warning visible in consolidated and review views, so that I know the list may be incomplete.
31. As a meal prepper, I want to switch back to **Recipe sections view** anytime, so that I can cross-check per-recipe data.
32. As a meal prepper, I want occurrence badges in recipe sections unchanged by consolidation work, so that planning context stays accurate.

### Polish quality and policy (unchanged intent)

33. As a shopper, I want Dutch store-style names from polish when I accept AI suggestions, so that labels match local supermarkets.
34. As a shopper, I want hints when polish would violate **Shopping list unit policy (v1)**, so that I am warned before buying incompatible unit merges.
35. As a shopper, I want hints when quantities would exceed the **Shopping list polish baseline** cap, so that I am warned about inflation even if I can override.
36. As a shopper, I want optional model `changes` explanations visible during review, so that ambiguous diffs are understandable.

### Operations

37. As an operator, I want structured logs for consolidate, review-related statuses, save, and deprecation checks, without full ingredient payloads, so that I can monitor health and cost.
38. As a developer operating without OpenRouter, I want graceful skip with baseline and warning, so that local dev is not blocked.

### Configuration

39. As a deployer, I want OpenRouter and timeout settings in server runtime config, so that secrets and budgets stay centralized.
40. As a product owner, I want no automatic repair loop re-calling the model on harness failure, so that cost and behavior stay predictable.

---

## Implementation Decisions

### Architectural shift

- **Human as final harness:** Server validation rules remain but produce **Shopping list polish hint**s; they do not replace AI output with **Shopping list polish fallback** when the model call succeeds.
- **Persistence on Saved Weekplan:** Store **Saved consolidated shopping list record** as JSON on the week template row: `lines`, `sourceFingerprint`, `confirmedAt`.
- **Invalidation:** Recompute fingerprint from canonical plan `body` on load; mismatch sets `shoppingListDeprecated` and read-only deprecated UX.

### Deep modules (testable, stable interfaces)

| Module | Responsibility |
|--------|----------------|
| **Week plan shopping source fingerprint** | Canonicalize `WeekPlanV1` body and compute stable digest; single source for save and compare. |
| **Saved consolidated shopping list repository** | Load/save record on **Saved Weekplan**; enforce **Planning Principal**; validate payload shape. |
| **Polish hint builder** | Run existing harness rules against canonicalized polish + baseline; return per-line hints with severity (`info` / `error`), not a pass/fail gate. |
| **Shopping list consolidation service** | Orchestrate merge → polish → hints; return `pending_review` bundle (`baselineLines`, `polishResponse`, `hints`, `changes`) on model success; retain fallback only for non-review failures. |
| **Consolidated shopping list HTTP adapter** | `GET`/`PUT` resource; embed summary fields on plan `GET`. |
| **Client consolidated shopping list state** | Composable: saved vs review vs deprecated; consolidate POST; confirm PUT; edit-without-AI path. |
| **Shopping list polish review UI** | Reference tabs + editable column; confirm with optional error acknowledgment; responsive layout. |

### Schema

- Add nullable JSON column on `meal_week_templates` (e.g. `consolidated_shopping_list`) holding **Saved consolidated shopping list record**.
- No separate shopping-list table in v1.

### API contracts

**Saved Weekplan GET** (extended):

- `hasSavedShoppingList: boolean`
- `shoppingListDeprecated: boolean`

**GET `/api/v1/saved-weekplans/:id/consolidated-shopping-list`**

- Returns full record when present; `404` or empty when none.
- Includes `deprecated` derived server-side from fingerprint vs current `body`.

**PUT `/api/v1/saved-weekplans/:id/consolidated-shopping-list`**

- Body: confirmed `lines` (same line IDs as baseline at last consolidate; `name`, `quantity`, `unit` editable fields).
- Server sets `sourceFingerprint` from current plan `body` and `confirmedAt`.
- Rejects or no-ops when plan not accessible; validate line shape.

**POST `/api/v1/saved-weekplans/:id/consolidate-shopping-list`** (extended response)

- On model success: `polishStatus: 'pending_review'`, `polishResponse`, `baselineLines`, `hints[]`, optional `changes`.
- On AI unavailable failure: existing fallback (`baseline_fallback` / `ai_skipped`) without `polishResponse`.
- Do not return `consolidatedLines` as the auto-applied final list when status is `pending_review` (client owns confirm).

### Client UX states

| State | UI |
|-------|-----|
| No saved list | Consolidated view prompts **Consolidate action** |
| Valid saved list | Show **Saved consolidated shopping list**; **Consolidate** / **Edit list** |
| Deprecated saved list | Warning + read-only old list + **Consolidate** |
| After consolidate | **Shopping list polish review** until confirm → **PUT** |
| Edit saved | Review UI pre-filled from saved lines; no OpenRouter call |

### Harness and hints

- Reuse canonicalization from existing harness before hint generation.
- Map harness rules to hint messages (unit-policy, quantity cap, invented/removed lines, etc.).
- **Shopping list polish confirm:** block-less confirm with required checkbox when any `error` hints remain.

### Status vocabulary

- `pending_review` — model output ready for human review (replaces harness-driven `baseline_fallback` for validation failures).
- Persisted list after **PUT** — treat as current **Consolidated shopping list** for the plan until deprecated.

### Migration and compatibility

- Existing clients that expect auto-applied `consolidatedLines` from POST must be updated in the same release as review UI.
- Update `CONTEXT.md` planned terms to active; add ADR 0003 documenting reversal of ephemeral persistence.

---

## Testing Decisions

**Principle:** Test observable behavior through module boundaries and HTTP/UI contracts—not internal call order or private helpers.

| Area | What to test | Prior art |
|------|----------------|-----------|
| **Week plan shopping source fingerprint** | Same body → same digest; key order / trivial formatting → same digest; slot change → different digest | Unit tests for planning JSON helpers |
| **Polish hint builder** | Known invalid polish → expected hints with rule ids; valid polish → no error hints | `shopping-list-polish-harness` unit tests |
| **Consolidation service** | Model success + harness violations → `pending_review` with `polishResponse` and hints, not baseline-only; timeout → fallback | `consolidation-service`, `shopping-list-polish-integration` |
| **Saved list repository** | Save/load round-trip; fingerprint stored; principal denial | `saved-weekplans-repository` patterns |
| **Consolidated shopping list API** | GET/PUT auth, validation, deprecated flag when body changes | `consolidation-api` unit tests |
| **Client composable** | State transitions: saved → edit → PUT; consolidate → review; deprecated flag | `use-consolidated-shopping-list` |
| **Review UI (component)** | Reference tabs; editable fields; error acknowledgment gate; deprecated read-only | `shopping-list-page-states`, `shopping-list-consolidated-view` |

**Recommended test focus (for implementer confirmation):** fingerprint module, hint builder, consolidation service response shape, PUT/GET API, and component tests for deprecated + review confirm flows.

---

## Out of Scope

- Fingerprint invalidation when **Public Recipe Catalog** recipe ingredients change but **Saved Weekplan** `body` is unchanged (catalog-version fingerprint is a future enhancement).
- Adding, removing, or merging rows with new line IDs in v1 (edit limited to `name`, `quantity`, `unit` on existing IDs).
- Automatic model repair loop or second OpenRouter call on harness failure.
- **Shopping list unit policy** conversion (e.g. g → kg).
- Separate shopping-list table or cross-plan list sharing.
- Printing/export redesign (existing behavior may consume saved list once implemented).
- One-shot `POST consolidate` with confirm flag (always two-step).
- Client-supplied `sourceFingerprint` on PUT.

---

## Further Notes

- This PRD implements the design from the **grill-with-docs** session (human review, persistence, deprecation, API split).
- Draft ADR 0003 should record the trade-off: trust moves from server harness gate to **Shopping list polish confirm**, with hints preserving former safety rails.
- PRD [Shopping list AI consolidation](./shopping-list-ai-consolidation.md) remains the baseline for exact merge, OpenRouter chain, locale, and partial consolidation; this document extends it rather than replacing it entirely.
- After implementation, remove `(planned)` markers from `CONTEXT.md` terms and align component test vocabulary contracts.

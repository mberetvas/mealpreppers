# Auto-consolidated shopping list redesign

We redesign the consolidated shopping list flow so AI consolidation runs automatically when needed, users always review before save, confirmed lists persist on the Saved Weekplan, and matching meal grids reuse lists without another AI call. Preview and in-planner access use a lightweight modal; the full shopping list page remains the only place that runs consolidation, supports edit/confirm, and drives in-store use. This ADR extends [ADR 0002 — Shopping list AI consolidation](Docs/adr/0002-shopping-list-ai-consolidation.md) and [ADR 0003 — Shopping list human review and persistence](docs/adr/0003-shopping-list-human-review-and-persistence.md).

## Status

accepted

## Decisions

### When AI runs (auto-consolidation trigger)

- Run **Shopping list consolidation** automatically when the user opens **Consolidated shopping list** on `/shopping-list?plan=…` and there is no valid **Saved consolidated shopping list** (none yet, or deprecated after recipe changes).
- Do **not** run AI on plan save, on recipe-sections view only, or from **Consolidated shopping list preview** in manage/planner.
- When recipes change: show an explicit “recipes changed” notice, then run AI immediately into **Shopping list polish review** (deprecated lines remain available read-only for comparison).
- If no saved list exists, auto-switch to the consolidated tab and start AI (do not default to recipe sections first).

### Human review and session draft

- Nothing is persisted until explicit **Confirm** (`PUT` consolidated shopping list).
- Unconfirmed AI output is held as a **Shopping list consolidation session draft** in client memory for the browser session; returning to the same plan resumes review without a new AI call. Closing the tab discards the draft.
- When AI fails (timeout, missing key, parse error), fall back to **Shopping list exact merge**, show a warning, and still open **Shopping list polish review** so the user can edit and confirm.

### Reuse without AI

- **Same plan:** revisiting an unchanged Saved Weekplan loads the saved list with no AI call.
- **New plan, same meals (copy-on-match):** on `POST` create only (not on PATCH edits), if the new plan’s **Shopping list source fingerprint** matches another plan owned by the same principal with a valid saved list, copy that list server-side. When multiple sources match, use the source with the latest `confirmedAt`. Copied lists are saved immediately as **Saved consolidated shopping list** (no review gate); show a one-time dismissible **Consolidated shopping list copy notice** on first preview or full-page open.
- If no copy source exists, fall back to auto-consolidation on first consolidated visit.

### In-plan access and preview

- **Manage plans** and the weekly planner show **Weekplan consolidated list status** (`List ready`, `List outdated`, `No list yet`) and **View shopping list**.
- Preview is read-only, uses collapsible **Shopping list aisle section**s, and never runs AI.
- When there is no valid saved list, preview shows an empty-state message and **Open full list** (consolidation runs on the full page).
- Full shopping list page remains canonical for review, edit, confirm, and store use.

### Aisle presentation

- **Shopping list AI polish** assigns `aisleCategory` per line and returns lines in store walk order; the server does not keyword-sort or re-infer aisles on serve or save.
- UI groups lines under labeled, collapsible aisle sections (Dutch shopper labels) using persisted AI categories. Legacy saves without categories display flat until re-consolidation. Non-AI paths show an empty consolidated list with a warning. All sections start expanded on each open; collapse state is not persisted.

## Considered options (rejected)

| Topic | Rejected | Why |
|-------|----------|-----|
| AI trigger | Background consolidate on plan save | Wastes API calls; runs before user intent |
| AI trigger | Re-run on every recipe edit | Costly; overwrites in-progress human edits |
| Reuse | Manual “pick list from…” (v1) | Trust risk when meals don’t match |
| Reuse | Copy-on-match on PATCH | Surprising silent inheritance after edits |
| Preview | Run AI from modal | Duplicates orchestration; hides review context |
| Preview | Disable View when no list | Hides primary entry point |
| AI failure | Error-only screen blocking review | Breaks automatic flow promise |
| Copy | Require re-confirm after copy | Friction without safety gain when fingerprint matches |

## Consequences

- `useConsolidatedShoppingList` must auto-call consolidate on consolidated view when appropriate, hold session drafts, and auto-switch tabs when no valid saved list.
- `POST /api/v1/saved-weekplans` must implement copy-on-match after insert (principal-scoped fingerprint lookup, latest `confirmedAt` wins).
- List and detail APIs for Saved Weekplans should expose `hasSavedShoppingList` and `shoppingListDeprecated` for manage/planner badges (list endpoint may need extension).
- New UI: aisle section component (preview, review, saved view), preview modal, status badges, copy notice, deprecated/regenerating states.
- **Consolidate action** remains as optional manual re-run / retry, not the primary path.

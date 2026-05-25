# Document public Recipe Catalog assumption in CONTEXT / ADR

**Source:** REV-004 (Medium) — branch review 2026-05-25
**Type:** AFK

## What to build

Add an explicit named entry to `CONTEXT.md` stating that all **Recipe Catalog** entries are publicly readable — `GET /api/v1/recipes/:id` performs no **Planning Principal** check by design. Cross-reference this assumption from the Shopping list section of `CONTEXT.md`. Flag that any future batch endpoint or private-recipe feature must revisit visibility enforcement consistent with the requesting **Planning Principal**.

## Acceptance criteria

- [ ] `CONTEXT.md` contains a named vocabulary entry for the public-catalog assumption (e.g. **Public Recipe Catalog**)
- [ ] The Shopping list section of `CONTEXT.md` references this assumption
- [ ] The entry explicitly calls out the private-recipe risk as a future-feature consideration
- [ ] No code changes to `server/api/v1/recipes/[id].get.ts` or related handlers

## Blocked by

None — can start immediately.

# Document `--force` / `--trust` agent flags as trusted-local-only

**Source:** REV-010 (Low) — branch review 2026-05-25
**Type:** AFK

## What to build

Add inline warning comments and/or a prominent header block to `scripts/code-review.ps1` and `Docs/ralph-loop/cursor-ralph-loop.ps1` documenting that `--force`, `--trust`, and `--approve-mcps` flags are appropriate for local development machines only and must not be used on shared machines or production-adjacent environments. Optionally document a `-ReadOnly` invocation path for `code-review.ps1` that omits `--force` for safe review runs.

## Acceptance criteria

- [ ] `scripts/code-review.ps1` has a clearly visible warning at or near the top about trusted-local-only use of `--force`
- [ ] `Docs/ralph-loop/cursor-ralph-loop.ps1` has a clearly visible warning about `--force`, `--trust`, and `--approve-mcps` being trusted-local-only
- [ ] `code-review.ps1` includes a comment or example showing how to invoke without `--force` for read-only review runs
- [ ] No functional changes to either script

## Blocked by

None — can start immediately.

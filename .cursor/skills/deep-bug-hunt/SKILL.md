---
name: deep-bug-hunt
description: Inspects recent commits for critical correctness bugs that escaped review — data loss, crashes, security holes, or significant user-facing breakage. Use when auditing recent changes, running post-merge bug hunts, scheduled commit reviews, or when the user asks for deep critical bug analysis on commits.
---

# Deep Bug Hunt

You are a deep bug-finding automation focused on high-severity issues.

## Goal

Inspect recent commits and identify critical correctness bugs that escaped review. Only surface issues that would cause data loss, crashes, security holes, or significant user-facing breakage.

## Investigation strategy

- Focus on behavioral changes with meaningful blast radius.
- Look for: data corruption, race conditions that lose writes, null dereferences in critical paths, auth/permission bypasses, infinite loops, resource leaks, and silent data truncation.
- Trace through the full code path — don't just pattern-match on the diff. Understand the caller chain and downstream effects.
- Ignore: style issues, minor edge cases, theoretical concerns without a concrete trigger, and low-severity issues that would merely degrade UX.

## Confidence bar

- You must be able to describe a concrete scenario that triggers the bug.
- If you cannot construct a plausible trigger scenario, do not open a PR.
- When in doubt, report your findings in Slack without opening a PR.

## Fix strategy

- If you find a critical bug, implement a minimal, high-confidence fix.
- Add or update tests when possible to lock in the behavior.
- Avoid broad refactors in the same PR.

## Safety rules

- Do not open a PR unless you are highly confident the bug is real and the fix is correct.
- If no critical bug is found, post a short "no critical bugs found" summary. This is the expected outcome most days.

## Output

If fixed, include:

- Bug and impact
- Root cause
- Fix and validation performed

## Workflow

### 1. Scope recent changes

Default to commits merged in the last 24 hours on the default branch unless the user specifies otherwise.

```bash
git log --oneline --since="24 hours ago" origin/main
git diff origin/main~N..origin/main   # N = number of commits in scope
```

For a PR or branch review, diff against the merge base instead:

```bash
git merge-base HEAD origin/main
git diff <merge-base>..HEAD
git log --oneline <merge-base>..HEAD
```

### 2. Triage by blast radius

Prioritize files and changes that touch:

- Persistence, migrations, sync, or serialization
- Auth, permissions, and multi-tenant boundaries
- Concurrency, async, and shared mutable state
- Error handling on critical paths (startup, save, payment, delete)
- Public API contracts and IPC boundaries

Read surrounding code — not just the diff hunk — until you can state who calls the changed code and what happens on failure.

### 3. Construct a trigger scenario

Before reporting or fixing, write a short scenario:

1. **Precondition** — required state or inputs
2. **Action** — what the user or system does
3. **Expected** — correct behavior
4. **Actual** — the bug manifestation (crash, data loss, bypass, etc.)

If any step is speculative, stop. Either investigate further or report uncertainty without opening a PR.

### 4. Act on findings

| Outcome | Action |
|---------|--------|
| No critical bug | Post short "no critical bugs found" summary |
| Possible bug, low confidence | Report in Slack with scenario and open questions — no PR |
| Confirmed critical bug | Minimal fix + test, then open PR |

Use the project's `gh` CLI skill for PRs. Keep the PR scoped to the bug fix only.

### 5. Report templates

**No critical bugs found:**

```markdown
## Deep bug hunt — no critical bugs found

**Scope:** [commits / time range reviewed]
**Areas checked:** [brief list]
**Notes:** [optional — areas of higher risk reviewed but clean]
```

**Critical bug fixed (PR body):**

```markdown
## Bug and impact
[What breaks, for whom, severity]

## Root cause
[Why the bug exists — caller chain, race, missing check, etc.]

## Fix and validation performed
[Minimal change summary]
[Tests added/updated]
[Commands run — e.g. targeted test suite, build]
```

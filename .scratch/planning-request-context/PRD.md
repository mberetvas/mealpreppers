# PRD: Planning Request Context for Planning Handlers

Canonical source: [`Docs/prd/PRD-planning-request-context.md`](../../Docs/prd/PRD-planning-request-context.md)

This local tracker entry mirrors the canonical PRD stored in `Docs/prd/PRD-planning-request-context.md`. Use the source PRD for the full problem statement, solution, user stories, implementation decisions, testing decisions, and out-of-scope constraints.

## Scope summary

- Introduce **Planning Request Context** as a Planning-only handler seam.
- Keep **Request Context Trace ID** resolution in the existing trace middleware.
- Centralize **Planning Principal** resolution, request-scoped **Application Logger** binding, and unexpected-error wrapping for adopting Planning handlers.
- Roll out the seam through **Saved Weekplans** first, then the legacy `planning/week-templates` CRUD routes.
- Keep **anonymous merge**, anonymous idle purge, month-plan routes, public route shapes, response bodies, and persistence schema changes out of scope for this work.

# PRD: Planning Request Context for Planning Handlers

## Problem Statement

Planning handlers currently rebuild the same request-scoped behavior by hand: resolve the **Planning Principal**, read the **Request Context Trace ID**, bind a request-scoped **Application Logger**, and wrap unexpected failures. That makes the handler interface shallow, spreads one policy across many callers, and leaves too much cross-cutting knowledge in each handler. The result is low locality, weaker leverage from shared modules, and tests that either repeat the same setup or miss the real request-level behavior.

## Solution

Introduce **Planning Request Context** as the canonical request-scoped module for principal-based Planning handlers. The existing trace middleware continues to resolve the **Request Context Trace ID**. A new Planning-only handler wrapper resolves the **Planning Principal**, binds a request-scoped **Application Logger** for the handler, and centralizes unexpected-error logging and wrapping. Handlers then work through a small interface and focus on parsing, validation, and repository orchestration instead of rebuilding the same seam on every route.

## User Stories

1. As a backend developer, I want one **Planning Request Context** interface, so that I do not rebuild trace, auth, and logging setup in every Planning handler.
2. As a backend developer, I want **Saved Weekplan** handlers to receive the current **Planning Principal** automatically, so that handler code stays focused on request-specific behavior.
3. As a backend developer, I want the **Request Context Trace ID** to be available automatically inside Planning handlers, so that I do not thread trace data manually.
4. As a backend developer, I want one place to declare handler metadata such as log tag and operation name, so that logging behavior is consistent.
5. As a backend developer, I want unexpected Planning failures to be wrapped centrally, so that each handler does not reinvent error behavior.
6. As a backend developer, I want expected HTTP errors to pass through unchanged, so that handlers can still signal validation and authorization failures explicitly.
7. As a backend developer, I want request-scoped success logging to be pre-bound to the handler context, so that logging calls are smaller and less error-prone.
8. As a backend developer, I want the handler interface to expose the current principal kind, so that logs and repository orchestration do not recompute it.
9. As a maintainer, I want changes to **Planning Principal** resolution to live in one module, so that auth-policy changes do not require broad handler edits.
10. As a maintainer, I want anonymous session cookie behavior centralized, so that anonymous **Saved Weekplan** ownership stays consistent.
11. As a maintainer, I want the seam to stay Planning-only, so that non-Planning routes do not inherit Planning-specific auth and cookie policy accidentally.
12. As a maintainer, I want the first implementation slice to cover principal-based Planning CRUD handlers, so that the interface stays deep before it grows.
13. As a maintainer, I want **anonymous merge** to stay outside the first cut, so that the module does not absorb a different interface shape too early.
14. As a maintainer, I want the internal anonymous idle purge handler to stay outside the first cut, so that non-principal flows do not complicate the core module.
15. As an operator, I want all unexpected Planning failures logged with the **Request Context Trace ID**, so that request-level debugging is reliable.
16. As an operator, I want Planning logs to carry stable handler metadata, so that logs remain searchable across **Saved Weekplan**, legacy week-template, and month-plan routes.
17. As an operator, I want request-scoped logs to distinguish authenticated and anonymous principals safely, so that I can understand behavior without exposing raw identifiers.
18. As a security-conscious maintainer, I want bearer-token-to-user resolution behind an adapter, so that external auth behavior is isolated from handler code.
19. As a security-conscious maintainer, I want logging to continue using the shared **Application Logger** and redaction policy, so that this refactor does not weaken safety guarantees.
20. As a QA engineer, I want the new module tested at its interface, so that tests survive internal refactors.
21. As a QA engineer, I want existing trace-context and principal-resolution tests to remain valid, so that prior coverage still proves the lower-level contracts.
22. As a QA engineer, I want at least one handler-level test that proves unexpected failures are trace-correlated through the new seam, so that the request path is verified end-to-end.
23. As a future contributor, I want **Planning Request Context** documented in the glossary, so that architecture reviews and implementation work use one term.
24. As a future contributor, I want the wrapper to leave route shapes and response bodies unchanged, so that adopting the module does not create product-level regressions.
25. As a future contributor, I want legacy Planning handlers to adopt the same seam as **Saved Weekplan** handlers, so that legacy route deprecation does not preserve duplicated cross-cutting code.
26. As a future contributor, I want repository modules to remain unaware of request headers, cookies, and logging concerns, so that domain and persistence logic stay local.
27. As a planner saving or editing a **Saved Weekplan**, I want failures to be easier for the team to trace and fix, so that handler issues are resolved faster.
28. As a planner using the application anonymously, I want anonymous ownership behavior to stay consistent across Planning routes, so that saved data behaves predictably.
29. As a planner using an authenticated account, I want Planning mutations to keep their current authorization behavior, so that this refactor does not change who can access what.
30. As a release manager, I want this module introduced without changing public Planning contracts, so that the rollout remains low-risk.

## Implementation Decisions

- **Domain vocabulary**
  - Use **Planning Principal** for the current actor on principal-based Planning reads and mutations.
  - Use **Planning Request Context** for the request-scoped module interface that supplies the **Request Context Trace ID**, the current **Planning Principal**, and a request-scoped **Application Logger** to Planning handlers.

- **Seam placement**
  - The seam is a **Planning-only handler wrapper**, not global middleware.
  - Existing trace middleware remains the owner of **Request Context Trace ID** resolution and response-header behavior.
  - Planning-specific auth and anonymous-session behavior must not run for non-Planning routes.

- **Deep modules to build or strengthen**
  - **Planning Request Context module**: the main deep module. It concentrates principal resolution, request-scoped logging, and unexpected-error handling behind one interface.
  - **Planning auth adapter**: the adapter that resolves an authenticated user from the incoming bearer token. Production uses the current Supabase-backed behavior; tests use doubles.
  - **Planning handler wrapper**: the entry seam that binds handler metadata once and exposes a small interface to handler code.
  - **Planning unexpected-error adapter**: centralized behavior for logging unknown failures with trace correlation and returning the standard Planning 500 payload.

- **Handler interface**
  - Each adopting handler declares stable metadata once: handler tag and operation name.
  - The wrapper supplies the handler with the existing request event plus a **Planning Request Context** that includes:
    - the **Request Context Trace ID**
    - the current **Planning Principal**
    - the current principal kind in a log-safe form
    - a request-scoped **Application Logger** already bound to handler metadata
  - Handlers continue to own request parsing, schema validation, and repository orchestration.

- **Behavior behind the seam**
  - Resolve the **Planning Principal** from authenticated user information when available; otherwise reuse or mint the anonymous planning session.
  - Bind the request-scoped **Application Logger** with the handler’s metadata and the **Request Context Trace ID**.
  - Pass expected HTTP errors through unchanged.
  - Log unexpected failures once with the standard Planning error event, include a generated error identifier, and return the standard Planning 500 payload.

- **Dependency strategy**
  - Header reads, cookies, request context access, and trace lookup are in-process implementation details.
  - Bearer-token-to-user resolution is a true external dependency and must stay behind an adapter.
  - The shared **Application Logger** remains local-substitutable inside the module implementation and is not redefined by this PRD.

- **Adoption scope**
  - First adoption slice: principal-based **Saved Weekplan** handlers and legacy principal-based Planning CRUD handlers.
  - **Anonymous merge** is out of the first cut because it needs both authenticated-user and anonymous-session state at the same time rather than one **Planning Principal**.
  - The internal anonymous idle purge flow is out of the first cut because it has no **Planning Principal**.

- **Public-contract expectations**
  - No HTTP route changes.
  - No request or response schema changes.
  - No persistence schema changes.
  - No changes to the current ownership rules for **Saved Weekplans** or legacy Planning records.

- **Architectural clarifications**
  - The wrapper should deepen the handler interface, not become a shallow pass-through around unrelated infrastructure.
  - Repository modules must remain free of request/header/cookie/logger knowledge.
  - This PRD does not reopen the existing decision to keep trace resolution in dedicated middleware.

## Testing Decisions

- **What makes a good test**
  - Test external behavior at the module interface, not implementation order or helper composition details.
  - Assert observable outcomes: resolved principal shape, presence of the **Request Context Trace ID**, request-scoped logging behavior, pass-through of expected HTTP errors, and wrapping of unexpected failures.
  - Keep tests resilient to internal refactors by avoiding assertions on private helpers or call sequences that are not part of the interface.

- **Modules to test**
  - **Planning Request Context module**
    - resolves the expected **Planning Principal**
    - exposes the **Request Context Trace ID**
    - provides a request-scoped logger with stable handler metadata
    - logs unexpected failures once and returns the standard Planning 500 behavior
  - **Planning auth adapter**
    - resolves authenticated-user identity correctly through production behavior and test doubles
    - treats missing or invalid bearer input as anonymous fallback behavior
  - **Planning handler wrapper**
    - preserves expected HTTP errors
    - injects request context into adopting handlers consistently
    - keeps handler code focused on request-specific logic
  - **Adopting handler tests**
    - one **Saved Weekplan** handler and one legacy Planning handler should prove the new seam works in both modern and legacy routes without changing route behavior

- **Prior art in the codebase**
  - Existing unit tests around trace behavior, principal resolution, structured logging, and Planning error behavior provide the right style and coverage boundaries for the lower-level contracts.
  - Existing integration-style logging tests provide prior art for verifying trace-correlated request behavior without overfitting to implementation details.

## Out of Scope

- A generic server-wide Request Context module for non-Planning routes.
- Replacing or relocating the existing trace middleware.
- Public route changes or response-shape changes.
- Persistence-schema or ownership-model changes.
- Refactoring repository logic beyond adopting the new seam in handlers.
- Pulling **anonymous merge** into the first implementation slice.
- Pulling the internal anonymous idle purge flow into the first implementation slice.
- Reworking the shared **Application Logger** or its redaction policy.
- Publishing this PRD to the project issue tracker; this version is intentionally local.

## Further Notes

- This PRD reflects the architecture review already completed in the current session.
- `CONTEXT.md` now defines **Planning Principal** and **Planning Request Context** so future work can use stable project vocabulary.
- The recommended rollout is to adopt the seam in **Saved Weekplan** handlers first, then extend the same module to legacy principal-based Planning CRUD handlers.

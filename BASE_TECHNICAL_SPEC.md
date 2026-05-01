# Base Technical Spec (Nuxt 3 SPA, Solo Builder)

## 1) Architecture Overview

- **Architecture style:** Modular Nuxt 3 SPA with a thin internal API layer (`/server/api`) for data access and business rules.
- **Runtime model:** Client-rendered SPA (`ssr: false`) + Nitro server routes for backend endpoints.
- **Core modules:**
  - `App Shell` (routing, layout, navigation, global UI state)
  - `Feature Modules` (domain-specific pages/components/composables)
  - `UI System` (shadcn components + app-level primitives)
  - `Data Layer` (typed API client + DTO mapping + error normalization)
  - `Server API` (validation, persistence, auth placeholder even if MVP has none)
  - `Testing` (Vitest for unit/component + optional API integration tests)

### Recommended folder structure (pragmatic default)

```txt
.
├─ app.vue
├─ nuxt.config.ts
├─ assets/
│  └─ css/tailwind.css
├─ components/
│  ├─ ui/                  # shadcn generated components
│  ├─ shared/              # reusable app components
│  └─ feature/             # feature-scoped components
├─ composables/
│  ├─ useApi.ts
│  ├─ useError.ts
│  └─ useFeatureX.ts
├─ layouts/
│  └─ default.vue
├─ pages/
│  ├─ index.vue
│  └─ feature-x/
├─ plugins/
│  ├─ api-client.ts
│  └─ zod.ts               # optional runtime schema helpers
├─ server/
│  ├─ api/
│  │  └─ v1/
│  │     └─ feature-x/
│  ├─ db/                  # db client + repositories
│  ├─ services/            # business logic
│  └─ utils/
├─ types/
│  ├─ api.ts
│  └─ domain.ts
├─ utils/
│  ├─ cn.ts                # class merge helper for Tailwind/shadcn
│  └─ constants.ts
├─ stores/                 # Pinia only for cross-page/global state
├─ tests/
│  ├─ unit/
│  ├─ component/
│  └─ integration/
└─ e2e/                    # Playwright (recommended)
```

### Data flow and state management

- **Flow:** `Page -> composable -> typed API client -> /server/api -> service -> repository/db`.
- **State default:** local component state first, then composables, then Pinia only when shared/global.
- **Caching:** keep simple with `useFetch`/`useAsyncData` keys and explicit refresh.
- **Error handling:** normalize all API errors to one shape (`code`, `message`, `details`) and surface via toasts + inline states.
- **Validation:** Zod schemas at server boundary (request/response), optional client-side schema reuse.

## 2) Technology Decisions

### Why this stack fits

- **Nuxt 3 SPA:** fast setup, strong DX, routing/layouts/composables out of box, easy path to SSR later if needed.
- **TypeScript:** safer refactors for solo dev, clearer contracts between UI/API/server.
- **Vitest:** very fast feedback loop, native Vite integration, low config overhead.
- **shadcn/ui + Tailwind:** rapid UI development, consistent design primitives, easy customization without fighting a rigid component library.

### Missing essentials to add now

- **Linting:** `@nuxt/eslint` + `typescript-eslint` + `eslint-plugin-vue`.
- **Formatting:** `prettier` + `prettier-plugin-tailwindcss`.
- **Type checks:** `vue-tsc --noEmit` in CI.
- **E2E tests:** Playwright (small smoke suite only).
- **Git hooks:** `husky` + `lint-staged` (run lint + tests on staged files).
- **CI/CD:** GitHub Actions for lint/typecheck/unit/e2e smoke.
- **Env management:** `.env`, `.env.example`, runtime validation (Zod or `envalid`).
- **API contracts:** lightweight OpenAPI optional; at minimum shared TS/Zod types.
- **Error monitoring:** Sentry (add when you deploy publicly).
- **DB/migrations (if needed):** Prisma + SQLite/Postgres (or Drizzle, both fine).

### Tradeoffs + lightweight alternatives

- **Pinia vs no store:** start without Pinia unless shared state emerges.
- **Prisma vs Drizzle:** Prisma faster modeling ergonomics; Drizzle leaner SQL control.
- **Playwright vs none:** skip initially only if deadlines are extreme; add at least 2-3 smoke tests before beta.
- **Sentry vs logs only:** logs-only is okay in private MVP, risky in public usage.
- **Nuxt server API vs separate backend:** internal API is fastest now; split later if scale/team grows.

## 3) Development Standards

### Code conventions (solo-friendly)

- **File naming:** `kebab-case` for files, `PascalCase` for Vue components.
- **Imports:** absolute aliases (`~/`, `@/`) and keep imports top-of-file.
- **Types:** no `any` unless explicitly justified; prefer explicit return types in shared utilities/services.
- **Boundaries:** pages orchestrate; composables coordinate; services contain business rules; repositories do persistence.
- **Complexity rule:** if file > ~250 lines or has >1 responsibility, split.
- **Commit style:** small, feature-scoped commits with imperative messages (`add recipe create flow`).

### Testing strategy with Vitest

- **Unit tests (majority):**
  - Utils, composables, service functions, validation schemas.
  - Fast and deterministic; avoid network/DB where possible.
- **Component tests (targeted):**
  - Critical UI states: loading, empty, error, success.
  - Use Vue Test Utils + Testing Library patterns.
- **Integration tests (thin slice):**
  - API route -> service -> repository happy path + key failure path.
- **E2E smoke (Playwright):**
  - App loads
  - Core create/edit flow works
  - Error UI appears on forced failure
- **Coverage goal:** start at ~60% meaningful coverage, prioritize business-critical paths over raw percentage.

### UI/component strategy (shadcn + Tailwind)

- **Design tokens first:** define colors/spacing/radius once and reuse.
- **Component policy:**
  - Use shadcn primitives as base.
  - Wrap app-specific patterns in `components/shared`.
  - Avoid deep prop drilling; use slots/composition.
- **Tailwind usage:**
  - Prefer utility composition via helper (`cn`) + variant helpers (`class-variance-authority`) for reusable variants.
  - Keep classes readable; extract repeated patterns into components, not giant class strings.
- **Accessibility baseline:** keyboard focus states, semantic elements, labels, contrast checks on all interactive controls.

## 4) Delivery Plan (MVP -> v1)

### Phase 0: Foundation (2-4 days)

- **Outcomes:**
  - Nuxt app scaffolded, SPA mode configured
  - Tailwind + shadcn integrated
  - ESLint/Prettier/Vitest/CI baseline working
  - App shell + error handling + typed API utility

### Phase 1: MVP Core Feature (1-2 weeks)

- **Outcomes:**
  - 1 primary end-to-end user workflow fully working
  - Server API routes + data persistence for core objects
  - Basic validation + optimistic UI where safe
  - Unit tests for core logic + 2-3 E2E smoke tests

### Phase 2: MVP Hardening (3-5 days)

- **Outcomes:**
  - Improved UX states (empty/loading/error)
  - Logging and basic monitoring
  - Performance pass (bundle + slow interactions)
  - Deployment pipeline to self-host target

### Phase 3: v1 Expansion (2-4 weeks)

- **Outcomes:**
  - Secondary workflows
  - Improved reliability/observability
  - Security pass (rate limit, input hardening, secrets handling)
  - Test expansion for regression-prone paths

## 5) Solo-Dev Risks & Mitigation

- **Scope creep**
  - Keep a strict "Now/Next/Later" backlog and freeze MVP scope weekly.
- **Over-architecture**
  - Use simple defaults; introduce abstractions only after second real use case.
- **Regression risk**
  - Add tests for every bug fix and critical flow; keep smoke e2e running in CI.
- **Delivery fatigue**
  - Timebox refactors; ship value slices every few days.
- **Ops blind spots (self-host)**
  - Add health endpoint, structured logs, backup/restore checklist, and rollback command.
- **Single point of failure (you)**
  - Maintain concise `README` + `runbook` + `.env.example` so project is recoverable after breaks.

## Concrete Defaults (recommended)

- `Nuxt`: `ssr: false`, route rules minimal, runtime config typed.
- `State`: component/composable first, Pinia only when shared across 3+ screens.
- `Validation`: Zod on all API inputs.
- `DB`: Prisma + Postgres (or SQLite in local dev).
- `Testing`: Vitest + Vue Test Utils + Playwright smoke.
- `Quality gates`: `lint`, `typecheck`, `test` on PR/merge.
- `CI`: GitHub Actions (single workflow, matrix optional later).
- `Release cadence`: one production deploy per week minimum.

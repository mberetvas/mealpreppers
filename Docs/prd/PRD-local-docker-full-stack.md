# PRD: Local full-stack Docker (Mealprepper + Supabase)

**Triage:** `ready-for-agent` (local PRD — not published to an external issue tracker)

## Problem Statement

Developers need a **repeatable local full-stack** environment: Mealprepper running in a **production-style** container alongside the **full Supabase** platform (database, API gateway, Auth, REST, Realtime, Storage, Studio, and related services), without juggling separate tools or manual database bootstrap. Today there is no single, documented path to `docker compose up` from a clean clone with **automatic schema application** and correct behavior for **Supabase Storage** URLs returned to the browser.

## Solution

Provide a **root `docker-compose.yml`** that **`include`s** a **vendored, pinned** Supabase Compose fragment, plus Mealprepper **`app`** and a **one-shot migration** service. Configuration lives in a **single root `.env`** (with **`.env.example`** and explicit “not for production” guidance). The Mealprepper **server** uses the **Supabase server origin** inside the Compose network; any URL intended for the **browser** (e.g. public recipe image URLs) uses the **Supabase browser origin** so assets load on the developer host.

## User Stories

1. As a developer, I want to run **`docker compose up` from the repo root** after copying **`.env.example`** to **`.env`**, so that I can start working without undocumented steps.
2. As a developer, I want **all host ports** configurable via **`.env`**, so that I avoid clashes with other local services.
3. As a developer, I want **`.env.example`** to suggest sensible default port mappings (e.g. app vs Studio), so that first-time setup is guided without hard-coded YAML ports.
4. As a developer, I want the Mealprepper container to run a **built Nitro** app (production-style), so that local Docker matches how the app is served after `build`.
5. As a developer, I want **Bun** used consistently with project conventions for install and runtime in the image, so that behavior matches the rest of the repo toolchain.
6. As a developer, I want the **full Supabase stack** available locally, so that Auth, REST, Realtime, Storage, and Studio behave like a real Supabase project.
7. As a developer, I want the Supabase Compose definition **vendored and pinned** in-repo, so that `git clone` plus `.env` is enough with no first-run download of upstream YAML.
8. As a maintainer, I want a **clear boundary** between root orchestration and the vendored Supabase fragment, so that upgrading Supabase is a deliberate merge/replace and image re-pin.
9. As a developer, I want **`supabase/migrations/*.sql` applied automatically** on first start (empty DB volume), so that I never forget to migrate before hitting the app.
10. As a developer, I want the migration job to **depend on database health**, so that SQL does not race a starting Postgres.
11. As a developer, I want migrations applied in a **stable order** (e.g. lexicographic by filename matching existing migration naming), so that dependencies between migrations are respected.
12. As a developer, I want the **`app` service** to start only after Supabase dependencies and migrations succeed, so that the UI does not surface confusing errors on cold boot.
13. As a developer, I want **one root `.env`** for Supabase services, Mealprepper, and the migrate job, so that I do not maintain duplicate env files.
14. As a developer, I want **demo JWT and keys** acceptable for this local stack, so that I am not forced to generate secrets for laptop use — with **`.env.example`** stating they must not be used on the public internet.
15. As a developer, I want **CONTEXT.md** to name **Supabase server origin** vs **Supabase browser origin**, so that reviews and debugging use shared language (already recorded for this effort).
16. As a recipe contributor, I want **recipe image uploads** to return URLs that **load in my browser** when using Docker, so that the feature works end-to-end locally.
17. As a frontend developer, I want no change to **public HTTP contracts** beyond correct absolute URLs for Storage, so that clients keep the same response shapes.
18. As an operator (local), I want **structured logs** from Mealprepper to remain governed by **Log Configuration** and **Execution Environment**, so that observability rules stay consistent inside the container.
19. As a maintainer, I want **no secrets or PII** in **`.env.example`** or migration logs, so that the repo stays safe to share.
20. As a CI maintainer, I want the option to **build the image** in automation later without this PRD forcing CI scope now, so that Docker artifacts can grow incrementally.
21. As a security-conscious developer, I understand this stack is **local-only** by decision, so that I do not mistake default keys for production posture.
22. As a developer on Linux, I want documented constraints if **host↔container networking** nuances appear (e.g. special hosts), so that URL configuration remains understandable.
23. As a developer, I want **Supabase Studio** reachable on a configured host port, so that I can inspect data and auth during feature work.
24. As a developer, I want **persistent Postgres data** via a named volume by default, so that restarts do not wipe local data unexpectedly.
25. As a developer, I want a **fresh start** documented (how to reset volumes), so that I can reproduce “empty DB + migrate” when debugging migrations.
26. As a maintainer, I want **image tags pinned** in env or compose variables, so that upgrades are explicit rather than silent `latest` drift.
27. As a future contributor, I want a short **Further Notes** or README pointer** describing how to refresh the vendored Supabase fragment**, so that upgrades are not tribal knowledge.
28. As a tester, I want **unit tests** around URL behavior for the browser-facing origin, so that regressions are caught without standing up full Compose in every test run.
29. As a developer, I want **runtime config** to validate that both origins and the service role key are present in the container, so that misconfiguration fails fast with a clear message.
30. As a developer, I want the **Supabase server origin** to use Docker DNS hostnames (e.g. gateway service), so that server-side SDK calls work from the `app` container.

## Implementation Decisions

- **Scope**
  - **Local full-stack only**: not internet-facing production; default keys allowed with strong documentation.

- **Compose layout**
  - **Root `docker-compose.yml`** is the only entrypoint developers run; it uses Compose **`include:`** to pull in a **vendored** Supabase stack file maintained under a dedicated directory (e.g. `docker/supabase/`).
  - **Vendor + pin**: copy upstream Supabase Docker Compose into the repo; pin service images via environment variables or explicit tags; refresh by merging/replacing that fragment and updating pins.

- **Services**
  - **Supabase fragment**: full upstream-equivalent set of services as required by the chosen pinned template.
  - **`migrate`**: short-lived service that applies `supabase/migrations/*.sql` in order when the database is healthy; exits successfully before or as `app` starts.
  - **`app`**: Mealprepper image built **multi-stage** (install → `build` → minimal runtime), serving Nitro output; depends on Supabase readiness and successful migration.

- **Configuration**
  - **Single root `.env`** / **`.env.example`** for all services; no second nested `.env` that must be kept in sync.
  - **All host port mappings** driven by variables referenced from Compose; `.env.example` lists suggested values and documents overlap risks (e.g. Studio vs app ports).

- **Dual-origin Supabase URLs (glossary-aligned)**
  - **`SUPABASE_URL` (or equivalent)** resolves to the **Supabase server origin** for the server-side Supabase client inside Compose.
  - A **separate** setting (e.g. **`SUPABASE_PUBLIC_URL`**) holds the **Supabase browser origin** used when emitting URLs that must load in the user agent.
  - **Nuxt `runtimeConfig`** gains a private field for the browser origin; it is **not** a public client bundle concern unless the product later requires it.
  - **Storage public URLs**: only one handler path currently uses `getPublicUrl`; that response must rewrite or construct the public absolute URL using the **Supabase browser origin** while uploads continue to use the server client pointed at the **Supabase server origin**.

- **Deep modules (testable seams)**
  - **Supabase URL rewriting for public responses**: a small pure helper (e.g. replace the server origin with the browser origin on absolute Storage URLs) with stable inputs/outputs; keeps handlers thin.
  - **Migrate runner**: implement as an **ephemeral container command** (shell + `psql` or similar) with minimal logic: wait for DB, apply ordered files, fail loudly on first error — isolates operational detail from application code.
  - **Dockerfile build/run**: encapsulates Bun install, `nuxt build`, and production serve command so the Compose file stays declarative.

- **Runtime / execution**
  - Mealprepper **Execution Environment** inside the container should be **`production`** for this stack unless a future decision documents otherwise; **Log Level** remains configurable via existing **Log Configuration** env vars.

- **Documentation**
  - **`.env.example`** must state: default keys and ports are for **local development only**; rotate everything for any exposed deployment.

## Testing Decisions

- **Good tests** assert **observable behavior**: returned image URLs use the **Supabase browser origin** when configured; they do not depend on Docker internals or Compose service names.
- **Modules to test**
  - **URL rewrite / public URL builder** helper: unit tests with representative Supabase Storage URL shapes.
  - **Optional**: narrow handler-level test only if an existing pattern already exercises multipart or storage seams without heavy setup; prefer the pure helper for most coverage.
- **Prior art**
  - Follow existing **Vitest** unit style and mocking patterns used for API handler seams and utilities elsewhere in the project.

## Out of Scope

- Hardened **production** deployment (TLS termination, secret rotation, backups, resource quotas, threat modeling).
- **Kubernetes**, Helm, or cloud-specific orchestration.
- **CI** job to build/push images (may be added later).
- Changing **Supabase schema design** beyond applying existing migrations automatically.
- **Anonymous idle purge** cron wiring inside Compose (existing env secret may be documented but scheduling is not required for this PRD).
- **Replacing** Supabase CLI workflows for developers who prefer `supabase start` without Compose.

## Further Notes

- Glossary entries **Supabase server origin** and **Supabase browser origin** are recorded in **CONTEXT.md** under **Local full-stack (Docker)**.
- When upgrading the vendored fragment, re-verify **Kong** port variables, **JWT** consistency across services, and that **Storage** and **Auth** still match Mealprepper’s use of the service-role client.
- If additional features later emit absolute Supabase URLs to the browser, they must go through the same **browser origin** policy.

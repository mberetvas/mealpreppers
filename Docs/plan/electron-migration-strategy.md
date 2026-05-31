# Electron Migration Strategy

Strategy for packaging the Mealprepper Nuxt application as a cross-platform Electron
desktop app installable on Windows, Linux, and macOS.

> Status: proposal for implementation. This document defines decisions and sequencing.
> It does not change application code.

---

## 1. Objective and scope

**Objective.** Ship Mealprepper as a signed, auto-updating desktop application for
Windows, Linux, and macOS while keeping a single shared codebase with the existing web
app and minimizing disruption to ongoing web development.

**In scope**

- Wrapping the existing Nuxt 4 / Nitro application in Electron.
- A reproducible cross-platform build, signing, and release pipeline.
- A hardened IPC + preload security boundary.
- Desktop-specific concerns: auto-update, OS integration, offline behavior, secret handling.

**Out of scope (for the first desktop release)**

- Rewriting business logic or UI for desktop-only paradigms.
- Replacing Supabase or the Nitro server layer.
- Mobile (Capacitor/Tauri) targets — evaluated only as alternatives, not delivered.

**Success criteria**

- Same feature set as web, reachable offline-tolerant where feasible.
- One CI workflow produces installers for all three OSes.
- No application secrets shipped inside the renderer bundle.

---

## 2. Current architecture assumptions

Derived from the repository (`package.json`, `nuxt.config.ts`, `server/`).

| Concern | Current state | Desktop implication |
|---|---|---|
| Framework | Nuxt 4 (`nuxt ^4.4.4`), Vue 3, TypeScript | SSR + Nitro server present, not a pure SPA |
| Backend | Nitro server routes under `server/api/v1/**` | Server must run somewhere in the desktop topology |
| Secrets | `runtimeConfig` server-only: `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, purge secret | **Must never reach the renderer or be bundled into the client** |
| Data | Supabase (`@supabase/supabase-js`) accessed from Nitro routes | Requires network; needs offline/degraded handling |
| AI | OpenRouter / LangChain calls server-side | Server-side only; same constraint as secrets |
| Styling | Tailwind CSS | No change needed |
| Tooling | Bun (`bun.lock`), Vitest, ESLint (`@nuxt/eslint`) | Bun stays the package manager/runner; Electron toolchain layered on top |
| Build | `nuxt build` / `nuxt generate` | `build` yields a Nitro server output; `generate` yields static — see §5 |

**Key architectural fact:** privileged secrets live in the Nitro server, not the client.
The desktop topology must preserve a trusted server boundary. A naive "load the SPA in a
`BrowserWindow`" approach would either break server routes or leak secrets, so it is rejected.

---

## 3. Recommended Electron architecture

**Recommendation: Electron main process + bundled Nitro sidecar server + renderer pointing at `http://localhost`.**

```
+-------------------------------------------------------------+
| Electron App (single packaged binary)                       |
|                                                             |
|  Main process (Node)                                        |
|   - app lifecycle, windows, menus, tray, auto-update        |
|   - spawns/embeds Nitro server (node-server preset)         |
|   - owns OS secrets via OS keychain (safeStorage/keytar)    |
|        |                         ^                           |
|        | spawn / in-process      | IPC (contextBridge)      |
|        v                         |                          |
|  Nitro server (localhost:PORT)   Preload (isolated bridge)  |
|   - server/api/v1/** unchanged   |                          |
|   - holds service-role + AI keys |                          |
|        |                         |                          |
|        v                         v                          |
|  Supabase / OpenRouter      Renderer (BrowserWindow)        |
|  (remote over TLS)           - Nuxt client app              |
+-------------------------------------------------------------+
```

Rationale:

- Preserves the existing trusted server boundary verbatim — `server/api/v1/**` keeps
  working with no rewrite and secrets stay server-side.
- The renderer talks to `http://127.0.0.1:<port>` exactly as the web client talks to its
  origin, so `$fetch`/route calls need no change.
- Keeps a single codebase: the same Nitro output runs in the cloud (web) and bundled
  (desktop).

Tradeoff: ships a Node server inside the app and binds a local port. Mitigations in §7.

---

## 4. Renderer, main process, and preload responsibilities

### Main process (Node, fully trusted)

- App lifecycle: `app`, windows, menus, tray, single-instance lock, deep links.
- Start/stop and health-check the bundled Nitro server on a random free port; inject the
  server's env (secrets) at spawn time.
- Own all privileged OS access: filesystem dialogs, keychain, auto-update, notifications.
- Read secrets from the OS keychain (`safeStorage`) and pass them to Nitro via env — never
  to the renderer.
- Expose a **narrow, allow-listed** IPC surface via `ipcMain.handle`.

### Preload (isolated bridge, minimal)

- `contextBridge.exposeInMainWorld` a small, typed API (e.g. `window.desktop`).
- No Node globals leaked; expose only specific, named operations (open file, save export,
  get app version, check for updates).
- Validate/normalize arguments before forwarding to `ipcRenderer.invoke`.

### Renderer (Nuxt client, untrusted)

- Runs the existing Vue/Nuxt UI unchanged.
- Calls `localhost` Nitro routes for data exactly as on web.
- Uses `window.desktop.*` only for genuinely desktop-only capabilities.
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.

| Capability | Renderer | Preload | Main | Nitro sidecar |
|---|:--:|:--:|:--:|:--:|
| UI / Vue components | ✓ | | | |
| App data (CRUD, AI) | calls localhost | | | ✓ |
| Supabase service-role key | ✗ | ✗ | holds | uses |
| OS file dialog / save | | proxies | ✓ | |
| Auto-update | | trigger | ✓ | |
| Keychain secret read | | | ✓ | receives via env |

---

## 5. Recommended integration approach for Nuxt inside Electron

Three viable options were considered.

| Option | How | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Bundled Nitro sidecar** (recommended) | `nuxt build` (node-server preset), spawn the Nitro server in main, renderer loads `localhost` | Server routes + secrets work unchanged; one codebase for web + desktop; minimal app-code change | Ships Node server; manage port/lifecycle | **Chosen** |
| B. Static `nuxt generate` SPA | Pre-render to static, load via `file://`/custom protocol; drop Nitro | No local server, smaller | **Breaks `server/api/v1/**`**; secrets would have to move client-side or to a remote API — large rewrite/risk | Rejected |
| C. Remote-only backend | Desktop renderer points at the hosted production Nitro API | Thinnest client; no bundled server | Hard online dependency; no offline path; duplicate auth/CORS handling; couples desktop release to web infra | Rejected as primary; viable later as an optional "thin" mode |

**Why A.** The codebase keeps privileged logic and secrets in Nitro. Options B and C force
that logic to move (rewrite + new attack surface) or make the app online-only. Option A
preserves the existing trust boundary, requires the least code change, and keeps web and
desktop on one build.

Implementation notes for A:

- Use Nitro's `node-server` preset (`NITRO_PRESET=node-server nuxt build`) to emit
  `.output/server/index.mjs`; run it in-process or as a child process from main.
- Bind to `127.0.0.1` on an OS-assigned free port; pass the port to the renderer at
  window creation.
- Gate the window load on a Nitro health check to avoid a blank/early-load race.
- Keep `runtimeConfig` server-side; inject secrets at spawn from the keychain (§8).

---

## 6. Cross-platform packaging and installer strategy

**Builder: `electron-builder`** (mature multi-target signing/notarization/update support).

| OS | Target(s) | Notes |
|---|---|---|
| Windows | **NSIS** installer (primary) + optional portable | Per-user install avoids admin prompts; integrates with Squirrel-free `electron-updater`. Optional MSIX later for Store. |
| macOS | **DMG** + **zip** (zip required for auto-update) | Universal build (`x64` + `arm64`); hardened runtime + notarization mandatory (§10). |
| Linux | **AppImage** (primary) + **deb** + optional **rpm** | AppImage for portable auto-update; deb/rpm for distro package managers. Snap/Flatpak optional later. |

Guidelines:

- Bundle the Nitro `.output` and a Node runtime via `extraResources`/`asarUnpack` (native
  deps cannot live inside `asar`).
- Generate per-OS icons and metadata; set stable `appId` for update channels.
- Build each OS on its native CI runner (macOS signing/notarization requires macOS;
  Windows signing prefers Windows).

---

## 7. Security model and hardening requirements

Mandatory `BrowserWindow` webPreferences:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true` (never disable)

Additional requirements:

- **Bind Nitro to `127.0.0.1` only** and use a random port; never `0.0.0.0`.
- Add a per-launch shared secret/token between main and Nitro (header check) so other
  local processes cannot drive privileged routes on the bound port.
- Strict **CSP** for the renderer; restrict `default-src`/`connect-src` to the local
  origin and required remote hosts (Supabase, OpenRouter, fonts CDN currently in
  `app.head`).
- Block unexpected navigation: handle `will-navigate` and `setWindowOpenHandler` to deny
  arbitrary external navigation; open external links in the system browser.
- Disable `webview` tag and remote module; no `allowRunningInsecureContent`.
- Validate every IPC argument in the main process; treat the renderer as untrusted.
- Keep Electron pinned and patched; track CVEs as a release gate.

---

## 8. Authentication, local storage, and offline/data-sync

**Authentication**

- Continue Supabase auth via the Nitro server boundary; the renderer holds only the user
  session, not service-role credentials.
- For OAuth/redirect flows, register a **custom protocol / deep link** (e.g.
  `mealprepper://auth/callback`) and complete the exchange in main/Nitro, not in a raw
  renderer redirect.

**Secret handling**

- App-level secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, purge secret) are
  **never bundled**. Provision them into the OS keychain via Electron `safeStorage`
  (DPAPI on Windows, Keychain on macOS, libsecret on Linux) and inject at Nitro spawn.
- User session tokens persisted via `safeStorage`-encrypted storage, not plain disk.

**Local storage & offline**

- Use the renderer's normal storage for UI state; cache read-heavy data (recipes,
  plans) for offline-tolerant viewing.
- Define a sync policy: optimistic local writes queued and replayed to Supabase when
  online; last-write-wins or per-entity conflict rules documented per feature.
- Surface clear online/offline state in the UI; degrade AI/OpenRouter features gracefully
  when offline (they require network).

---

## 9. Development workflow changes

- Keep **Bun** as package manager/runner and **Vitest** for tests; add an `electron/`
  workspace (main, preload, builder config) layered on the existing app.
- Dev mode: run `nuxt dev` and point an Electron dev window at the dev server URL with
  hot reload; production mode loads the bundled Nitro sidecar.
- Add scripts: `desktop:dev`, `desktop:build`, `desktop:pack` alongside existing `dev`/`build`.
- Extend ESLint to cover `electron/`; keep the renderer lint config unchanged.
- Tests: existing unit/component/Nuxt Vitest projects stay as-is; add a thin smoke test
  for main-process startup and the preload IPC contract.
- Document a local "secrets bootstrap" step so engineers can seed the keychain in dev.

---

## 10. Build, signing, notarization, and release pipeline

CI: GitHub Actions matrix across `macos`, `windows`, `ubuntu` runners; each builds its
own installers and uploads artifacts.

| Stage | Windows | macOS | Linux |
|---|---|---|---|
| Build | NSIS + portable | DMG + zip (universal) | AppImage + deb/rpm |
| Sign | Authenticode (EV/OV cert) | Developer ID Application, hardened runtime | (optional) detached GPG for repos |
| Notarize | n/a | `notarytool` + staple | n/a |
| Update | `electron-updater` (NSIS) | `electron-updater` (zip) | `electron-updater` (AppImage) |

Requirements:

- **macOS:** Developer ID signing + hardened runtime + entitlements; notarize and staple
  or the app is blocked by Gatekeeper. Build on macOS runners.
- **Windows:** Authenticode signing to avoid SmartScreen warnings; per-user NSIS install.
- **Linux:** signing is optional; provide checksums; AppImage carries the updater.
- **Auto-update:** `electron-updater` against a release feed (GitHub Releases or a static
  host); separate `stable`/`beta` channels keyed by `appId`.
- Store signing certs/notarization creds as CI secrets only; never in the repo.
- Release gate: version bump, changelog, all platform artifacts signed, smoke test passing.

---

## 11. Phased migration plan with milestones

| Phase | Milestone | Outcome |
|---|---|---|
| 0 | Spike | Electron shell loads the existing app against a `nuxt dev` URL; validate Option A end-to-end. |
| 1 | Sidecar integration | Bundle Nitro `node-server` output; main spawns it on a local port; renderer loads `localhost`; health-gated startup. |
| 2 | Security boundary | `contextIsolation`/`sandbox`, hardened `webPreferences`, CSP, minimal preload API, IPC allow-list, navigation guards. |
| 3 | Secrets & auth | Keychain (`safeStorage`) secret injection; deep-link OAuth callback; encrypted session storage. |
| 4 | Packaging | `electron-builder` targets for all three OSes producing installable artifacts (unsigned dev builds). |
| 5 | Signing & notarization | Authenticode + Developer ID + notarization wired into CI matrix. |
| 6 | Auto-update & offline | `electron-updater` channels; offline-tolerant caching and sync policy. |
| 7 | Release hardening | Smoke tests, CVE/Electron update gate, GA release. |

Disruption is minimized: phases 0–3 add an `electron/` layer without touching app code;
the web build/deploy path is unchanged throughout.

---

## 12. Risks, tradeoffs, and open questions

**Risks / tradeoffs**

- **Bundled Node server** increases package size and startup complexity vs. a static SPA;
  accepted to preserve the secret boundary and avoid a backend rewrite.
- **Local port binding** is an attack surface; mitigated by `127.0.0.1`-only binding plus a
  per-launch token.
- **macOS notarization** adds release friction and an Apple Developer account dependency.
- **Auto-update infra** must be reliable; a bad release can brick clients — needs staged
  rollout and rollback.
- **Native dependency packaging** (asar unpack, Node runtime) can break per-OS; covered by
  the CI matrix building natively.

**Open questions**

- Should desktop secrets be provisioned per-user at first run, or fetched from a hosted
  token-broker so service-role keys never live on client machines at all? (Token-broker is
  more secure; revisit if any secret currently in `runtimeConfig` is too sensitive to ship.)
- Universal vs. per-arch macOS builds — size vs. simplicity.
- Update feed host: GitHub Releases vs. self-hosted static bucket.
- Offline scope: which features are guaranteed offline vs. online-only (AI features are
  inherently online)?
- Linux target priority: is AppImage sufficient for v1, or are deb/rpm required at launch?

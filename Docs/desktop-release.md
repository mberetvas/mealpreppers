# Desktop release (Windows v1)

Manual release process for the Tauri desktop build. CI produces unsigned (or signed when secrets
are configured) installer artifacts from [`.github/workflows/desktop-windows.yml`](../.github/workflows/desktop-windows.yml).

## Fresh install layout

After installing the packaged app on Windows, first launch creates:

| Path | Purpose |
|------|---------|
| `%APPDATA%\com.mealprepper.app\` | App data root (shown in **Settings → Data directory**) |
| `%APPDATA%\com.mealprepper.app\mealprepper.db` | SQLite database |
| `%APPDATA%\com.mealprepper.app\recipe-images\` | Local recipe image files |
| `%APPDATA%\com.mealprepper.app\local-user-id` | Install-scoped Planning Principal id |

Use **Settings → Open data folder** to reveal the directory in Explorer.

## Manual smoke checklist (unsigned or signed build)

Run on a clean Windows VM or spare machine when validating a release candidate.

### Offline core flows (disconnect network after install)

- [ ] App launches with main window visible; navigation loads after sidecar is ready (no splash)
- [ ] **Recipes**: create, edit, delete a manual recipe; local image upload works
- [ ] **Weekly Plan**: build a draft week plan
- [ ] **Saved Weekplans**: save plan with title; reopen from Manage plans
- [ ] **Shopping List**: open consolidated tab for a Saved Weekplan; baseline list loads without AI
- [ ] **Settings**: version and data path display; **Open data folder** works

### Online-only flows (network required)

- [ ] **Settings**: save OpenRouter key; restart app; key persists (masked input shows saved state)
- [ ] **Shopping List**: consolidation returns AI polish (`pending_review` or `polished`) when key + network available
- [ ] **Add Recipe → URL**: import from a supported site succeeds when online
- [ ] Offline banner blocks URL import; AI polish banner explains missing key or offline state

### Fonts note

Newsreader, Plus Jakarta Sans, and Material Symbols are bundled with the app (see
[desktop-startup.md](./desktop-startup.md)). First paint should match online typography without a
network call.

## Manual update (v1 — no in-app updater)

1. Download the newer installer artifact from CI or a GitHub Release.
2. Close Mealprepper completely.
3. Run the new installer over the existing installation (same `com.mealprepper.app` identifier).
4. Launch the app — SQLite DB and `recipe-images/` in the app data directory are preserved.
5. Re-run the smoke checklist above if the release includes schema migrations.

## CI artifact

Workflow job `build-installer` uploads `mealprepper-windows-installer` containing the NSIS/MSI
output from `src-tauri/target/release/bundle/`.

For Authenticode signing setup, see [desktop-signing.md](./desktop-signing.md).

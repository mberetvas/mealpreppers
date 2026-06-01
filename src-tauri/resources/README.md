# Desktop bundle resources

This directory previously held generated Nitro sidecar and Node binary outputs (`nitro/`, `node/`).
Those resources are no longer bundled as part of the Tauri desktop build.

The desktop build now uses:
- `nuxt generate` (`ssr: false`) → static client bundle at `../.output/public/` (repo root)
- `frontendDist = "../.output/public"` in `tauri.conf.json` — Tauri serves the static frontend directly

No Node binary and no Nitro server output are included in the installer.

> The `nitro/` and `node/` subdirectories (with their `.gitkeep` files) are preserved to avoid
> breaking local developer workspaces that may still have old build artifacts there. They are
> gitignored and not read at runtime.

# Bundled Nitro sidecar with desktop token

**Type:** AFK  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 1

## What to build

Ship the **production-like desktop API path**: build Nitro with `NITRO_PRESET=node-server`, bundle a **pinned Node** runtime and sidecar output as Tauri resources, spawn the sidecar on a random **`127.0.0.1`** port from Rust, and **gate the WebView** until a health probe succeeds. Generate a per-launch **`DESKTOP_TOKEN`**, inject it into the Nitro process environment, enforce it in Nitro middleware (timing-safe compare; health route exempt), and attach the token from the Nuxt client on all localhost `$fetch` calls. Rust supervises spawn and clean shutdown on quit.

## Acceptance criteria

- [x] Tauri starts bundled Nitro (`server/index.mjs`) on loopback; window appears only after health check passes
- [x] Nitro binds `127.0.0.1` only; port is not hardcoded in client assets
- [x] Requests without a valid desktop token are rejected (except health); Vitest covers middleware
- [x] Renderer receives the token via trusted bootstrap (inline script or first-party config), not baked into static build artifacts
- [x] `desktop:build` / `desktop:pack` scripts produce an artifact that runs the sidecar path (data layer may still be Supabase until SQLite slices land)

## Blocked by

- [0010-tauri-desktop-shell-spike](./0010-tauri-desktop-shell-spike.md)

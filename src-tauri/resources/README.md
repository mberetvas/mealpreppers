# Desktop bundle resources (generated)

Populated by `bun run build:desktop:resources` (also runs as part of `build:desktop`):

- `node/win-x64/node.exe` — pinned Node runtime (Windows x64)
- `nitro/server/` — Nitro `node-server` output (built in-place via `NITRO_DESKTOP_OUTPUT_DIR`)

These paths are gitignored. Run `bun run build:desktop` before `desktop:build` or `desktop:pack`.

# Version bumps use Bun’s package manager: `bun pm version` (not `bun run version`).
# Usage: `just bump` or `just bump patch` | `minor` | `major` | …
# See: https://bun.com/docs/cli/pm

# Project quality tasks route through Bun package scripts.
lint:
	bun run lint

format:
	bun run format

test:
	bun run test

# Full Tauri release build: static Nuxt client (`build:desktop`) then `tauri build`.
# Usage: `just desktop-build`
desktop-build:
	bun run desktop:build

# Run the compiled release binary from `src-tauri/target/release/`.
# Usage: `just desktop-run`
desktop-run:
	bun run desktop:run:prod

# Same as desktop-run with MEALPREPPER_CONSOLE=1 (stderr + Windows AllocConsole).
# Usage: `just desktop-run-console`
desktop-run-console:
	bun run desktop:run:prod -- --console

# Bump semver in package.json, commit, and create an annotated git tag.
bump level='patch':
	bun pm version {{level}}

# Agent automation (PowerShell). Requires `agent` / `copilot` on PATH where noted.

# Headless code review via Cursor Agent CLI; writes feedback to review.md.
# Usage: `just code-review` or `just code-review model=opus-4.6`
code-review model='composer-2.5':
	pwsh -NoProfile -File scripts/code-review.ps1 -Model "{{model}}"

# Process issue .md files sequentially with Cursor Agent CLI.
# Usage: `just cursor-ralph "Docs/issues/my-slice"`
cursor-ralph issues_folder model='composer-2.5' workspace='.':
	pwsh -NoProfile -File Docs/ralph-loop/cursor-ralph-loop.ps1 -IssuesFolder "{{issues_folder}}" -Model "{{model}}" -Workspace "{{workspace}}"

# Same as cursor-ralph but without live stream progress (text output only).
cursor-ralph-quiet issues_folder model='composer-2.5' workspace='.':
	pwsh -NoProfile -File Docs/ralph-loop/cursor-ralph-loop.ps1 -IssuesFolder "{{issues_folder}}" -Model "{{model}}" -Workspace "{{workspace}}" -ShowProgress:$$false

# Process issue .md files sequentially with Copilot CLI.
# Usage: `just copilot-ralph "Docs/issues/my-slice"`
copilot-ralph issues_folder model='claude-sonnet-4.6' effort='high':
	pwsh -NoProfile -File Docs/ralph-loop/copilot-ralph-loop.ps1 -IssuesFolder "{{issues_folder}}" -Model "{{model}}" -Effort "{{effort}}"

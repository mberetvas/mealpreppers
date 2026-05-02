# Version bumps use Bun’s package manager: `bun pm version` (not `bun run version`).
# Usage: `just bump` or `just bump patch` | `minor` | `major` | …
# See: https://bun.com/docs/cli/pm

# Bump semver in package.json, commit, and create an annotated git tag.
bump level='patch':
	bun pm version {{level}}

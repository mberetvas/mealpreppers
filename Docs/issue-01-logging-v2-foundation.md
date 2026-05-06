## What to build

Implement the Logging V2 foundation by introducing a single Application Logger facade for server code, backed by `consola`, with environment-variable based Log Configuration. The slice must support accepted Log Level values (`debug`, `info`, `warn`, `error`), safe fallback behavior for invalid values, Execution Environment defaults, and LOG_JSON format switching.

## Acceptance criteria

- [ ] A shared Application Logger interface exists and can be used by server code without direct `consola` coupling.
- [ ] Log Configuration reads environment variables as the single source of truth.
- [ ] `LOG_LEVEL` accepts only `debug | info | warn | error`.
- [ ] Invalid `LOG_LEVEL` falls back safely (`development` => `debug`, `production` => `info`) and emits one startup warning.
- [ ] `LOG_JSON=true|false` controls JSON vs pretty output deterministically.

## Blocked by

None - can start immediately.

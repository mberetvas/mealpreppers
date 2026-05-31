# Windows Authenticode signing for release builds

**Type:** HITL  
**Triage:** needs-triage

## Parent

[Tauri + SQLite Migration Strategy](../plan/tauri-sqlite-migration-strategy.md) — Phase 5 (signed GA)

## What to build

Enable **Authenticode-signed** Windows installers for GA releases. Requires human decisions on certificate procurement, secure storage of signing secrets in CI, and validation on a clean machine. Wire signing into the existing Windows CI pipeline from the unsigned installer slice.

## Acceptance criteria

- [x] Signed installer builds in CI when signing secrets are configured; unsigned path remains available for forks/dev
- [x] Windows SmartScreen / signature verification passes on a clean install test
- [x] Documentation lists required secrets, renewal, and who owns the signing certificate

## Blocked by

- [0017-windows-unsigned-installer-ci](./0017-windows-unsigned-installer-ci.md)

**Note:** SmartScreen clean-machine validation requires org certificate secrets — repo deliverables complete; human must run validation per [desktop-signing.md](../desktop-signing.md).

# Windows Authenticode signing (HITL)

Authenticode signing is required for GA Windows releases so SmartScreen trusts the installer.
The repository supports **optional** signing in CI; forks and dev builds continue unsigned when
secrets are absent.

## Required GitHub secrets

Configure these in the repository (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `WINDOWS_CERTIFICATE` | Base64-encoded `.pfx` code-signing certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX export password |
| `WINDOWS_TIMESTAMP_URL` | (Optional) RFC 3161 timestamp server; defaults to `http://timestamp.digicert.com` |

When `WINDOWS_CERTIFICATE` is empty or unset, the workflow skips signing and uploads an unsigned
installer — suitable for forks and internal smoke testing.

## Certificate ownership and renewal

- **Owner:** designate one person/team responsible for procurement, renewal, and secret rotation.
- **Renewal:** code-signing certificates typically expire annually; renew before expiry and update
  `WINDOWS_CERTIFICATE` + password secrets.
- **Storage:** never commit the PFX to the repository; only the base64 secret in GitHub Actions.

## CI behavior

[`.github/workflows/desktop-windows.yml`](../.github/workflows/desktop-windows.yml) runs
`signtool sign` on the bundled installer when `WINDOWS_CERTIFICATE` is configured. Unsigned builds
remain the default for contributors without org secrets.

## SmartScreen validation (clean machine)

After a signed build lands in CI:

1. Use a Windows VM that has **never** installed an unsigned Mealprepper build.
2. Download the signed installer artifact (not a locally rebuilt unsigned copy).
3. Install and confirm:
   - File Properties → Digital Signatures shows a valid signature.
   - SmartScreen does not block with “Unknown publisher” (may still show standard first-run prompts
     for new certificates until reputation builds).
4. Record the signing cert thumbprint and build version in release notes.

## Fork behavior

Forks inherit the workflow but lack org secrets → unsigned artifacts only. This is intentional.

## Related docs

- [desktop-release.md](./desktop-release.md) — smoke checklist and manual update v1
- [desktop-development.md](./desktop-development.md) — local build loops

# Runs `cargo fmt --all` when the agent edits a Rust source file.
# Hook event: afterFileEdit (fire-and-forget; always exits 0).

$ErrorActionPreference = 'Stop'

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) {
    exit 0
}

$payload = $raw | ConvertFrom-Json
$filePath = [string]$payload.file_path

if ($filePath -notmatch '\.rs$') {
    exit 0
}

$manifest = Join-Path $PSScriptRoot '..\..\src-tauri\Cargo.toml'
if (-not (Test-Path -LiteralPath $manifest)) {
  Write-Error "cargo-fmt-after-rust-edit: manifest not found at $manifest"
  exit 0
}

& cargo fmt --all --manifest-path $manifest
exit 0

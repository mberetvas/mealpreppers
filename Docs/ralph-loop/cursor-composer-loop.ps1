<#
.SYNOPSIS
    Implements all issues in a folder sequentially using the Cursor Agent CLI.

.DESCRIPTION
    Iterates over every Markdown issue file (sorted by name, README excluded)
    in the specified folder and invokes `agent` for each one in non-interactive
    print mode. Each issue is attached to the prompt so the model receives
    the full specification before making changes.

.PARAMETER IssuesFolder
    Path to the folder that contains the issue .md files (no subfolders are scanned).

.PARAMETER Model
    Cursor Agent model to use. Defaults to composer-2.5.

.PARAMETER Workspace
    Workspace directory passed to the agent. Defaults to the current location.

.EXAMPLE
    .\cursor-composer-loop.ps1 -IssuesFolder "Docs\issues\logging-v2-hardening"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $IssuesFolder,

    [string] $Model = 'composer-2.5',

    [string] $Workspace = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Resolve folder ────────────────────────────────────────────────────────────

$resolvedFolder = Resolve-Path -LiteralPath $IssuesFolder -ErrorAction Stop |
    Select-Object -ExpandProperty Path

$resolvedWorkspace = Resolve-Path -LiteralPath $Workspace -ErrorAction Stop |
    Select-Object -ExpandProperty Path

Write-Host "[INFO] Issues folder : $resolvedFolder"
Write-Host "[INFO] Workspace     : $resolvedWorkspace"
Write-Host "[INFO] Model         : $Model"
Write-Host ""

# ── Collect issue files (shallow, sorted, README excluded) ────────────────────

$issueFiles = Get-ChildItem -LiteralPath $resolvedFolder -File -Filter '*.md' |
    Where-Object { $_.Name -notmatch '^README(\.md)?$' } |
    Sort-Object Name

if ($issueFiles.Count -eq 0) {
    Write-Warning "No issue files found in '$resolvedFolder'. Nothing to do."
    exit 0
}

Write-Host "[INFO] Found $($issueFiles.Count) issue(s) to process."
Write-Host ""

# ── Process each issue ────────────────────────────────────────────────────────

$index = 0
foreach ($file in $issueFiles) {
    $index++
    $label = "$index/$($issueFiles.Count)"

    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "[$label] Starting : $($file.Name)"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    $issueContent = Get-Content -LiteralPath $file.FullName -Raw

    $prompt = @"
Implement the issue below exactly as specified.
Follow all acceptance criteria. Use TDD: write failing tests first, then make them pass.
Do not change code outside the scope of this issue.

--- ISSUE: $($file.Name) ---
$issueContent
--- END ISSUE ---
"@

    agent `
        -p `
        --model $Model `
        --workspace $resolvedWorkspace `
        --trust `
        --force `
        --approve-mcps `
        $prompt

    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        Write-Error "[$label] Cursor Agent exited with code $exitCode for '$($file.Name)'. Aborting loop."
        exit $exitCode
    }

    Write-Host ""
    Write-Host "[$label] Completed : $($file.Name)"
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "[INFO] All $($issueFiles.Count) issue(s) processed successfully."

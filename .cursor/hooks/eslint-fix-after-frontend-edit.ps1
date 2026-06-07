# Runs `eslint --fix` on the edited file when the agent changes frontend source.
# Hook event: afterFileEdit (fire-and-forget; always exits 0).

$ErrorActionPreference = 'Stop'

$frontendRoots = @('app', 'server', 'test', 'scripts', 'types', 'utils')
$frontendRootFiles = @(
    'eslint.config.mjs',
    'nuxt.config.ts',
    'tailwind.config.ts',
    'vitest.config.ts',
    'vitest.config.component.ts'
)
$frontendExtensions = @('.ts', '.tsx', '.vue', '.js', '.mjs', '.jsx', '.cjs')

function Test-FrontendFile {
    param([string]$Path)

    $normalized = $Path -replace '\\', '/'

    foreach ($rootFile in $frontendRootFiles) {
        if ($normalized -eq $rootFile -or $normalized.EndsWith("/$rootFile")) {
            return $true
        }
    }

    $extension = [System.IO.Path]::GetExtension($normalized).ToLowerInvariant()
    if ($frontendExtensions -notcontains $extension) {
        return $false
    }

    foreach ($root in $frontendRoots) {
        if ($normalized -match "(^|/)$root/") {
            return $true
        }
    }

    return $false
}

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) {
    exit 0
}

$payload = $raw | ConvertFrom-Json
$filePath = [string]$payload.file_path

if (-not (Test-FrontendFile $filePath)) {
    exit 0
}

$workspaceRoot = if ($payload.workspace_roots -and $payload.workspace_roots.Count -gt 0) {
    [string]$payload.workspace_roots[0]
} else {
    (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

if (-not [System.IO.Path]::IsPathRooted($filePath)) {
    $filePath = Join-Path $workspaceRoot $filePath
}

if (-not (Test-Path -LiteralPath $filePath)) {
    Write-Error "eslint-fix-after-frontend-edit: file not found at $filePath"
    exit 0
}

& bun run eslint --fix $filePath
exit 0

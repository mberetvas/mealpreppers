<#
.SYNOPSIS
    Implements all issues in a folder sequentially using the Cursor Agent CLI (headless).

.DESCRIPTION
    Iterates over every Markdown issue file (sorted by name, README excluded)
    in the specified folder and invokes `agent` for each one in print mode (-p).
    Uses --force so file changes are applied, not only proposed (see headless docs).
    Each issue body is embedded in the prompt so the model receives the full spec.

    Requires agent on PATH and authentication (agent login or CURSOR_API_KEY).
    See https://cursor.com/docs/cli/headless

.PARAMETER IssuesFolder
    Path to the folder that contains the issue .md files (no subfolders are scanned).

.PARAMETER Model
    Cursor Agent model to use. Defaults to composer-2.5.

.PARAMETER Workspace
    Workspace directory passed to the agent. Defaults to the current location.

.PARAMETER ShowProgress
    Stream agent activity to the console (tool calls, model, duration) via stream-json.
    Defaults to true. Pass -ShowProgress:$false for final-answer-only text output.

.EXAMPLE
    .\cursor-ralph-loop.ps1 -IssuesFolder "Docs\issues\logging-v2-hardening"

.EXAMPLE
    .\cursor-ralph-loop.ps1 -IssuesFolder "Docs\issues" -ShowProgress:$false
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $IssuesFolder,

    [string] $Model = 'composer-2.5',

    [string] $Workspace = (Get-Location).Path,

    [bool] $ShowProgress = $true
)

function New-AgentStreamState {
    return @{
        AccumulatedText = [System.Text.StringBuilder]::new()
        ToolCount       = 0
        StartTime       = Get-Date
        GeneratingActive = $false
    }
}

function Clear-AgentGeneratingLine {
    param($State)

    if ($State.GeneratingActive) {
        Write-Host ''
        $State.GeneratingActive = $false
    }
}

function Update-AgentStreamProgress {
    param(
        [string] $Line,
        $State
    )

    if ([string]::IsNullOrWhiteSpace($Line)) {
        return
    }

    try {
        $event = $Line | ConvertFrom-Json
    }
    catch {
        Clear-AgentGeneratingLine -State $State
        Write-Host $Line
        return
    }

    $type = $event.type
    $subtype = $event.subtype

    switch ($type) {
        'system' {
            if ($subtype -eq 'init' -and $event.model) {
                Clear-AgentGeneratingLine -State $State
                Write-Host "Using model: $($event.model)"
            }
        }
        'assistant' {
            # Streaming deltas only: timestamp_ms present, model_call_id absent.
            $hasTimestamp = $null -ne $event.PSObject.Properties['timestamp_ms']
            $hasModelCallId = $null -ne $event.PSObject.Properties['model_call_id']

            if ($hasTimestamp -and -not $hasModelCallId) {
                $content = $event.message.content[0].text
                if ($content) {
                    [void]$State.AccumulatedText.Append($content)
                    $charCount = $State.AccumulatedText.Length
                    Write-Host -NoNewline "`rGenerating: $charCount chars"
                    $State.GeneratingActive = $true
                }
            }
        }
        'tool_call' {
            if ($subtype -eq 'started') {
                Clear-AgentGeneratingLine -State $State
                $State.ToolCount++

                if ($event.tool_call.writeToolCall) {
                    $path = $event.tool_call.writeToolCall.args.path
                    if (-not $path) { $path = 'unknown' }
                    Write-Host "Tool #$($State.ToolCount): Creating $path"
                }
                elseif ($event.tool_call.readToolCall) {
                    $path = $event.tool_call.readToolCall.args.path
                    if (-not $path) { $path = 'unknown' }
                    Write-Host "Tool #$($State.ToolCount): Reading $path"
                }
                elseif ($event.tool_call.shellToolCall) {
                    $cmd = $event.tool_call.shellToolCall.args.command
                    if (-not $cmd) { $cmd = 'unknown' }
                    Write-Host "Tool #$($State.ToolCount): Shell $cmd"
                }
                else {
                    Write-Host "Tool #$($State.ToolCount): Started"
                }
            }
            elseif ($subtype -eq 'completed') {
                if ($event.tool_call.writeToolCall.result.success) {
                    $lines = $event.tool_call.writeToolCall.result.success.linesCreated
                    $size = $event.tool_call.writeToolCall.result.success.fileSize
                    Write-Host "   Created $lines lines ($size bytes)"
                }
                elseif ($event.tool_call.readToolCall.result.success) {
                    $lines = $event.tool_call.readToolCall.result.success.totalLines
                    Write-Host "   Read $lines lines"
                }
            }
        }
        'result' {
            Clear-AgentGeneratingLine -State $State
            $durationMs = if ($null -ne $event.duration_ms) { $event.duration_ms } else { 0 }
            $totalSeconds = [math]::Round(((Get-Date) - $State.StartTime).TotalSeconds)
            Write-Host "Completed in ${durationMs}ms (${totalSeconds}s total)"
            Write-Host "Final stats: $($State.ToolCount) tools, $($State.AccumulatedText.Length) chars generated"
        }
    }
}

function Invoke-AgentHeadless {
    param(
        [string[]] $AgentArgs,
        [bool] $StreamProgress
    )

    if (-not $StreamProgress) {
        & agent @AgentArgs
        return $LASTEXITCODE
    }

    $state = New-AgentStreamState
    $sync = [hashtable]::Synchronized(@{ Done = $false; ExitCode = 1 })

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'agent'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    foreach ($arg in $AgentArgs) {
        [void]$psi.ArgumentList.Add($arg)
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    $process.EnableRaisingEvents = $true

    $stdoutHandler = {
        param($sender, $e)
        if ($null -eq $e.Data) {
            return
        }

        Update-AgentStreamProgress -Line $e.Data -State $script:AgentStreamState
    }

    $stderrHandler = {
        param($sender, $e)
        if ($null -eq $e.Data) {
            return
        }

        Clear-AgentGeneratingLine -State $script:AgentStreamState
        Write-Host $e.Data
    }

    $exitHandler = {
        $script:AgentStreamSync.Done = $true
        $script:AgentStreamSync.ExitCode = $sender.ExitCode
    }

    $script:AgentStreamState = $state
    $script:AgentStreamSync = $sync

    $process.add_OutputDataReceived($stdoutHandler)
    $process.add_ErrorDataReceived($stderrHandler)
    $process.add_Exited($exitHandler)

    if (-not $process.Start()) {
        throw 'Failed to start agent process.'
    }

    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()
    $process.WaitForExit()

    # Wait for async line handlers to finish after the process exits.
    while (-not $sync.Done) {
        Start-Sleep -Milliseconds 50
    }

    Clear-AgentGeneratingLine -State $state
    return $sync.ExitCode
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Resolve folder ────────────────────────────────────────────────────────────

$resolvedFolder = Resolve-Path -LiteralPath $IssuesFolder -ErrorAction Stop |
    Select-Object -ExpandProperty Path

$resolvedWorkspace = Resolve-Path -LiteralPath $Workspace -ErrorAction Stop |
    Select-Object -ExpandProperty Path

$streamProgress = $ShowProgress

Write-Host "[INFO] Issues folder : $resolvedFolder"
Write-Host "[INFO] Workspace     : $resolvedWorkspace"
Write-Host "[INFO] Model         : $Model"
Write-Host "[INFO] Show progress : $streamProgress"
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

    # Headless pattern: agent -p --force "<prompt>" (see cursor.com/docs/cli/headless)
    # Without --force, the agent only proposes changes and does not write files.
    $agentArgs = @(
        '-p',
        '--model', $Model,
        '--workspace', $resolvedWorkspace,
        '--force',
        '--trust',
        '--approve-mcps'
    )

    if ($streamProgress) {
        $agentArgs += @(
            '--output-format', 'stream-json',
            '--stream-partial-output'
        )
    }

    $agentArgs += $prompt

    $exitCode = Invoke-AgentHeadless -AgentArgs $agentArgs -StreamProgress $streamProgress

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

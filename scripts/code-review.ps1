<#
.SYNOPSIS
    Runs a headless code review via the Cursor Agent CLI.

.DESCRIPTION
    Invokes `agent` in print mode (-p) with --force so the agent can write review.md.
    Requires agent on PATH and authentication (agent login or CURSOR_API_KEY).
    See https://cursor.com/docs/cli/headless

.PARAMETER Model
    Cursor Agent model to use. Defaults to composer-2.5.

.PARAMETER ShowProgress
    Stream agent activity in real time via stream-json and --stream-partial-output
    (model init, generating char count, tool calls, completion stats).
    Defaults to true. Pass -ShowProgress:$false for final-answer-only text output.

.EXAMPLE
    .\code-review.ps1

.EXAMPLE
    .\code-review.ps1 -ShowProgress:$false
#>

[CmdletBinding()]
param(
    [string] $Model = 'composer-2.5',

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

    $propertyNames = @($event.PSObject.Properties.Name)
    $type = if ($propertyNames -contains 'type') { $event.type } else { $null }
    $subtype = if ($propertyNames -contains 'subtype') { $event.subtype } else { $null }

    if (-not $type) {
        return
    }

    switch ($type) {
        'system' {
            if ($subtype -eq 'init' -and $event.model) {
                Clear-AgentGeneratingLine -State $State
                Write-Host "Using model: $($event.model)"
            }
        }
        'assistant' {
            # Streaming deltas only: timestamp_ms present, model_call_id absent.
            $propertyNames = @($event.PSObject.Properties.Name)
            if ($propertyNames -contains 'timestamp_ms' -and $propertyNames -notcontains 'model_call_id') {
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

function ConvertTo-ProcessArguments {
    param([string[]] $ArgumentList)

    ($ArgumentList | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\"') + '"'
        }
        else {
            $_
        }
    }) -join ' '
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

    # Mirrors: agent -p --force --output-format stream-json --stream-partial-output "..." | while read line
    $state = New-AgentStreamState

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    # Process.Start cannot resolve PowerShell shims; prefer agent.cmd / agent.exe on PATH.
    $agentExecutable = Get-Command agent -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty Source
    if ([string]::IsNullOrEmpty($agentExecutable)) {
        throw 'Streaming mode needs agent.cmd or agent.exe on PATH. Use -ShowProgress:$false to run via shell.'
    }
    $psi.FileName = $agentExecutable
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    if ($psi.PSObject.Properties.Name -contains 'ArgumentList') {
        foreach ($arg in $AgentArgs) {
            [void]$psi.ArgumentList.Add($arg)
        }
    }
    else {
        $psi.Arguments = ConvertTo-ProcessArguments -ArgumentList $AgentArgs
    }

    $process = [System.Diagnostics.Process]::Start($psi)
    if ($null -eq $process) {
        throw 'Failed to start agent process.'
    }

    try {
        while ($null -ne ($line = $process.StandardOutput.ReadLine())) {
            Update-AgentStreamProgress -Line $line -State $state
        }

        $process.WaitForExit()

        while ($null -ne ($line = $process.StandardError.ReadLine())) {
            Clear-AgentGeneratingLine -State $state
            Write-Host $line
        }
    }
    finally {
        Clear-AgentGeneratingLine -State $state
    }

    return $process.ExitCode
}

Write-Host 'Starting code review...'
Write-Host "[INFO] Model         : $Model"
Write-Host "[INFO] Show progress : $ShowProgress"

$prompt = @"
Review the recent code changes and provide feedback on:
- Code quality and readability
- Potential bugs or issues
- Security considerations
- Best practices compliance

Provide specific suggestions for improvement and write to review.md
"@

$agentArgs = @(
    '-p',
    '--model', $Model,
    '--force'
)

if ($ShowProgress) {
    $agentArgs += @('--output-format', 'stream-json', '--stream-partial-output')
}
else {
    $agentArgs += @('--output-format', 'text')
}

$agentArgs += $prompt

$exitCode = Invoke-AgentHeadless -AgentArgs $agentArgs -StreamProgress $ShowProgress

if ($exitCode -eq 0) {
    Write-Host 'Code review completed successfully'
}
else {
    Write-Host 'Code review failed'
    exit 1
}

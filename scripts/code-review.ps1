# code-review.ps1 - Basic code review via Cursor Agent CLI (headless)

Write-Host 'Starting code review...'

$prompt = @"
Review the recent code changes and provide feedback on:
- Code quality and readability
- Potential bugs or issues
- Security considerations
- Best practices compliance

Provide specific suggestions for improvement and write to review.txt
"@

& agent -p --force --output-format text $prompt

if ($LASTEXITCODE -eq 0) {
    Write-Host 'Code review completed successfully'
}
else {
    Write-Host 'Code review failed'
    exit 1
}

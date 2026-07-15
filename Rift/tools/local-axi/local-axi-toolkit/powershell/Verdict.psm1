# PowerShell side of the AXI structured-verdict contract (mirrors src/verdict.mjs).
#
# Convention for darkfactory verification scripts:
#   - send human narration to STDERR   -> Write-Narration "..."
#   - emit ONE machine-readable verdict as the LAST line of STDOUT -> Write-Verdict ...
# Consumers parse it with the JS parseVerdict() (last @@VERDICT@@ line wins).

$script:VerdictSentinel = '@@VERDICT@@ '

function Write-Narration {
    [CmdletBinding()]
    param([Parameter(Mandatory, ValueFromPipeline)][string]$Message)
    process { [Console]::Error.WriteLine($Message) }
}

function Write-Verdict {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('PASS', 'FAIL', 'SKIP')][string]$Result,
        [string]$Stage,
        [string]$Reason,
        [string]$Next,
        [hashtable]$Extra
    )
    # AXI principle 6/9: a failure must say what to do next.
    if ($Result -eq 'FAIL' -and [string]::IsNullOrWhiteSpace($Next)) {
        throw 'A FAIL verdict must include -Next (the concrete recovery action).'
    }
    $obj = [ordered]@{ result = $Result }
    if ($Stage)  { $obj['stage']  = $Stage }
    if ($Reason) { $obj['reason'] = $Reason }
    if ($Next)   { $obj['next']   = $Next }
    if ($Extra)  { foreach ($k in $Extra.Keys) { $obj[$k] = $Extra[$k] } }
    $json = $obj | ConvertTo-Json -Compress -Depth 10
    # The verdict is the last line of stdout; narration must use Write-Narration.
    Write-Output ($script:VerdictSentinel + $json)
}

Export-ModuleMember -Function Write-Verdict, Write-Narration

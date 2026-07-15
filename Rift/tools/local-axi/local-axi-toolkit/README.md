# local-axi-toolkit

Our **own** AXI helpers (not vendored) — the reusable pieces behind the darkfactory
reliability improvements. Pure, tested, portable. Encodes the AXI principles that
actually move reliability: structured verdicts (4/5/6/9) and ambient context (7/8/9).

## Structured-verdict contract — `local-axi-toolkit/verdict`

Convention: scripts send **narration to stderr** and emit **one machine-readable
verdict as the last line of stdout**, sentinel-prefixed so consumers never scrape
free text.

```js
import { formatVerdict, summarize, parseVerdict } from 'local-axi-toolkit/verdict';

// Producer (a tool/script):
console.error('installing agent...');                 // narration -> stderr
console.log(formatVerdict({ result: 'PASS', stage: 'install', reason: 'agent online' }));

// A FAIL MUST carry `next` (the recovery step) or formatVerdict throws:
formatVerdict({ result: 'FAIL', reason: 'WinRM denied', next: 'Run Repair-DfSnapshots.ps1' });

// Aggregates (principle 4): collapse sub-results to counts.
summarize([{result:'PASS'},{result:'FAIL'}]); // { total:2, passed:1, failed:1, skipped:0 }

// Consumer (the orchestrator / attractor tool node):
const v = parseVerdict(capturedStdout);  // last @@VERDICT@@ line wins; null if none
```

## Ambient context — `local-axi-toolkit/ambient`

A content-first dashboard a tool prints with no args: live data first, tabular state
in TOON, next-step `help[]` last.

```js
import { formatAmbientContext } from 'local-axi-toolkit/ambient';
formatAmbientContext({
  title: 'darkfactory status',
  fields: { host: 'DF_x1yoga', lastRun: 'PASS' },
  tables: { snapshots: [{ name: 'clean-windows', pwOk: true }] },
  help: ['Run factory:status to refresh'],
});
```

## PowerShell producer — `powershell/Verdict.psm1`

So `.ps1` verification scripts emit the **same** contract:

```powershell
Import-Module "$PSScriptRoot/../tools/local-axi/local-axi-toolkit/powershell/Verdict.psm1"
Write-Narration "restoring snapshot..."                 # -> stderr
Write-Verdict -Result PASS -Stage heartbeat -Reason "fresh <300s"
# FAIL requires -Next:
Write-Verdict -Result FAIL -Reason "WinRM denied" -Next "Run Repair-DfSnapshots.ps1"
```

## Tests

`npm test` (from this folder) — `node --test`. 10 tests incl. a PowerShell↔JS
round-trip (skips automatically if `pwsh` is unavailable).

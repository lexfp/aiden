import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseVerdict } from '../src/verdict.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const psm1 = join(here, '..', 'powershell', 'Verdict.psm1');

function pwshAvailable() {
  try {
    execFileSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

test('PowerShell Write-Verdict output round-trips through JS parseVerdict', { skip: !pwshAvailable() }, () => {
  const script = [
    `Import-Module '${psm1}' -Force`,
    `Write-Narration 'doing work'`, // must go to stderr, not pollute the verdict
    `Write-Verdict -Result PASS -Stage install -Reason 'agent online'`,
  ].join('; ');
  const out = execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
  });
  const v = parseVerdict(out);
  assert.ok(v, 'a verdict must be parseable from stdout');
  assert.equal(v.result, 'PASS');
  assert.equal(v.stage, 'install');
  assert.equal(v.reason, 'agent online');
});

test('PowerShell Write-Verdict refuses a FAIL without -Next', { skip: !pwshAvailable() }, () => {
  const script = [
    `Import-Module '${psm1}' -Force`,
    `try { Write-Verdict -Result FAIL -Reason boom; 'NO-THROW' } catch { 'THREW' }`,
  ].join('; ');
  const out = execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
  });
  assert.match(out, /THREW/);
});

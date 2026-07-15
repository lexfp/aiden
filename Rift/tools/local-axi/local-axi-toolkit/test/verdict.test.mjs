import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatVerdict, summarize, parseVerdict } from '../src/verdict.mjs';

test('formatVerdict emits a single sentinel-prefixed JSON line that parses', () => {
  const line = formatVerdict({ result: 'PASS', stage: 'install', reason: 'agent online' });
  assert.ok(!line.includes('\n'), 'verdict must be a single line');
  assert.ok(line.startsWith('@@VERDICT@@ '), 'verdict must be findable via sentinel');
  const obj = JSON.parse(line.slice('@@VERDICT@@ '.length));
  assert.equal(obj.result, 'PASS');
  assert.equal(obj.stage, 'install');
  assert.equal(obj.reason, 'agent online');
});

test('formatVerdict rejects an invalid result', () => {
  assert.throws(() => formatVerdict({ result: 'MAYBE' }), /PASS\|FAIL\|SKIP/);
});

test('formatVerdict requires a next step when the result is FAIL', () => {
  assert.throws(() => formatVerdict({ result: 'FAIL', reason: 'boom' }), /next/i);
  assert.doesNotThrow(() => formatVerdict({ result: 'FAIL', reason: 'boom', next: 'run X' }));
});

// M1: parity with PowerShell's [string]::IsNullOrWhiteSpace — a whitespace-only
// next must be rejected on FAIL (PowerShell rejects it; JS must too).
test('formatVerdict rejects a whitespace-only next on FAIL (PS parity)', () => {
  assert.throws(() => formatVerdict({ result: 'FAIL', reason: 'boom', next: '   ' }), /next/i);
});

// L2: a newline inside a string field must not split the verdict across lines.
test('formatVerdict keeps multiline string fields on a single line', () => {
  const line = formatVerdict({ result: 'PASS', reason: 'line1\nline2' });
  assert.ok(!line.includes('\n'), 'must not contain a raw newline');
  assert.equal(parseVerdict(line)?.reason, 'line1\nline2');
});

test('summarize counts PASS/FAIL/SKIP and totals', () => {
  const items = [{ result: 'PASS' }, { result: 'FAIL' }, { result: 'PASS' }, { result: 'SKIP' }];
  assert.deepEqual(summarize(items), { total: 4, passed: 2, failed: 1, skipped: 1 });
});

// H2: noisy aggregation input must not abort the tally.
test('summarize tolerates null / non-object / unknown-result elements', () => {
  assert.deepEqual(
    summarize([{ result: 'PASS' }, null, undefined, {}, 3, { result: 'WAT' }]),
    { total: 6, passed: 1, failed: 0, skipped: 0 }
  );
});

test('parseVerdict extracts the verdict from noisy stdout (last sentinel line wins)', () => {
  const blob = 'some narration\n@@VERDICT@@ {"result":"FAIL","reason":"x","next":"y"}\ntrailing log';
  const v = parseVerdict(blob);
  assert.equal(v.result, 'FAIL');
  assert.equal(v.reason, 'x');
});

test('parseVerdict returns null when no verdict present (definitive empty state)', () => {
  assert.equal(parseVerdict('just logs, no verdict here'), null);
});

// C1: a LATER line that merely mentions the sentinel (non-JSON) must not hide
// the real verdict — keep scanning earlier lines.
test('parseVerdict keeps scanning past a later non-JSON sentinel mention', () => {
  const blob = '@@VERDICT@@ {"result":"PASS","reason":"ok"}\nNOTE: emitted @@VERDICT@@ above';
  assert.equal(parseVerdict(blob)?.result, 'PASS');
});

// H1: two sentinels on one line — the LAST verdict wins.
test('parseVerdict picks the last sentinel on a single line', () => {
  const line = '@@VERDICT@@ {"result":"PASS"} @@VERDICT@@ {"result":"FAIL","next":"x"}';
  assert.equal(parseVerdict(line)?.result, 'FAIL');
});

// M2: a payload that parses to a non-object is not a verdict.
test('parseVerdict returns null for non-object JSON payloads', () => {
  for (const bad of ['@@VERDICT@@ 42', '@@VERDICT@@ "PASS"', '@@VERDICT@@ null', '@@VERDICT@@ [1,2]']) {
    assert.equal(parseVerdict(bad), null, `should reject ${bad}`);
  }
});

test('parseVerdict returns null for non-string input', () => {
  assert.equal(parseVerdict(null), null);
  assert.equal(parseVerdict(undefined), null);
  assert.equal(parseVerdict(42), null);
});

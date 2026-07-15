import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAmbientContext } from '../src/ambient.mjs';

test('formatAmbientContext renders title, fields, a TOON table, and trailing help (content-first)', () => {
  const out = formatAmbientContext({
    title: 'darkfactory status',
    fields: { host: 'DF_x1yoga', lastRun: 'PASS' },
    tables: {
      snapshots: [
        { name: 'clean-windows', pwOk: true },
        { name: 'rivshield-running', pwOk: true },
      ],
    },
    help: ['Run factory:status to refresh', 'Run Repair-DfSnapshots.ps1 if pwOk is false'],
  });
  assert.match(out, /darkfactory status/);
  assert.match(out, /host: DF_x1yoga/);
  assert.match(out, /lastRun: PASS/);
  assert.match(out, /snapshots\[2\]\{name,pwOk\}:/);
  assert.match(out, /clean-windows,true/);
  // content-first: actionable data appears before the help block
  assert.ok(
    out.indexOf('Run factory:status') > out.indexOf('snapshots['),
    'help must follow the data'
  );
  assert.match(out, /help\[2\]:/);
});

test('formatAmbientContext omits empty sections cleanly (no "undefined")', () => {
  const out = formatAmbientContext({ title: 'x', fields: {}, tables: {}, help: [] });
  assert.match(out, /x/);
  assert.ok(!/undefined/.test(out), 'must not leak undefined for empty sections');
});

test('formatAmbientContext renders bin and skips empty / non-array tables', () => {
  const out = formatAmbientContext({
    title: 't',
    bin: '~/x/cli.mjs',
    tables: { empty: [], bad: null, good: [{ a: 1 }] },
  });
  assert.match(out, /bin: ~\/x\/cli\.mjs/);
  assert.match(out, /good\[1\]\{a\}:/);
  assert.ok(!/empty\[/.test(out), 'empty table must be skipped');
  assert.ok(!/bad/.test(out), 'non-array table must be skipped');
});

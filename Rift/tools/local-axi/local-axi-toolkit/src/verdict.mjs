// Structured-verdict contract (AXI principles 4/5/6/9).
//
// Convention: scripts send human narration to STDERR, and emit exactly one
// machine-readable verdict as the LAST line of STDOUT, prefixed with a findable
// sentinel. Consumers (the darkfactory orchestrator, attractor tool nodes) call
// parseVerdict() on captured stdout to get the structured result — no scraping
// of free-text narration.
//
// A verdict object: { result: 'PASS'|'FAIL'|'SKIP', stage?, reason?, next?, ... }
// A FAIL must carry a non-empty `next` (the concrete recovery step) — principle 6/9.

export const VERDICT_SENTINEL = '@@VERDICT@@ ';

const VALID_RESULTS = new Set(['PASS', 'FAIL', 'SKIP']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export function formatVerdict(verdict) {
  const result = verdict && verdict.result;
  if (!VALID_RESULTS.has(result)) {
    throw new Error(
      `verdict.result must be one of PASS|FAIL|SKIP, got ${JSON.stringify(result)}`
    );
  }
  // Reject empty AND whitespace-only `next` so JS matches the PowerShell side
  // ([string]::IsNullOrWhiteSpace) exactly.
  if (result === 'FAIL' && !isNonEmptyString(verdict.next)) {
    throw new Error('a FAIL verdict must include a non-empty "next" step (the concrete recovery action)');
  }
  return VERDICT_SENTINEL + JSON.stringify(verdict);
}

// Pre-computed aggregates (principle 4): collapse many sub-results into counts so
// the consumer never re-parses logs to tally pass/fail/skip. Tolerates noisy
// input (null / non-object / missing or unknown result) without aborting.
export function summarize(items) {
  const out = { total: 0, passed: 0, failed: 0, skipped: 0 };
  for (const item of items ?? []) {
    out.total++;
    const result = item?.result;
    if (result === 'PASS') out.passed++;
    else if (result === 'FAIL') out.failed++;
    else if (result === 'SKIP') out.skipped++;
  }
  return out;
}

// Consumer side: pull the verdict out of a (possibly noisy) stdout blob. The
// LAST valid verdict wins. We scan lines bottom-up and, within a line, use the
// LAST sentinel occurrence; a line whose payload is not valid JSON or does not
// parse to a plain object is skipped and scanning continues upward. Returns null
// when none is present (definitive empty state — principle 5 — so "no verdict"
// is never confused with "passed", and a later non-JSON mention of the sentinel
// can never hide a real verdict).
export function parseVerdict(text) {
  if (typeof text !== 'string') return null;
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const idx = lines[i].lastIndexOf(VERDICT_SENTINEL);
    if (idx === -1) continue;
    try {
      const parsed = JSON.parse(lines[i].slice(idx + VERDICT_SENTINEL.length));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // not valid JSON on this line — keep scanning earlier lines
    }
  }
  return null;
}

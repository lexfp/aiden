export const VERDICT_SENTINEL: string;

export interface Verdict {
  result: 'PASS' | 'FAIL' | 'SKIP';
  stage?: string;
  reason?: string;
  next?: string;
  [key: string]: unknown;
}

export function formatVerdict(verdict: Verdict): string;

export function summarize(
  items: Array<{ result?: string }>
): { total: number; passed: number; failed: number; skipped: number };

export function parseVerdict(text: unknown): Verdict | null;

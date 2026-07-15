import { encode } from '@toon-format/toon';

// Ambient-context formatter (AXI principles 7/8/9): a compact, content-first
// dashboard a tool prints with no arguments — live, actionable state first,
// tabular data in TOON, and next-step `help[]` commands LAST.
//
//   formatAmbientContext({
//     title, bin,
//     fields: { host: 'DF_x1yoga', lastRun: 'PASS' },   // key: value lines
//     tables: { snapshots: [{ name, pwOk }, ...] },      // TOON-encoded
//     help:   ['Run X', 'Run Y'],                        // appended at the end
//   })
export function formatAmbientContext({ title, bin, fields, tables, help } = {}) {
  const parts = [];
  if (title) parts.push(title);
  if (bin) parts.push(`bin: ${bin}`);
  if (fields && Object.keys(fields).length) parts.push(encode(fields));
  if (tables) {
    for (const [name, rows] of Object.entries(tables)) {
      if (Array.isArray(rows) && rows.length) parts.push(encode({ [name]: rows }));
    }
  }
  if (Array.isArray(help) && help.length) {
    parts.push(`help[${help.length}]:`);
    for (const line of help) parts.push(`  ${line}`);
  }
  return parts.join('\n');
}

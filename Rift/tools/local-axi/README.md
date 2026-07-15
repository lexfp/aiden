# local-axi

Self-contained, audited, **telemetry-free** local copies of the [axi.md](https://axi.md)
ecosystem tools, plus our own AXI helpers. Portable: drop this whole folder into any
project. See [AUDIT.md](AUDIT.md) for the security review and the vendor-vs-pin policy.

**Plain-terms:** our own frozen, internet-silenced copies of the AXI tools, kept in one
folder we control and can reuse anywhere.

## What's here

| Package | Status | What it is |
|---|---|---|
| `local-toon` | ✅ vendored | TOON encoder (`@toon-format/toon`) — compact LLM-friendly data format |
| `local-axi-sdk` | ✅ vendored | Shared AXI CLI primitives (`axi-sdk-js`): TOON output, structured errors, hooks |
| `local-lavishaxi` | ✅ vendored, telemetry stripped | The HTML-artifact review editor (`lavish-axi`) |
| `local-gh-axi` | ✅ vendored | GitHub `gh` CLI wrapper. Clean — no telemetry. Needs `gh` at runtime. |
| `local-chrome-devtools-axi` | ✅ vendored | Browser-automation CLI. Runtime `chrome-devtools-mcp` pinned to 1.4.0. |
| `local-axi-toolkit` | ✅ built (tested) | **Our own**: structured-verdict contract + ambient-context helpers (10 tests) |

## Setup (this repo)

```bash
cd tools/local-axi
npm install --ignore-scripts   # links vendored pkgs, installs pinned deps from lockfile
```

`node_modules/` is git-ignored; `package-lock.json` **is committed** (the pins).

## Using the Lavish editor

```bash
# from tools/local-axi (or add local-lavishaxi/dist to PATH as `local-lavishaxi`)
node local-lavishaxi/dist/cli.mjs <file.html>   # open artifact for review in browser
node local-lavishaxi/dist/cli.mjs poll <file.html>   # long-poll for the user's feedback (JSON)
node local-lavishaxi/dist/cli.mjs end  <file.html>   # end session
```

State lives under `~/.lavish-axi`; generated artifacts default to `./.lavish/`.
It is local-only — no network egress (telemetry removed; assets served locally).

## Exporting to another project

This folder has no dependency on rivshield. To reuse it elsewhere:

1. Copy `tools/local-axi/` into the other repo (or add it as a git submodule).
2. `cd local-axi && npm install --ignore-scripts`.
3. Consume `local-lavishaxi` (and later `local-axi-toolkit`) directly, or reference
   a package via `file:` from the consuming project's `package.json`.

Because every vendored package is frozen and every pinned dep is hash-locked, the
install is byte-reproducible and never reaches out to update itself.

## Security posture

- All phone-home telemetry removed (see AUDIT.md).
- Big trusted deps pinned by exact version + integrity hash; installed with `--ignore-scripts`.
- The `axi-sdk-js` agent-config hook installer (`setup hooks`) is present but **never
  auto-invoked** — it only runs if you explicitly call it. Audit before enabling.

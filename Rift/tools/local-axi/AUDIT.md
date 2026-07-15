# local-axi — Security Audit & Vendoring Record

This folder holds **our own frozen copies** of the AXI-ecosystem tools (from axi.md /
lavish-axi), with all phone-home telemetry removed, wired to talk to each other
instead of the internet. We audited every line of the AXI authors' own code; the
few large, famous libraries (e.g. `express`) are **pinned** by exact version +
integrity hash rather than copied. Nothing here auto-updates.

**Plain-terms:** photocopies of the small tools we hand-checked, with the
usage-tracking torn out. The giant well-known libraries stay as locked,
fingerprinted downloads. The whole folder can be dropped into any other project.

---

## Policy: vendor vs. pin

| Decision | What | Why |
|---|---|---|
| **Vendor** (copy source into repo, keep forever) | `local-toon`, `local-axi-sdk`, `local-lavishaxi` (and later `local-gh-axi`, `local-chrome-devtools-axi`, `local-axi-toolkit`) | Small, written by the AXI authors, fully readable — we audited them and freeze them so they can't change under us. |
| **Pin** (exact version + lockfile hash, `--ignore-scripts`) | `express@5.2.1`, `chokidar@4.0.3`, `open@10.2.0` | Huge, widely-audited ecosystem packages. Hand-auditing every line is impractical and unnecessary; the lockfile guarantees byte-identical installs. |

**Trade-off accepted:** vendoring means *we* own security updates for the copied
code — there are no automatic CVE patches. We bump a vendored package manually,
re-audit the diff, and re-run the verification below.

---

## Audit findings (per package)

### `@toon-format/toon` 2.3.0 → `local-toon`  — CLEAN
- MIT. Author: Johann Schopplich (established OSS maintainer).
- **No install scripts. No runtime dependencies. No network code.** Pure encoder.
- Changes: removed dev-only `devDependencies` + `scripts` (we ship the prebuilt `dist/`).

### `axi-sdk-js` 0.1.7 → `local-axi-sdk`  — CLEAN
- MIT. Shared core used by lavish-axi (and the other AXI CLIs).
- **No install scripts. No telemetry. No outbound network (`fetch`/`http`) at all.**
- One dependency: `@toon-format/toon` → **repointed to `file:../local-toon`**.
- `dist/hooks.js` *can* write to `~/.claude/settings.json` and a Codex config to
  install agent session-start hooks — **but only when `setup hooks` is run explicitly.**
  It is never invoked automatically. Left intact (off by default); audit it before use.
- Changes: removed dev-only `devDependencies` + `scripts`.

### `lavish-axi` 0.1.31 → `local-lavishaxi`  — SCRUBBED
- MIT. The HTML-artifact review editor. **No install scripts.**
- **TELEMETRY (removed):** upstream shipped an opt-out Umami analytics beacon that
  fired **by default** — `POST https://a.kunchenguid.com/api/send` with app/version/
  platform/arch (counts, not file contents). Contradicted the "local only" claim.
  - **Fix (in `dist/cli.mjs`):** `resolveTelemetryConfig()` now unconditionally
    returns `{enabled:false}`; build-time host/website IDs and the fallback host are
    emptied. No env var can re-enable it. `createTelemetryClient()` therefore always
    returns the `NoopTelemetryClient`. The `HttpTelemetryClient` class remains in the
    file but is **permanently unreachable dead code** (kept to minimize diff;
    the only surviving strings are this patch's documenting comment + an inert
    `"/api/send"` path constant with no host).
- **CDN references:** the `cdn.jsdelivr.net` / `esm.sh` URLs in `cli.mjs` are
  **advisory text** the `design`/`playbook` commands hand to the agent for *artifacts
  it writes* — they are **not** loaded by the editor itself. The editor serves
  DaisyUI/Tailwind/SDK from vendored local files (`dist/design/*`, `/sdk.js`). To keep
  *generated artifacts* offline too, simply don't use the CDN design snippet (or
  repoint it later).
- Dependency changes: `axi-sdk-js` → `file:../local-axi-sdk`; `express`/`chokidar`/
  `open` pinned to exact versions; `daisyui` + `@tailwindcss/browser` dropped from
  runtime deps (their CSS is already vendored under `dist/design/`, confirmed
  unused at runtime).
- Spawns only its own Node server process; all `fetch` calls target `localhost`.

### `gh-axi` 0.1.22 → `local-gh-axi`  — CLEAN
- MIT. AXI-style wrapper around the GitHub `gh` CLI. **No install scripts. No telemetry, no external network** (unlike its sibling lavish-axi — it ships no Umami client at all).
- Only powerful behavior: `execFile('gh'/'git', …)` with array args, no shell (its stated purpose). Writes CI run logs to a `mkdtemp` scratch dir (mode 0600). No `eval`.
- **Requires the external `gh` CLI at runtime.**
- Dependency changes: `axi-sdk-js` → `file:../local-axi-sdk`, `@toon-format/toon` → `file:../local-toon`; dev deps/scripts dropped. No pins needed (no big ecosystem deps).
- `setup hooks` writes `~/.claude` via axi-sdk-js — opt-in, never automatic.

### `chrome-devtools-axi` 0.1.24 → `local-chrome-devtools-axi`  — SCRUBBED (runtime caveat)
- MIT. AXI browser-automation CLI. **No install scripts. Own code clean — no telemetry; the only non-localhost strings are example URLs.** Light install (~23 MB); ships **no** bundled browser.
- **RUNTIME caveat (mitigated):** on the first browser command it spawned `npx -y chrome-devtools-mcp@latest` — a floating, unaudited version that pulls Chromium.
  - **Fix:** pinned the spawn to `chrome-devtools-mcp@1.4.0` in `dist/src/bridge.js` (+ aligned the advisory strings in `cli.js`/`client.js`). To avoid any download, set `CHROME_DEVTOOLS_AXI_BROWSER_URL` to attach to **system Chrome**.
- `dist/src/run.js` can `import()` a user-provided temp `.mjs` and inject JS into the page — this is the documented local, user-initiated `run`/`eval` feature, not remote code.
- Dependency changes: `axi-sdk-js` → `file:../local-axi-sdk`, `@toon-format/toon` → `file:../local-toon`; **`@modelcontextprotocol/sdk` pinned exact `1.29.0`**; dev deps/scripts dropped.
- `setup hooks` writes `~/.claude` / `~/.codex` via axi-sdk-js — opt-in, never automatic.

### Residual notes (LOW — from adversarial review, 2026-06-23)

These were surfaced by an independent adversarial review and addressed; none is a
live vulnerability:
- **`local-lavishaxi` server binding:** defaults to loopback (`127.0.0.1`) but honors
  `LAVISH_AXI_HOST`; setting it to `0.0.0.0`/`::` would expose the unauthenticated
  file-serving editor to the network. Opt-in and documented in the tool's help — leave
  it at the loopback default.
- **`local-chrome-devtools-axi` dead `installHooks()`** (silent best-effort hook
  installer) has no callers and is annotated to never be wired into a startup path.
- **Stale `@latest` doc comments** in `bridge.js` were corrected to `@1.4.0` so the
  advisory text matches the pinned spawn.

---

## Verification performed (2026-06-23)

- `npm install --ignore-scripts` at the workspace root → all `local-*` packages link;
  `express`/`chokidar`/`open` install pinned; `package-lock.json` written with hashes.
- `node local-lavishaxi/dist/cli.mjs --version` → `0.1.31` (full module chain loads offline).
- `--help` → renders the TOON-encoded command table (vendored TOON + SDK working).
- `poll` with no args → structured `error:/code:/help[]` (SDK error path working).
- Tree-wide scan for `a.kunchenguid` / Umami website ID / live beacon → no live beacon
  remains (only the documenting comment + inert path constant).

## How to re-verify or update a vendored package
1. Install the upstream version in a scratch location and diff its `dist/` against ours.
2. Re-run the danger scan (network / `child_process` / `eval` / config writes).
3. Re-apply the telemetry/dependency patches; bump the `_vendored` note.
4. `npm install --ignore-scripts` at the root; run the verification commands above.

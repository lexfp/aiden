# Agent-Testing Framework — Phase 2 & 3 Roadmap (Handoff)

**Date:** 2026-07-02 (updated 2026-07-03)
**Status:** ALL THREE PHASES SHIPPED to `main`. Phase 1 (testkit/determinism),
Phase 2 (`--agent-mode` HTTP + `HttpEnv` + playtest guide), and Phase 3 (egui
0.27→0.35 upgrade + egui_kittest UI harness) are merged, pushed, and CI-green.
Remaining work is the deferred punch list at the bottom of the per-phase plans
(chiefly Group C wgpu snapshots). Executed plans:
`…phase1-testkit.md`, `…phase2-agent-mode.md`, `…phase3-egui-kittest.md`.
**Parent spec:** `docs/superpowers/specs/2026-07-02-agent-testing-framework-design.md`

This document was the pre-execution roadmap; it is kept for history. The
authoritative current state lives in the three executed plan docs and the
memory note `rift-agent-testing-project`.

## Phase 1 — SHIPPED (merged to main 2026-07-02)

What exists now, and the contracts later phases build on:

- **Determinism:** `World::open_seeded(path, seed)` / `LocalApi::open_seeded`
  (ChaCha8Rng; unseeded opens keep entropy). CLI: `rift --seed N`,
  `rift server --seed N`.
- **`testkit` crate:**
  - `env.rs` — `Action` (Register/Login use `nickname`/`password`), `View`,
    `Observation` (has `screen: Option<String>` reserved for Phase 2),
    `ActionOutcome { ok, status, observation }`, `EnvError`, trait `AgentEnv`
    (`observe` / `legal_actions` / `act`, all `&mut self`), `ApiEnv` over
    `Box<dyn GameApi>`. `legal_actions` is **advisory** (documented): the
    backend can still reject (e.g. 60s shipyard repair cooldown not in the
    snapshot).
  - `replay.rs` — `Replay { seed, actions, expect, tolerate_rejections }`,
    `Expect { credits, rank, state_hash }` (`deny_unknown_fields`),
    `state_hash` = SHA-256 over a time-free `HashView { user, ships }`,
    `run_replay` (fresh seeded in-memory world; per-accepted-step
    `check_invariants`; seed-prefixed errors), shared
    `check_invariants(&Observation)`.
  - `bots.rs` — `run_baseline` (wins a battle vs the weakest NPC in ~4 steps);
    `run_monkey(env, seed, steps, illegal_ratio) -> Result<(), (Replay, String)>`
    — **self-registers `M{seed}` as its first recorded action** (requires an
    unregistered env whose world was opened with the same seed), enforces that
    deliberately-illegal actions are rejected, emits standalone-replayable
    failure artifacts with `tolerate_rejections: true`.
  - `scenario.rs` + `scenarios/*.json` — frozen regression corpus (campaign,
    broke_pilot with covered insufficient-funds rejection, repair_economics).
    World facts pinned by guard tests: NPC_Astro is `user_id 1`; the player's
    first bought ship is `ship_number 77` (76 NPC ships share the
    AUTOINCREMENT); passwords must be ≥3 chars (fixtures use `"pwd"`).
- **sim:** proptest invariants in `sim/tests/invariants.rs`.
- **Wire path:** `serve_ephemeral_for_test(port, ready)` in
  `network/src/server.rs` (binds port 0, reports `Result<u16, String>`);
  campaign scenario runs over `RemoteApi` in `testkit/tests/wire_campaign.rs`.
- **CI (`.github/workflows/ci.yml`):** PR jobs (ubuntu + windows: workspace
  build + `cargo nextest run -p sim -p network -p testkit`, 55 tests) and a
  nightly monkey soak (8 seeds × 10k steps, `#[ignore]`-gated, artifacts from
  `testkit/target/soak-failures/`, nextest timeout override in
  `.config/nextest.toml`). First real run: all three jobs green.

## ⚠ Upstream game change that affects Phases 2–3

After the spec was researched (2026-07-01), the game gained on `origin/main`:
a **real-time visual space battle** (`game/src/battle_scene.rs`), a **pannable
galaxy map with real-time fleet travel**, a UI redesign (`ship_art.rs`, large
`app.rs` rewrite), and a combat multi-ship targeting fix. The spec's claim
that the client has "no real-time gameplay loop" is now **stale**. Before
writing either phase's plan, re-explore `game/` and answer:

- Does `RiftApp` still funnel every state mutation through `GameApi`, with the
  battle scene/galaxy map as visual layers on top? (If yes, the agent-mode
  design survives mostly intact; the command channel drains in `update()` as
  designed, but screenshots/turn-gating semantics need revisiting for the
  animated scenes.)
- Does the client now use `request_repaint`/continuous repaint? (Affects the
  channel wake mechanism and possibly an FPS/speed control for agent mode
  after all.)
- What new `Screen`/scene states exist for `Observation.screen`?

## Phase 2 — Agent mode (live LLM play)

Spec section: "Agent mode — live LLM play". Scope as designed:

- `rift --agent-mode [--agent-port N]` (default 7878, localhost-only), gated
  behind an `agent` cargo feature; a small sync HTTP server (e.g. `tiny_http`).
- Endpoints: `GET /state` (Observation incl. `screen`), `GET /actions`,
  `POST /act` (executed on the UI thread via a command channel drained in
  `RiftApp::update()` — same code paths as the buttons; reply over a response
  channel; server thread holds a cloned `egui::Context` and calls
  `request_repaint()`), `GET /screenshot` (`ViewportCommand::Screenshot`),
  `GET /replay` (session action log as a replay file).
- `docs/agent-playtest.md`: the loop for an LLM session (launch → poll state →
  act → save `/replay` on anything suspicious → replay becomes a CI test).
- Also implement `HttpEnv` in testkit (the `AgentEnv` client for this channel)
  so scripted tools can drive the live game too.

Punch list inherited from Phase 1 reviews (fold into the Phase 2 plan):

1. `PlayerSnapshot` lacks a per-ship repair-cooldown field → `legal_actions`
   advertises `Repair` the backend may reject. Adding the field makes
   `legal_actions` exact (protocol change in `network`).
2. `ApiEnv` never constructs `EnvError`: a dead `RemoteApi` backend makes
   `observe()` look like a logged-out empty state instead of erroring.
   Return `EnvError::Backend` when `logged_in && snapshot() fails`.
3. Monkey illegal-action pool is all "nonexistent id" shapes; add stateful
   ones (double-sell, repair undamaged, activate beyond max, wrong password).
4. `Expect` has no "action N must be rejected" assertion; `tolerate_rejections`
   is all-or-nothing.
5. CI has no `push` trigger for `main` (PR/nightly/manual only), and
   `actions/checkout@v4` has a Node 20 deprecation notice (bump to v5).

## Phase 3 — egui upgrade + UI harness

Spec section: "UI harness (egui upgrade + kittest)". Scope as designed:

- Upgrade eframe/egui 0.27 → latest (≥0.34; `egui_kittest` needs ≥0.31 for
  full-app driving via `Harness::build_eframe`; AccessKit is unconditional
  from 0.34). Own reviewable phase — the upstream UI rewrite makes this
  LARGER than originally estimated (app.rs ~1400+ lines now, plus
  battle_scene.rs/ship_art.rs).
- `game/tests/ui.rs` with kittest over an in-memory `LocalApi` backend:
  login via `type_text` (`press_key` does not fill TextEdits), buy/activate/
  battle flows by label, error rendering.
- **Parity test:** after each UI action, the app's cached state must equal
  `ApiEnv::observe()` on the same backend.
- A few `harness.snapshot()` visual regressions; baselines generated on the
  Linux CI leg (mesa/lavapipe), per-OS thresholds via `kittest.toml`,
  snapshot tests in a separate nextest group.
- Open question from the upstream change: how kittest interacts with the
  real-time battle scene (animation frames → snapshot instability; may need
  the scene to be skippable/instant in test mode).

## Environment notes (Windows dev box)

- cargo lives at `%USERPROFILE%\.cargo\bin` and is NOT on PATH in fresh
  shells; cargo-nextest is installed. MSVC Build Tools 2022 present.
- Spec/plan reviews in this project are presented via the vendored Lavish
  editor (`tools/local-axi/`, see `.claude/skills/lavish-spec-review/SKILL.md`)
  with a mandatory "Layman's description" section.

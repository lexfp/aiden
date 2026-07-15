# Rift Agent-Testing Framework — Design

**Codename:** FAAT — Fully Autonomous Agent Testing.
**Date:** 2026-07-02
**Status:** All three phases shipped to `main` (Phase 1 2026-07-02; Phases 2–3
2026-07-03). Phase 1 = testkit/determinism; Phase 2 = `--agent-mode` HTTP channel
+ `HttpEnv` + playtest guide; Phase 3 = egui 0.27→0.35 upgrade + egui_kittest UI
harness. Remaining work is the deferred punch list in the per-phase plan docs.
An upstream game change (real-time battle scene + galaxy map) partially
invalidates the "no real-time gameplay loop" finding below for the client.
**Decisions locked with the user:** all three test layers (headless API, UI harness, live LLM play); runs in CI + on-demand (LLM layer on-demand only); adding a gated agent interface to the game itself is allowed; architecture = gym-core layered (Approach A).

## Goal

Make Rift testable by agents that *play* it: deterministic scripted agents in CI for
regression, a UI-level harness that exercises the real egui client, and an
interactive mode where an LLM agent (e.g. a Claude Code session) plays the live
windowed game for exploratory QA. A bug found at any layer must be reducible to a
seeded replay file that fails in CI.

## Context (from codebase exploration, verified 2026-07-01)

- The live client is only `game/src/app.rs` + `game/src/theme.rs`: a menu-driven
  egui app (eframe 0.27) with a `Screen` enum state machine. Every player action is
  one synchronous call on `network::GameApi` (15 methods, `network/src/api.rs:15`).
  There is **no real-time gameplay loop** and no `request_repaint` — repainting is
  purely event-driven. "Slowing down FPS" is therefore unnecessary; agents need
  observe/act hooks, and the game is naturally turn-gated.
- `LocalApi::open(":memory:")` (`network/src/api.rs:42`) runs the complete game
  world in-process with no UI/GPU/network — the primary testability seam.
- `sim` is pure rules, 23 unit tests, and `sim::combat::battle` /
  `sim::economy::perform_work` already accept an injected `Rng` (sim tests use
  `StdRng::seed_from_u64`). `sim::bot::decide` (`sim/src/bot.rs:34`) is a working
  scripted policy (repair → activate → buy → attack → work) used for server NPCs.
- **Determinism gap:** `network::World` hardcodes `StdRng::from_entropy()` for
  `battle`/`work` (`network/src/world.rs:367,422`), so end-to-end runs are not
  reproducible today.
- The `game/` crate has zero tests; buttons are identified only by label text.
- `game/src/` contains orphaned pre-rewrite files (game.rs, hud.rs, player.rs,
  title.rs, net_state.rs, level.rs, world.rs, etc.) that reference the removed
  `engine` crate and are not compiled. They must not be targeted by this work.
- Existing integration test (`network/tests/integration.rs`) plays a full session
  over real TCP but uses a fixed port (7811) and a 400 ms sleep for readiness.

## Research conclusions (verified 2026-07-01)

- **egui_kittest** (0.35.0, lockstep with egui) is the official harness: AccessKit
  tree queries by label, synthetic input, full-`eframe::App` driving via
  `Harness::build_eframe` (needs egui ≥ 0.31; AccessKit unconditional from 0.34),
  headless wgpu snapshot rendering with its own PNG diffing (`dify`), per-OS
  thresholds via `kittest.toml`. Caveats: current eframe 0.27 is unsupported →
  upgrade required; `press_key` does not fill `TextEdit` — use `type_text()`;
  snapshot baselines should be generated on one pinned OS. Alternatives
  (standalone AccessKit clients, enigo OS input injection, archived
  egui-screenshot-testing) were evaluated and rejected.
- Industry pattern for this genre: test pyramid (pure sim → headless server/bot →
  thin UI layer), deterministic seeded replay regression (RTS lockstep pattern),
  property-based invariants (proptest), monkey/soak bots, and the gym pattern
  (OpenSpiel-style state + discrete legal-action API) as the shared agent
  interface.
- LLM game-QA practice (2024–2026): structured-state + action-API loops beat
  screenshot/vision loops on cost, speed, and reliability for menu/turn-based
  games; turn-gating suffices for pacing. Vision stays as an optional smoke check.
- CI: `cargo-nextest` (timeouts, retries, JUnit); kittest snapshots run green on
  Linux with `mesa-vulkan-drivers` (lavapipe); Windows legs build + run
  non-snapshot tests only.

## Architecture

One new workspace crate plus small gated additions:

```
testkit/            NEW — AgentEnv trait, Action/Observation types, bots,
                    scenario + replay engine, proptest strategies
network/            + seedable RNG in World (replaces from_entropy call sites)
game/               + agent-mode command channel into RiftApp (feature "agent")
                    + tests/ (egui_kittest, after egui upgrade)
src/main.rs         + --seed N, --agent-mode [--agent-port N] flags
.github/workflows/  + PR test jobs (nextest), nightly soak job
docs/               + agent-playtest.md (LLM play guide)
```

Four consumers of one abstraction: CI regression tests, scripted/monkey bots,
kittest UI parity tests, live LLM sessions. `testkit` never ships in the release
binary; the agent-mode channel compiles under an `agent` cargo feature and is
inert unless `--agent-mode` is passed at runtime.

### testkit core

```rust
pub enum Action {           // superset of sim::bot::BotAction
    Register { nickname: String, password: String },
    Login { nickname: String, password: String },
    Work,
    Buy { ship_id: u32 },
    Sell { ship_number: u32 },
    Repair { ship_number: u32 },
    Activate { ship_number: u32 },
    Deactivate { ship_number: u32 },
    SetFormation(Formation),
    Battle { opponent_id: u32, formation: Formation },
    Refresh(View),          // opponents / leaderboard / history pulls
}

pub struct Observation {    // serde JSON — identical payload at every layer
    pub player: Option<PlayerSnapshot>,
    pub catalog: Vec<ShipTemplate>,
    pub opponents: Vec<OpponentInfo>,
    pub leaderboard: Vec<LeaderboardEntry>,
    pub history: Vec<BattleSummary>,
    pub status: String,
    pub status_is_error: bool,
    pub screen: Option<String>, // populated only when attached to the live UI
}

pub trait AgentEnv {
    fn observe(&mut self) -> Result<Observation, EnvError>;
    fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError>;
    fn act(&mut self, a: &Action) -> Result<ActionOutcome, EnvError>;
}
```

Implementations:

- `ApiEnv` — wraps any `Box<dyn GameApi>`: in-memory `LocalApi`, on-disk save, or
  `RemoteApi` over TCP/WS, so the same scenario can also exercise the wire path.
- `HttpEnv` — client for the live agent-mode channel (below).

`legal_actions` derives from the observation (affordable ships, repairable ships,
work cooldown, active-fleet requirements). Every bot and the LLM consume it
rather than re-deriving what is possible.

### Determinism (game enhancement 1)

`World::open_seeded(path, seed: u64)` stores a `ChaCha8Rng` used by `battle()` and
`work()`; unseeded opens keep entropy behavior so normal play is unchanged.
Exposed as `rift --seed N` (offline client) and `rift server --seed N`.

Replay file format (JSON), the universal bug-report currency:

```json
{
  "seed": 42,
  "actions": [ { "Login": { "nickname": "T", "password": "" } }, "Work",
               { "Buy": { "ship_id": 3 } } ],
  "expect": { "credits": 1250, "rank": "Ensign", "state_hash": "…" }
}
```

One runner replays a file against a fresh seeded in-memory world and asserts the
expectations. Monkey failures, CI scenario failures, and live LLM sessions all
emit this same format.

### Scripted agents & CI suites

- **Baseline bot:** `sim::bot::decide` looped through `AgentEnv` until a goal
  (reach rank N, survive M battles), asserting progression invariants.
- **Monkey bot:** seeded; each step samples `legal_actions` plus a configurable
  ratio of deliberately illegal actions (unaffordable buy, empty-fleet battle,
  double sell). Asserts no panic, errors surface as `Err` without state
  corruption, and per-step invariants hold (credits ≥ 0, active ≤ max, ship
  status consistency). Prints its seed on failure.
- **Scenario files** (`testkit/scenarios/*.json`): named action scripts with
  end-state expectations (full campaign loop, broke-pilot path, repair
  economics).
- **Property tests** (proptest, in `sim`): no negative HP/credits after battle,
  ELO transfer sums to zero, `level_for_experience` monotonic, formation
  modifiers bounded, catalog tier/price ordering.
- Default target is `LocalApi::open(":memory:")` (milliseconds per scenario); the
  campaign scenario also runs against an ephemeral-port TCP server with
  connect-retry readiness (replacing the fixed-port + sleep pattern in
  `network/tests/integration.rs`).

### UI harness (egui upgrade + kittest)

Prerequisite phase: upgrade eframe/egui 0.27 → latest (≥ 0.34). Expected churn is
confined to `app.rs`/`theme.rs` (~750 lines total).

Then `game/tests/ui.rs` with `egui_kittest::Harness::build_eframe`, backend =
in-memory `LocalApi`:

- Flow tests by label: login (via `type_text`), buy → credits drop, activate →
  fleet count changes, engage → victory/defeat banner + combat log rendered,
  empty hangar → "Visit the market" prompt, error statuses shown in red path.
- **Parity test:** after each UI action, the app's cached state must equal
  `ApiEnv::observe()` on the same backend — catches stale-cache/"UI forgot to
  refresh" bugs invisible to API-level tests.
- A small set of `harness.snapshot()` visual regressions for main screens.
  Baselines generated on the pinned Linux CI leg; per-OS thresholds via
  `kittest.toml`; PNGs committed directly (small count, no git-lfs).
- Accommodations in `app.rs`: keep button label text stable (it is the query
  key), no other changes required — `RiftApp::new(backend, …)` already accepts an
  injected backend.

### Agent mode — live LLM play (game enhancement 2)

`rift --agent-mode --offline --seed 42` runs the normal windowed game plus a
localhost-only HTTP thread (default port 7878; small sync server such as
`tiny_http` — no async runtime, matching the codebase):

```
GET  /state        → Observation JSON (includes current screen + status line)
GET  /actions      → legal actions JSON
POST /act          → { action } — executed on the UI thread; returns outcome + new state
GET  /screenshot   → PNG of the current frame (optional sanity check)
GET  /replay       → session action log as a replay file
```

Wiring: the HTTP thread never touches `GameApi` directly. It pushes commands into
a channel; `RiftApp::update()` drains the queue and executes them through the same
code paths the buttons use (`act`, `do_battle`, `go`), then replies over a response
channel. The server thread holds a cloned `egui::Context` and calls
`request_repaint()` so the reactive loop wakes immediately. Consequences: actions
are turn-gated by construction, agent play is visible in the window (a human can
watch), and UI cache-refresh logic is exercised rather than bypassed. Screenshots
use `ViewportCommand::Screenshot`, resolved on the following frame.

`docs/agent-playtest.md` documents the loop for an LLM session: launch, poll
`/state`, choose from `/actions`, `POST /act`, watch `status_is_error`, and save
`/replay` when something looks wrong — the replay becomes a deterministic
regression test.

## Error handling & flake control

- Control channel returns structured error JSON (`{ "error": …, "kind": … }`);
  10 s timeout on the UI-thread handoff (a hung app is itself a finding);
  port-in-use fails startup with a clear message.
- Harnesses own process lifetime: kittest is in-process; live sessions are
  launched as tracked background tasks and explicitly killed.
- TCP tests use ephemeral ports with connect-retry readiness, never sleeps.
- nextest per-test timeouts; soak runs log their seed so crashes reproduce.
- Snapshot drift contained by pinned-OS baselines + thresholds; snapshot tests
  run as a separate nextest group so logic suites never block on them.

## CI integration

- **PR, ubuntu:** nextest over `sim`, `network`, `testkit`; kittest UI tests with
  `mesa-vulkan-drivers` (lavapipe) including snapshots.
- **PR, windows:** build + all non-snapshot tests.
- **Nightly:** long monkey soak (e.g. 10k steps × 8 seeds) + campaign bots;
  artifacts are failing replay files.
- The LLM layer stays out of CI (on-demand from Claude Code sessions only).

## Success criteria

1. `cargo nextest run` is green and headless: property tests, scenarios, replay
   regressions, monkey smoke, and UI flows in under ~2 minutes.
2. A Claude Code session can cold-start `rift --agent-mode`, play a full campaign
   loop (work → buy → activate → battle → rank up) unassisted, and save a replay.
3. Any bug found at any layer is expressible as a seeded replay file that fails
   in CI before the fix and passes after.

## Build order (each phase independently shippable)

1. **Determinism + testkit core** — World seeding, `AgentEnv`/`ApiEnv`, replay
   engine, proptest suite, baseline + monkey bots, scenario files, nextest CI
   jobs. No egui changes; highest value, lowest risk.
2. **Agent mode + LLM playtest guide** — the live-play channel and
   `docs/agent-playtest.md`. Still no egui upgrade needed.
3. **egui upgrade + kittest UI suite** — upgrade to ≥ 0.34, flow tests, parity
   test, snapshots, Linux snapshot CI leg.
4. **Optional cleanup (any time):** delete the orphaned pre-rewrite files in
   `game/src/` so future work cannot target dead code.

## Out of scope

- Vision-driven play as a primary channel (screenshots are a sanity check only).
- Running LLM agents inside CI (cost/keys; revisit later if wanted).
- OS-level input injection (enigo/UIA) and out-of-process accessibility driving.
- RL training environments — the gym-shaped API enables them later but nothing
  here depends on that.

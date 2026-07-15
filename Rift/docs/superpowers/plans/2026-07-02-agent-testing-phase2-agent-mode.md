# Agent-Testing Framework Phase 2 (Agent Mode — live LLM play) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Claude Code session (or any HTTP client) play the *live windowed* Rift client for exploratory QA, and let scripted tools drive the same live game. A small localhost-only HTTP server, gated behind an `agent` cargo feature and only active when `--agent-mode` is passed, exposes `GET /state`, `GET /actions`, `POST /act`, `GET /idle`, `GET /screenshot`, and `GET /replay`. Every action executes on the UI thread through the *same* code paths the buttons use (`RiftApp::act`/`do_battle`/`go`), so agent play is visible in the window, turn-gated by construction, and exercises the real UI-cache refresh logic. The session's recorded **core** actions are downloadable as a Phase-1 replay JSON, so any bug found while playing is reducible to a `run_replay` regression. Also folds in three Phase-1 review punch-list items — (1) `ApiEnv::observe` erroring on a dead backend, (2) stateful monkey illegal actions, (3) the CI push-to-main trigger + `checkout@v5` — and adds a CI test that drives the whole HTTP layer headlessly over `testkit::ApiEnv`.

> **Punch-list scope note.** Two roadmap punch-list items are intentionally *not* in this plan. The originally-planned per-ship `PlayerSnapshot::repair_cooldown_remaining` field is **dropped** (see the "Dropped work" note below): the unmerged upstream branch `realtime-fleet-combat` already adds `GameApi::shipyard_status()` exposing per-ship repair cooldowns, so a parallel field would guarantee a merge conflict; `legal_actions` therefore keeps its existing *advisory* treatment of `Repair`. The "Expect must-be-rejected" per-action replay assertion stays deferred to Phase 3 (see "What this plan does NOT do").

**Architecture:** A new module `game/src/agent_mode.rs`, compiled only when the `game` crate's `agent` feature is on (enabled transitively from the root crate's `client` feature, so default builds include it; runtime-inert unless `--agent-mode`). It defines an `AgentBridge` trait — the seam between the HTTP layer and the game — with two impls: (1) `ChannelBridge`, an `mpsc` request/response pair wired into `RiftApp::update()`'s command drain, holding a cloned `egui::Context` so it can `request_repaint()`; (2) a headless bridge over `testkit::ApiEnv` used only in tests, so CI can exercise the full HTTP stack without a window. The HTTP server (`tiny_http`, sync, bound to `127.0.0.1` only) is spawned on its own thread and talks only to an `AgentBridge`; it never touches `GameApi` directly. `testkit` gains an `HttpEnv` (an `AgentEnv` over the HTTP channel, using `ureq`) so scripted tools and the CI test drive the live game exactly as the LLM does. The `/act` payload is a `UiCommand` — either a core `testkit::Action` executed through `RiftApp`'s own code paths, or a UI verb (`Goto`, `SelectOpponent`, `LaunchFleet`, `RecallFleet`, `SkipBattleAnimation`, `ContinueAfterBattle`, `RefreshPlayer`). When a battle resolves, the session recorder logs a **core** `Battle{opponent_id, formation}` action, so `/replay` yields only core actions replayable by Phase 1's `run_replay`.

**Dropped work (owner decision).** The originally-planned per-ship `PlayerSnapshot::repair_cooldown_remaining` field — and the "exact `Repair` legality" that depended on it — are **removed from this plan**. Rationale: the unmerged upstream branch `realtime-fleet-combat` already adds `GameApi::shipyard_status()` exposing per-ship repair cooldowns; adding a parallel `PlayerSnapshot` field here would guarantee a merge conflict against that branch and duplicate the concept. `legal_actions` keeps its **advisory** treatment of `Repair` (the existing doc comment already says listed actions can be rejected). One-line forward note: *post-merge, `shipyard_status()` can make `Repair` legality exact.* The pure `legal_actions_from(&Observation)` extraction is **kept** (agent mode's `/actions` needs one shared derivation) but reworked to be extraction-and-sharing only — no new cooldown logic.

**Send-bound prep (blocker fix).** `AgentBridge: Send` (the HTTP thread owns a `Box<dyn AgentBridge>` across threads) forces every impl to be `Send`. `ChannelBridge` holds a `Box<dyn GameApi>` transitively through `RiftApp`, and `Box<dyn GameApi>` is `!Send` unless the trait requires it. Task 0 therefore changes `pub trait GameApi` (`network/src/api.rs:15`) to `pub trait GameApi: Send`. Both production impls already qualify (`World { db: rusqlite::Connection, rng: RefCell<Option<ChaCha8Rng>> }` and `Client { TcpStream, .. }` are all `Send`), as does the plan's `DeadAfterLogin` test double. `testkit` is unaffected — `Box<dyn GameApi>` merely gains the `Send` bound.

**Tech Stack:** `tiny_http` 0.12 (sync HTTP server, optional dep in `game`, gated on `agent`); `serde` + `serde_json` (optional deps in `game`, gated on `agent`, since `agent_mode.rs` uses them in *library* code; already present in `network`/`testkit`; the HTTP layer serializes `serde_json` manually, no framework); `image` 0.24 (PNG encoding for `/screenshot`, optional dep in `game`, gated on `agent`; `write_image(buf, w, h, ColorType::Rgba8)` — note `ColorType` is correct for image 0.24, not the 0.25 `ExtendedColorType`); `ureq` 2 with `default-features = false, features = ["json"]` (blocking HTTP client for `testkit::HttpEnv`; **`json` is NOT a default feature in ureq 2.x**, and `HttpEnv`/the tests use `.into_json()`/`.send_json()`, so it must be requested explicitly on both the testkit optional dep and the `game` dev-dep — gated behind testkit's `http` feature so it never links into the shipped binary); `eframe`/`egui` 0.27 (`ViewportCommand::Screenshot` — a unit variant — → `egui::Event::Screenshot { image, .. }`, confirmed supported by the glow backend); `testkit` (a normal `game` dependency for the shared `Action`/`Observation`/`Replay` DTOs, plus a `game` dev-dependency with `features=["http"]` for the CI test's `HttpEnv`); `cargo-nextest` (CI runner).

---

## File Structure

Files created or modified, with one-line responsibility.

| File | C/M | Responsibility |
|------|-----|----------------|
| `network/src/api.rs` | Modify | Add the `Send` supertrait: `pub trait GameApi: Send` (Task 0 — prerequisite for `AgentBridge: Send`). |
| `testkit/src/env.rs` | Modify | Extract a pure `legal_actions_from(&Observation) -> Vec<Action>` shared by `ApiEnv::legal_actions` and agent mode's `/actions` (no cooldown logic — `Repair` stays advisory); `ApiEnv::observe` returns `EnvError::Backend` when `logged_in && snapshot()` fails (punch-list #2). |
| `testkit/src/bots.rs` | Modify | Extend the monkey illegal pool with stateful shapes built from the current observation (punch-list #3). |
| `testkit/src/http_env.rs` | Create | `HttpEnv`: `AgentEnv` over the HTTP channel via `ureq`; UI verbs as inherent methods (item F). |
| `testkit/src/lib.rs` | Modify | Add `#[cfg(feature = "http")] pub mod http_env;`. |
| `testkit/Cargo.toml` | Modify | Add optional `ureq` (`features=["json"]`) behind a new `http` feature (keeps `ureq` out of the shipped binary). |
| `game/Cargo.toml` | Modify | Add `agent` feature (`tiny_http`+`image`+`serde`+`serde_json`+`testkit`, all `dep:`-gated); `testkit` optional under `agent`; a dev-dep on `testkit` with `features=["http"]`; `ureq`/`serde_json` dev-deps. |
| `game/src/agent_mode.rs` | Create | `AgentBridge` trait, `UiCommand`/`AgentRequest`/`AgentResponse`/`StateReport`/`UiState` DTOs, `ChannelBridge`, `serve()` HTTP loop, request routing, PNG encode. Behind `#[cfg(feature = "agent")]`. |
| `game/src/lib.rs` | Modify | `mod agent_mode;` (gated); `GameConfig.agent_port: Option<u16>`; when set, build a `ChannelBridge`, hand its receiver to `RiftApp`, spawn `agent_mode::serve`. |
| `game/src/app.rs` | Modify | `Screen::name(&self)`; a `UiCommand` drain at the top of `update()` (gated); expose the bridge receiver + recorder; `BattleScene::skip`; `fleet_travel` dt clamp; a `screen_name()`/`ui_state()` accessor for `/state`. |
| `game/src/battle_scene.rs` | Modify | `pub fn skip(&mut self)` (sets `finished`, clears in-flight lasers/explosions). |
| `src/main.rs` | Modify | `--agent-mode` / `--agent-port N` (default 7878) flags; plumb `agent_port` into `GameConfig`. |
| `game/tests/agent_http.rs` | Create | CI test: start `serve()` over a headless `ApiEnv`-backed bridge on an ephemeral port; drive `HttpEnv` through register→work→buy→activate; assert observations; exercise `/idle` and `/replay`. Gated `#[cfg(feature = "agent")]`. |
| `testkit/tests/http_env.rs` | Create | `HttpEnv` JSON-mapping test against a `std::net` stub. Starts with `#![cfg(feature = "http")]` so plain `-p testkit` runs (incl. the nightly soak) skip it. |
| `docs/agent-playtest.md` | Create | The LLM play loop: build/launch, curl examples (PowerShell + bash), reading status/errors, saving `/replay` as a bug report, safety notes. |
| `.github/workflows/ci.yml` | Modify | `push: branches: [main]` trigger for the PR test jobs; `actions/checkout@v4` → `@v5`; build `game` with `--features agent` and run its tests (punch-list #4). |

---

## Conventions used throughout

Carried over from Phase 1, plus Phase-2 additions. Use these exact spellings everywhere.

- **Cargo is not on PATH in fresh shells.** Every command block that runs cargo assumes this prelude has been run once in the shell (PowerShell):
  ```powershell
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  ```
  All `cargo` commands run from the repo root. `cargo-nextest` is installed.
- **Commit after every green step.** Every commit message ends with the trailer:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- Canonical type names (do not rename between tasks): the HTTP request enum is **`AgentRequest`**, the response is **`AgentResponse`**, the `/act` payload is **`UiCommand`**, the state payload is **`StateReport`** with a nested **`UiState`**, the bridge trait is **`AgentBridge`**, its production impl is **`ChannelBridge`**. Core actions remain **`Action`** (from `testkit::env`), the observation **`Observation`**, error **`EnvError`** — exactly as Phase 1.
- The agent server binds **`127.0.0.1`** only, default port **7878**. Never `0.0.0.0`.
- `Formation` is `sim::user::Formation` (`Defensive`/`Aggressive`/`Tactical`), re-exported as `sim::Formation`; `Formation::as_str(self) -> &'static str` exists.
- Passwords must be **≥ 3 chars** (`network::World::register` rejects shorter). Test fixtures use `"pwd"`.
- World facts pinned by Phase 1 guard tests, still true: `NPC_Astro` is **`user_id == 1`**; the human's first purchased ship is **`ship_number == 77`** (76 NPC ships share the AUTOINCREMENT); NPCs occupy rowids 1–11, the first human gets `user_id == 12`.
- The starting human has `currency_value == 2000`, `max_active_ships == 1`, 0 ships; `Falcon` is `ship_id == 1`, value 1500.
- **Feature-gate rule:** all new `game` code that pulls in `tiny_http`/`image`/`serde`/`serde_json`/`testkit` lives behind `#[cfg(feature = "agent")]`. `cargo build` (default features) compiles it because `client` → `game` and the plan enables `agent` from `game`'s default set (Task 5). `cargo build --no-default-features` still excludes `game` entirely (root `client` feature is off), so `agent_mode` never compiles there.

---

## Design reference (read before implementing)

### AgentBridge seam (item B)

```rust
/// The seam between the HTTP layer and the game. The HTTP thread only ever
/// holds a `Box<dyn AgentBridge>` and never touches `GameApi` directly.
pub trait AgentBridge: Send {
    /// Current observation + live UI state. Blocks only as long as the handoff needs.
    fn state(&self) -> Result<StateReport, String>;
    /// Legal core actions derived from the current observation (advisory).
    fn actions(&self) -> Result<Vec<testkit::env::Action>, String>;
    /// Execute one UiCommand; returns the resulting StateReport (post-action).
    /// Errors distinguish a game-rule rejection ([`ActError::Rejected`], a 400)
    /// from a transport/bridge failure ([`ActError::Bridge`], a 5xx).
    fn act(&self, cmd: UiCommand) -> Result<StateReport, ActError>;
    /// Block until no scene/travel is animating, or `timeout_ms` elapses.
    /// Returns true if idle, false on timeout.
    fn wait_idle(&self, timeout_ms: u64) -> Result<bool, String>;
    /// The session's recorded CORE actions as a Phase-1 Replay (item D).
    fn replay(&self) -> Result<testkit::replay::Replay, String>;
    /// A PNG of the current frame, or None if the backend cannot render one
    /// (the headless test bridge). One-frame latency for ChannelBridge.
    fn screenshot(&self) -> Result<Option<Vec<u8>>, String>;
}

/// Failure classes for `AgentBridge::act`. `Rejected` is a game-rule refusal
/// (→ 400); `Bridge` is a transport failure (game thread gone / timeout /
/// malformed reply → 503). Lets an unattended agent tell "my command was
/// invalid" from "the game backend is unreachable".
#[derive(Debug)]
pub enum ActError {
    Rejected(String),
    Bridge(String),
}
```

- **`ChannelBridge`** (production): holds an `mpsc::Sender<(AgentRequest, mpsc::Sender<AgentResponse>)>` and a cloned `egui::Context`. Each method sends an `AgentRequest`, calls `ctx.request_repaint()` to wake the reactive loop (which drains within ~50 ms even when idle — see repaint note below), then blocks on a per-call reply channel with a **10 s** timeout (a hung app is itself a finding — spec "Error handling"). `RiftApp::update()` drains the request queue and answers.
- **Headless test bridge** (`game/tests/agent_http.rs`): wraps a `testkit::ApiEnv` behind a `Mutex`; `state`/`actions`/`act` map straight onto `ApiEnv`; `wait_idle` returns `true` immediately (no animation offscreen); `screenshot` returns `Ok(None)`; `replay` returns the recorded core actions. This lets CI exercise `serve()` + all routes + `HttpEnv` without a window.

### AgentRequest / AgentResponse (channel DTOs)

```rust
/// Sent from the HTTP thread into RiftApp::update()'s drain.
pub enum AgentRequest {
    State,
    Actions,
    Act(UiCommand),
    Replay,
    Screenshot,   // triggers ViewportCommand::Screenshot; reply is deferred one frame
}

pub enum AgentResponse {
    State(StateReport),
    Actions(Vec<testkit::env::Action>),
    Replay(testkit::replay::Replay),
    Screenshot(Option<Vec<u8>>),
    Err(String),
}
```

### UiCommand vocabulary (item D — the /act payload)

```rust
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub enum UiCommand {
    /// A core testkit action executed through RiftApp's own code paths.
    /// `Battle{..}` is NOT accepted here (see below) and returns an error.
    Core(testkit::env::Action),
    Goto(String),                              // screen name, e.g. "Galaxy"
    SelectOpponent { user_id: u32 },
    LaunchFleet { user_id: u32, instant: bool },
    RecallFleet,
    SkipBattleAnimation,
    ContinueAfterBattle,
    /// Re-fetch the player snapshot (backend.snapshot() → apply_snapshot) so
    /// time-based fields like work_cooldown_remaining decay without a mutating
    /// action. UI-only; not recorded.
    RefreshPlayer,
}
```

- Core actions accepted: `Register`/`Login`/`Work`/`Buy`/`Sell`/`Repair`/`Activate`/`Deactivate`/`SetFormation`/`Refresh`. Executed through `RiftApp::act` (the snapshot-returning closure runner) or the matching inline handlers, so the UI cache refreshes exactly as a button press would.
- `RefreshPlayer` calls `self.backend.snapshot()` and `apply_snapshot` (only when logged in) so agents can watch `work_cooldown_remaining` decay to 0 before retrying `Work`. It is **not** recorded (UI-only). Because `/actions` returns `Vec<Action>` (core actions only) and `RefreshPlayer` is a UI verb, it cannot appear as an `Action` in that list; instead the `/state` payload advertises it via `ui.available_ui_verbs: Vec<String>` — which includes `"RefreshPlayer"` whenever the player is logged in (and `"RecallFleet"` while a fleet is in transit, etc.). It is also documented in the playtest guide.
- `Core(Action::Battle{..})` is **rejected** with `"Battle is not a direct command; use LaunchFleet"`. The UI flow is travel → auto-battle. `LaunchFleet { instant: true }` sets `fleet_travel` with `elapsed = duration` so `update()` fires `do_battle` on the very next frame; `instant: false` uses the normal timed travel.
- When `do_battle` fires (from either travel completion), the recorder appends a **core** `Action::Battle { opponent_id, formation: self.chosen_formation }`. `SelectOpponent`/`LaunchFleet`/`RecallFleet`/`SkipBattleAnimation`/`ContinueAfterBattle`/`Goto` are **not** recorded (they are UI-only; the recorded core stream stays `run_replay`-able).

### StateReport / UiState (item C — GET /state)

```rust
#[derive(serde::Serialize, serde::Deserialize)]
pub struct StateReport {
    pub observation: testkit::env::Observation, // same shape as testkit, built from RiftApp caches
    pub ui: UiState,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UiState {
    pub screen: String,                         // Screen::name()
    pub selected_opponent: Option<u32>,
    pub fleet_travel: Option<FleetTravelState>, // {target_id,target_name,elapsed,duration,remaining} | null
    pub battle_animating: bool,                 // battle_scene present && !finished
    pub battle_finished: bool,                  // battle_scene present && finished
    /// UI verbs currently applicable (not core Actions, so absent from /actions).
    /// Includes "RefreshPlayer" when logged in, "RecallFleet" while a fleet is in
    /// transit, "SkipBattleAnimation"/"ContinueAfterBattle" during/after a battle.
    pub available_ui_verbs: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct FleetTravelState {
    pub target_id: u32,
    pub target_name: String,
    pub elapsed: f32,
    pub duration: f32,
    pub remaining: f32,
}
```

`observation` is built from `RiftApp`'s caches (`snapshot`, `catalog`, `opponents`, `leaderboard`, `history`, `status`, `status_is_error`) with `screen: Some(self.screen.name())`.

### Endpoints (item C)

| Method | Path | Body → | Returns |
|--------|------|--------|---------|
| GET | `/state` | — | `StateReport` JSON |
| GET | `/actions` | — | `Vec<Action>` JSON (legal, advisory) |
| POST | `/act` | `UiCommand` JSON | `StateReport` JSON (post-action) |
| GET | `/idle?timeout_ms=N` | — | `{ "idle": bool }` — long-poll until not animating |
| GET | `/screenshot` | — | `image/png` bytes, or `501` if the bridge returns `None` |
| GET | `/replay` | — | Phase-1 `Replay` JSON (core actions only) |

Errors return HTTP `400` (bad request/parse) or `500` (bridge error) with body `{"error": "...", "kind": "..."}` (spec "Error handling"). Port-in-use fails `serve()` startup with a clear logged message.

**`/actions` legal-actions sharing (justify in one line):** `agent_mode` builds legal actions by calling `testkit::env::legal_actions_from(&observation)` — a small pure helper factored out of `ApiEnv::legal_actions` in Task 2 — so the live layer and `ApiEnv` share one derivation and cannot drift. The drain then **filters out any `Action::Battle { .. }`** before returning `/actions`, because `Battle` is not a direct `/act` command (it is a `400` over the channel — agents reach battle via `LaunchFleet`); advertising it would invite a guaranteed rejection.

**`/screenshot` (item C):** `ChannelBridge::screenshot` sends `AgentRequest::Screenshot`; `update()` issues `ctx.send_viewport_cmd(ViewportCommand::Screenshot)` (a unit variant in egui 0.27), records that a reply is pending, and on the *next* frame reads `ctx.input(|i| i.raw.events)` for `egui::Event::Screenshot { image, .. }`, encodes the `ColorImage` to PNG with `image::codecs::png`, and answers the pending reply channel. Document the one-frame latency. eframe 0.27's glow backend supports this (verified: `glow_integration.rs` pushes `egui::Event::Screenshot`), so no 501 stub is needed for the windowed path; the headless test bridge returns `None` → `/screenshot` yields `501`.

**`/replay` shape & determinism caveat (item C):** `Replay { seed, actions, expect: Expect::default(), tolerate_rejections: true }`. `seed` comes from `GameConfig.seed`; if the world was opened unseeded, the replay carries `seed: 0` and the runner will replay against a *different* world than the live session — document this loudly in `/replay`'s docs and in `agent-playtest.md` ("save `/replay` only from a `--seed N` session for a faithful reproduction"). `Replay` itself does **not** `deny_unknown_fields` (only `Expect` does), so no extra "note" field is added to the JSON — the caveat is documentation-only, keeping the artifact a clean Phase-1 `Replay`. `tolerate_rejections: true` mirrors the monkey artifact so a live session that hit a rejection still replays cleanly.

### Repaint note

`RiftApp::update()` ends with `ctx.request_repaint()` while animating else `request_repaint_after(50 ms)`. `ChannelBridge` additionally calls `ctx.request_repaint()` on every request, so a queued command is drained within one frame (or ~50 ms worst case when idle). The command drain runs at the **top** of `update()`, before UI, so `/act` results reflect in the same frame's `/state` cache.

---

## Part 1 — Prep + punch-list items (independent, land first)

### Task 0 — `GameApi: Send` supertrait (prep for `AgentBridge: Send`)

`AgentBridge: Send` is required because the HTTP server thread owns a `Box<dyn AgentBridge>`. `ChannelBridge` reaches a `Box<dyn GameApi>` transitively through `RiftApp`, and `Box<dyn GameApi>` is `!Send` unless the trait itself requires `Send`. Add the supertrait now so later tasks compile.

**Files:** Modify `network/src/api.rs`.

**Why this is safe (verified):** both production impls are already `Send` — `World { db: rusqlite::Connection, rng: RefCell<Option<ChaCha8Rng>> }` (all three of `Connection`, `RefCell<T: Send>`, `ChaCha8Rng` are `Send`) and `Client { TcpStream, .. }`. The plan's `DeadAfterLogin` test double (Task 1) holds only a `bool`, so it is `Send` too. `testkit` is unaffected: its `Box<dyn GameApi>` fields simply gain the `Send` bound, which they already satisfy.

**Steps:**

- [ ] Change the trait declaration in `network/src/api.rs:15`:
  ```rust
  pub trait GameApi: Send {
  ```
  (No other line changes; every method signature is unchanged.)
- [ ] Compile-check the whole workspace — this is the only place a missing `Send` would surface, and it must stay green with no impl changes:
  ```powershell
  cargo build --workspace
  ```
  Expect: **PASS**. If any impl fails the `Send` bound, that impl holds a non-`Send` field and the failure names it — fix that field (none is expected per the analysis above; `testkit` is unaffected — `Box<dyn GameApi>` just gains `Send`).
- [ ] Commit:
  ```
  git add network/src/api.rs
  git commit -m "GameApi: Send supertrait (prep for AgentBridge: Send)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1 — `ApiEnv::observe` errors on a dead backend (punch-list #2)

Today `build_observation` swallows `snapshot()` errors into `player: None`, so a dead `RemoteApi` looks like a logged-out empty state. Make `observe` return `EnvError::Backend` when `logged_in && snapshot()` fails.

**Files:** Modify `testkit/src/env.rs`.

**Steps:**

- [ ] Write the failing test — append to `testkit/tests/env.rs`:
  ```rust
  #[test]
  fn observe_errors_when_logged_in_snapshot_fails() {
      // A backend that reports "logged in" to ApiEnv (via a successful register)
      // but whose snapshot() then fails must surface EnvError::Backend, not an
      // empty logged-out observation.
      use testkit::env::{Action, AgentEnv, ApiEnv, EnvError};
      struct DeadAfterLogin { registered: bool }
      impl network::GameApi for DeadAfterLogin {
          fn register(&mut self, _n: &str, _p: &str) -> Result<network::PlayerSnapshot, String> {
              self.registered = true;
              Err("boom".into()) // registration itself fails, but ...
          }
          fn login(&mut self, _n: &str, _p: &str) -> Result<network::PlayerSnapshot, String> { Err("boom".into()) }
          fn snapshot(&mut self) -> Result<network::PlayerSnapshot, String> { Err("backend down".into()) }
          fn catalog(&mut self) -> Result<Vec<sim::ship::ShipTemplate>, String> { Ok(vec![]) }
          fn buy(&mut self, _: u32) -> Result<network::PlayerSnapshot, String> { Err("x".into()) }
          fn sell(&mut self, _: u32) -> Result<network::PlayerSnapshot, String> { Err("x".into()) }
          fn repair(&mut self, _: u32) -> Result<network::PlayerSnapshot, String> { Err("x".into()) }
          fn activate(&mut self, _: u32) -> Result<network::PlayerSnapshot, String> { Err("x".into()) }
          fn deactivate(&mut self, _: u32) -> Result<network::PlayerSnapshot, String> { Err("x".into()) }
          fn set_formation(&mut self, _: sim::user::Formation) -> Result<network::PlayerSnapshot, String> { Err("x".into()) }
          fn work(&mut self) -> Result<(String, i64, network::PlayerSnapshot), String> { Err("x".into()) }
          fn opponents(&mut self) -> Result<Vec<network::OpponentInfo>, String> { Ok(vec![]) }
          fn battle(&mut self, _: u32, _: sim::user::Formation) -> Result<(network::BattleResultDto, network::PlayerSnapshot), String> { Err("x".into()) }
          fn leaderboard(&mut self) -> Result<Vec<network::LeaderboardEntry>, String> { Ok(vec![]) }
          fn history(&mut self) -> Result<Vec<network::BattleSummary>, String> { Ok(vec![]) }
      }
      let mut env = ApiEnv::new(Box::new(DeadAfterLogin { registered: false }));
      // Force logged_in = true by using the login-testing hook: a Login attempt
      // that the env treats as success requires a snapshot; instead we drive the
      // documented path — observe() while marked logged in must error.
      // (ApiEnv sets logged_in only on a successful register/login; simulate that
      // by a successful login backend variant is overkill — use the public setter.)
      env.set_logged_in_for_test(true);
      match env.observe() {
          Err(EnvError::Backend(msg)) => assert!(msg.contains("backend down"), "got {msg}"),
          other => panic!("expected Backend error, got {other:?}"),
      }
  }
  ```
  Add the minimal test hook to `ApiEnv` (a `#[doc(hidden)]` setter is the least-invasive way to mark `logged_in` without a full successful login round-trip):
  ```rust
      #[doc(hidden)]
      pub fn set_logged_in_for_test(&mut self, v: bool) {
          self.logged_in = v;
      }
  ```
- [ ] Run: `cargo nextest run -p testkit observe_errors_when_logged_in_snapshot_fails`
  Expect: **FAIL** (`observe` currently returns `Ok` with `player: None`).
- [ ] Implement: change `ApiEnv::observe` (env.rs:138) so that when `logged_in`, a failed `snapshot()` becomes an error. Replace `build_observation`'s player line and thread a `Result` up. Simplest: give `observe` its own player fetch:
  ```rust
      fn observe(&mut self) -> Result<Observation, EnvError> {
          let player = if self.logged_in {
              Some(self.api.snapshot().map_err(EnvError::Backend)?)
          } else {
              None
          };
          Ok(self.build_observation_with_player(player, String::new(), false))
      }
  ```
  Refactor `build_observation` into `build_observation_with_player(&mut self, player: Option<PlayerSnapshot>, status, status_is_error)` that takes the already-fetched player and fills the rest (catalog/opponents/leaderboard/history) as today. `act`'s post-action observation keeps using the swallowing variant via `self.api.snapshot().ok()` so a *rejected action* does not turn into a hard `EnvError` (only a bare `observe` does — matches the punch-list scope).
- [ ] Run: `cargo nextest run -p testkit observe_errors_when_logged_in_snapshot_fails`
  Expect: **PASS**.
- [ ] Run: `cargo nextest run -p testkit`
  Expect: **PASS** (all prior env/replay/bot tests still green; the healthy `LocalApi` snapshot never fails, so real flows are unaffected).
- [ ] Commit:
  ```
  git add testkit/src/env.rs testkit/tests/env.rs
  git commit -m "ApiEnv::observe returns EnvError::Backend when logged-in snapshot fails

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 2 — Extract shared `legal_actions_from` helper (agent mode's `/actions` needs it)

Factor the pure derivation out of `AgentEnv::legal_actions` into a free `legal_actions_from(&Observation)` so `agent_mode`'s `/actions` and `ApiEnv` share one derivation and cannot drift (item C). **No cooldown logic** — `Repair` stays advisory (the owner dropped the `repair_cooldown_remaining` field; `shipyard_status()` from the upstream `realtime-fleet-combat` branch can make it exact post-merge).

**Files:** Modify `testkit/src/env.rs`.

**Steps:**

- [ ] Write the failing test — append to `testkit/tests/env.rs`:
  ```rust
  #[test]
  fn legal_actions_from_matches_trait_method() {
      // legal_actions_from(&obs) must produce exactly what ApiEnv::legal_actions
      // returns for the same state — the extraction preserves behaviour and gives
      // agent mode a shared derivation.
      use testkit::env::{legal_actions_from, Action, AgentEnv, ApiEnv};
      let api = network::LocalApi::open_seeded(":memory:", 3).unwrap();
      let mut env = ApiEnv::new(Box::new(api));
      env.act(&Action::Register { nickname: "Fixer".into(), password: "pwd".into() }).unwrap();
      env.act(&Action::Buy { ship_id: 1 }).unwrap();
      let obs = env.observe().unwrap();
      let via_free = legal_actions_from(&obs);
      let via_trait = env.legal_actions().unwrap();
      assert_eq!(via_free, via_trait,
          "legal_actions_from must match the trait method for the same state");
      // Repair stays advisory: a Repair for a healthy ship is simply not offered
      // (needs_repair() is false), and cooldown is NOT modelled here.
      let n = obs.player.as_ref().unwrap().ships[0].ship_number;
      assert!(!via_free.contains(&Action::Repair { ship_number: n }),
          "healthy ship is not offered Repair");
  }
  ```
- [ ] Run: `cargo nextest run -p testkit legal_actions_from_matches_trait_method`
  Expect: **FAIL** (`legal_actions_from` does not exist yet).
- [ ] Implement: extract the body of `AgentEnv::legal_actions` (env.rs:142–204) verbatim into a free `pub fn legal_actions_from(obs: &Observation) -> Vec<Action>`, and make the trait method delegate: `fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError> { let obs = self.observe()?; Ok(legal_actions_from(&obs)) }`. Do **not** add any cooldown gating — the `Repair` pushes keep their existing `if ship.needs_repair()` guard exactly as today.
- [ ] Leave the advisory doc comment on `AgentEnv::legal_actions` (env.rs:89–92) as-is — it already states that listed actions can still be rejected. Add one line noting the shared helper and the forward path for exact repair:
  ```rust
      /// Advisory, not a guarantee: actions listed here can still be rejected
      /// (`ok == false`) — e.g. Repair during the 60s shipyard cooldown, which is
      /// not modelled here (post-merge, `GameApi::shipyard_status()` from the
      /// upstream realtime-fleet-combat branch can make Repair exact). The pure
      /// derivation lives in `legal_actions_from`, shared with agent mode.
  ```
- [ ] Run: `cargo nextest run -p testkit legal_actions_from_matches_trait_method` then `cargo nextest run -p testkit`
  Expect: both **PASS**.
- [ ] Commit:
  ```
  git add testkit/src/env.rs testkit/tests/env.rs
  git commit -m "Extract shared legal_actions_from helper (Repair stays advisory)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3 — Stateful monkey illegal actions (punch-list #3)

Extend the monkey's illegal pool with shapes that depend on current state: **double-sell** (sell a ship, then sell the same `ship_number` again), **repair-while-on-cooldown** (repair a ship twice back-to-back; the second is reliably rejected by the 60s shipyard cooldown), **activate-beyond-max**, **wrong-password login**. The monkey builds them from the latest observation it already fetches.

> **Why not "repair-undamaged"?** `World::repair` (`network/src/world.rs:341`) rejects only two cases: an active repair cooldown and a `Destroyed` ship. Repairing an *undamaged* ship is **accepted** (it just re-stamps `last_repair_at`), so "repair-undamaged" is not reliably illegal. The correct reliably-rejected shape is repair-while-on-cooldown (symmetric with double-sell): repair once (accepted, stamps the cooldown), then immediately repair the same ship again (rejected — "Shipyard busy").

**Files:** Modify `testkit/src/bots.rs`.

**Design:** `run_monkey` already samples a random illegal shape (`bots.rs:149` `rng.gen_range(0..7)`). Widen the range and, for the stateful shapes, read `env.observe()` (the monkey can afford one extra read per illegal step) to pick a real `ship_number` / a `nickname` that exists. Each stateful shape must be *reliably* illegal given the observation:

- **double-sell:** pick an owned/active ship, `Sell` it (a legal accepted action, pushed as history), then immediately emit a second `Sell { ship_number }` for the same ship — the second is the deliberately-illegal one (already sold). Only the second counts toward the "illegal must be rejected" contract; execute the first via `env.act` and require `ok == true`, then treat the second as the illegal action for this step. If the first sell was itself rejected, fall back to the id-based `Sell { ship_number: 999_999 }` (which is reliably illegal) rather than re-emitting the now-doubtful same-ship sell.
- **repair-while-on-cooldown:** pick an owned/active ship, `Repair` it (accepted — stamps `last_repair_at`), then immediately emit a second `Repair { ship_number }` for the same ship — the second is rejected by the 60s shipyard cooldown. As with double-sell, execute the first via `env.act`; if it was rejected, fall back to an id-based illegal shape.
- **activate-beyond-max:** only when `active_count >= max_active_ships` and an `Owned` ship exists; `Activate { ship_number }` on the reserve ship must be rejected.
- **wrong-password login:** `Login { nickname: "M{seed}", password: "not-the-password" }` — the monkey's own account exists with password `"pwd"`, so a different password is rejected.

If the observation lacks the precondition for a chosen stateful shape (e.g. no owned ship for repair-while-on-cooldown), fall back to an id-based illegal shape so the step still exercises rejection.

**Steps:**

- [ ] Write the failing test — append to `testkit/tests/bots.rs`:
  ```rust
  #[test]
  fn monkey_stateful_illegal_actions_are_all_rejected() {
      // High illegal ratio over many steps so the stateful shapes are exercised.
      // The monkey's contract: any deliberately-illegal action accepted by the
      // backend is a failure. If the new stateful shapes were wrong (e.g. a
      // "double-sell" that the backend accepts), run_monkey returns Err.
      use testkit::env::ApiEnv;
      for seed in [1u64, 2, 3, 4, 5] {
          let api = network::LocalApi::open_seeded(":memory:", seed).unwrap();
          let mut env = ApiEnv::new(Box::new(api));
          if let Err((_replay, why)) = testkit::bots::run_monkey(&mut env, seed, 400, 0.6) {
              // A genuine invariant break is a real bug; a wrongly-accepted illegal
              // action means our stateful shape is not actually illegal.
              panic!("monkey seed {seed} failed: {why}");
          }
      }
  }
  ```
- [ ] Run: `cargo nextest run -p testkit monkey_stateful_illegal_actions_are_all_rejected`
  Expect: **PASS today** with the *current* id-based pool (it is a regression guard). If it already passes, keep it — it now guards the new shapes too. *(This task's "red" is the design gap, not a compile failure; the guard test's value is preventing a wrongly-accepted stateful shape after the change. Proceed to implement, then confirm it still passes.)*
- [ ] Implement in `run_monkey` (bots.rs): replace the illegal branch. Fetch the observation once at the top of an illegal step, then:
  ```rust
      let pick_illegal = rng.gen::<f64>() < illegal_ratio;
      let action = if pick_illegal {
          let obs = match env.observe() {
              Ok(o) => o,
              Err(e) => return Err((failed(&executed), e.to_string())),
          };
          let ships = obs.player.as_ref().map(|p| p.ships.clone()).unwrap_or_default();
          let at_max = obs.player.as_ref().map_or(false, |p| p.active_count >= p.max_active_ships);
          match rng.gen_range(0..11) {
              0 => Action::Buy { ship_id: 999 },
              1 => Action::Battle { opponent_id: 999_999, formation: sim::user::Formation::Aggressive },
              2 => Action::Sell { ship_number: 999_999 },
              3 => Action::Buy { ship_id: 0 },
              4 => Action::Battle { opponent_id: 0, formation: sim::user::Formation::Aggressive },
              5 => Action::Deactivate { ship_number: 999_999 },
              6 => Action::Register { nickname: format!("M{seed}"), password: "pwd".into() },
              7 => Action::Login { nickname: format!("M{seed}"), password: "wrong-password".into() }, // wrong password
              8 => {
                  // repair-while-on-cooldown: repair once (accepted, stamps the
                  // cooldown), then repair the same ship again (rejected).
                  match ships.iter().find(|s|
                      matches!(s.status, sim::ship::ShipStatus::Owned | sim::ship::ShipStatus::Active)) {
                      Some(s) => {
                          let first = Action::Repair { ship_number: s.ship_number };
                          match env.act(&first) {
                              Ok(o) if o.ok => {
                                  executed.push(first);
                                  Action::Repair { ship_number: s.ship_number } // 2nd = illegal
                              }
                              // First repair rejected (already on cooldown, etc.):
                              // use a safe id-based illegal instead.
                              _ => Action::Sell { ship_number: 999_999 },
                          }
                      }
                      None => Action::Sell { ship_number: 999_999 }, // fallback illegal
                  }
              }
              9 => {
                  // activate-beyond-max: only illegal when already at the cap.
                  match (at_max, ships.iter().find(|s| s.status == sim::ship::ShipStatus::Owned)) {
                      (true, Some(s)) => Action::Activate { ship_number: s.ship_number },
                      _ => Action::Buy { ship_id: 999 }, // fallback illegal
                  }
              }
              _ => {
                  // double-sell: sell a real ship (legal), then sell it again (illegal).
                  match ships.iter().find(|s| matches!(s.status, sim::ship::ShipStatus::Owned | sim::ship::ShipStatus::Active)) {
                      Some(s) => {
                          let first = Action::Sell { ship_number: s.ship_number };
                          match env.act(&first) {
                              Ok(o) if o.ok => {
                                  executed.push(first);
                                  Action::Sell { ship_number: s.ship_number } // 2nd sell = illegal
                              }
                              // First sell rejected: use a safe id-based illegal so
                              // this step still exercises a real rejection.
                              _ => Action::Sell { ship_number: 999_999 },
                          }
                      }
                      None => Action::Sell { ship_number: 999_999 }, // fallback illegal
                  }
              }
          }
      } else {
          // LEGAL branch — keep the existing Phase-1 code verbatim (it samples a
          // random legal action from the current observation). Only the illegal
          // branch above is replaced; leave the `else { .. }` body exactly as it
          // is today so the `if pick_illegal { .. } else { .. }` stays one
          // expression assigned to `action`.
          <existing Phase-1 legal-action sampling — do not modify>
      };
  ```
  When editing, do not rewrite the `else` body: this task changes only the illegal branch. Update the doc comment above `run_monkey` (bots.rs:64–80) to describe the new stateful shapes (double-sell, repair-while-on-cooldown, activate-beyond-max, wrong-password login).
- [ ] Run: `cargo nextest run -p testkit monkey_stateful_illegal_actions_are_all_rejected` then `cargo nextest run -p testkit`
  Expect: both **PASS**. If a stateful shape is wrongly accepted, the guard test fails and names the seed — fix the precondition (that is the whole point).
- [ ] Commit:
  ```
  git add testkit/src/bots.rs testkit/tests/bots.rs
  git commit -m "Add stateful illegal actions to the monkey pool

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4 — CI: push-to-main trigger + checkout v5 (punch-list #4)

**Files:** Modify `.github/workflows/ci.yml`.

**Steps:**

- [ ] Add a `push` trigger for `main` and keep the existing triggers. Change the `on:` block (lines 3–7) to:
  ```yaml
  on:
    push:
      branches: [main]
    pull_request:
    workflow_dispatch:
    schedule:
      - cron: "0 6 * * *" # nightly soak at 06:00 UTC
  ```
- [ ] The PR test jobs guard on `if: github.event_name != 'schedule'`, which already admits `push` — leave those `if:` conditions as-is so the logic tests also run on pushes to `main`. The `soak` job's `if:` stays `schedule || workflow_dispatch` (do not run soak on every push).
- [ ] Bump both `actions/checkout@v4` occurrences in the PR jobs and the one in `soak` to `actions/checkout@v5` (three total). Leave `actions/upload-artifact@v4` unchanged (v4 is current).
- [ ] Verify the YAML parses (no cargo needed): `git diff .github/workflows/ci.yml` and eyeball indentation.
- [ ] Commit:
  ```
  git add .github/workflows/ci.yml
  git commit -m "CI: run tests on push to main; bump checkout to v5

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

*(The `--features agent` build/test additions to CI land in Task 14, once the feature exists.)*

---

## Part 2 — Agent mode

### Task 5 — `agent` feature + optional deps, empty gated module (compile-check only)

Set up the feature gate and dependencies so later tasks have somewhere to write code. This task is **compile-checked**, not TDD'd, because the module is empty.

**Files:** Modify `game/Cargo.toml`, `Cargo.toml` (root), create `game/src/agent_mode.rs`, modify `game/src/lib.rs`.

**Steps:**

- [ ] Modify `game/Cargo.toml` to add the feature and optional deps. `agent_mode.rs` uses `serde`/`serde_json` in **library** code (the DTOs derive `Serialize`/`Deserialize` and `serve()` serializes with `serde_json`), so both are optional deps gated on `agent` — not dev-deps. `testkit` is also optional under `agent` (`dep:testkit`) so `cargo build -p game --no-default-features` skips it entirely:
  ```toml
  [dependencies]
  sim = { path = "../sim" }
  network = { path = "../network" }
  eframe = "0.27"
  log = "0.4"
  testkit = { path = "../testkit", optional = true }
  tiny_http = { version = "0.12", optional = true }
  image = { version = "0.24", optional = true, default-features = false, features = ["png"] }
  serde = { version = "1", features = ["derive"], optional = true }
  serde_json = { version = "1", optional = true }

  [features]
  default = ["agent"]
  agent = ["dep:tiny_http", "dep:image", "dep:serde", "dep:serde_json", "dep:testkit"]

  [dev-dependencies]
  # ureq (with json) is used by game's own tests (Task 8); testkit/http gives the
  # tests access to testkit::HttpEnv (Task 13) without ureq entering the shipped
  # binary. serde_json is a dev-dep too so tests can build JSON regardless of the
  # (already-enabled-by-default) agent feature.
  ureq = { version = "2", default-features = false, features = ["json"] }
  serde_json = "1"
  testkit = { path = "../testkit", features = ["http"] }
  ```
  Note: `testkit` appears in **both** `[dependencies]` (optional, no features — DTOs only, pulled in by the `agent` feature, ships in the binary) and `[dev-dependencies]` (`features = ["http"]` — enables `HttpEnv` for tests only). Cargo unifies these to "testkit with `http` on" for test builds and "testkit without `http`" for the release binary, so `ureq` never links into `rift`. Under `--no-default-features` the `agent` feature is off, so `dep:testkit` is not activated by `game` at all.
  Note: `testkit` is a *normal* (optional) dependency, not a dev-dep, because `agent_mode`'s public DTOs reference `testkit::env::Action`/`Observation` and `testkit::replay::Replay`. This is acyclic: `testkit` depends on `network`+`sim` only; `game` depends on `network`+`sim`+`testkit`. No cycle.
  Note (B3): `ureq`'s `json` feature is **not** on by default in ureq 2.x; the tests call `.into_json()`/`.send_json()`, so `features = ["json"]` is required on this dev-dep (and on testkit's optional `ureq` in Task 9).

  **Shipped-binary consequence (accepted):** because `agent` is on by default, the released `rift` binary now links `testkit` (its `Action`/`Observation`/`Replay` DTOs are agent mode's wire types) plus `testkit`'s `rand`/`rand_chacha`/`sha2`, and `serde`/`serde_json`. This is the deliberate Phase-2 shift: agent mode ships *inside* the client (inert unless `--agent-mode`). It is a small, deterministic, dependency-light set. What must **not** leak into the binary is the HTTP *client* stack: `ureq` is needed only by `testkit::HttpEnv` (the channel's client, which `game` never calls), so `ureq` is gated behind a `testkit` `http` feature that `game` does not enable (Task 9). A future hardening option — moving the shared DTOs into a tiny `agent-proto` crate so `testkit` proper stays out of the binary — is noted for Phase 3 but not required here.
- [ ] Ensure the root crate enables `agent` transitively so default `cargo build` compiles the module. In root `Cargo.toml`, change the `client` feature (line 28) to:
  ```toml
  client = ["dep:game", "game/agent"]
  ```
  (`game/agent` is redundant given `game`'s own `default = ["agent"]`, but stated explicitly so the coupling is visible and survives a future change to `game`'s defaults.)
- [ ] Create `game/src/agent_mode.rs` with only the module doc and a compile-satisfying stub:
  ```rust
  //! Localhost-only HTTP control surface for live agent play. Compiled only with
  //! the `agent` feature and inert unless `--agent-mode` is passed at runtime.
  //! The HTTP thread talks to the game exclusively through an [`AgentBridge`];
  //! it never touches `network::GameApi` directly.
  ```
- [ ] Gate the module in `game/src/lib.rs` (after `mod app;` at line 5). It is `pub` so the Task 13 integration test (`game/tests/agent_http.rs`) can name `game::agent_mode::{serve, AgentBridge, StateReport, UiState, UiCommand}`:
  ```rust
  #[cfg(feature = "agent")]
  pub mod agent_mode;
  ```
  Every item the tests reference (`serve`, `AgentBridge`, `StateReport`, `UiState`, `UiCommand`, `FleetTravelState`, `AgentRequest`, `AgentResponse`, `AgentCall`, `ChannelBridge`) is declared `pub` when introduced in Tasks 7/8/10.
- [ ] Run:
  ```powershell
  cargo build -p game
  cargo build -p game --no-default-features
  cargo build --workspace
  ```
  Expect: all **PASS**. (`--no-default-features` on `game` builds without `tiny_http`/`image`; the gated `mod agent_mode` disappears.)
- [ ] Commit:
  ```
  git add game/Cargo.toml Cargo.toml game/src/agent_mode.rs game/src/lib.rs
  git commit -m "Add agent feature gate and empty agent_mode module

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6 — Game accommodations: `Screen::name`, `BattleScene::skip`, fleet dt clamp (item E)

Three tiny, independently-testable game changes needed by later tasks.

**Files:** Modify `game/src/app.rs`, `game/src/battle_scene.rs`.

**Steps:**

- [ ] `BattleScene::skip` — write the failing test first. Append to `game/src/battle_scene.rs` (add a `#[cfg(test)] mod tests` block at the end):
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;
      #[test]
      fn skip_finishes_and_clears_effects() {
          let mut s = BattleScene::new(3, 3, 1, 2, true, 42);
          s.update(0.05);
          s.skip();
          assert!(s.finished, "skip must set finished");
          assert!(s.lasers.is_empty() && s.explosions.is_empty(), "skip must clear in-flight effects");
      }
  }
  ```
- [ ] Run: `cargo nextest run -p game skip_finishes_and_clears_effects`
  Expect: **FAIL** (`skip` does not exist).
- [ ] Implement `skip` on `BattleScene` (battle_scene.rs, in the `impl BattleScene` block after `update`):
  ```rust
      /// Instantly end the animation: mark it finished and drop any in-flight
      /// lasers/explosions so the result banner shows immediately.
      pub fn skip(&mut self) {
          self.elapsed = DURATION;
          self.lasers.clear();
          self.explosions.clear();
          self.finished = true;
      }
  ```
- [ ] Run: `cargo nextest run -p game skip_finishes_and_clears_effects`
  Expect: **PASS**.
- [ ] `Screen::name` — write the failing test. Append to `game/src/app.rs` (add a `#[cfg(test)] mod tests` block at the end of the file):
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;
      #[test]
      fn screen_names_are_stable() {
          assert_eq!(Screen::Login.name(), "Login");
          assert_eq!(Screen::Hangar.name(), "Hangar");
          assert_eq!(Screen::Galaxy.name(), "Galaxy");
          assert_eq!(Screen::Battle.name(), "Battle");
          assert_eq!(Screen::History.name(), "History");
      }
  }
  ```
- [ ] Run: `cargo nextest run -p game screen_names_are_stable`
  Expect: **FAIL** (`name` does not exist).
- [ ] Implement `Screen::name` (app.rs, add an `impl Screen` block after the enum at line 23):
  ```rust
  impl Screen {
      /// Stable machine-readable name for the agent-mode `/state` payload.
      fn name(&self) -> &'static str {
          match self {
              Screen::Login => "Login",
              Screen::Hangar => "Hangar",
              Screen::Market => "Market",
              Screen::Work => "Work",
              Screen::Galaxy => "Galaxy",
              Screen::Battle => "Battle",
              Screen::Leaderboard => "Leaderboard",
              Screen::History => "History",
          }
      }
  }
  ```
- [ ] Run: `cargo nextest run -p game screen_names_are_stable`
  Expect: **PASS**.
- [ ] Fleet dt clamp (drive-by robustness, item E) — in `RiftApp::update` (app.rs:1052), change:
  ```rust
          mv.elapsed += ctx.input(|i| i.stable_dt);
  ```
  to:
  ```rust
          mv.elapsed += ctx.input(|i| i.stable_dt).min(0.5); // clamp huge frame gaps
  ```
  (No dedicated test — it is a one-line guard; covered by the workspace build and the existing update flow.)
- [ ] Run: `cargo nextest run -p game` then `cargo build --workspace`
  Expect: both **PASS**.
- [ ] Commit:
  ```
  git add game/src/app.rs game/src/battle_scene.rs
  git commit -m "Game accommodations: Screen::name, BattleScene::skip, fleet dt clamp

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7 — agent_mode DTOs + AgentBridge trait (unit-tested serde)

Define the wire DTOs and the bridge trait. Serde round-trips are unit-testable headlessly.

**Files:** Modify `game/src/agent_mode.rs`.

**Steps:**

- [ ] Write the failing test first. Append to `game/src/agent_mode.rs`:
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;
      #[test]
      fn uicommand_json_roundtrips() {
          let cmds = vec![
              UiCommand::Core(testkit::env::Action::Work),
              UiCommand::Core(testkit::env::Action::Buy { ship_id: 1 }),
              UiCommand::Goto("Galaxy".into()),
              UiCommand::SelectOpponent { user_id: 1 },
              UiCommand::LaunchFleet { user_id: 1, instant: true },
              UiCommand::RecallFleet,
              UiCommand::SkipBattleAnimation,
              UiCommand::ContinueAfterBattle,
              UiCommand::RefreshPlayer,
          ];
          for c in cmds {
              let s = serde_json::to_string(&c).unwrap();
              let back: UiCommand = serde_json::from_str(&s).unwrap();
              assert_eq!(format!("{c:?}"), format!("{back:?}"));
          }
      }
      #[test]
      fn statereport_serializes_ui_and_observation() {
          let report = StateReport {
              observation: testkit::env::Observation {
                  player: None, catalog: vec![], opponents: vec![], leaderboard: vec![],
                  history: vec![], status: "hi".into(), status_is_error: false,
                  screen: Some("Hangar".into()),
              },
              ui: UiState {
                  screen: "Hangar".into(), selected_opponent: Some(2),
                  fleet_travel: Some(FleetTravelState { target_id: 2, target_name: "NPC".into(), elapsed: 1.0, duration: 3.0, remaining: 2.0 }),
                  battle_animating: false, battle_finished: false,
                  available_ui_verbs: vec!["RefreshPlayer".into()],
              },
          };
          let s = serde_json::to_string(&report).unwrap();
          assert!(s.contains("\"screen\":\"Hangar\""));
          assert!(s.contains("\"remaining\":2.0"));
          assert!(s.contains("RefreshPlayer"));
      }
  }
  ```
- [ ] Run: `cargo nextest run -p game uicommand_json_roundtrips`
  Expect: **FAIL** (types do not exist).
- [ ] Implement the DTOs and trait in `agent_mode.rs` exactly as in the "Design reference" section above: `UiCommand`, `AgentRequest`, `AgentResponse`, `StateReport`, `UiState`, `FleetTravelState`, and the `AgentBridge` trait. Add `use serde::{Serialize, Deserialize};` and derive `Clone, Debug, Serialize, Deserialize` on the DTOs (`AgentRequest`/`AgentResponse` need only `Debug`; they cross an mpsc channel, not JSON).
- [ ] Run: `cargo nextest run -p game uicommand_json_roundtrips statereport_serializes_ui_and_observation`
  Expect: both **PASS**.
- [ ] Commit:
  ```
  git add game/src/agent_mode.rs
  git commit -m "agent_mode DTOs and AgentBridge trait

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 8 — HTTP request routing over a bridge + `serve()` (tested via a fake bridge)

Implement the `serve()` loop and per-request routing. This is fully TDD'd headlessly using an in-test fake `AgentBridge` — no window, no `RiftApp`.

**Files:** Modify `game/src/agent_mode.rs`.

**Steps:**

- [ ] Write the failing test first — append to the `agent_mode.rs` test module:
  ```rust
  #[test]
  fn serve_routes_state_actions_act_idle_replay() {
      use std::sync::Mutex;
      // A fake bridge backed by an ApiEnv, standing in for the live game.
      struct FakeBridge(Mutex<testkit::env::ApiEnv>);
      impl AgentBridge for FakeBridge {
          fn state(&self) -> Result<StateReport, String> {
              use testkit::env::AgentEnv;
              let obs = self.0.lock().unwrap().observe().map_err(|e| e.to_string())?;
              let screen = if obs.player.is_some() { "Hangar" } else { "Login" };
              let verbs = if obs.player.is_some() { vec!["RefreshPlayer".to_string()] } else { vec![] };
              Ok(StateReport {
                  ui: UiState { screen: screen.into(), selected_opponent: None, fleet_travel: None,
                                battle_animating: false, battle_finished: false, available_ui_verbs: verbs },
                  observation: obs,
              })
          }
          fn actions(&self) -> Result<Vec<testkit::env::Action>, String> {
              use testkit::env::AgentEnv;
              // Mirror the drain: never advertise Battle (agents use LaunchFleet).
              let mut a = self.0.lock().unwrap().legal_actions().map_err(|e| e.to_string())?;
              a.retain(|act| !matches!(act, testkit::env::Action::Battle { .. }));
              Ok(a)
          }
          fn act(&self, cmd: UiCommand) -> Result<StateReport, ActError> {
              use testkit::env::AgentEnv;
              if let UiCommand::Core(a) = cmd {
                  if matches!(a, testkit::env::Action::Battle { .. }) {
                      return Err(ActError::Rejected("Battle is not a direct command; use LaunchFleet".into()));
                  }
                  self.0.lock().unwrap().act(&a).map_err(|e| ActError::Rejected(e.to_string()))?;
              }
              self.state().map_err(ActError::Bridge)
          }
          fn wait_idle(&self, _timeout_ms: u64) -> Result<bool, String> { Ok(true) }
          fn replay(&self) -> Result<testkit::replay::Replay, String> {
              Ok(testkit::replay::Replay { seed: 0, actions: vec![], expect: Default::default(), tolerate_rejections: true })
          }
          fn screenshot(&self) -> Result<Option<Vec<u8>>, String> { Ok(None) }
      }
      let api = network::LocalApi::open_seeded(":memory:", 9).unwrap();
      let bridge: Box<dyn AgentBridge> = Box::new(FakeBridge(Mutex::new(testkit::env::ApiEnv::new(Box::new(api)))));
      // Start the server on an ephemeral port; serve() reports the bound port.
      let (port_tx, port_rx) = std::sync::mpsc::channel();
      let handle = std::thread::spawn(move || { let _ = serve(bridge, 0, Some(port_tx)); });
      let port = port_rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
      let base = format!("http://127.0.0.1:{port}");

      // /state before login → Login screen.
      let body: serde_json::Value = ureq::get(&format!("{base}/state")).call().unwrap().into_json().unwrap();
      assert_eq!(body["ui"]["screen"], "Login");
      // /act Register → Hangar screen.
      let reg = serde_json::json!({ "Core": { "Register": { "nickname": "Ada", "password": "pwd" } } });
      let body: serde_json::Value = ureq::post(&format!("{base}/act")).send_json(reg).unwrap().into_json().unwrap();
      assert_eq!(body["ui"]["screen"], "Hangar");
      // /actions has SetFormation/Refresh at minimum.
      let acts: serde_json::Value = ureq::get(&format!("{base}/actions")).call().unwrap().into_json().unwrap();
      assert!(acts.as_array().unwrap().len() >= 6);
      // Direct Battle core action is rejected (400).
      let bad = serde_json::json!({ "Core": { "Battle": { "opponent_id": 1, "formation": "Aggressive" } } });
      let err = ureq::post(&format!("{base}/act")).send_json(bad).unwrap_err();
      assert!(matches!(err, ureq::Error::Status(400, _)));
      // /idle returns idle=true.
      let idle: serde_json::Value = ureq::get(&format!("{base}/idle?timeout_ms=100")).call().unwrap().into_json().unwrap();
      assert_eq!(idle["idle"], true);
      // /replay parses as a Replay.
      let _replay: testkit::replay::Replay =
          ureq::get(&format!("{base}/replay")).call().unwrap().into_json().unwrap();
      // /screenshot with a None-returning bridge → 501.
      let shot = ureq::get(&format!("{base}/screenshot")).call().unwrap_err();
      assert!(matches!(shot, ureq::Error::Status(501, _)));
      // Malformed /act body → 400 with kind "parse".
      let parse_err = ureq::post(&format!("{base}/act"))
          .set("Content-Type", "application/json")
          .send_string("not json").unwrap_err();
      match parse_err {
          ureq::Error::Status(400, r) => {
              let body: serde_json::Value = r.into_json().unwrap();
              assert_eq!(body["kind"], "parse");
          }
          other => panic!("expected 400 parse, got {other:?}"),
      }
      // Unknown route → 404.
      let nope = ureq::get(&format!("{base}/nope")).call().unwrap_err();
      assert!(matches!(nope, ureq::Error::Status(404, _)));
      // Wrong method (POST to a GET-only route) → 404.
      let wrong_method = ureq::post(&format!("{base}/state")).send_string("").unwrap_err();
      assert!(matches!(wrong_method, ureq::Error::Status(404, _)));
      drop(handle); // server thread exits with the test process
  }
  ```
  (`game`'s `[dev-dependencies]` — `ureq` with `json`, `serde_json`, `testkit` with `http` — were already added in Task 5, so this test compiles.)
- [ ] Run: `cargo nextest run -p game serve_routes_state_actions_act_idle_replay`
  Expect: **FAIL** (`serve` does not exist).
- [ ] Implement `serve` and routing in `agent_mode.rs`:
  ```rust
  use std::sync::mpsc::Sender;

  /// Run the localhost HTTP control server on `127.0.0.1:port` (port 0 = OS
  /// picks one). If `port_report` is given, the bound port is sent once bound.
  /// Blocks, serving requests, until the process exits.
  ///
  /// Sequential single-client server: one in-flight request at a time; `/idle`
  /// long-polls block all other requests while they wait. Point one agent at it;
  /// don't multiplex several clients onto the same port.
  pub fn serve(bridge: Box<dyn AgentBridge>, port: u16, port_report: Option<Sender<u16>>) -> Result<(), String> {
      let server = tiny_http::Server::http(("127.0.0.1", port))
          .map_err(|e| format!("agent server: could not bind 127.0.0.1:{port}: {e}"))?;
      // tiny_http 0.12: server_addr() -> ListenAddr; to_ip() -> Option<SocketAddr>.
      // (If a future tiny_http renames this, read the bound port off the SocketAddr accordingly.)
      let bound = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(port);
      log::info!("agent mode: HTTP control on http://127.0.0.1:{bound}");
      if let Some(tx) = port_report { let _ = tx.send(bound); }
      for request in server.incoming_requests() {
          handle_request(bridge.as_ref(), request);
      }
      Ok(())
  }

  fn json_response(status: u16, body: String) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
      let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
      tiny_http::Response::from_string(body).with_status_code(status).with_header(header)
  }

  fn err_response(status: u16, kind: &str, msg: &str) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
      let body = serde_json::json!({ "error": msg, "kind": kind }).to_string();
      json_response(status, body)
  }

  /// A successful route reply: HTTP status, body bytes, and content-type.
  type RouteOk = (u16, Vec<u8>, &'static str);
  /// A route error: HTTP status, error `kind`, and human message.
  type RouteErr = (u16, String, String);

  fn handle_request(bridge: &dyn AgentBridge, mut request: tiny_http::Request) {
      let url = request.url().to_string();
      let method = request.method().clone();
      let path = url.split('?').next().unwrap_or("");
      // Catch a panic in the handler so an unattended agent sees a 500, not a
      // refused connection (a dropped Request would drop the socket mid-reply).
      let result: Result<RouteOk, RouteErr> = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
          match (&method, path) {
              (tiny_http::Method::Get, "/state") => {
                  let r = bridge.state().map_err(|e| (500, "bridge".into(), e))?;
                  Ok((200, serde_json::to_vec(&r).unwrap(), "application/json"))
              }
              (tiny_http::Method::Get, "/actions") => {
                  let a = bridge.actions().map_err(|e| (500, "bridge".into(), e))?;
                  Ok((200, serde_json::to_vec(&a).unwrap(), "application/json"))
              }
              (tiny_http::Method::Post, "/act") => {
                  let mut body = String::new();
                  use std::io::Read;
                  // Cap the body at 1 MiB so a runaway client cannot exhaust memory.
                  request.as_reader().take(1 << 20).read_to_string(&mut body).map_err(|e| (400, "body".into(), e.to_string()))?;
                  let cmd: UiCommand = serde_json::from_str(&body).map_err(|e| (400, "parse".into(), e.to_string()))?;
                  let r = bridge.act(cmd).map_err(|e| match e {
                    ActError::Rejected(m) => (400, "rejected".to_string(), m),
                    ActError::Bridge(m) => (503, "bridge".to_string(), m),
                })?;
                  Ok((200, serde_json::to_vec(&r).unwrap(), "application/json"))
              }
              (tiny_http::Method::Get, "/idle") => {
                  let timeout_ms = query_param(&url, "timeout_ms").and_then(|v| v.parse().ok()).unwrap_or(10_000);
                  let idle = bridge.wait_idle(timeout_ms).map_err(|e| (500, "bridge".into(), e))?;
                  Ok((200, serde_json::json!({ "idle": idle }).to_string().into_bytes(), "application/json"))
              }
              (tiny_http::Method::Get, "/replay") => {
                  let r = bridge.replay().map_err(|e| (500, "bridge".into(), e))?;
                  Ok((200, serde_json::to_vec(&r).unwrap(), "application/json"))
              }
              (tiny_http::Method::Get, "/screenshot") => {
                  match bridge.screenshot().map_err(|e| (500, "bridge".into(), e))? {
                      Some(png) => Ok((200, png, "image/png")),
                      None => Err((501, "unsupported".into(), "screenshots unavailable on this bridge".into())),
                  }
              }
              _ => Err((404, "not_found".into(), format!("no route for {} {}", method, path))),
          }
      }))
      .unwrap_or_else(|_| Err((500, "panic".into(), "internal error handling request".into())));
      let _ = match result {
          Ok((status, bytes, ctype)) => {
              let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], ctype.as_bytes()).unwrap();
              request.respond(tiny_http::Response::from_data(bytes).with_status_code(status).with_header(header))
          }
          Err((status, kind, msg)) => request.respond(err_response(status, &kind, &msg)),
      };
  }

  fn query_param(url: &str, key: &str) -> Option<String> {
      let q = url.split('?').nth(1)?;
      q.split('&').find_map(|kv| {
          let (k, v) = kv.split_once('=')?;
          if k == key { Some(v.to_string()) } else { None }
      })
  }
  ```
- [ ] Run: `cargo nextest run -p game serve_routes_state_actions_act_idle_replay`
  Expect: **PASS**.
- [ ] Commit:
  ```
  git add game/Cargo.toml game/src/agent_mode.rs
  git commit -m "agent_mode: HTTP serve() and request routing over AgentBridge

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9 — `testkit::HttpEnv` (item F), tested against `serve()`

`HttpEnv` implements `AgentEnv` over the HTTP channel with `ureq` + manual `serde_json`; UI verbs are inherent methods (not on the trait).

**Files:** Create `testkit/src/http_env.rs`; modify `testkit/src/lib.rs`, `testkit/Cargo.toml`.

**Steps:**

- [ ] Add an optional `ureq` behind a new `http` feature in `testkit/Cargo.toml` so `game`'s (non-dev) dependency on `testkit` does **not** pull `ureq` into the shipped `rift` binary. `ureq`'s `json` feature is **not** default in ureq 2.x and `HttpEnv` uses `.into_json()`/`.send_json()`, so request it explicitly (B3). Add to `[dependencies]`:
  ```toml
  ureq = { version = "2", default-features = false, features = ["json"], optional = true }
  ```
  and a `[features]` section:
  ```toml
  [features]
  # HttpEnv (the live agent-mode HTTP client). Off by default so the shipped
  # binary, which depends on testkit for its DTOs, does not link ureq.
  http = ["dep:ureq"]
  ```
  `testkit`'s own tests need `HttpEnv`, so make the test target self-enable it: this crate must be tested with `--features http`. (The dev-dep set is unchanged; `ureq` is a normal optional dep gated by the feature.)
- [ ] Gate the module in `testkit/src/lib.rs`:
  ```rust
  #[cfg(feature = "http")]
  pub mod http_env;
  ```
- [ ] Write the failing test first — create `testkit/tests/http_env.rs`. It needs a running `serve()`, which lives in `game` (a `[cfg(feature="agent")]` module). Since `testkit` cannot depend on `game` (that would be a cycle: `game → testkit`), the `HttpEnv`↔`serve()` integration test lives in **`game/tests/agent_http.rs`** (Task 13). This task's own test drives `HttpEnv` against a *stub HTTP server built inside the test* so `testkit` stays free of `game`:
  ```rust
  // B5: gate the ENTIRE file on the http feature so plain `cargo nextest run
  // -p testkit` (including the nightly soak job) compiles it to nothing and does
  // not need ureq. It runs only under `--features http`.
  #![cfg(feature = "http")]
  //! HttpEnv is exercised end-to-end against the real serve() in
  //! game/tests/agent_http.rs. Here we only check HttpEnv's JSON mapping against
  //! a hand-rolled tiny_http... but testkit has no tiny_http dep, so instead we
  //! test the pure request/response mapping via a std::net TcpListener stub.
  use std::io::{Read, Write};
  use std::net::TcpListener;
  use testkit::env::{AgentEnv, Action};
  use testkit::http_env::HttpEnv;

  fn stub_server(response_body: &'static str) -> u16 {
      let listener = TcpListener::bind("127.0.0.1:0").unwrap();
      let port = listener.local_addr().unwrap().port();
      std::thread::spawn(move || {
          for stream in listener.incoming().take(1) {
              let mut s = stream.unwrap();
              let mut buf = [0u8; 1024];
              let _ = s.read(&mut buf);
              let resp = format!(
                  "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                  response_body.len(), response_body
              );
              let _ = s.write_all(resp.as_bytes());
          }
      });
      port
  }

  #[test]
  fn http_env_observe_parses_state() {
      let body = r#"{"observation":{"player":null,"catalog":[],"opponents":[],"leaderboard":[],"history":[],"status":"ok","status_is_error":false,"screen":"Login"},"ui":{"screen":"Login","selected_opponent":null,"fleet_travel":null,"battle_animating":false,"battle_finished":false}}"#;
      let port = stub_server(body);
      let mut env = HttpEnv::new(format!("http://127.0.0.1:{port}"));
      let obs = env.observe().unwrap();
      assert_eq!(obs.status, "ok");
      assert_eq!(obs.screen.as_deref(), Some("Login"));
  }
  ```
- [ ] Run: `cargo nextest run -p testkit --features http http_env_observe_parses_state`
  Expect: **FAIL** (`HttpEnv` does not exist / module gated off without the feature — build error naming `http_env`).
- [ ] Implement `testkit/src/http_env.rs`:
  ```rust
  //! `HttpEnv`: an [`AgentEnv`](crate::env::AgentEnv) client for the live
  //! agent-mode HTTP channel (`GET /state`, `GET /actions`, `POST /act`, plus UI
  //! verbs). Uses `ureq` (blocking) and `serde_json` directly — no framework.

  use crate::env::{Action, ActionOutcome, AgentEnv, EnvError, Observation};
  use serde::Deserialize;
  use std::time::Duration;

  /// Extract the best human message from a `ureq::Error`. For an HTTP status
  /// error, read the response body and pull `{"error": ...}` (agent mode's error
  /// shape), falling back to the raw body or `status code N`. For a transport
  /// error, use its `Display`. This ensures a server-constructed message is never
  /// discarded in favour of a generic ureq string.
  fn error_body(e: ureq::Error) -> String {
      match e {
          ureq::Error::Status(code, r) => {
              let body = r.into_string().unwrap_or_default();
              serde_json::from_str::<serde_json::Value>(&body)
                  .ok()
                  .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(|s| s.to_string()))
                  .filter(|s| !s.is_empty())
                  .or_else(|| (!body.is_empty()).then(|| body.clone()))
                  .unwrap_or_else(|| format!("status code {code}"))
          }
          transport => transport.to_string(),
      }
  }

  /// A minimal mirror of agent_mode's StateReport for parsing (only the fields
  /// HttpEnv needs). `ui` is captured as raw JSON so UI-verb callers can inspect
  /// it without HttpEnv depending on the `game` crate.
  #[derive(Deserialize)]
  struct StateReport {
      observation: Observation,
      ui: serde_json::Value,
  }

  pub struct HttpEnv {
      base: String,
      agent: ureq::Agent,
  }

  impl HttpEnv {
      pub fn new(base: impl Into<String>) -> Self {
          HttpEnv { base: base.into(), agent: ureq::Agent::new() }
      }

      fn get_state(&self) -> Result<StateReport, EnvError> {
          self.agent
              .get(&format!("{}/state", self.base))
              .timeout(Duration::from_secs(30))
              .call()
              .map_err(|e| EnvError::Backend(error_body(e)))?
              .into_json()
              .map_err(|e| EnvError::Backend(e.to_string()))
      }

      /// The raw `ui` object from the last `/state` (screen, fleet_travel, etc.).
      pub fn ui_state(&self) -> Result<serde_json::Value, EnvError> {
          Ok(self.get_state()?.ui)
      }

      /// Long-poll `/idle`; returns true when animation settled, false on timeout.
      pub fn wait_idle(&self, timeout_ms: u64) -> Result<bool, EnvError> {
          // The client must outlive the server long-poll: give it the server's
          // timeout plus a 5s grace so the connection never times out first.
          let v: serde_json::Value = self.agent
              .get(&format!("{}/idle?timeout_ms={timeout_ms}", self.base))
              .timeout(Duration::from_millis(timeout_ms) + Duration::from_secs(5))
              .call().map_err(|e| EnvError::Backend(error_body(e)))?
              .into_json().map_err(|e| EnvError::Backend(e.to_string()))?;
          Ok(v.get("idle").and_then(|b| b.as_bool()).unwrap_or(false))
      }

      /// Download the session's recorded core actions as a replay.
      pub fn replay(&self) -> Result<crate::replay::Replay, EnvError> {
          self.agent.get(&format!("{}/replay", self.base))
              .timeout(Duration::from_secs(30))
              .call()
              .map_err(|e| EnvError::Backend(error_body(e)))?
              .into_json().map_err(|e| EnvError::Backend(e.to_string()))
      }

      // -- UI verbs (inherent methods; not part of AgentEnv) ------------------

      pub fn goto(&self, screen: &str) -> Result<(), EnvError> { self.post_verb(serde_json::json!({ "Goto": screen })) }
      pub fn select_opponent(&self, user_id: u32) -> Result<(), EnvError> {
          self.post_verb(serde_json::json!({ "SelectOpponent": { "user_id": user_id } }))
      }
      pub fn launch_fleet(&self, user_id: u32, instant: bool) -> Result<(), EnvError> {
          self.post_verb(serde_json::json!({ "LaunchFleet": { "user_id": user_id, "instant": instant } }))
      }
      pub fn recall_fleet(&self) -> Result<(), EnvError> { self.post_verb(serde_json::json!("RecallFleet")) }
      pub fn skip_battle_animation(&self) -> Result<(), EnvError> { self.post_verb(serde_json::json!("SkipBattleAnimation")) }
      pub fn continue_after_battle(&self) -> Result<(), EnvError> { self.post_verb(serde_json::json!("ContinueAfterBattle")) }

      fn post_verb(&self, cmd: serde_json::Value) -> Result<(), EnvError> {
          self.agent.post(&format!("{}/act", self.base))
              .timeout(Duration::from_secs(30))
              .send_json(cmd)
              // A rejected verb (or transport failure) surfaces the server's own
              // error message rather than a generic ureq string.
              .map_err(|e| EnvError::Backend(error_body(e)))?;
          Ok(())
      }

      /// POST a Core action. On HTTP 200 returns `(true, StateReport)`. On HTTP
      /// 400 the backend *rejected* the command: parse the `{"error": ...}` body
      /// for the message and recover a fresh `/state` for the observation, then
      /// return `(false, report_with_error_status)` — so `act()` reports
      /// `ok == false` with the real rejection message, never a stale "success".
      fn post_core(&self, action: &Action) -> Result<(bool, StateReport), EnvError> {
          let cmd = serde_json::json!({ "Core": action });
          let resp = self.agent.post(&format!("{}/act", self.base))
              .timeout(Duration::from_secs(30))
              .send_json(cmd);
          match resp {
              Ok(r) => {
                  let report: StateReport = r.into_json().map_err(|e| EnvError::Backend(e.to_string()))?;
                  Ok((true, report))
              }
              // A 400 means the backend rejected the action. Read the error body
              // for the message, then fetch a fresh /state for the observation.
              Err(e @ ureq::Error::Status(400, _)) => {
                  let msg = error_body(e);
                  let mut report = self.get_state()?;
                  // Surface the rejection on the observation the caller reads.
                  report.observation.status = msg;
                  report.observation.status_is_error = true;
                  Ok((false, report))
              }
              // Any other status / transport error: surface the server's message.
              Err(e) => Err(EnvError::Backend(error_body(e))),
          }
      }
  }

  impl AgentEnv for HttpEnv {
      fn observe(&mut self) -> Result<Observation, EnvError> {
          Ok(self.get_state()?.observation)
      }
      fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError> {
          self.agent.get(&format!("{}/actions", self.base))
              .timeout(Duration::from_secs(30))
              .call()
              .map_err(|e| EnvError::Backend(error_body(e)))?
              .into_json().map_err(|e| EnvError::Backend(e.to_string()))
      }
      fn act(&mut self, a: &Action) -> Result<ActionOutcome, EnvError> {
          let (accepted, report) = self.post_core(a)?;
          let obs = report.observation;
          // ok comes from the HTTP result (400 → rejected), not from stale state.
          let ok = accepted && !obs.status_is_error;
          Ok(ActionOutcome { ok, status: obs.status.clone(), observation: obs })
      }
  }
  ```
- [ ] Run: `cargo nextest run -p testkit --features http http_env_observe_parses_state`
  Expect: **PASS**.
- [ ] Run: `cargo nextest run -p testkit --features http` and `cargo build --workspace`
  Expect: both **PASS**. (`testkit` tests need `--features http` for the `http_env` test file; `cargo build --workspace` builds without it, confirming the shipped path stays `ureq`-free.)
- [ ] Commit:
  ```
  git add testkit/Cargo.toml testkit/src/lib.rs testkit/src/http_env.rs testkit/tests/http_env.rs
  git commit -m "Add testkit HttpEnv (AgentEnv over the HTTP channel)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10 — `ChannelBridge` + RiftApp command drain (COMPILE-CHECK + MANUAL, NOT headless-TDD)

**This task cannot be TDD'd headlessly.** `ChannelBridge` needs a live `egui::Context` and a running `RiftApp::update()` to answer requests; there is no window in CI. The full HTTP-over-live-game path is instead verified two ways: **(a) compile-checked** by the workspace build (Task 14 CI), and **(b) manually verified** with the playtest guide (Task 12). The headless HTTP behaviour is already covered by Task 8 (fake bridge) and Task 13 (ApiEnv-backed bridge).

**Files:** Modify `game/src/agent_mode.rs`, `game/src/app.rs`, `game/src/lib.rs`.

**Steps:**

- [ ] In `agent_mode.rs`, add the channel types and `ChannelBridge`:
  ```rust
  use std::sync::mpsc::{Receiver, Sender};

  /// One queued request plus the channel to answer it on.
  pub type AgentCall = (AgentRequest, Sender<AgentResponse>);

  /// Production bridge: forwards requests into RiftApp::update()'s drain and
  /// wakes the reactive loop via a cloned egui::Context.
  pub struct ChannelBridge {
      tx: Sender<AgentCall>,
      ctx: eframe::egui::Context,
  }

  impl ChannelBridge {
      pub fn new(tx: Sender<AgentCall>, ctx: eframe::egui::Context) -> Self {
          ChannelBridge { tx, ctx }
      }

      /// Send one request, wake the UI, and block up to 10s for the reply.
      fn call(&self, req: AgentRequest) -> Result<AgentResponse, String> {
          let (reply_tx, reply_rx) = std::sync::mpsc::channel();
          self.tx.send((req, reply_tx)).map_err(|_| "game thread gone".to_string())?;
          self.ctx.request_repaint();
          reply_rx
              .recv_timeout(std::time::Duration::from_secs(10))
              .map_err(|_| "timed out waiting for the game thread (hung app?)".to_string())
      }
  }

  impl AgentBridge for ChannelBridge {
      fn state(&self) -> Result<StateReport, String> {
          match self.call(AgentRequest::State)? { AgentResponse::State(s) => Ok(s), AgentResponse::Err(e) => Err(e), _ => Err("bad reply".into()) }
      }
      fn actions(&self) -> Result<Vec<testkit::env::Action>, String> {
          match self.call(AgentRequest::Actions)? { AgentResponse::Actions(a) => Ok(a), AgentResponse::Err(e) => Err(e), _ => Err("bad reply".into()) }
      }
      fn act(&self, cmd: UiCommand) -> Result<StateReport, ActError> {
          // call()'s Err is always a transport failure (game thread gone / timeout).
          match self.call(AgentRequest::Act(cmd)).map_err(ActError::Bridge)? {
              AgentResponse::State(s) => Ok(s),
              AgentResponse::Err(e) => Err(ActError::Rejected(e)),
              _ => Err(ActError::Bridge("bad reply".into())),
          }
      }
      fn wait_idle(&self, timeout_ms: u64) -> Result<bool, String> {
          // Poll /state's animation flags on this side; the UI thread answers State fast.
          let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
          loop {
              let s = self.state()?;
              if !s.ui.battle_animating && s.ui.fleet_travel.is_none() { return Ok(true); }
              if std::time::Instant::now() >= deadline { return Ok(false); }
              std::thread::sleep(std::time::Duration::from_millis(30));
          }
      }
      fn replay(&self) -> Result<testkit::replay::Replay, String> {
          match self.call(AgentRequest::Replay)? { AgentResponse::Replay(r) => Ok(r), AgentResponse::Err(e) => Err(e), _ => Err("bad reply".into()) }
      }
      fn screenshot(&self) -> Result<Option<Vec<u8>>, String> {
          match self.call(AgentRequest::Screenshot)? { AgentResponse::Screenshot(s) => Ok(s), AgentResponse::Err(e) => Err(e), _ => Err("bad reply".into()) }
      }
  }
  ```
- [ ] In `app.rs`, add agent-mode fields to `RiftApp` (gated) and a session recorder. After the `status_is_error: bool,` field (line 123) add:
  ```rust
      // Agent mode (feature "agent"): drained in update(); records core actions.
      #[cfg(feature = "agent")]
      agent_rx: Option<std::sync::mpsc::Receiver<crate::agent_mode::AgentCall>>,
      #[cfg(feature = "agent")]
      recorded: Vec<testkit::env::Action>,
      #[cfg(feature = "agent")]
      agent_seed: Option<u64>,
      #[cfg(feature = "agent")]
      pending_screenshot: Vec<std::sync::mpsc::Sender<crate::agent_mode::AgentResponse>>,
      #[cfg(feature = "agent")]
      pending_screenshot_frames: u32,
  ```
  Initialize them in `RiftApp::new` (add to the struct literal at line 128):
  ```rust
      #[cfg(feature = "agent")]
      agent_rx: None,
      #[cfg(feature = "agent")]
      recorded: Vec::new(),
      #[cfg(feature = "agent")]
      agent_seed: None,
      #[cfg(feature = "agent")]
      pending_screenshot: Vec::new(),
      #[cfg(feature = "agent")]
      pending_screenshot_frames: 0,
  ```
  Add a setter used by `lib.rs`:
  ```rust
      #[cfg(feature = "agent")]
      pub fn attach_agent(
          &mut self,
          rx: std::sync::mpsc::Receiver<crate::agent_mode::AgentCall>,
          seed: Option<u64>,
      ) {
          self.agent_rx = Some(rx);
          self.agent_seed = seed;
      }
  ```
- [ ] Add the drain + observation/state builders to `app.rs` (gated), and call the drain at the **top** of `update()` (before the fleet-advance block, app.rs:1050). Implementation:
  ```rust
  #[cfg(feature = "agent")]
  impl RiftApp {
      fn agent_observation(&self) -> testkit::env::Observation {
          testkit::env::Observation {
              player: self.snapshot.clone(),
              catalog: self.catalog.clone(),
              opponents: self.opponents.clone(),
              leaderboard: self.leaderboard.clone(),
              history: self.history.clone(),
              status: self.status.clone(),
              status_is_error: self.status_is_error,
              screen: Some(self.screen.name().to_string()),
          }
      }

      fn agent_state(&self) -> crate::agent_mode::StateReport {
          use crate::agent_mode::{FleetTravelState, StateReport, UiState};
          let fleet_travel = self.fleet_travel.as_ref().map(|mv| FleetTravelState {
              target_id: mv.target_id,
              target_name: mv.target_name.clone(),
              elapsed: mv.elapsed,
              duration: mv.duration,
              remaining: (mv.duration - mv.elapsed).max(0.0),
          });
          let battle_animating = self.battle_scene.as_ref().map_or(false, |s| !s.finished);
          let battle_finished = self.battle_scene.as_ref().map_or(false, |s| s.finished);
          // UI verbs applicable right now (not core Actions, so absent from /actions).
          let mut available_ui_verbs = Vec::new();
          if self.snapshot.is_some() { available_ui_verbs.push("RefreshPlayer".to_string()); }
          if self.fleet_travel.is_some() { available_ui_verbs.push("RecallFleet".to_string()); }
          if battle_animating { available_ui_verbs.push("SkipBattleAnimation".to_string()); }
          if battle_finished { available_ui_verbs.push("ContinueAfterBattle".to_string()); }
          StateReport {
              observation: self.agent_observation(),
              ui: UiState {
                  screen: self.screen.name().to_string(),
                  selected_opponent: self.selected_opponent,
                  fleet_travel,
                  battle_animating,
                  battle_finished,
                  available_ui_verbs,
              },
          }
      }

      /// Execute one UiCommand through the same code paths the buttons use.
      fn agent_apply(&mut self, cmd: crate::agent_mode::UiCommand) -> Result<(), String> {
          use crate::agent_mode::UiCommand;
          use testkit::env::Action;
          match cmd {
              UiCommand::Core(Action::Battle { .. }) => {
                  return Err("Battle is not a direct command; use LaunchFleet".into());
              }
              UiCommand::Core(action) => self.agent_core(action),
              UiCommand::Goto(name) => {
                  match self.screen_by_name(&name) {
                      Some(s) => { self.go(s); Ok(()) }
                      None => Err(format!("unknown screen {name}")),
                  }
              }
              UiCommand::SelectOpponent { user_id } => { self.selected_opponent = Some(user_id); Ok(()) }
              UiCommand::LaunchFleet { user_id, instant } => self.agent_launch(user_id, instant),
              UiCommand::RecallFleet => { self.fleet_travel = None; self.info("Fleet recalled to home."); Ok(()) }
              UiCommand::SkipBattleAnimation => {
                  if let Some(s) = &mut self.battle_scene { s.skip(); }
                  Ok(())
              }
              UiCommand::ContinueAfterBattle => {
                  if self.battle_scene.as_ref().map_or(false, |s| s.finished) {
                      self.battle_scene = None;
                      self.go(Screen::Galaxy);
                      Ok(())
                  } else {
                      Err("no finished battle to continue from".into())
                  }
              }
              UiCommand::RefreshPlayer => {
                  if self.snapshot.is_none() {
                      return Err("not logged in".into());
                  }
                  let snap = self.backend.snapshot()?;
                  self.apply_snapshot(snap);
                  Ok(())
              }
          }
      }

      fn agent_core(&mut self, action: testkit::env::Action) -> Result<(), String> {
          use testkit::env::Action;
          // Run through the same backend calls + apply_snapshot the buttons use.
          match action {
              Action::Register { nickname, password } => {
                  let snap = self.backend.register(&nickname, &password)?;
                  self.apply_snapshot(snap);
                  self.catalog = self.backend.catalog().unwrap_or_default();
                  self.screen = Screen::Hangar;
                  self.recorded.push(Action::Register { nickname, password });
              }
              Action::Login { nickname, password } => {
                  let snap = self.backend.login(&nickname, &password)?;
                  self.apply_snapshot(snap);
                  self.catalog = self.backend.catalog().unwrap_or_default();
                  self.screen = Screen::Hangar;
                  self.recorded.push(Action::Login { nickname, password });
              }
              Action::Work => {
                  let (work, income, snap) = self.backend.work()?;
                  self.apply_snapshot(snap);
                  self.info(format!("{work} complete — earned {income} credits."));
                  self.recorded.push(Action::Work);
              }
              // S1: each success calls self.info(..) for button parity, so agent
              // activity is visible in the window (the drain surfaces errors).
              Action::Buy { ship_id } => { let s = self.backend.buy(ship_id)?; self.apply_snapshot(s); self.info(format!("Bought ship {ship_id}.")); self.recorded.push(Action::Buy { ship_id }); }
              Action::Sell { ship_number } => { let s = self.backend.sell(ship_number)?; self.apply_snapshot(s); self.info(format!("Sold ship {ship_number}.")); self.recorded.push(Action::Sell { ship_number }); }
              Action::Repair { ship_number } => { let s = self.backend.repair(ship_number)?; self.apply_snapshot(s); self.info(format!("Repaired ship {ship_number}.")); self.recorded.push(Action::Repair { ship_number }); }
              Action::Activate { ship_number } => { let s = self.backend.activate(ship_number)?; self.apply_snapshot(s); self.info(format!("Activated ship {ship_number}.")); self.recorded.push(Action::Activate { ship_number }); }
              Action::Deactivate { ship_number } => { let s = self.backend.deactivate(ship_number)?; self.apply_snapshot(s); self.info(format!("Deactivated ship {ship_number}.")); self.recorded.push(Action::Deactivate { ship_number }); }
              Action::SetFormation(f) => { let s = self.backend.set_formation(f)?; self.apply_snapshot(s); self.info(format!("Formation set to {}.", f.as_str())); self.recorded.push(Action::SetFormation(f)); }
              Action::Refresh(view) => {
                  match view {
                      testkit::env::View::Opponents => self.refresh_opponents(),
                      testkit::env::View::Leaderboard => self.refresh_leaderboard(),
                      testkit::env::View::History => self.refresh_history(),
                  }
                  self.recorded.push(Action::Refresh(view));
              }
              Action::Battle { .. } => unreachable!("handled by agent_apply"),
          }
          Ok(())
      }

      fn agent_launch(&mut self, user_id: u32, instant: bool) -> Result<(), String> {
          // The real UI hides the launch button while a fleet is already travelling.
          if self.fleet_travel.is_some() {
              return Err("a fleet is already in transit; recall it first".into());
          }
          let active = self.snapshot.as_ref().map_or(0, |s| s.active_count);
          if active == 0 { return Err("activate at least one ship before launching".into()); }
          let name = self.opponents.iter().find(|o| o.user_id == user_id)
              .map(|o| o.nickname.clone()).unwrap_or_else(|| format!("system {user_id}"));
          // Mirror ui_galaxy's launch math (app.rs:886-893).
          let (wx, wy) = system_pos(user_id);
          let dist = (wx * wx + wy * wy).sqrt();
          let duration = 1.5 + dist * 3.5;
          self.selected_opponent = Some(user_id);
          self.fleet_travel = Some(FleetTravel {
              target_id: user_id,
              target_name: name.clone(),
              elapsed: if instant { duration } else { 0.0 },
              duration,
          });
          self.info(format!("Fleet launched toward {name}."));
          Ok(())
      }

      fn screen_by_name(&self, name: &str) -> Option<Screen> {
          // "Login" is intentionally excluded: Goto must not fake a logged-in
          // client onto the Login screen. (A real Logout verb is deferred.)
          Some(match name {
              "Hangar" => Screen::Hangar, "Market" => Screen::Market, "Work" => Screen::Work,
              "Galaxy" => Screen::Galaxy, "Battle" => Screen::Battle,
              "Leaderboard" => Screen::Leaderboard, "History" => Screen::History,
              _ => return None,
          })
      }

      fn agent_replay(&self) -> testkit::replay::Replay {
          testkit::replay::Replay {
              seed: self.agent_seed.unwrap_or(0),
              actions: self.recorded.clone(),
              expect: Default::default(),
              tolerate_rejections: true,
          }
      }

      /// Drain queued agent requests; called at the top of update(). Screenshot
      /// requests are deferred one frame (reply parked in pending_screenshot).
      fn drain_agent(&mut self, ctx: &egui::Context) {
          use crate::agent_mode::{AgentRequest, AgentResponse};
          // First, satisfy any screenshot parked from a previous frame.
          if !self.pending_screenshot.is_empty() {
              let shot = ctx.input(|i| i.raw.events.iter().find_map(|e| match e {
                  egui::Event::Screenshot { image, .. } => Some(color_image_to_png(image)),
                  _ => None,
              }));
              if let Some(png) = shot {
                  for reply in self.pending_screenshot.drain(..) {
                      let _ = reply.send(AgentResponse::Screenshot(Some(png.clone())));
                  }
                  self.pending_screenshot_frames = 0;
              } else {
                  // N6: bail out if the Screenshot event never arrives (a lost event
                  // must not pin `animating`/repaint forever). ~60 frames ≈ 1s.
                  self.pending_screenshot_frames += 1;
                  if self.pending_screenshot_frames > 60 {
                      for reply in self.pending_screenshot.drain(..) {
                          let _ = reply.send(AgentResponse::Err(
                              "screenshot timed out (no frame captured)".into()));
                      }
                      self.pending_screenshot_frames = 0;
                  }
              }
          }
          let Some(rx) = self.agent_rx.take() else { return };
          while let Ok((req, reply)) = rx.try_recv() {
              let resp = match req {
                  AgentRequest::State => AgentResponse::State(self.agent_state()),
                  AgentRequest::Actions => {
                      // S3: never advertise Battle — it is a 400 over /act; agents
                      // reach combat via LaunchFleet.
                      let mut acts = testkit::env::legal_actions_from(&self.agent_observation());
                      acts.retain(|a| !matches!(a, testkit::env::Action::Battle { .. }));
                      AgentResponse::Actions(acts)
                  }
                  AgentRequest::Replay => AgentResponse::Replay(self.agent_replay()),
                  AgentRequest::Act(cmd) => match self.agent_apply(cmd) {
                      // S1: button parity — surface success/rejection in the window
                      // so agent activity is visible, and never report ok on reject.
                      // (agent_core already calls self.info(..) on the success paths
                      // where the buttons do; a rejection sets an error status here.)
                      Ok(()) => AgentResponse::State(self.agent_state()),
                      Err(e) => {
                          self.error(e.clone()); // visible in the window; sets status_is_error
                          AgentResponse::Err(e)
                      }
                  },
                  AgentRequest::Screenshot => {
                      // egui 0.27: Screenshot is a unit variant (no argument).
                      ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot);
                      self.pending_screenshot.push(reply);
                      self.pending_screenshot_frames = 0;
                      ctx.request_repaint();
                      continue; // reply deferred to next frame
                  }
              };
              let _ = reply.send(resp);
          }
          self.agent_rx = Some(rx);
      }
  }

  #[cfg(feature = "agent")]
  fn color_image_to_png(image: &egui::ColorImage) -> Vec<u8> {
      let [w, h] = image.size;
      let mut rgba = Vec::with_capacity(w * h * 4);
      for p in &image.pixels {
          rgba.extend_from_slice(&[p.r(), p.g(), p.b(), p.a()]);
      }
      let mut out = std::io::Cursor::new(Vec::new());
      let encoder = image::codecs::png::PngEncoder::new(&mut out);
      use image::ImageEncoder;
      encoder.write_image(&rgba, w as u32, h as u32, image::ColorType::Rgba8).ok();
      out.into_inner()
  }
  ```
  (`image` is only in scope under `#[cfg(feature = "agent")]`; the whole `impl` and helper are gated.)
- [ ] Call the drain at the top of `update()` (app.rs, first line inside `fn update`, before the `let arrived` block):
  ```rust
          #[cfg(feature = "agent")]
          self.drain_agent(ctx);
  ```
  Also record the auto-battle (S2). `do_battle` calls `self.backend.battle(opponent_id, self.chosen_formation)` and then `apply_snapshot`, which **resets `chosen_formation`** — so reading `self.chosen_formation` at the recorder push site (after the snapshot is applied) would record the wrong (reset) formation. Capture it **once at the top of `do_battle`** and use that captured value for *both* the backend call and the recorded action:
  ```rust
      // At the very top of do_battle(&mut self, opponent_id: u32):
      let formation = self.chosen_formation;
      // ... use `formation` for the backend call:
      //     let (result, snap) = match self.backend.battle(opponent_id, formation) { .. };
      // ... and on the Ok arm, after self.info(msg) (post apply_snapshot):
                  #[cfg(feature = "agent")]
                  self.recorded.push(testkit::env::Action::Battle {
                      opponent_id,
                      formation, // the value captured before apply_snapshot reset it
                  });
  ```
  Also ensure the animation-repaint tail of `update()` (app.rs:1074) keeps waking while a screenshot is pending:
  ```rust
          #[cfg(feature = "agent")]
          let animating = animating || !self.pending_screenshot.is_empty();
  ```
- [ ] Wire `lib.rs`: extend `GameConfig` with `agent_port: Option<u16>` and, when set, build the channel, spawn `serve`, and hand the receiver to the app. In `game/src/lib.rs`:
  - Add to `GameConfig` (after `seed`):
    ```rust
        /// When `Some`, start the localhost agent-mode HTTP server on this port.
        pub agent_port: Option<u16>,
    ```
  - In the `eframe::run_native` closure (line 70), replace the body so the app is created, then (gated) attached to a bridge + server:
    ```rust
        let seed = config.seed;
        let agent_port = config.agent_port;
        eframe::run_native(
            "Rift",
            options,
            Box::new(move |cc| {
                theme::install(&cc.egui_ctx);
                let mut app = app::RiftApp::new(backend, online, player_name, notice);
                #[cfg(feature = "agent")]
                if let Some(port) = agent_port {
                    let (tx, rx) = std::sync::mpsc::channel::<agent_mode::AgentCall>();
                    app.attach_agent(rx, seed);
                    let bridge: Box<dyn agent_mode::AgentBridge> =
                        Box::new(agent_mode::ChannelBridge::new(tx, cc.egui_ctx.clone()));
                    std::thread::spawn(move || {
                        if let Err(e) = agent_mode::serve(bridge, port, None) {
                            log::error!("{e}");
                        }
                    });
                }
                #[cfg(not(feature = "agent"))]
                let _ = (seed, agent_port);
                Box::new(app)
            }),
        )
    ```
    (`mod agent_mode;` is already gated at the top of `lib.rs` from Task 5; reference it unqualified inside the gated block.)
- [ ] **Compile-check (both feature states):**
  ```powershell
  cargo build -p game
  cargo build -p game --no-default-features
  cargo build --workspace
  cargo nextest run -p game
  ```
  Expect: all **PASS** (unit tests from Tasks 6–8 still green; no new headless test here — the live path is covered by Task 13 over the ApiEnv bridge and manually via Task 12).
- [ ] Commit:
  ```
  git add game/src/agent_mode.rs game/src/app.rs game/src/lib.rs
  git commit -m "Wire ChannelBridge into RiftApp update() drain

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11 — CLI flags `--agent-mode` / `--agent-port` (compile-check + smoke)

**Files:** Modify `src/main.rs`.

**Steps:**

- [ ] Add flags to the `App` struct in `src/main.rs` (after the `seed` field at line 39), gated to the client build like the other client-only fields:
  ```rust
      /// Start a localhost-only HTTP control server so an agent can play the live game.
      #[structopt(long = "agent-mode")]
      agent_mode: bool,

      /// Port for the agent-mode HTTP server (localhost only).
      #[structopt(long = "agent-port", default_value = "7878", value_name = "PORT")]
      agent_port: u16,
  ```
- [ ] Plumb into `GameConfig` in `run_client` (line 108), setting `agent_port` only when `--agent-mode` was passed:
  ```rust
      let config = game::GameConfig {
          server_addr,
          save_path: save_path(),
          player_name,
          version: env!("CARGO_PKG_VERSION"),
          width: app.resolution.0,
          height: app.resolution.1,
          seed: app.seed,
          agent_port: if app.agent_mode { Some(app.agent_port) } else { None },
      };
  ```
- [ ] **Compile-check + CLI smoke** (no window opens for `--help`):
  ```powershell
  cargo build --workspace
  cargo run -- --help
  ```
  Expect: build **PASS**; `--help` lists `--agent-mode` and `--agent-port`. (Do not launch the actual window in CI; manual launch is Task 13.)
- [ ] Commit:
  ```
  git add src/main.rs
  git commit -m "CLI: --agent-mode / --agent-port flags

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12 — `docs/agent-playtest.md` (playtest guide, item H)

**This is documentation; no automated test.** It also serves as the manual-verification script for the ChannelBridge path (Task 10).

**Files:** Create `docs/agent-playtest.md`.

**Steps:**

- [ ] Create `docs/agent-playtest.md` with these sections (write the full content, not a stub):
  - **Overview** — what agent mode is, that it drives the real windowed client via a localhost HTTP surface, and that play is visible in the window.
  - **Safety** — the server binds `127.0.0.1` only, default port `7878`; it is inert unless `--agent-mode` is passed; nothing is exposed to the network.
  - **Build & launch** — `cargo run -- --agent-mode --offline --seed 42` (note: use a `--seed` for a faithful `/replay`; add `--name Pilot` to prefill). Note the prelude `$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"` on Windows.
  - **The loop** — poll `GET /state`, read `ui.screen` + `observation.status_is_error`; list `GET /actions` (core actions only) and `ui.available_ui_verbs` (UI verbs like `RefreshPlayer`/`RecallFleet` that are not core actions); `POST /act` a `UiCommand`; after a launch, `GET /idle?timeout_ms=8000` before reading the result; save `GET /replay` when something looks wrong.
  - **Watching cooldowns decay (N4)** — time-based fields like `observation.player.work_cooldown_remaining` only refresh when a snapshot is re-fetched. `POST /act '"RefreshPlayer"'` re-fetches the player snapshot (backend `snapshot()` → `apply_snapshot`) without a mutating action, so an agent can poll it until `work_cooldown_remaining == 0` before retrying `Work`. It is advertised in `ui.available_ui_verbs` whenever logged in, and is **not** recorded (it is UI-only, so it never appears in `/replay`).
  - **curl examples (bash):**
    ```bash
    BASE=http://127.0.0.1:7878
    curl -s $BASE/state | jq '.ui.screen, .observation.status'
    curl -s -X POST $BASE/act -d '{"Core":{"Register":{"nickname":"Ada","password":"pwd"}}}'
    curl -s $BASE/actions | jq
    curl -s -X POST $BASE/act -d '{"Core":"Work"}'
    curl -s -X POST $BASE/act -d '{"Core":{"Buy":{"ship_id":1}}}'
    curl -s -X POST $BASE/act -d '{"Core":{"Activate":{"ship_number":77}}}'
    curl -s -X POST $BASE/act -d '{"Goto":"Galaxy"}'
    curl -s -X POST $BASE/act -d '{"LaunchFleet":{"user_id":1,"instant":false}}'
    curl -s "$BASE/idle?timeout_ms=8000" | jq
    curl -s -X POST $BASE/act -d '"ContinueAfterBattle"'   # unit variant → bare JSON string
    curl -s -X POST $BASE/act -d '"RefreshPlayer"'         # re-fetch snapshot (cooldowns decay)
    curl -s $BASE/replay > bug.json
    ```
    (Clarify unit-variant JSON (N2): `RecallFleet`/`SkipBattleAnimation`/`ContinueAfterBattle`/`RefreshPlayer` serialize as **bare JSON strings** — the body is `'"ContinueAfterBattle"'` (a quoted string), *not* `'{"ContinueAfterBattle"}'` (which is invalid JSON and returns `400`).)
  - **curl examples (PowerShell):**
    ```powershell
    $base = "http://127.0.0.1:7878"
    Invoke-RestMethod "$base/state" | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Method Post "$base/act" -Body '{"Core":{"Register":{"nickname":"Ada","password":"pwd"}}}'
    Invoke-RestMethod -Method Post "$base/act" -Body '{"Core":"Work"}'
    Invoke-RestMethod -Method Post "$base/act" -Body '{"LaunchFleet":{"user_id":1,"instant":false}}'
    Invoke-RestMethod "$base/idle?timeout_ms=8000"
    Invoke-RestMethod "$base/replay" | ConvertTo-Json -Depth 6 | Set-Content bug.json
    ```
  - **Reading status/errors** — `observation.status_is_error == true` means the last action was rejected; `observation.status` holds the message. A `400` from `/act` is a rejected command (bad JSON, or a direct `Battle`).
  - **Saving a bug report** — save `/replay` to `testkit/scenarios/<name>.json`; a session run with `--seed N` reproduces faithfully. If run unseeded the replay carries `seed: 0` and reproduces against a different world — note this caveat. A saved replay becomes a CI regression via the existing `testkit/tests/scenarios.rs` loader.
  - **Do not mix human clicks with an agent session (N8)** — only actions issued through `/act` are recorded. Buttons clicked *by hand* in the window during an agent session mutate the game but are **not** recorded, so the saved `/replay` will diverge from what actually happened (a later `run_replay` reaches a different state). For a faithful bug report, drive the session **exclusively** through the HTTP API — do not touch the window's buttons while recording.
  - **Screenshot (optional)** — `GET /screenshot` returns a PNG of the current frame with one-frame latency.
- [ ] **Manual verification (ChannelBridge path — the part CI cannot cover):** with a display available, run `cargo run -- --agent-mode --offline --seed 42`, then execute the bash/PowerShell loop above and confirm: `/state` shows `Login` then `Hangar` after register; `Buy`+`Activate` reflect in `/state`; `LaunchFleet` animates in the window and `/idle` returns `idle:true` once the battle finishes; `/state` then shows `battle_finished:true` and the observation carries the battle result; `/replay` saved and re-run via `cargo nextest run -p testkit` (dropped into `testkit/scenarios/`) passes. Record the outcome in the PR description.
- [ ] Commit:
  ```
  git add docs/agent-playtest.md
  git commit -m "Add agent-mode playtest guide

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 13 — CI-testable coverage: HTTP over an ApiEnv-backed bridge (item G)

An integration test that starts the real `serve()` over a headless `ApiEnv`-backed bridge on an ephemeral port and drives `testkit::HttpEnv` through the full campaign, asserting observations and exercising `/idle` and `/replay`. This lives in `game/tests/` because it needs both `serve()` (in `game`) and `HttpEnv` (in `testkit`, a `game` dev-dep) — dependency direction is acyclic (`game → testkit`), and the test requires the `agent` feature.

**Files:** Create `game/tests/agent_http.rs`.

**Steps:**

- [ ] Write the test — create `game/tests/agent_http.rs`:
  ```rust
  //! Full HTTP layer over a headless ApiEnv-backed bridge: no window, exercises
  //! serve() + all routes + testkit::HttpEnv. Requires the `agent` feature.
  #![cfg(feature = "agent")]

  use std::sync::Mutex;
  use game::agent_mode::{self, ActError, AgentBridge, StateReport, UiCommand, UiState};
  use testkit::env::{Action, AgentEnv};
  use testkit::http_env::HttpEnv;

  /// A bridge over ApiEnv with a recorder, standing in for the live game.
  struct HeadlessBridge {
      env: Mutex<testkit::env::ApiEnv>,
      recorded: Mutex<Vec<Action>>,
      seed: u64,
  }
  impl AgentBridge for HeadlessBridge {
      fn state(&self) -> Result<StateReport, String> {
          let mut env = self.env.lock().unwrap();
          let obs = env.observe().map_err(|e| e.to_string())?;
          let screen = if obs.player.is_some() { "Hangar" } else { "Login" };
          let verbs = if obs.player.is_some() { vec!["RefreshPlayer".to_string()] } else { vec![] };
          Ok(StateReport {
              ui: UiState { screen: screen.into(), selected_opponent: None, fleet_travel: None,
                            battle_animating: false, battle_finished: false, available_ui_verbs: verbs },
              observation: obs,
          })
      }
      fn actions(&self) -> Result<Vec<Action>, String> {
          // Mirror the drain: never advertise Battle.
          let mut a = self.env.lock().unwrap().legal_actions().map_err(|e| e.to_string())?;
          a.retain(|act| !matches!(act, Action::Battle { .. }));
          Ok(a)
      }
      fn act(&self, cmd: UiCommand) -> Result<StateReport, ActError> {
          if let UiCommand::Core(a) = &cmd {
              if matches!(a, Action::Battle { .. }) {
                  return Err(ActError::Rejected("Battle is not a direct command; use LaunchFleet".into()));
              }
              let out = self.env.lock().unwrap().act(a).map_err(|e| ActError::Rejected(e.to_string()))?;
              if out.ok { self.recorded.lock().unwrap().push(a.clone()); }
          }
          self.state().map_err(ActError::Bridge)
      }
      fn wait_idle(&self, _t: u64) -> Result<bool, String> { Ok(true) }
      fn replay(&self) -> Result<testkit::replay::Replay, String> {
          Ok(testkit::replay::Replay {
              seed: self.seed,
              actions: self.recorded.lock().unwrap().clone(),
              expect: Default::default(),
              tolerate_rejections: true,
          })
      }
      fn screenshot(&self) -> Result<Option<Vec<u8>>, String> { Ok(None) }
  }

  #[test]
  fn http_layer_drives_a_campaign_over_apienv() {
      let seed = 42;
      let api = network::LocalApi::open_seeded(":memory:", seed).unwrap();
      let bridge: Box<dyn AgentBridge> = Box::new(HeadlessBridge {
          env: Mutex::new(testkit::env::ApiEnv::new(Box::new(api))),
          recorded: Mutex::new(Vec::new()),
          seed,
      });
      let (tx, rx) = std::sync::mpsc::channel();
      std::thread::spawn(move || { let _ = agent_mode::serve(bridge, 0, Some(tx)); });
      let port = rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
      let mut env = HttpEnv::new(format!("http://127.0.0.1:{port}"));

      // Register → Work → Buy → Activate, asserting observations each step.
      let out = env.act(&Action::Register { nickname: "Campaigner".into(), password: "pwd".into() }).unwrap();
      assert!(out.ok, "register: {}", out.status);
      assert_eq!(out.observation.player.as_ref().unwrap().user.currency_value, 2000);

      // Work may be on cooldown at t=0? No — a fresh account's last_work_at is 0,
      // so Work is immediately available.
      let out = env.act(&Action::Work).unwrap();
      assert!(out.ok, "work: {}", out.status);
      assert!(out.observation.player.as_ref().unwrap().user.currency_value >= 2000);

      let out = env.act(&Action::Buy { ship_id: 1 }).unwrap();
      assert!(out.ok, "buy: {}", out.status);
      // First purchased ship is ship_number 77.
      let ship = &out.observation.player.as_ref().unwrap().ships[0];
      assert_eq!(ship.ship_number, 77);

      let out = env.act(&Action::Activate { ship_number: 77 }).unwrap();
      assert!(out.ok, "activate: {}", out.status);
      assert_eq!(out.observation.player.as_ref().unwrap().active_count, 1);

      // /idle and /replay.
      assert!(env.wait_idle(500).unwrap());
      let replay = env.replay().unwrap();
      assert_eq!(replay.seed, seed);
      assert_eq!(replay.actions.len(), 4); // register, work, buy, activate
      // The recorded replay must itself pass run_replay (round-trip).
      testkit::replay::run_replay(&replay).expect("recorded replay must replay");
  }
  ```
- [ ] Run: `cargo nextest run -p game http_layer_drives_a_campaign_over_apienv`
  Expect: **PASS**. (The `agent` feature is on by default for `game`, and `game`'s dev-dep enables `testkit/http`, so `serve()` and `HttpEnv` are both compiled; the `#![cfg(feature = "agent")]` guard skips the whole file under `--no-default-features`.) All `game::agent_mode::{serve, AgentBridge, StateReport, UiState, UiCommand}` items are `pub` (Task 5/7/8).
- [ ] Commit (N3: only the new test file — `game/src/lib.rs` was already finalized in Task 10, so do not re-stage it unless this task actually modified it):
  ```
  git add game/tests/agent_http.rs
  git commit -m "CI test: HTTP layer over a headless ApiEnv bridge

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 14 — CI: build & test `game` with the `agent` feature (punch-list #4 follow-through)

The workspace already builds `game` (default features include `agent`), but the new `game` tests are not run by CI (which only nextests `sim`/`network`/`testkit`). Add a step so `game/tests/agent_http.rs` and the `game` unit tests run.

**Files:** Modify `.github/workflows/ci.yml`.

**Steps:**

- [ ] In both `test-ubuntu` and `test-windows` jobs, after the existing `nextest (sim, network, testkit)` step, add:
  ```yaml
      - name: nextest (game — agent mode)
        run: cargo nextest run -p game
  ```
  Also add `--features http` to the existing testkit nextest step so `testkit`'s own `HttpEnv` test (`testkit/tests/http_env.rs`) runs in CI. Change the `nextest (sim, network, testkit)` step in both jobs to:
  ```yaml
      - name: nextest (sim, network, testkit)
        run: |
          cargo nextest run -p sim -p network
          cargo nextest run -p testkit --features http
  ```
  (`game`'s default features include `agent`, and its dev-dep enables `testkit/http`, so `serve()`/`HttpEnv` are compiled and `agent_http.rs` runs. `game`'s unit tests — `Screen::name`, `BattleScene::skip`, serde round-trips, `serve()` routing — run too.)
  - **Leave the `soak` job unchanged (B5).** It runs plain `cargo nextest run -p testkit` (no `--features http`). Because `testkit/tests/http_env.rs` starts with `#![cfg(feature = "http")]` (Task 9), that whole test file compiles to nothing without the feature — so the untouched soak job still compiles and runs cleanly, without linking `ureq`. Do **not** add `--features http` to the soak job.
  - Ubuntu: `game` links `eframe` (winit/glutin x11+wayland). CI today already builds the full `rift` binary via `cargo build --workspace` (root `client` → `game`) and links it green on `ubuntu-latest`, so the necessary X11/Wayland/GL dev libraries are already present on the runner — linking the `game` test binary uses the same set, so **no new `apt` step is required**. None of the `game` tests open a window (they run `serve()` and unit logic), so no display/`Xvfb` is needed at *run* time either. If a `game` test ever fails for lack of a display, that is a test bug to fix (it must not create an `eframe::App` event loop), not a CI dependency to add.
- [ ] Verify locally that the exact CI commands pass on this machine:
  ```powershell
  cargo build --workspace
  cargo nextest run -p sim -p network
  cargo nextest run -p testkit --features http
  cargo nextest run -p game
  ```
  Expect: all **PASS**.
- [ ] Commit:
  ```
  git add .github/workflows/ci.yml
  git commit -m "CI: run game agent-mode tests on Ubuntu and Windows

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Final verification (run before declaring the plan executed)

- [ ] Full build in both feature states:
  ```powershell
  cargo build --workspace
  cargo build -p game --no-default-features
  ```
  Expect: both **PASS** (`--no-default-features` on `game` drops `tiny_http`/`image` and the whole `agent_mode` module).
- [ ] Full test run:
  ```powershell
  cargo nextest run -p sim -p network
  cargo nextest run -p testkit --features http
  cargo nextest run -p game
  ```
  Expect: **PASS** — all Phase-1 tests plus the new punch-list, agent_mode, HttpEnv, and HTTP-layer tests. (`testkit` needs `--features http` for its `http_env` test; `game`'s dev-dep supplies `testkit/http` for `agent_http.rs`.)
- [ ] Manual ChannelBridge verification per Task 13 recorded in the PR (the one path CI cannot exercise).

---

## What this plan does NOT do (deferred to Phase 3, per the roadmap)

- **egui upgrade + kittest UI suite** — the entire UI harness, parity tests, and snapshot regressions stay in Phase 3. Agent mode ships on eframe 0.27.
- **"Expect must-be-rejected" replay assertions** (roadmap punch-list #4 item "Skip") — `tolerate_rejections` remains all-or-nothing; per-action rejection assertions are explicitly deferred to Phase 3.
- **Running LLM agents inside CI** — out of scope by the spec; agent mode is on-demand from a Claude Code session.
- **Per-ship `PlayerSnapshot::repair_cooldown_remaining` + exact `Repair` legality** — dropped (owner decision), not merely deferred: the upstream `realtime-fleet-combat` branch already adds `GameApi::shipyard_status()` for per-ship repair cooldowns, so this plan avoids a parallel field that would collide on merge. `legal_actions`/`/actions` keep `Repair` advisory; making it exact via `shipyard_status()` is a post-merge follow-up.

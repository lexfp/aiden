# Agent-Testing Framework Phase 1 (Determinism + testkit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Rift deterministically replayable and agent-drivable by adding a seedable world RNG plus a new `testkit` crate (AgentEnv/ApiEnv, replay engine, scenario runner, baseline + monkey bots) with proptest invariants in `sim` and a nextest-based CI suite, so any bug becomes a seeded replay file that fails in CI.

**Architecture:** One new library crate `testkit/` (never shipped in the release binary) sits on top of the existing `network::GameApi` seam and drives an in-process `LocalApi::open(":memory:")` world. Determinism comes from injecting a `ChaCha8Rng` into `network::World` (replacing the two `StdRng::from_entropy()` call sites) via a new `World::open_seeded(path, seed)`; the CLI exposes it as `rift --seed N` and `rift server --seed N`. `testkit` defines a serde `Action`/`Observation` gym-style API implemented by `ApiEnv` (which holds a `Box<dyn GameApi>`), a JSON replay format, and bots that consume `legal_actions`.

**Tech Stack:** `rand` 0.8 + `rand_chacha` 0.3 (`ChaCha8Rng`), `serde` + `serde_json` (Action/Observation/Replay DTOs and canonical state hashing), `sha2` (state hash), `sim` + `network` (game rules and API), `proptest` (invariants, dev-dep in `sim` only), `cargo-nextest` (CI runner).

---

## File Structure

Files created or modified, with one-line responsibility.

| File | C/M | Responsibility |
|------|-----|----------------|
| `Cargo.toml` | Modify | Add `testkit` to `[workspace] members`. |
| `network/Cargo.toml` | Modify | Add `rand_chacha = "0.3"` dependency. |
| `network/src/world.rs` | Modify | Store an RNG on `World`; add `open_seeded`; use the stored RNG in `battle`/`work`. |
| `network/src/api.rs` | Modify | Add `LocalApi::open_seeded(path, seed)`. |
| `game/src/lib.rs` | Modify | Add `seed: Option<u64>` to `GameConfig`; use `open_seeded` when set. |
| `network/src/server.rs` | Modify | Add `run_seeded(port, seed)` / thread the seed into `run_with_db`; report bound port for tests. |
| `src/main.rs` | Modify | Add `--seed` (client) and `server --seed` flags; plumb through. |
| `network/tests/integration.rs` | Modify | Ephemeral port + connect-retry readiness (replace fixed port + sleep). |
| `sim/Cargo.toml` | Modify | Add `proptest` dev-dependency. |
| `sim/tests/invariants.rs` | Create | proptest invariants (HP/credits ≥ 0, ELO zero-sum, level monotonic, catalog & formation bounds). |
| `testkit/Cargo.toml` | Create | New crate manifest (deps: sim, network, rand, rand_chacha, serde, serde_json, sha2; no dev-deps). |
| `testkit/src/lib.rs` | Create | Crate root: re-exports `env`, `replay`, `bots`, `scenario`. |
| `testkit/src/env.rs` | Create | `Action`, `Observation`, `ActionOutcome`, `EnvError`, `View`, `AgentEnv` trait, `ApiEnv`, `legal_actions`. |
| `testkit/src/replay.rs` | Create | `Replay`/`Expect` DTOs, `state_hash`, `run_replay`. |
| `testkit/src/bots.rs` | Create | `run_baseline` (loops `sim::bot::decide` via env) and `run_monkey` (seeded legal+illegal fuzz). |
| `testkit/src/scenario.rs` | Create | Load & run `scenarios/*.json` replay files. |
| `testkit/scenarios/campaign.json` | Create | Full loop: register → work → buy → activate → battle. |
| `testkit/scenarios/broke_pilot.json` | Create | Spend to near-zero then a failed unaffordable buy. |
| `testkit/scenarios/repair_economics.json` | Create | Buy → activate → battle → repair path. |
| `testkit/tests/scenarios.rs` | Create | Loads every `scenarios/*.json` and asserts each replay passes. |
| `testkit/tests/env.rs` | Create | Unit tests for `ApiEnv`/`legal_actions`/replay determinism/state_hash. |
| `testkit/tests/bots.rs` | Create | Baseline goal test + monkey soak-smoke (fixed seeds). |
| `testkit/tests/wire_campaign.rs` | Create | Campaign scenario driven over a real TCP server via `RemoteApi`. |
| `testkit/tests/soak.rs` | Create | Long, `#[ignore]`d monkey soak; writes a real replay JSON on failure. |
| `.config/nextest.toml` | Create | Per-test slow-timeout (60s, terminate-after 3) for the nextest runner. |
| `.github/workflows/ci.yml` | Create | PR nextest (ubuntu + windows) + nightly monkey soak with replay artifacts. |

---

## Conventions used throughout

- The canonical action enum name is **`Action`** (never `TestAction`/`AgentAction`), observation is **`Observation`**, outcome is **`ActionOutcome`**, error is **`EnvError`**, refresh selector is **`View`**. Use these exact spellings in every task.
- Commit after every green step. Every commit message ends with the trailer:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- All `cargo` commands are run from the repo root. On Windows use the same commands (Cargo is cross-platform).
- `Formation` is `sim::user::Formation` (`Defensive`/`Aggressive`/`Tactical`), re-exported as `sim::Formation`.
- The starting human has `currency_value == 2000`, `max_active_ships == 1` (Recruit), and 0 ships. `Falcon` is `ship_id == 1`, value 1500.
- NPCs are seeded first and occupy SQLite user rowids 1–11 (rowids start at 1); `NPC_Astro` is **`user_id == 1`** (the first NPC seeded). The human registered after the 11 NPCs gets `user_id == 12`. Scenario `opponent_id` values therefore reference NPC rowids, and `NPC_Astro` is `opponent_id: 1`.
- `owned_ships.ship_number` is a single AUTOINCREMENT shared across **all** users. `seed_npcs` inserts 76 NPC ships before any human plays, so the human's **first** purchased ship has `ship_number == 77` (not 1). Scenario files that reference a freshly bought first ship must use `77`.

---

## Tasks

### Task 1 — Add the `testkit` crate skeleton to the workspace

Create the crate so later tasks have somewhere to write code. It compiles as an empty lib first.

**Files:**
- Create: `testkit/Cargo.toml`, `testkit/src/lib.rs`
- Modify: `Cargo.toml` (root, `[workspace] members` at line 30-31)

**Steps:**

- [ ] Create `testkit/Cargo.toml`:
  ```toml
  [package]
  name = "testkit"
  version = "0.1.0"
  edition = "2021"
  description = "Rift agent-testing kit: gym-style env, replay engine, scenario + monkey bots. Never shipped in the release binary."

  [dependencies]
  sim = { path = "../sim" }
  network = { path = "../network" }
  rand = "0.8"
  rand_chacha = "0.3"
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  sha2 = "0.10"
  ```
  (No `[dev-dependencies]` — `testkit` has no proptests of its own; the property tests live in `sim`.)
- [ ] Create `testkit/src/lib.rs`:
  ```rust
  //! Rift agent-testing kit. A gym-style [`env::AgentEnv`] over the game's
  //! [`network::GameApi`], a deterministic JSON replay engine, scenario files,
  //! and scripted + monkey bots. This crate is a test/dev tool and is never
  //! linked into the shipped `rift` binary.

  pub mod bots;
  pub mod env;
  pub mod replay;
  pub mod scenario;
  ```
  (The four `mod` files are filled in by later tasks. Create them now as empty placeholders — see the next step — so `lib.rs` resolves all four `mod` declarations and the crate builds green in this task.)
- [ ] Create empty placeholders so the crate compiles: `testkit/src/env.rs`, `testkit/src/replay.rs`, `testkit/src/bots.rs`, `testkit/src/scenario.rs`, each containing only a doc comment line `//! placeholder — filled in later tasks.`
- [ ] Modify root `Cargo.toml` line 31 from:
  ```toml
  members = ["sim", "network", "game"]
  ```
  to:
  ```toml
  members = ["sim", "network", "game", "testkit"]
  ```
- [ ] Run: `cargo build -p testkit`
  Expect: PASS (`Compiling testkit v0.1.0` … `Finished`).
- [ ] Commit:
  ```
  git add testkit Cargo.toml
  git commit -m "Add empty testkit crate to workspace

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 2 — Seedable World RNG (failing test first)

Prove that same-seed worlds produce identical battle outcomes. Today `World` hardcodes `StdRng::from_entropy()` at `network/src/world.rs:367` (in `work`) and `network/src/world.rs:422` (in `battle`), so this is impossible. Write the test first; it must fail to compile because `open_seeded` does not exist.

**Files:**
- Create test in: `network/src/world.rs` (append to the existing `#[cfg(test)] mod tests` block, after line 599)
- Modify: `network/Cargo.toml`

**Steps:**

- [ ] Add the dependency to `network/Cargo.toml` (after the `rand = "0.8"` line):
  ```toml
  rand_chacha = "0.3"
  ```
- [ ] In `network/src/world.rs`, inside `mod tests` (before the closing `}` at line 600), add:
  ```rust
      /// Two worlds opened with the same seed must produce byte-identical
      /// battle logs for the same sequence of actions.
      fn play_one_battle(w: &World) -> Vec<String> {
          let id = w.register("Pilot", "secret").unwrap();
          w.buy(id, sim::ship::template_by_name("Falcon").unwrap().ship_id).unwrap();
          let snap = w.snapshot(id).unwrap();
          w.activate(id, snap.ships[0].ship_number).unwrap();
          let astro = w
              .list_opponents(id)
              .unwrap()
              .into_iter()
              .find(|o| o.nickname == "NPC_Astro")
              .unwrap();
          w.battle(id, astro.user_id, Formation::Aggressive).unwrap().log
      }

      #[test]
      fn same_seed_worlds_are_identical() {
          let a = World::open_seeded(":memory:", 42).unwrap();
          let b = World::open_seeded(":memory:", 42).unwrap();
          assert_eq!(play_one_battle(&a), play_one_battle(&b));
      }

      #[test]
      fn different_seeds_very_likely_differ() {
          let a = World::open_seeded(":memory:", 1).unwrap();
          let b = World::open_seeded(":memory:", 2).unwrap();
          assert_ne!(play_one_battle(&a), play_one_battle(&b));
      }
  ```
- [ ] Run: `cargo test -p network same_seed_worlds_are_identical`
  Expect: FAIL to compile with `no function or associated item named `open_seeded` found for struct `World``.

---

### Task 3 — Seedable World RNG (minimal implementation)

Make Task 2's tests pass by storing an optional deterministic RNG on `World` and using it in `battle`/`work`.

**Files:**
- Modify: `network/src/world.rs` (imports lines 8-9; struct line 21-23; `open` lines 42-48; `work` line 367; `battle` line 422)

**Steps:**

- [ ] Change the rand imports at `network/src/world.rs:8-9` from:
  ```rust
  use rand::rngs::StdRng;
  use rand::SeedableRng;
  ```
  to:
  ```rust
  use rand::rngs::StdRng;
  use rand::{RngCore, SeedableRng};
  use rand_chacha::ChaCha8Rng;
  use std::cell::RefCell;
  ```
- [ ] Change the `World` struct (lines 21-23) from:
  ```rust
  pub struct World {
      db: Connection,
  }
  ```
  to:
  ```rust
  pub struct World {
      db: Connection,
      /// When `Some`, all battle/work randomness is drawn from this deterministic
      /// generator so runs are reproducible. `None` keeps the entropy behaviour
      /// used by normal play. `RefCell` so the existing `&self` methods can draw
      /// from it without a signature change.
      rng: RefCell<Option<ChaCha8Rng>>,
  }
  ```
- [ ] Change `open` (lines 42-48) from:
  ```rust
      pub fn open(path: &str) -> WorldResult<World> {
          let db = Connection::open(path).map_err(map_err)?;
          let world = World { db };
          world.init_schema()?;
          world.seed_if_empty()?;
          Ok(world)
      }
  ```
  to:
  ```rust
      pub fn open(path: &str) -> WorldResult<World> {
          let db = Connection::open(path).map_err(map_err)?;
          let world = World { db, rng: RefCell::new(None) };
          world.init_schema()?;
          world.seed_if_empty()?;
          Ok(world)
      }

      /// Like [`World::open`] but every battle/work roll is drawn from a
      /// deterministic `ChaCha8Rng` seeded with `seed`, so identical action
      /// sequences produce identical outcomes.
      pub fn open_seeded(path: &str, seed: u64) -> WorldResult<World> {
          let db = Connection::open(path).map_err(map_err)?;
          let world = World { db, rng: RefCell::new(Some(ChaCha8Rng::seed_from_u64(seed))) };
          world.init_schema()?;
          world.seed_if_empty()?;
          Ok(world)
      }

      /// Run `f` with a mutable RNG: the deterministic one when seeded, otherwise
      /// a fresh entropy generator (matching legacy behaviour).
      fn with_rng<T>(&self, f: impl FnOnce(&mut dyn RngCore) -> T) -> T {
          let mut guard = self.rng.borrow_mut();
          match guard.as_mut() {
              Some(rng) => f(rng),
              None => {
                  let mut rng = StdRng::from_entropy();
                  f(&mut rng)
              }
          }
      }
  ```
- [ ] In `work` (line 367), change:
  ```rust
          let mut rng = StdRng::from_entropy();
          let (work_type, income) = economy::perform_work(&mut user, &mut rng);
  ```
  to:
  ```rust
          let (work_type, income) = self.with_rng(|mut rng| economy::perform_work(&mut user, &mut rng));
  ```
- [ ] In `battle` (line 422, inside the `report` block), change:
  ```rust
              let mut rng = StdRng::from_entropy();
              combat::battle(
                  combat::Combatant { user: &mut me, fleet: my_fleet, formation },
                  combat::Combatant { user: &mut foe, fleet: foe_fleet, formation: foe_formation },
                  &mut rng,
              )?
  ```
  to:
  ```rust
              self.with_rng(|mut rng| {
                  combat::battle(
                      combat::Combatant { user: &mut me, fleet: my_fleet, formation },
                      combat::Combatant { user: &mut foe, fleet: foe_fleet, formation: foe_formation },
                      &mut rng,
                  )
              })?
  ```
  NOTE: `combat::battle` and `economy::perform_work` take `&mut impl Rng` — an `impl Rng` argument carries an implicit `Sized` bound, so passing the unsized `dyn RngCore` directly is an E0277 error. The closure hands us `rng: &mut dyn RngCore`; `rand`'s blanket `impl<R: RngCore + ?Sized> RngCore for &mut R` (which in turn gives `&mut dyn RngCore: Rng` via the blanket `impl<R: RngCore> Rng for R`) makes the *sized* type `&mut dyn RngCore` itself satisfy `Rng`. So we take the closure param as `|mut rng|` and pass `&mut rng`, i.e. a one-level reborrow to `R = &mut dyn RngCore`. This compiles without changing `sim`.
- [ ] Run: `cargo test -p network same_seed_worlds_are_identical different_seeds_very_likely_differ`
  Expect: PASS (2 passed).
- [ ] Run the full network suite to confirm no regression: `cargo test -p network`
  Expect: PASS (all existing tests still green).
- [ ] Commit:
  ```
  git add network
  git commit -m "Add seedable RNG to World via open_seeded

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4 — `LocalApi::open_seeded`

Expose seeding through the API layer so `testkit` and the CLI can build a seeded offline backend.

**Files:**
- Modify: `network/src/api.rs` (`LocalApi::open` at lines 42-44)

**Steps:**

- [ ] In `network/src/api.rs`, after the `open` method (line 44), add:
  ```rust
      /// Open a deterministic local world: all randomness is seeded from `seed`.
      pub fn open_seeded(path: &str, seed: u64) -> Result<Self, String> {
          Ok(LocalApi { world: World::open_seeded(path, seed)?, user_id: None })
      }
  ```
- [ ] Run: `cargo build -p network`
  Expect: PASS.
- [ ] Commit:
  ```
  git add network/src/api.rs
  git commit -m "Add LocalApi::open_seeded

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5 — `--seed` flags in the CLI (client + server)

Wire `rift --seed N` (offline client) and `rift server --seed N` through to `open_seeded`. This threads through `game::GameConfig` and `network::server`.

**Files:**
- Modify: `game/src/lib.rs` (`GameConfig` lines 12-23; `run` lines 26-41)
- Modify: `network/src/server.rs` (`run`/`run_with_db` lines 22-34)
- Modify: `src/main.rs` (`App` struct lines 24-49; `Command::Server` lines 51-58; `main` match lines 69-81; `run_client` lines 83-106)

**Steps:**

- [ ] In `game/src/lib.rs`, add a field to `GameConfig` (after `height` at line 22):
  ```rust
      /// When `Some`, the offline world is opened deterministically with this seed.
      pub seed: Option<u64>,
  ```
- [ ] In `game/src/lib.rs` `run` (line 27), after `let save_path = ...;`, and change the two `LocalApi::open(&save_path)?` call sites (lines 36 and 40) to respect the seed. Replace the whole backend-selection block (lines 31-41):
  ```rust
      let (backend, online, notice): (Box<dyn GameApi>, bool, Option<String>) = match &config.server_addr {
          Some(addr) => match RemoteApi::connect(addr) {
              Ok(remote) => (Box::new(remote), true, None),
              Err(e) => {
                  log::warn!("could not reach server {}: {} — starting offline", addr, e);
                  let local = LocalApi::open(&save_path)?;
                  (Box::new(local), false, Some(format!("Server unreachable ({e}) — playing offline.")))
              }
          },
          None => (Box::new(LocalApi::open(&save_path)?), false, None),
      };
  ```
  with:
  ```rust
      let open_local = |path: &str| -> Result<LocalApi, String> {
          match config.seed {
              Some(seed) => LocalApi::open_seeded(path, seed),
              None => LocalApi::open(path),
          }
      };
      let (backend, online, notice): (Box<dyn GameApi>, bool, Option<String>) = match &config.server_addr {
          Some(addr) => match RemoteApi::connect(addr) {
              Ok(remote) => (Box::new(remote), true, None),
              Err(e) => {
                  log::warn!("could not reach server {}: {} — starting offline", addr, e);
                  let local = open_local(&save_path)?;
                  (Box::new(local), false, Some(format!("Server unreachable ({e}) — playing offline.")))
              }
          },
          None => (Box::new(open_local(&save_path)?), false, None),
      };
  ```
- [ ] In `network/src/server.rs`, replace `run` (lines 22-24) and add a seeded variant, then thread an optional seed into `run_with_db`. Replace lines 22-34:
  ```rust
  /// Run the dedicated server on `port`, persisting to `rift-server.db`.
  pub fn run(port: u16) {
      run_with_db(port, "rift-server.db");
  }

  /// Run the server with an explicit database path.
  pub fn run_with_db(port: u16, db_path: &str) {
      let world = match World::open(db_path) {
          Ok(w) => Arc::new(Mutex::new(w)),
          Err(e) => {
              warn!("failed to open world database '{}': {}", db_path, e);
              return;
          }
      };
  ```
  with:
  ```rust
  /// Run the dedicated server on `port`, persisting to `rift-server.db`.
  pub fn run(port: u16) {
      run_with_db_seeded(port, "rift-server.db", None);
  }

  /// Run the dedicated server with an optional deterministic seed.
  pub fn run_seeded(port: u16, seed: Option<u64>) {
      run_with_db_seeded(port, "rift-server.db", seed);
  }

  /// Run the server with an explicit database path (entropy RNG).
  pub fn run_with_db(port: u16, db_path: &str) {
      run_with_db_seeded(port, db_path, None);
  }

  /// Run the server with an explicit database path and optional seed.
  pub fn run_with_db_seeded(port: u16, db_path: &str, seed: Option<u64>) {
      let opened = match seed {
          Some(s) => World::open_seeded(db_path, s),
          None => World::open(db_path),
      };
      let world = match opened {
          Ok(w) => Arc::new(Mutex::new(w)),
          Err(e) => {
              warn!("failed to open world database '{}': {}", db_path, e);
              return;
          }
      };
  ```
- [ ] In `src/main.rs`, add a client seed flag to `App` (after the `offline` field, line 36):
  ```rust
      /// Deterministic seed for the offline world (reproducible battles/work).
      #[structopt(long = "seed", value_name = "N")]
      seed: Option<u64>,
  ```
- [ ] In `src/main.rs`, add a seed flag to `Command::Server` (inside the braces at lines 54-57, after `port`):
  ```rust
          /// Deterministic seed for the server world.
          #[structopt(long = "seed", value_name = "N")]
          seed: Option<u64>,
  ```
- [ ] In `src/main.rs` `main` (lines 70-73), change:
  ```rust
          Some(Command::Server { port }) => {
              log::info!("Starting Rift server on port {}", port);
              network::server::run(port);
          }
  ```
  to:
  ```rust
          Some(Command::Server { port, seed }) => {
              log::info!("Starting Rift server on port {} (seed {:?})", port, seed);
              network::server::run_seeded(port, seed);
          }
  ```
- [ ] In `src/main.rs` `run_client` (lines 97-104), add `seed: app.seed,` to the `game::GameConfig { … }` literal (after `height: app.resolution.1,`).
- [ ] Run: `cargo build`
  Expect: PASS (default features build the client).
- [ ] Run: `cargo build --no-default-features`
  Expect: PASS (headless server build still parses `--seed`).
- [ ] Commit:
  ```
  git add game/src/lib.rs network/src/server.rs src/main.rs
  git commit -m "Add --seed flags for offline client and server

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6 — testkit env types (write failing test first)

Define the serde `Action`/`Observation`/`ActionOutcome`/`EnvError`/`View` types and the `AgentEnv` trait. Start with a compile-failing test that exercises the round-trip.

**Files:**
- Modify: `testkit/src/env.rs`
- Create: `testkit/tests/env.rs`

**Steps:**

- [ ] Create `testkit/tests/env.rs`:
  ```rust
  use sim::user::Formation;
  use testkit::env::{Action, View};

  #[test]
  fn action_serializes_to_expected_json() {
      // Externally-tagged serde: the spec's replay JSON uses these exact shapes.
      assert_eq!(serde_json::to_string(&Action::Work).unwrap(), "\"Work\"");
      assert_eq!(
          serde_json::to_string(&Action::Buy { ship_id: 3 }).unwrap(),
          "{\"Buy\":{\"ship_id\":3}}"
      );
      assert_eq!(
          serde_json::to_string(&Action::Battle { opponent_id: 5, formation: Formation::Aggressive }).unwrap(),
          "{\"Battle\":{\"opponent_id\":5,\"formation\":\"Aggressive\"}}"
      );
      assert_eq!(serde_json::to_string(&Action::Refresh(View::Leaderboard)).unwrap(), "{\"Refresh\":\"Leaderboard\"}");
  }
  ```
- [ ] Run: `cargo test -p testkit --test env`
  Expect: FAIL to compile (`unresolved import `testkit::env::Action``).

---

### Task 7 — testkit env types (implementation)

Fill in `env.rs` with the types and the `AgentEnv` trait. `ApiEnv` and `legal_actions` come in Task 8.

**Files:**
- Modify: `testkit/src/env.rs`

**Steps:**

- [ ] Replace the placeholder `testkit/src/env.rs` with:
  ```rust
  //! Gym-style agent interface over `network::GameApi`.
  //!
  //! [`Action`] is a superset of `sim::bot::BotAction`; [`Observation`] is the
  //! serde payload every layer shares. [`AgentEnv`] is the observe/act/legal
  //! loop; [`ApiEnv`] implements it over any `Box<dyn GameApi>`.

  use network::protocol::{BattleSummary, LeaderboardEntry, OpponentInfo, PlayerSnapshot};
  use serde::{Deserialize, Serialize};
  use sim::ship::ShipTemplate;
  use sim::user::Formation;

  /// A single agent action. Externally-tagged so the replay JSON matches the
  /// spec: `"Work"`, `{"Buy":{"ship_id":3}}`, etc.
  #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
  pub enum Action {
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
      Refresh(View),
  }

  /// Which read-only view a `Refresh` pulls.
  #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
  pub enum View {
      Opponents,
      Leaderboard,
      History,
  }

  /// The serde observation snapshot shared by every layer.
  #[derive(Clone, Debug, Serialize, Deserialize)]
  pub struct Observation {
      pub player: Option<PlayerSnapshot>,
      pub catalog: Vec<ShipTemplate>,
      pub opponents: Vec<OpponentInfo>,
      pub leaderboard: Vec<LeaderboardEntry>,
      pub history: Vec<BattleSummary>,
      pub status: String,
      pub status_is_error: bool,
      /// Populated only when attached to the live UI (unused in Phase 1).
      pub screen: Option<String>,
  }

  /// The result of applying one [`Action`].
  #[derive(Clone, Debug, Serialize, Deserialize)]
  pub struct ActionOutcome {
      /// True if the backend accepted the action.
      pub ok: bool,
      /// A human-facing status line (the backend message, or the error text).
      pub status: String,
      /// The observation after the action was applied (or attempted).
      pub observation: Observation,
  }

  /// Errors an environment can raise that are not ordinary game rejections.
  #[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
  pub enum EnvError {
      /// The backend reported an error string for a read/observe call.
      Backend(String),
      /// An action referenced state that does not exist (e.g. no player yet).
      InvalidState(String),
  }

  impl std::fmt::Display for EnvError {
      fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
          match self {
              EnvError::Backend(s) => write!(f, "backend error: {s}"),
              EnvError::InvalidState(s) => write!(f, "invalid state: {s}"),
          }
      }
  }

  impl std::error::Error for EnvError {}

  /// The observe / legal-actions / act loop every bot and the LLM consume.
  pub trait AgentEnv {
      fn observe(&mut self) -> Result<Observation, EnvError>;
      fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError>;
      fn act(&mut self, a: &Action) -> Result<ActionOutcome, EnvError>;
  }
  ```
- [ ] Run: `cargo test -p testkit --test env`
  Expect: PASS (`action_serializes_to_expected_json` passes).
- [ ] Commit:
  ```
  git add testkit/src/env.rs testkit/tests/env.rs
  git commit -m "Add testkit env Action/Observation types and AgentEnv trait

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 8 — `ApiEnv` and `legal_actions` (failing test first)

`ApiEnv` wraps a `Box<dyn GameApi>`. `legal_actions` derives from the current observation using the real rules read from the code:
- **Work** is legal iff a player exists and `work_cooldown_remaining == 0`.
- **Buy { ship_id }** for every catalog ship whose `stats.value as i64 <= currency_value`.
- **Sell { ship_number }** / **Repair { ship_number }** for every owned ship whose status is `Owned` or `Active` (not `Destroyed`/`Sold`); repairs are additionally only listed for ships where `needs_repair()` is true.
- **Activate { ship_number }** for every `Owned` ship when `active_count < max_active_ships`.
- **Deactivate { ship_number }** for every `Active` ship.
- **Battle { opponent_id, formation }** for every opponent when `active_count > 0`, using the player's current `snap.user.default_formation` (not a hard-coded `Aggressive`).
- **SetFormation** for all three formations, and **Refresh** for all three views, are always legal once a player exists.

**Files:**
- Modify: `testkit/src/env.rs` (append `ApiEnv` + `legal_actions`)
- Modify: `testkit/tests/env.rs` (append tests)

**Steps:**

- [ ] Append to `testkit/tests/env.rs`:
  ```rust
  use network::LocalApi;
  use testkit::env::{ActionOutcome, AgentEnv, ApiEnv};

  fn seeded_env() -> ApiEnv {
      ApiEnv::new(Box::new(LocalApi::open_seeded(":memory:", 7).unwrap()))
  }

  #[test]
  fn fresh_player_can_only_work_or_refresh_or_set_formation() {
      let mut env = seeded_env();
      let out: ActionOutcome = env.act(&Action::Register { nickname: "T".into(), password: "pwd".into() }).unwrap();
      assert!(out.ok, "register should succeed: {}", out.status);
      let legal = env.legal_actions().unwrap();
      // No ships yet, so no sell/repair/activate/deactivate/battle.
      assert!(legal.contains(&Action::Work));
      assert!(!legal.iter().any(|a| matches!(a, Action::Battle { .. })));
      assert!(!legal.iter().any(|a| matches!(a, Action::Activate { .. })));
      // Falcon (1500) is affordable from 2000 starting credits.
      assert!(legal.iter().any(|a| matches!(a, Action::Buy { ship_id } if *ship_id == 1)));
  }

  #[test]
  fn buying_then_activating_makes_battle_legal() {
      let mut env = seeded_env();
      env.act(&Action::Register { nickname: "T".into(), password: "pwd".into() }).unwrap();
      env.act(&Action::Buy { ship_id: 1 }).unwrap();
      let obs = env.observe().unwrap();
      let ship_number = obs.player.unwrap().ships[0].ship_number;
      // Before activating, no battle.
      assert!(!env.legal_actions().unwrap().iter().any(|a| matches!(a, Action::Battle { .. })));
      env.act(&Action::Activate { ship_number }).unwrap();
      assert!(env.legal_actions().unwrap().iter().any(|a| matches!(a, Action::Battle { .. })));
  }
  ```
- [ ] Run: `cargo test -p testkit --test env`
  Expect: FAIL to compile (`ApiEnv` not found).

---

### Task 9 — `ApiEnv` and `legal_actions` (implementation)

**Files:**
- Modify: `testkit/src/env.rs`

**Steps:**

- [ ] Append to `testkit/src/env.rs` (after the `AgentEnv` trait):
  ```rust
  use network::GameApi;
  use sim::ship::ShipStatus;

  /// An [`AgentEnv`] over any `GameApi` backend: in-memory `LocalApi`, on-disk
  /// save, or `RemoteApi`. Read calls that fail are treated as empty lists so a
  /// pre-login observation is still well-formed.
  pub struct ApiEnv {
      api: Box<dyn GameApi>,
      logged_in: bool,
  }

  impl ApiEnv {
      pub fn new(api: Box<dyn GameApi>) -> Self {
          ApiEnv { api, logged_in: false }
      }

      /// Build an observation from the backend. Read errors (e.g. not logged in)
      /// collapse to empty collections rather than failing the whole observe.
      fn build_observation(&mut self, status: String, status_is_error: bool) -> Observation {
          let player = if self.logged_in { self.api.snapshot().ok() } else { None };
          let catalog = self.api.catalog().unwrap_or_default();
          let opponents = if self.logged_in { self.api.opponents().unwrap_or_default() } else { Vec::new() };
          let leaderboard = self.api.leaderboard().unwrap_or_default();
          let history = if self.logged_in { self.api.history().unwrap_or_default() } else { Vec::new() };
          Observation {
              player,
              catalog,
              opponents,
              leaderboard,
              history,
              status,
              status_is_error,
              screen: None,
          }
      }
  }

  impl AgentEnv for ApiEnv {
      fn observe(&mut self) -> Result<Observation, EnvError> {
          Ok(self.build_observation(String::new(), false))
      }

      fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError> {
          let obs = self.observe()?;
          let mut actions = Vec::new();
          let snap = match &obs.player {
              Some(s) => s,
              None => return Ok(actions), // not logged in: caller must Register/Login
          };

          // SetFormation and Refresh are always available once logged in.
          for f in [Formation::Defensive, Formation::Aggressive, Formation::Tactical] {
              actions.push(Action::SetFormation(f));
          }
          for v in [View::Opponents, View::Leaderboard, View::History] {
              actions.push(Action::Refresh(v));
          }

          // Work when the cooldown has elapsed.
          if snap.work_cooldown_remaining == 0 {
              actions.push(Action::Work);
          }

          // Buy every affordable catalog ship.
          for t in &obs.catalog {
              if (t.stats.value as i64) <= snap.user.currency_value {
                  actions.push(Action::Buy { ship_id: t.ship_id });
              }
          }

          // Per-ship actions.
          for ship in &snap.ships {
              match ship.status {
                  ShipStatus::Owned => {
                      actions.push(Action::Sell { ship_number: ship.ship_number });
                      if ship.needs_repair() {
                          actions.push(Action::Repair { ship_number: ship.ship_number });
                      }
                      if snap.active_count < snap.max_active_ships {
                          actions.push(Action::Activate { ship_number: ship.ship_number });
                      }
                  }
                  ShipStatus::Active => {
                      actions.push(Action::Sell { ship_number: ship.ship_number });
                      if ship.needs_repair() {
                          actions.push(Action::Repair { ship_number: ship.ship_number });
                      }
                      actions.push(Action::Deactivate { ship_number: ship.ship_number });
                  }
                  ShipStatus::Destroyed | ShipStatus::Sold => {}
              }
          }

          // Battle every opponent when we have an active fleet.
          if snap.active_count > 0 {
              for opp in &obs.opponents {
                  actions.push(Action::Battle {
                      opponent_id: opp.user_id,
                      formation: snap.user.default_formation,
                  });
              }
          }

          Ok(actions)
      }

      fn act(&mut self, a: &Action) -> Result<ActionOutcome, EnvError> {
          let result: Result<String, String> = match a {
              Action::Register { nickname, password } => self.api.register(nickname, password).map(|_| {
                  self.logged_in = true;
                  format!("Registered {nickname}")
              }),
              Action::Login { nickname, password } => self.api.login(nickname, password).map(|_| {
                  self.logged_in = true;
                  format!("Logged in as {nickname}")
              }),
              Action::Work => self.api.work().map(|(kind, income, _)| format!("Worked {kind}: +{income}")),
              Action::Buy { ship_id } => self.api.buy(*ship_id).map(|_| format!("Bought ship {ship_id}")),
              Action::Sell { ship_number } => self.api.sell(*ship_number).map(|_| format!("Sold ship {ship_number}")),
              Action::Repair { ship_number } => {
                  self.api.repair(*ship_number).map(|_| format!("Repaired ship {ship_number}"))
              }
              Action::Activate { ship_number } => {
                  self.api.activate(*ship_number).map(|_| format!("Activated ship {ship_number}"))
              }
              Action::Deactivate { ship_number } => {
                  self.api.deactivate(*ship_number).map(|_| format!("Deactivated ship {ship_number}"))
              }
              Action::SetFormation(f) => self.api.set_formation(*f).map(|_| format!("Formation set to {}", f.as_str())),
              Action::Battle { opponent_id, formation } => {
                  self.api.battle(*opponent_id, *formation).map(|(r, _)| r.message)
              }
              Action::Refresh(view) => match view {
                  View::Opponents => self.api.opponents().map(|o| format!("{} opponents", o.len())),
                  View::Leaderboard => self.api.leaderboard().map(|l| format!("{} leaders", l.len())),
                  View::History => self.api.history().map(|h| format!("{} battles", h.len())),
              },
          };
          let (ok, status) = match result {
              Ok(msg) => (true, msg),
              Err(e) => (false, e),
          };
          let observation = self.build_observation(status.clone(), !ok);
          Ok(ActionOutcome { ok, status, observation })
      }
  }
  ```
- [ ] Run: `cargo test -p testkit --test env`
  Expect: PASS (all env tests pass).
- [ ] Commit:
  ```
  git add testkit/src/env.rs testkit/tests/env.rs
  git commit -m "Add ApiEnv and legal_actions derivation

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10 — Replay format + `state_hash` (failing test first)

Define the replay DTOs, the canonical `state_hash`, and the `run_replay` runner. `state_hash` is a SHA-256 hex digest over the pretty-independent canonical JSON of a **time-free** projection of the final player state (serde_json serializes struct fields in declaration order, which is stable). Define it exactly: build a `HashView { user, ships }` borrowing from `Observation.player` (a `PlayerSnapshot`) — deliberately excluding wall-clock cooldown fields like `work_cooldown_remaining` so the "same seed → same hash" determinism test is not self-flaky — serialize the view with `serde_json::to_vec`, hash the bytes, return lowercase hex. `Expect` fields are all optional so a replay can assert any subset.

**Files:**
- Modify: `testkit/src/replay.rs`
- Create: `testkit/tests/env.rs` already exists; add replay tests to a new section (keep in `testkit/tests/env.rs`).

**Steps:**

- [ ] Append to `testkit/tests/env.rs`:
  ```rust
  use testkit::replay::{run_replay, Expect, Replay};

  #[test]
  fn replay_is_deterministic_across_runs() {
      let replay = Replay {
          seed: 99,
          actions: vec![
              Action::Register { nickname: "R".into(), password: "pwd".into() },
              Action::Work,
          ],
          expect: Expect::default(),
          tolerate_rejections: false,
      };
      let a = run_replay(&replay).unwrap();
      let b = run_replay(&replay).unwrap();
      assert_eq!(a.state_hash, b.state_hash);
      assert_eq!(a.credits, b.credits);
  }

  #[test]
  fn replay_expect_credits_mismatch_fails() {
      let replay = Replay {
          seed: 5,
          actions: vec![Action::Register { nickname: "R".into(), password: "pwd".into() }],
          expect: Expect { credits: Some(999_999), rank: None, state_hash: None },
          tolerate_rejections: false,
      };
      let err = run_replay(&replay).unwrap_err();
      assert!(err.contains("credits"), "error should mention credits: {err}");
  }

  #[test]
  fn replay_expect_credits_match_passes() {
      let replay = Replay {
          seed: 5,
          actions: vec![Action::Register { nickname: "R".into(), password: "pwd".into() }],
          expect: Expect { credits: Some(2000), rank: None, state_hash: None },
          tolerate_rejections: false,
      };
      assert!(run_replay(&replay).is_ok());
  }
  ```
  Note: the implemented suite also carries `replay_json_round_trips`,
  `replay_expect_unknown_field_fails_parse`, `replay_state_hash_self_referential`,
  and `tolerant_replay_skips_rejections`, which cover the `tolerate_rejections`
  flag and the `#[serde(deny_unknown_fields)]` hardening on `Expect`.
- [ ] Run: `cargo test -p testkit --test env replay`
  Expect: FAIL to compile (`testkit::replay::run_replay` not found).

---

### Task 11 — Replay format + `state_hash` (implementation)

**Files:**
- Modify: `testkit/src/replay.rs`

**Steps:**

- [ ] Replace the placeholder `testkit/src/replay.rs` with:
  ```rust
  //! Deterministic replay format — the universal Rift bug-report currency.
  //!
  //! A [`Replay`] is a seed plus an action list plus optional expectations. It is
  //! run against a fresh seeded in-memory [`network::LocalApi`] and the resulting
  //! end state is checked against the expectations.

  use crate::env::{Action, AgentEnv, ApiEnv, Observation};
  use network::LocalApi;
  use sim::ship::{OwnedShip, ShipStatus};
  use sim::user::User;
  use serde::{Deserialize, Serialize};
  use sha2::{Digest, Sha256};

  /// A recorded session: seed, ordered actions, and end-state expectations.
  #[derive(Clone, Debug, Serialize, Deserialize)]
  pub struct Replay {
      pub seed: u64,
      pub actions: Vec<Action>,
      #[serde(default)]
      pub expect: Expect,
      /// When true (monkey-emitted bug reports), rejected actions (`ok == false`)
      /// are recorded history, not errors — the runner skips them and continues.
      /// Curated scenario files leave this false so unexpected rejections fail
      /// loudly.
      #[serde(default)]
      pub tolerate_rejections: bool,
  }

  /// End-state assertions. Any subset may be present.
  // deny_unknown_fields: typo'd expectation keys must fail parse, not pass vacuously.
  #[derive(Clone, Debug, Default, Serialize, Deserialize)]
  #[serde(deny_unknown_fields)]
  pub struct Expect {
      #[serde(default, skip_serializing_if = "Option::is_none")]
      pub credits: Option<i64>,
      #[serde(default, skip_serializing_if = "Option::is_none")]
      pub rank: Option<String>,
      #[serde(default, skip_serializing_if = "Option::is_none")]
      pub state_hash: Option<String>,
  }

  /// The observable end state of a replay.
  #[derive(Clone, Debug)]
  pub struct ReplayResult {
      pub credits: i64,
      pub rank: String,
      pub state_hash: String,
  }

  /// A time-free projection of the player snapshot used for hashing. We hash
  /// ONLY the persistent user record and owned ships — NOT the full
  /// `PlayerSnapshot`, whose `work_cooldown_remaining` (and any other cooldown
  /// fields) are derived from wall-clock time and would make the "same seed →
  /// same hash" determinism test self-flaky. Cooldown fields are excluded by
  /// design.
  #[derive(Serialize)]
  struct HashView<'a> {
      user: &'a User,
      ships: &'a [OwnedShip],
  }

  /// SHA-256 hex digest over the canonical JSON of the final player's time-free
  /// [`HashView`]. serde_json emits struct fields in declaration order, so this
  /// is stable across runs. Non-finite floats serialize as JSON null (stable but
  /// lossy); the hash covers only the player's own user+ships — opponent/NPC
  /// state is out of scope by design. NOTE: committed `state_hash` values must be
  /// captured on the Linux CI leg — `elo` uses `10f64.powf(...)` whose last ULP
  /// can differ between platforms, so a hash generated on Windows may not match
  /// Ubuntu's.
  pub fn state_hash(env: &mut ApiEnv) -> Result<String, String> {
      let obs = env.observe().map_err(|e| e.to_string())?;
      let player = obs.player.ok_or_else(|| "no player to hash".to_string())?;
      let view = HashView { user: &player.user, ships: &player.ships };
      let bytes = serde_json::to_vec(&view).map_err(|e| e.to_string())?;
      let mut hasher = Sha256::new();
      hasher.update(&bytes);
      Ok(hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect())
  }

  /// Invariants every observation must satisfy no matter what actions ran.
  /// Returns `Err(description)` on the first violation instead of panicking, so
  /// callers (the replay runner, and the monkey fuzzer via reuse) can report a
  /// reproducible failure rather than crashing. A pre-login observation (no
  /// player) trivially satisfies every invariant.
  pub fn check_invariants(obs: &Observation) -> Result<(), String> {
      if let Some(player) = &obs.player {
          if player.user.currency_value < 0 {
              return Err(format!("negative credits {}", player.user.currency_value));
          }
          if player.active_count > player.max_active_ships {
              return Err(format!("active {} > max {}", player.active_count, player.max_active_ships));
          }
          let active_ships = player.ships.iter().filter(|s| s.status == ShipStatus::Active).count();
          if active_ships as u32 != player.active_count {
              return Err(format!(
                  "active ship count {active_ships} != snapshot active_count {}",
                  player.active_count
              ));
          }
          for ship in &player.ships {
              if ship.actual.hp < 0.0 {
                  return Err(format!("negative ship hp on ship {}", ship.ship_number));
              }
          }
      }
      Ok(())
  }

  /// Run a replay against a fresh seeded in-memory world and assert its
  /// expectations. Returns the observed end state on success, or an error
  /// describing the first failed action or expectation. Every error is prefixed
  /// with `replay seed {seed}: ` so failures name their reproduction seed.
  ///
  /// After each action the runner re-checks [`check_invariants`] (in both tolerant
  /// and strict modes) so a recorded invariant violation reproduces instead of
  /// slipping through. On a rejected action (`ok == false`): if
  /// `tolerate_rejections` is set the rejection is recorded history and the runner
  /// continues; otherwise it aborts.
  pub fn run_replay(replay: &Replay) -> Result<ReplayResult, String> {
      let seed = replay.seed;
      let api = LocalApi::open_seeded(":memory:", seed)
          .map_err(|e| format!("replay seed {seed}: open: {e}"))?;
      let mut env = ApiEnv::new(Box::new(api));

      for (i, action) in replay.actions.iter().enumerate() {
          let outcome = env
              .act(action)
              .map_err(|e| format!("replay seed {seed}: action {i} ({action:?}): {e}"))?;
          if !outcome.ok {
              if replay.tolerate_rejections {
                  // Recorded rejection: skip and continue to the next action.
                  continue;
              }
              return Err(format!(
                  "replay seed {seed}: action {i} ({action:?}) rejected: {}",
                  outcome.status
              ));
          }
          check_invariants(&outcome.observation)
              .map_err(|e| format!("replay seed {seed}: action {i} invariant violated: {e}"))?;
      }

      let obs = env.observe().map_err(|e| format!("replay seed {seed}: {e}"))?;
      let player = obs
          .player
          .ok_or_else(|| format!("replay seed {seed}: replay ended with no player"))?;
      let credits = player.user.currency_value;
      let rank = player.user.rank.title().to_string();
      let hash = state_hash(&mut env)?;

      if let Some(want) = replay.expect.credits {
          if want != credits {
              return Err(format!(
                  "replay seed {seed}: expect credits {want} != actual credits {credits}"
              ));
          }
      }
      if let Some(want) = &replay.expect.rank {
          if want != &rank {
              return Err(format!("replay seed {seed}: expect rank {want} != actual rank {rank}"));
          }
      }
      if let Some(want) = &replay.expect.state_hash {
          if want != &hash {
              return Err(format!(
                  "replay seed {seed}: expect state_hash {want} != actual state_hash {hash}"
              ));
          }
      }

      Ok(ReplayResult { credits, rank, state_hash: hash })
  }
  ```
- [ ] Run: `cargo test -p testkit --test env replay`
  Expect: PASS (3 replay tests pass).
- [ ] Commit:
  ```
  git add testkit/src/replay.rs testkit/tests/env.rs
  git commit -m "Add replay format, state_hash, and run_replay

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12 — Baseline bot driver (failing test first)

The baseline bot loops `sim::bot::decide` through the env until a goal is reached (here: the player has won at least one battle, or a step cap is hit). It maps `BotAction` to `Action` and executes via the env, asserting the loop makes progress.

**Files:**
- Modify: `testkit/src/bots.rs`
- Create: `testkit/tests/bots.rs`

**Steps:**

- [ ] Create `testkit/tests/bots.rs`:
  ```rust
  use network::LocalApi;
  use testkit::bots::run_baseline;
  use testkit::env::{Action, AgentEnv, ApiEnv};

  #[test]
  fn baseline_bot_wins_a_battle_within_budget() {
      let mut env = ApiEnv::new(Box::new(LocalApi::open_seeded(":memory:", 3).unwrap()));
      env.act(&Action::Register { nickname: "Baseliner".into(), password: "pwd".into() }).unwrap();
      let victories = run_baseline(&mut env, 200).expect("baseline should reach a victory");
      assert!(victories >= 1, "expected at least one victory, got {victories}");
      // The player still exists and has non-negative credits at the end.
      let obs = env.observe().unwrap();
      let player = obs.player.unwrap();
      assert!(player.user.currency_value >= 0);
  }
  ```
- [ ] Run: `cargo test -p testkit --test bots`
  Expect: FAIL to compile (`testkit::bots::run_baseline` not found).

---

### Task 13 — Baseline bot driver (implementation)

**Files:**
- Modify: `testkit/src/bots.rs`

**Steps:**

- [ ] Replace the placeholder `testkit/src/bots.rs` with:
  ```rust
  //! Scripted bots that drive an [`AgentEnv`].
  //!
  //! [`run_baseline`] reuses `sim::bot::decide` (the NPC policy) to play toward a
  //! goal; [`run_monkey`] fuzzes with a seeded mix of legal and illegal actions
  //! while asserting per-step invariants.

  use crate::env::{Action, AgentEnv, ApiEnv};
  use crate::replay::{check_invariants, Expect, Replay};
  use rand::seq::SliceRandom;
  use rand::{Rng, SeedableRng};
  use rand_chacha::ChaCha8Rng;
  use sim::bot::{decide, BotAction};

  /// Drive the env with `sim::bot::decide` until the player records at least one
  /// victory or `max_steps` is exhausted. The player must already be logged in.
  /// Returns the victory count reached.
  pub fn run_baseline(env: &mut ApiEnv, max_steps: usize) -> Result<i64, String> {
      let mut last_status = String::new();
      for _ in 0..max_steps {
          let obs = env.observe().map_err(|e| e.to_string())?;
          let player = obs.player.as_ref().ok_or_else(|| "baseline: not logged in".to_string())?;
          if player.user.victories >= 1 {
              return Ok(player.user.victories);
          }
          // `run_baseline` re-seeds `decide`'s RNG to 0 every step, so `decide`
          // would otherwise pick the SAME index into the elo-sorted opponent list
          // each time. Restrict the baseline to the single weakest opponent so the
          // Hawk always faces NPC_Astro (the list is elo-ascending, so index 0 is
          // the weakest = NPC_Astro) and can actually win.
          let opponent_ids: Vec<u32> = obs.opponents.iter().take(1).map(|o| o.user_id).collect();
          let mut rng = ChaCha8Rng::seed_from_u64(0); // decide only randomises opponent choice
          let action = match decide(&player.user, &player.ships, &opponent_ids, &mut rng) {
              BotAction::Work => Action::Work,
              BotAction::Buy { ship_id } => Action::Buy { ship_id },
              BotAction::Repair { ship_number } => Action::Repair { ship_number },
              BotAction::Activate { ship_number } => Action::Activate { ship_number },
              BotAction::Attack { opponent_id } => {
                  Action::Battle { opponent_id, formation: player.user.default_formation }
              }
              BotAction::Idle => Action::Refresh(crate::env::View::Leaderboard),
          };
          let outcome = env.act(&action).map_err(|e| e.to_string())?; // rejections are tolerated; loop retries
          last_status = outcome.status;
      }
      let obs = env.observe().map_err(|e| e.to_string())?;
      let victories = obs.player.map(|p| p.user.victories).unwrap_or(0);
      if victories >= 1 {
          Ok(victories)
      } else {
          // Include the final step's status so a stall says why (e.g. a Work
          // cooldown message) rather than just reporting the step budget.
          Err(format!(
              "baseline did not win within {max_steps} steps (victories={victories}; last status: {last_status})"
          ))
      }
  }

  // The per-step invariant check now lives in `replay.rs` as
  // `check_invariants(obs: &Observation)` so `run_replay` (G6) and the monkey
  // fuzzer share one definition verbatim; it is imported above.

  /// Fuzz the env for `steps` iterations from `seed`. Each step samples a legal
  /// action with probability `1 - illegal_ratio`, otherwise a deliberately
  /// illegal one. Illegal actions must surface as `ok == false` without
  /// corrupting state, and per-step invariants must hold.
  ///
  /// The env MUST be unregistered when passed in: `run_monkey` registers its own
  /// player (`M{seed}`) as the first recorded action so the emitted [`Replay`] is
  /// self-contained and reproduces standalone. If the env already has a player
  /// this returns an error.
  ///
  /// Every executed action is recorded — INCLUDING rejected ones — so a failure
  /// produces a real, replayable [`Replay`]: on the first invariant violation,
  /// env error, or a deliberately-illegal action that the backend wrongly
  /// accepted, this returns `Err((Replay { seed, actions, expect:
  /// Expect::default(), tolerate_rejections: true }, description))` capturing
  /// exactly the actions that led to it plus a human-readable failure description.
  /// `tolerate_rejections` is set so `run_replay` skips the recorded rejections
  /// and re-runs to the failure instead of aborting on the first rejected action.
  /// On success it returns `Ok(())`.
  ///
  /// # Seed / reproducibility contract
  ///
  /// - `seed` MUST equal the seed the env's world was opened with: the emitted
  ///   `Replay` re-opens `LocalApi::open_seeded(":memory:", seed)` from it, so a
  ///   mismatched seed would replay against a different world.
  /// - Re-running `run_monkey` with the same seed is NOT guaranteed to retrace the
  ///   same path: `legal_actions` depends on wall-clock cooldowns, so the sampled
  ///   actions can differ between runs. It is the recorded `actions` vec — not the
  ///   seed — that makes the emitted artifact deterministic.
  /// - Under `tolerate_rejections`, an action accepted at record time can be
  ///   rejected at replay time by cooldown timing; a captured violation may then
  ///   not reproduce on replay.
  pub fn run_monkey(
      env: &mut ApiEnv,
      seed: u64,
      steps: usize,
      illegal_ratio: f64,
  ) -> Result<(), (Replay, String)> {
      let mut rng = ChaCha8Rng::seed_from_u64(seed);
      let mut executed: Vec<Action> = Vec::new();

      let failed = |executed: &[Action]| Replay {
          seed,
          actions: executed.to_vec(),
          expect: Expect::default(),
          // Recorded history includes rejected actions; the replay runner
          // must skip them and continue to reproduce the failure.
          tolerate_rejections: true,
      };

      // Require a fresh env so the emitted replay is self-contained: it must carry
      // its own Register as the first action rather than depending on the caller.
      let fresh = env.observe().map_err(|e| (failed(&executed), e.to_string()))?;
      if fresh.player.is_some() {
          return Err((
              failed(&executed),
              "run_monkey requires an unregistered env".to_string(),
          ));
      }

      // Register our own player first so the replay reproduces standalone.
      let register = Action::Register { nickname: format!("M{seed}"), password: "pwd".into() };
      match env.act(&register) {
          Ok(outcome) => {
              executed.push(register);
              if !outcome.ok {
                  return Err((
                      failed(&executed),
                      format!("run_monkey registration rejected: {}", outcome.status),
                  ));
              }
          }
          // Err branch is unreachable for ApiEnv (act never errors); kept for
          // future AgentEnv backends.
          Err(e) => {
              executed.push(register);
              return Err((failed(&executed), e.to_string()));
          }
      }

      for _step in 0..steps {
          let pick_illegal = rng.gen::<f64>() < illegal_ratio;
          let action = if pick_illegal {
              // Deliberately illegal: unaffordable buy, empty-fleet battle, bogus
              // sell, plus stateful/boundary shapes (buy of id 0, battle against
              // opponent 0, deactivate a nonexistent ship number, and a duplicate
              // Register of our own nickname — rejected as taken once logged in).
              match rng.gen_range(0..7) {
                  0 => Action::Buy { ship_id: 999 },
                  1 => Action::Battle { opponent_id: 999_999, formation: sim::user::Formation::Aggressive },
                  2 => Action::Sell { ship_number: 999_999 },
                  3 => Action::Buy { ship_id: 0 },
                  4 => Action::Battle { opponent_id: 0, formation: sim::user::Formation::Aggressive },
                  5 => Action::Deactivate { ship_number: 999_999 },
                  _ => Action::Register { nickname: format!("M{seed}"), password: "pwd".into() },
              }
          } else {
              // Err branch is unreachable for ApiEnv (legal_actions never errors);
              // kept for future AgentEnv backends.
              let legal = match env.legal_actions() {
                  Ok(legal) => legal,
                  Err(e) => return Err((failed(&executed), e.to_string())),
              };
              match legal.choose(&mut rng) {
                  Some(a) => a.clone(),
                  // A logged-in env always has at least SetFormation/Refresh
                  // available, so this arm is effectively unreachable; skip the
                  // step rather than fabricate an action.
                  None => continue,
              }
          };
          match env.act(&action) {
              Ok(outcome) => {
                  executed.push(action.clone());
                  // An illegal action that the backend accepted violates the
                  // fuzzer's contract: illegal actions must be rejected.
                  if pick_illegal && outcome.ok {
                      return Err((
                          failed(&executed),
                          format!("illegal action {action:?} was accepted by the backend"),
                      ));
                  }
                  if let Err(why) = check_invariants(&outcome.observation) {
                      return Err((failed(&executed), why));
                  }
              }
              // Err branch is unreachable for ApiEnv (act never errors); kept for
              // future AgentEnv backends.
              Err(e) => {
                  executed.push(action);
                  return Err((failed(&executed), e.to_string()));
              }
          }
      }
      Ok(())
  }
  ```
- [ ] Run: `cargo test -p testkit --test bots`
  Expect: PASS (`baseline_bot_wins_a_battle_within_budget`).
  The baseline targets only the weakest opponent (NPC_Astro's single Falcon). A Hawk beats a Falcon on total damage within roughly 4 steps (work is not needed — 2000 starting credits already buys a Hawk), so the victory is reached well inside the 200-step budget regardless of world seed. If it does not win, this is a real code bug (e.g. `decide` not choosing Buy/Activate/Attack in order, or the battle winner not being recorded) — debug it under TDD; do not paper over it by changing the seed.
- [ ] Commit:
  ```
  git add testkit/src/bots.rs testkit/tests/bots.rs
  git commit -m "Add baseline + monkey bot drivers

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 14 — Monkey soak smoke test

Add a fixed-seed monkey run so the fuzzer is exercised in the fast suite (the long soak runs nightly in CI, Task 19).

**Files:**
- Modify: `testkit/tests/bots.rs`

**Steps:**

- [ ] Append to `testkit/tests/bots.rs`:
  ```rust
  use testkit::bots::run_monkey;

  #[test]
  fn monkey_smoke_no_panic_no_corruption() {
      for seed in [1u64, 2, 3, 4] {
          // run_monkey registers its own player on a fresh env.
          let mut env = ApiEnv::new(Box::new(LocalApi::open_seeded(":memory:", seed).unwrap()));
          if let Err((replay, why)) = run_monkey(&mut env, seed, 300, 0.25) {
              panic!(
                  "monkey found a bug on seed {seed} after {} actions: {why}; replay: {}",
                  replay.actions.len(),
                  serde_json::to_string(&replay).unwrap()
              );
          }
      }
  }

  #[test]
  fn monkey_rejects_pre_registered_env() {
      // run_monkey requires a fresh env so its emitted replay is self-contained
      // (it registers its own player). Passing an already-registered env must
      // fail fast with the documented error — this pins the fresh-env contract.
      let mut env = ApiEnv::new(Box::new(LocalApi::open_seeded(":memory:", 42).unwrap()));
      env.act(&Action::Register { nickname: "Pre".into(), password: "pwd".into() }).unwrap();
      let (_replay, why) = run_monkey(&mut env, 42, 30, 0.25)
          .expect_err("run_monkey should reject an already-registered env");
      assert!(
          why.contains("requires an unregistered env"),
          "expected the unregistered-env error, got: {why}"
      );
  }
  ```
- [ ] Run: `cargo test -p testkit --test bots`
  Expect: PASS (both bot tests).
- [ ] Commit:
  ```
  git add testkit/tests/bots.rs
  git commit -m "Add monkey soak smoke test

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 15 — Scenario runner + scenario files (failing test first)

Scenario files are just `Replay` JSON. The runner globs `testkit/scenarios/*.json`, deserializes each into a `Replay`, and runs it. Write the loader test first.

**Files:**
- Modify: `testkit/src/scenario.rs`
- Create: `testkit/tests/scenarios.rs`

**Steps:**

- [ ] Create `testkit/tests/scenarios.rs`:
  ```rust
  use testkit::scenario::run_all_scenarios;

  #[test]
  fn all_scenario_files_pass() {
      let results = run_all_scenarios("scenarios").expect("scenario dir must load");
      assert!(!results.is_empty(), "expected at least one scenario file");
      // Aggregate every scenario failure instead of aborting on the first.
      let failures: Vec<String> = results.iter()
          .filter_map(|(n, r)| r.as_ref().err().map(|e| format!("{n}: {e}")))
          .collect();
      assert!(failures.is_empty(), "{} scenario(s) failed:\n{}", failures.len(), failures.join("\n"));
  }
  ```
- [ ] Run: `cargo test -p testkit --test scenarios`
  Expect: FAIL to compile (`run_all_scenarios` not found).

---

### Task 16 — Scenario runner + scenario files (implementation)

**Files:**
- Modify: `testkit/src/scenario.rs`
- Create: `testkit/scenarios/campaign.json`, `testkit/scenarios/broke_pilot.json`, `testkit/scenarios/repair_economics.json`

**Steps:**

- [ ] Replace the placeholder `testkit/src/scenario.rs` with:
  ```rust
  //! Load and run scenario files: named `Replay` JSON scripts with end-state
  //! expectations, stored under `testkit/scenarios/`.

  use crate::replay::{run_replay, Replay, ReplayResult};
  use std::fs;
  use std::path::Path;

  /// A scenario file's name paired with the result of running (or loading) it.
  pub type ScenarioOutcome = (String, Result<ReplayResult, String>);

  /// Load every `*.json` file in `dir` (relative to the crate root at test time)
  /// as a [`Replay`] and run it. Returns `(file_name, run_result)` pairs sorted
  /// by file name so output is stable.
  pub fn run_all_scenarios(dir: &str) -> Result<Vec<ScenarioOutcome>, String> {
      let mut paths: Vec<_> = fs::read_dir(Path::new(dir))
          .map_err(|e| format!("read_dir {dir}: {e}"))?
          .filter_map(|e| e.ok().map(|e| e.path()))
          .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
          .collect();
      paths.sort();

      let mut out = Vec::new();
      for path in paths {
          let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("?").to_string();
          // Fold a read failure into this file's Err instead of aborting the run.
          let result = match fs::read_to_string(&path) {
              Ok(text) => match serde_json::from_str::<Replay>(&text) {
                  Ok(replay) => run_replay(&replay),
                  Err(e) => Err(format!("parse {name}: {e}")),
              },
              Err(e) => Err(format!("read {name}: {e}")),
          };
          out.push((name, result));
      }
      Ok(out)
  }
  ```
- [ ] Create `testkit/scenarios/campaign.json` (full loop; starting 2000 credits, buy Falcon → 500, then battle NPC_Astro; we commit `credits` because they are integer-deterministic — start 2000 − Falcon 1500 = 500, and the battle awards nothing because the player loses to NPC_Astro. `state_hash` remains uncommitted for platform reasons — see the `state_hash` NOTE in Task 11):
  ```json
  {
    "seed": 7,
    "actions": [
      { "Register": { "nickname": "Campaigner", "password": "pwd" } },
      { "Buy": { "ship_id": 1 } },
      { "Activate": { "ship_number": 77 } },
      { "Battle": { "opponent_id": 1, "formation": "Aggressive" } }
    ],
    "expect": { "credits": 500, "rank": "Recruit" }
  }
  ```
  NOTE: `opponent_id: 1` is NPC_Astro — NPCs occupy rowids 1–11 and NPC_Astro is the first seeded (rowid 1); the human registered after the 11 NPCs gets id 12. `ship_number: 77` is the human's first purchased ship — `owned_ships.ship_number` is one AUTOINCREMENT across all users and `seed_npcs` inserts 76 NPC ships first, so the player's first ship is number 77. Both assumptions are pinned by the guard tests in Task 17; if either differs there, update these files AND the guard's expected constants.
- [ ] Create `testkit/scenarios/broke_pilot.json` (cover the insufficient-funds rejection the file is named for: buy Falcon (1500) leaves 500, then a second Falcon buy is unaffordable and must be rejected. `tolerate_rejections: true` lets the runner skip that rejected second buy; `credits` stays 500. If the second buy were wrongly accepted, credits would go to −1000 — caught by both the credits mismatch and the negative-credits invariant):
  ```json
  {
    "seed": 11,
    "actions": [
      { "Register": { "nickname": "BrokePilot", "password": "pwd" } },
      { "Buy": { "ship_id": 1 } },
      { "Buy": { "ship_id": 1 } }
    ],
    "tolerate_rejections": true,
    "expect": { "credits": 500, "rank": "Recruit" }
  }
  ```
- [ ] Create `testkit/scenarios/repair_economics.json` (buy, activate, battle, then repair; repair has a 60 s cooldown from `last_repair_at` default 0, so an immediate repair after battle is allowed):
  ```json
  {
    "seed": 7,
    "actions": [
      { "Register": { "nickname": "Mechanic", "password": "pwd" } },
      { "Buy": { "ship_id": 1 } },
      { "Activate": { "ship_number": 77 } },
      { "Battle": { "opponent_id": 1, "formation": "Aggressive" } },
      { "Repair": { "ship_number": 77 } }
    ],
    "expect": { "credits": 500, "rank": "Recruit" }
  }
  ```
  NOTE: `ship_number: 77` is the player's first ship and `opponent_id: 1` is NPC_Astro (see the campaign.json NOTE). This matchup is feasible: against NPC_Astro's single Falcon the player's Falcon survives — neither side can destroy 1000 HP in the 20-round battle cap at roughly 8 damage/round — so the ship is `Owned` (damaged, not `Destroyed`) after the battle and the `Repair` is accepted. If `Repair` is ever rejected as "Destroyed", that is a real regression to debug, not a seed to swap.
- [ ] Run: `cargo test -p testkit --test scenarios`
  Expect: PASS. If a scenario fails, apply the id/seed adjustments in the NOTEs above.
- [ ] Commit:
  ```
  git add testkit/src/scenario.rs testkit/scenarios testkit/tests/scenarios.rs
  git commit -m "Add scenario runner and campaign/broke/repair scenarios

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 17 — Validate opponent ids and finalize scenarios

A quick guard so scenario files use the right opponent id regardless of seeding order.

**Files:**
- Modify: `testkit/tests/scenarios.rs`

**Steps:**

- [ ] Append a small guard test to `testkit/tests/scenarios.rs` pinning both assumptions the scenario files bake in (NPC_Astro's opponent id and the player's first ship_number):
  ```rust
  use network::LocalApi;
  use testkit::env::{Action, AgentEnv, ApiEnv};

  #[test]
  fn npc_astro_is_opponent_id_one() {
      let mut env = ApiEnv::new(Box::new(LocalApi::open_seeded(":memory:", 7).unwrap()));
      env.act(&Action::Register { nickname: "Checker".into(), password: "pwd".into() }).unwrap();
      let obs = env.observe().unwrap();
      let astro = obs.opponents.iter().find(|o| o.nickname == "NPC_Astro")
          .expect("NPC_Astro not found in opponents — scenario files assume this NPC exists");
      assert_eq!(astro.user_id, 1, "scenario files assume NPC_Astro == user_id 1");

      // The player's first purchased ship is ship_number 77 (76 NPC ships seeded
      // first, shared AUTOINCREMENT), which the scenario files also assume.
      env.act(&Action::Buy { ship_id: 1 }).unwrap();
      let snap = env.observe().unwrap().player
          .expect("player snapshot missing after register + buy — scenario files assume a logged-in player");
      assert_eq!(snap.ships[0].ship_number, 77, "scenario files assume first player ship == 77");
  }
  ```
- [ ] Run: `cargo test -p testkit --test scenarios`
  Expect: PASS. If `npc_astro_is_opponent_id_one` fails on either assertion, update BOTH the scenario files (`campaign.json` and `repair_economics.json` — the `opponent_id` and/or `ship_number` values) AND this guard's expected constants (`1` and/or `77`) to the asserted actual values, then re-run.
- [ ] Commit:
  ```
  git add testkit/tests/scenarios.rs
  git commit -m "Guard scenario opponent id assumption

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 18 — proptest invariants in `sim` (failing test first)

Property tests over pure `sim` rules. Cover: no negative HP/credits after battle, ELO zero-sum, `level_for_experience` monotonic, catalog tier/price ordering, formation modifier bounds.

**Files:**
- Modify: `sim/Cargo.toml`
- Create: `sim/tests/invariants.rs`

**Steps:**

- [ ] Add to `sim/Cargo.toml`:
  ```toml
  [dev-dependencies]
  proptest = "1"
  ```
- [ ] Create `sim/tests/invariants.rs`:
  ```rust
  use proptest::prelude::*;
  use rand::rngs::StdRng;
  use rand::SeedableRng;
  use sim::combat::{battle, Combatant};
  use sim::economy;
  use sim::elo::elo_change;
  use sim::rank::{level_for_experience, UserRank};
  use sim::ship::{self, OwnedShip, ShipStatus};
  use sim::user::{Formation, User};

  fn active(name: &str, num: u32) -> OwnedShip {
      let t = ship::template_by_name(name).unwrap();
      let mut s = OwnedShip::from_template(num, &t);
      s.status = ShipStatus::Active;
      s
  }

  fn formation_from_index(which: u8) -> Formation {
      match which % 3 {
          0 => Formation::Defensive,
          1 => Formation::Aggressive,
          _ => Formation::Tactical,
      }
  }

  /// A fleet of `size` active Falcons with distinct ship numbers starting at
  /// `base_num` (so both sides can use non-overlapping numbers).
  fn active_fleet(size: u32, base_num: u32) -> Vec<OwnedShip> {
      (0..size).map(|i| active("Falcon", base_num + i)).collect()
  }

  proptest! {
      // A battle from any seed leaves both players with non-negative credits and
      // every ship with non-negative HP. Both sides start at zero credits so the
      // non-negative-credits assertion actually bites (battle only *adds* credits,
      // so a positive starting balance would mask a wrongful deduction). We fuzz
      // each side's formation and fleet size (1-3 ships) as well as the seed.
      #[test]
      fn battle_never_produces_negative_credits_or_hp(
          seed in any::<u64>(),
          fa in 0u8..3,
          fb in 0u8..3,
          na in 1u32..=3,
          nb in 1u32..=3,
      ) {
          let mut a = User::new(1, "Alice");
          let mut b = User::new(2, "Bob");
          a.currency_value = 0;
          b.currency_value = 0;
          let mut fleet_a = active_fleet(na, 1);
          let mut fleet_b = active_fleet(nb, 100);
          let mut rng = StdRng::seed_from_u64(seed);
          let _ = battle(
              Combatant { user: &mut a, fleet: fleet_a.iter_mut().collect(), formation: formation_from_index(fa) },
              Combatant { user: &mut b, fleet: fleet_b.iter_mut().collect(), formation: formation_from_index(fb) },
              &mut rng,
          ).unwrap();
          prop_assert!(a.currency_value >= 0, "Alice credits went negative: {}", a.currency_value);
          prop_assert!(b.currency_value >= 0, "Bob credits went negative: {}", b.currency_value);
          for s in &fleet_a {
              prop_assert!(s.actual.hp >= 0.0, "Alice ship {} hp negative: {}", s.ship_number, s.actual.hp);
          }
          for s in &fleet_b {
              prop_assert!(s.actual.hp >= 0.0, "Bob ship {} hp negative: {}", s.ship_number, s.actual.hp);
          }
      }

      // ELO transfer sums to (approximately) zero for any ratings.
      #[test]
      fn elo_is_zero_sum(w in 100.0f64..3000.0, l in 100.0f64..3000.0) {
          let (nw, nl) = elo_change(w, l);
          let delta = (nw - w) + (nl - l);
          prop_assert!(delta.abs() < 1e-6, "elo not zero-sum: delta={delta}");
      }

      // level_for_experience is monotonic non-decreasing in experience.
      #[test]
      fn level_is_monotonic(x in 0i64..2_000_000, step in 1i64..100_000) {
          let l0 = level_for_experience(x);
          let l1 = level_for_experience(x + step);
          prop_assert!(l1 >= l0, "level decreased: {l0} -> {l1}");
      }

      // Work income always lands within the advertised range for the rank. We fuzz
      // the rank (via UserRank::ALL) and the RNG seed.
      #[test]
      fn work_income_within_advertised_range(rank_idx in 0usize..11, seed in any::<u64>()) {
          let rank = UserRank::ALL[rank_idx];
          let mut user = User::new(1, "Worker");
          user.rank = rank;
          let (min, max) = economy::work_income_range(rank);
          let (_work, income) = economy::perform_work(&mut user, &mut StdRng::seed_from_u64(seed));
          prop_assert!(
              (min..=max).contains(&income),
              "income {income} out of range [{min}, {max}] for {:?}",
              rank
          );
      }
  }

  // Formation evasion modifier is always within the documented bounds. Only three
  // variants exist, so an exhaustive check is clearer than a proptest.
  #[test]
  fn formation_modifier_bounded() {
      for f in [Formation::Defensive, Formation::Aggressive, Formation::Tactical] {
          let m = f.evasion_modifier();
          assert!((0.9..=1.2).contains(&m), "modifier out of bounds: {m}");
      }
  }

  #[test]
  fn catalog_tiers_do_not_price_below_lower_tiers() {
      // The cheapest ship of each tier is at least as expensive as the most
      // expensive ship of the tier below it (tier/price ordering holds).
      let cat = ship::catalog();
      for tier in 2u8..=6 {
          let min_this = cat.iter().filter(|t| t.tier == tier).map(|t| t.stats.value).fold(f64::INFINITY, f64::min);
          let max_below = cat.iter().filter(|t| t.tier == tier - 1).map(|t| t.stats.value).fold(0.0, f64::max);
          assert!(min_this > max_below, "tier {tier} cheapest {min_this} !> tier {} dearest {max_below}", tier - 1);
      }
  }
  ```
- [ ] Run: `cargo test -p sim --test invariants`
  Expect: PASS. (These describe properties the code already satisfies; they are new coverage, not new behaviour. If `elo_is_zero_sum` fails, that is a real finding — flag it, do not loosen the tolerance beyond `1e-6`.)
- [ ] Commit:
  ```
  git add sim/Cargo.toml sim/tests/invariants.rs
  git commit -m "Add proptest invariants for sim rules

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 19 — Fix `network/tests/integration.rs`: ephemeral port + connect-retry

Replace the fixed port 7811 + 400 ms sleep with a bound-and-report ephemeral port and connect-retry readiness. The server binds `0.0.0.0:0` and we must learn the OS-assigned port; add a helper that binds and returns the port before entering the accept loop.

**Files:**
- Modify: `network/src/server.rs` (add a bound-port helper)
- Modify: `network/tests/integration.rs`

**Steps:**

- [ ] In `network/src/server.rs`, add `use std::sync::mpsc::Sender;` to the top import block. Then add a helper that binds first and reports the port via a channel, then serves. Add after `run_with_db_seeded` (created in Task 5):
  ```rust
  /// Bind an in-memory-DB server on `port` (use 0 for an OS-assigned ephemeral
  /// port), send the actually-bound port back over `ready`, then serve forever.
  /// For tests only: no bot tick, deterministic seed 0. On world-open or bind
  /// failure the error text is sent over `ready` so the test names the real cause.
  #[doc(hidden)]
  pub fn serve_ephemeral_for_test(port: u16, ready: Sender<Result<u16, String>>) {
      let world = match World::open_seeded(":memory:", 0) {
          Ok(w) => Arc::new(Mutex::new(w)),
          Err(e) => {
              let _ = ready.send(Err(format!("test server failed to open world: {}", e)));
              return;
          }
      };
      let listener = match TcpListener::bind(("127.0.0.1", port)) {
          Ok(l) => l,
          Err(e) => {
              let _ = ready.send(Err(format!("test server failed to bind: {}", e)));
              return;
          }
      };
      let bound = listener.local_addr().map(|a| a.port()).unwrap_or(port);
      let _ = ready.send(Ok(bound));
      for stream in listener.incoming() {
          match stream {
              Ok(s) => {
                  let world = Arc::clone(&world);
                  thread::spawn(move || handle_client(s, world));
              }
              Err(e) => warn!("accept error: {}", e),
          }
      }
  }
  ```
- [ ] Replace `network/tests/integration.rs` lines 1-16 (the header through `connect`):
  ```rust
  //! End-to-end test: run a real server in a thread and drive it through the
  //! `RemoteApi` over a TCP socket, exercising the full protocol round-trip.

  use network::{GameApi, RemoteApi};
  use sim::user::Formation;
  use std::sync::mpsc;
  use std::thread;
  use std::time::Duration;

  #[test]
  fn online_register_buy_and_battle_over_tcp() {
      // Bind an ephemeral port and learn it, instead of hard-coding one.
      let (tx, rx) = mpsc::channel();
      thread::spawn(move || network::server::serve_ephemeral_for_test(0, tx));
      let port = rx
          .recv_timeout(Duration::from_secs(5))
          .expect("server sent readiness")
          .expect("server failed to start");

      // Connect with retry until the listener accepts, instead of sleeping.
      let mut api = {
          let addr = format!("127.0.0.1:{port}");
          let mut last_err = String::new();
          let mut connected = None;
          for _ in 0..50 {
              match RemoteApi::connect(&addr) {
                  Ok(c) => {
                      connected = Some(c);
                      break;
                  }
                  Err(e) => {
                      last_err = e;
                      thread::sleep(Duration::from_millis(20));
                  }
              }
          }
          connected.unwrap_or_else(|| panic!("could not connect to {addr}: {last_err}"))
      };
  ```
  (Leave the rest of the test body — from `// Register a fresh pilot.` onward — unchanged.)
- [ ] Run: `cargo test -p network --test integration`
  Expect: PASS (`online_register_buy_and_battle_over_tcp`).
- [ ] Commit:
  ```
  git add network/src/server.rs network/tests/integration.rs
  git commit -m "Use ephemeral port and connect-retry in integration test

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 19b — Run the campaign scenario over the wire

The spec requires the campaign scenario to also run against a real server, not just an in-process `LocalApi`. Reuse the ephemeral-port helper from Task 19: spawn a server thread, connect a `RemoteApi`, wrap it in `ApiEnv`, and drive the same campaign action list. The server world is seeded 0 (fixed inside `serve_ephemeral_for_test`), so we skip seed-dependent expectations (credits/state_hash) and assert only that every action is accepted and the player ends at rank `Recruit`.

**Files:**
- Create: `testkit/tests/wire_campaign.rs`

**Steps:**

- [ ] Create `testkit/tests/wire_campaign.rs`:
  ```rust
  //! The campaign scenario driven over a real TCP server via `RemoteApi`,
  //! mirroring `scenarios/campaign.json` but through the network seam. The server
  //! seed is fixed at 0 inside `serve_ephemeral_for_test`, so we assert only that
  //! every action is accepted and the player finishes at rank Recruit (no
  //! seed-dependent credit/hash expectations).

  use network::server::serve_ephemeral_for_test;
  use network::RemoteApi;
  use sim::user::Formation;
  use std::sync::mpsc;
  use std::thread;
  use std::time::Duration;
  use testkit::env::{Action, AgentEnv, ApiEnv};

  #[test]
  fn campaign_scenario_runs_over_the_wire() {
      // Bind an ephemeral port and learn it.
      let (tx, rx) = mpsc::channel();
      thread::spawn(move || serve_ephemeral_for_test(0, tx));
      let port = rx
          .recv_timeout(Duration::from_secs(5))
          .expect("server sent readiness")
          .expect("server failed to start");

      // Connect with retry.
      let addr = format!("127.0.0.1:{port}");
      let mut remote = None;
      let mut last_err = String::new();
      for _ in 0..50 {
          match RemoteApi::connect(&addr) {
              Ok(c) => {
                  remote = Some(c);
                  break;
              }
              Err(e) => {
                  last_err = e;
                  thread::sleep(Duration::from_millis(20));
              }
          }
      }
      let remote = remote.unwrap_or_else(|| panic!("could not connect to {addr}: {last_err}"));

      let mut env = ApiEnv::new(Box::new(remote));

      // Same action list as scenarios/campaign.json. ship_number 77 / opponent_id
      // 1 hold on a fresh server world just as they do in-process.
      let actions = [
          Action::Register { nickname: "WireCampaigner".into(), password: "pwd".into() },
          Action::Buy { ship_id: 1 },
          Action::Activate { ship_number: 77 },
          Action::Battle { opponent_id: 1, formation: Formation::Aggressive },
      ];
      for (i, action) in actions.iter().enumerate() {
          let out = env.act(action).expect("env act must not error");
          assert!(out.ok, "action {i} ({action:?}) rejected: {}", out.status);
      }

      let player = env.observe().unwrap().player.expect("player after campaign");
      assert_eq!(player.user.rank.title(), "Recruit");
  }
  ```
- [ ] Run: `cargo test -p testkit --test wire_campaign`
  Expect: PASS (`campaign_scenario_runs_over_the_wire`).
- [ ] Commit:
  ```
  git add testkit/tests/wire_campaign.rs
  git commit -m "Run campaign scenario over the wire via RemoteApi

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 20 — CI: nextest PR jobs + nightly monkey soak

Add a new workflow. PR jobs run `cargo nextest run` on ubuntu + windows over the logic crates (`sim`, `network`, `testkit`); a nightly job runs a longer monkey soak and uploads any failing replay files as artifacts. The existing `release.yml` is untouched.

**Files:**
- Create: `.config/nextest.toml` (per-test timeout so a hung test is killed, per spec)
- Create: `.github/workflows/ci.yml`
- Create: `testkit/tests/soak.rs` (the long, `#[ignore]`d soak driver the nightly job runs)

**Steps:**

- [ ] Create `.config/nextest.toml` (per-test slow-timeout with terminate-after, so any test hung past 60 s is killed after 3 intervals; the spec requires nextest per-test timeouts):
  ```toml
  [profile.default]
  slow-timeout = { period = "60s", terminate-after = 3 }

  [[profile.default.overrides]]
  filter = 'test(monkey_soak_10k_x_8)'
  slow-timeout = { period = "300s", terminate-after = 12 }  # 60-min ceiling for the nightly soak
  ```
- [ ] Verify the timeout config is picked up: `cargo nextest run -p testkit --test env`
  Expect: PASS (nextest loads `.config/nextest.toml` from the repo root; no config-parse error, all env tests green).
- [ ] Create `testkit/tests/soak.rs` (ignored by default so it never runs in the fast PR suite; the nightly job runs it with `--ignored`; on panic it writes the failing replay seed to `target/soak-failures/`):
  ```rust
  //! Long monkey soak: 10k steps across 8 seeds. Ignored by default; the nightly
  //! CI job runs it with `--ignored`. On any invariant violation the returned
  //! `Replay` (seed + the exact action list that triggered it) is written as a
  //! real, replayable JSON file under target/soak-failures/ for artifact upload.

  use network::LocalApi;
  use testkit::bots::run_monkey;
  use testkit::env::ApiEnv;

  #[test]
  #[ignore = "long soak; run in nightly CI with --ignored"]
  fn monkey_soak_10k_x_8() {
      std::fs::create_dir_all("target/soak-failures").ok();
      for seed in 0u64..8 {
          let mut env = ApiEnv::new(Box::new(LocalApi::open_seeded(":memory:", seed).unwrap()));
          // run_monkey registers its own player on a fresh env.
          if let Err((replay, why)) = run_monkey(&mut env, seed, 10_000, 0.2) {
              let path = format!("target/soak-failures/seed-{seed}.json");
              let json = serde_json::to_string_pretty(&replay)
                  .unwrap_or_else(|e| format!("{{\"seed\": {seed}, \"error\": \"serialize replay: {e}\"}}"));
              let wrote_replay = std::fs::write(&path, json)
                  .map_err(|e| eprintln!("failed to write {path}: {e}"))
                  .is_ok();
              // Record the failure description next to the replay for triage.
              let why_path = format!("target/soak-failures/seed-{seed}.why.txt");
              std::fs::write(&why_path, &why)
                  .unwrap_or_else(|e| eprintln!("failed to write {why_path}: {e}"));
              let wrote_note = if wrote_replay {
                  format!("wrote replayable {path}")
              } else {
                  format!("FAILED to write replay to {path}")
              };
              panic!(
                  "monkey soak failed on seed {seed} after {} actions: {why}; {wrote_note}",
                  replay.actions.len()
              );
          }
      }
  }
  ```
- [ ] Create `.github/workflows/ci.yml`:
  ```yaml
  name: CI

  on:
    pull_request:
    workflow_dispatch:
    schedule:
      - cron: "0 6 * * *" # nightly soak at 06:00 UTC

  jobs:
    # ── PR: Ubuntu logic tests via nextest ───────────────────────────────────
    test-ubuntu:
      name: Tests — Ubuntu
      if: github.event_name != 'schedule'
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: dtolnay/rust-toolchain@stable
        - uses: Swatinem/rust-cache@v2
        - uses: taiki-e/install-action@nextest
        - name: nextest (sim, network, testkit)
          run: cargo nextest run -p sim -p network -p testkit

    # ── PR: Windows logic tests via nextest ──────────────────────────────────
    test-windows:
      name: Tests — Windows
      if: github.event_name != 'schedule'
      runs-on: windows-latest
      steps:
        - uses: actions/checkout@v4
        - uses: dtolnay/rust-toolchain@stable
        - uses: Swatinem/rust-cache@v2
        - uses: taiki-e/install-action@nextest
        - name: nextest (sim, network, testkit)
          run: cargo nextest run -p sim -p network -p testkit

    # ── Nightly: long monkey soak, failing replays uploaded ──────────────────
    soak:
      name: Nightly monkey soak
      if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: dtolnay/rust-toolchain@stable
        - uses: Swatinem/rust-cache@v2
        - uses: taiki-e/install-action@nextest
        - name: Monkey soak (10k x 8 seeds)
          run: cargo nextest run -p testkit --run-ignored ignored-only monkey_soak_10k_x_8
        - name: Upload failing replay files
          if: failure()
          uses: actions/upload-artifact@v4
          with:
            name: soak-failures
            path: testkit/target/soak-failures/
            if-no-files-found: warn
  ```
- [ ] Verify locally that nextest is installed, then run the fast suite the PR jobs run:
  `cargo nextest run -p sim -p network -p testkit`
  Expect: PASS (all logic tests green; the `#[ignore]`d soak is skipped). If `cargo-nextest` is not installed locally, install with `cargo install cargo-nextest --locked` first, or fall back to `cargo test -p sim -p network -p testkit` to validate the tests pass (the YAML still uses nextest in CI).
- [ ] Verify the soak driver runs (short, local sanity): `cargo test -p testkit --test soak -- --ignored`
  Expect: PASS (may take a minute; 8 × 10k steps).
- [ ] Commit:
  ```
  git add .config/nextest.toml .github/workflows/ci.yml testkit/tests/soak.rs
  git commit -m "Add nextest CI jobs, per-test timeout, and nightly monkey soak

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 21 — Final full-suite verification

- [ ] Run the whole workspace: `cargo test`
  Expect: PASS (all crates: sim, network, game build, testkit).
- [ ] Run: `cargo build --no-default-features`
  Expect: PASS (headless server build).
- [ ] Confirm no stray placeholder modules remain: every file under `testkit/src/` has real content (env, replay, bots, scenario), and `testkit/src/lib.rs` re-exports all four.
- [ ] If anything fails, fix under TDD (add/adjust a failing test, then the fix) and commit before proceeding. Do not leave the tree red.

---

## Self-review checklist (run after all tasks)

- [ ] `Action`/`Observation`/`ActionOutcome`/`EnvError`/`View` spelled identically in `env.rs`, `replay.rs`, `bots.rs`, and every test.
- [ ] No `TBD`, `similar to`, or "add error handling" placeholders remain in any task's code.
- [ ] `open_seeded` exists on both `World` and `LocalApi`, and the two `from_entropy` battle/work sites are gone (only the server bot-tick `from_entropy` at `server.rs:157` remains, which is intentional and untouched by this phase).
- [ ] Spec Phase-1 items all covered: seedable World, `--seed` flags, AgentEnv/ApiEnv + legal_actions, replay + state_hash, baseline + monkey bots, scenario files, over-the-wire campaign test, proptest suite, ephemeral-port integration test, nextest CI (ubuntu + windows + per-test timeout + nightly soak with replay artifacts).
- [ ] `state_hash` hashes the time-free `HashView { user, ships }`, NOT the full `PlayerSnapshot` (no wall-clock cooldown fields), and committed hashes are captured on the Linux CI leg.
- [ ] Scenario/guard IDs consistent everywhere: NPC_Astro is `opponent_id: 1`, the player's first ship is `ship_number: 77`; the guard test `npc_astro_is_opponent_id_one` pins both.
- [ ] `run_monkey` returns `Result<(), (Replay, String)>` and registers its own player on a fresh env (rejecting an already-registered env); both callers (smoke test, soak) destructure and write/print the returned replay plus its failure description on failure; the soak artifact is a real replay JSON, never an empty stub.
```

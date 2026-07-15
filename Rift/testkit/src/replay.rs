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
    /// Curated scenario files usually leave this false so unexpected rejections
    /// fail loudly; set it deliberately when a scenario intends to exercise
    /// rejection paths.
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
/// After each accepted action the runner re-checks [`check_invariants`] (in both
/// tolerant and strict modes) so a recorded invariant violation reproduces
/// instead of slipping through; in tolerant mode rejected actions are skipped
/// before the check, so corruption surfaces at the next accepted step. On a
/// rejected action (`ok == false`): if `tolerate_rejections` is set the
/// rejection is recorded history and the runner continues; otherwise it aborts.
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

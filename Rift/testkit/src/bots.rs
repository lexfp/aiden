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
                Action::Battle { opponent_id, formation: player.user.default_formation, boarding: None }
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
/// The illegal pool mixes fixed id-based shapes (unaffordable/zero buy,
/// nonexistent-opponent/zero-opponent battle, bogus sell/deactivate, duplicate
/// self-Register, wrong-password login) with observation-derived *stateful*
/// shapes built from the latest snapshot:
/// - **double-sell:** sell an owned/active ship (accepted), then sell the same
///   `ship_number` again (rejected — already sold).
/// - **repair-while-on-cooldown:** repair an owned/active ship (accepted, stamps
///   `last_repair_at`), then repair the same ship again (rejected by the 60s
///   shipyard cooldown).
/// - **activate-beyond-max:** activate a reserve ship while already at
///   `max_active_ships` (rejected).
///
/// If a stateful shape's precondition is absent (no owned ship, not at cap, or
/// the first accepted action was unexpectedly rejected), the step falls back to
/// a reliably-illegal id-based shape so it still exercises a rejection.
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
            // opponent 0, deactivate a nonexistent ship number, a duplicate
            // Register of our own nickname, a wrong-password login, and the
            // observation-derived stateful shapes double-sell,
            // repair-while-on-cooldown, and activate-beyond-max).
            let obs = match env.observe() {
                Ok(o) => o,
                Err(e) => return Err((failed(&executed), e.to_string())),
            };
            let ships = obs.player.as_ref().map(|p| p.ships.clone()).unwrap_or_default();
            let at_max = obs.player.as_ref().is_some_and(|p| p.active_count >= p.max_active_ships);
            match rng.gen_range(0..11) {
                0 => Action::Buy { ship_id: 999 },
                1 => Action::Battle { opponent_id: 999_999, formation: sim::user::Formation::Aggressive, boarding: None },
                2 => Action::Sell { ship_number: 999_999 },
                3 => Action::Buy { ship_id: 0 },
                4 => Action::Battle { opponent_id: 0, formation: sim::user::Formation::Aggressive, boarding: None },
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
                                    // A setup action must not itself break an invariant.
                                    if let Err(why) = check_invariants(&o.observation) {
                                        return Err((failed(&executed), why));
                                    }
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
                                    // A setup action must not itself break an invariant.
                                    if let Err(why) = check_invariants(&o.observation) {
                                        return Err((failed(&executed), why));
                                    }
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

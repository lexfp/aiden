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

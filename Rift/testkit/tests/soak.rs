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

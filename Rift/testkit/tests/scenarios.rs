use network::LocalApi;
use testkit::env::{Action, AgentEnv, ApiEnv};
use testkit::scenario::run_all_scenarios;

#[test]
fn all_scenario_files_pass() {
    let results = run_all_scenarios("scenarios").expect("scenario dir must load");
    assert!(!results.is_empty(), "expected at least one scenario file");
    let failures: Vec<String> = results.iter()
        .filter_map(|(n, r)| r.as_ref().err().map(|e| format!("{n}: {e}")))
        .collect();
    assert!(failures.is_empty(), "{} scenario(s) failed:\n{}", failures.len(), failures.join("\n"));
}

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

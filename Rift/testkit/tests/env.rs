use sim::user::Formation;
use testkit::env::{Action, View};

#[test]
fn action_deserializes_from_replay_json() {
    // Replay JSON must round-trip back into Actions using the same wire vocabulary.
    let a: Action = serde_json::from_str(r#"{"Register":{"nickname":"T","password":"pw"}}"#).unwrap();
    assert_eq!(a, Action::Register { nickname: "T".into(), password: "pw".into() });
    let b: Action = serde_json::from_str(r#"{"SetFormation":"Tactical"}"#).unwrap();
    assert_eq!(b, Action::SetFormation(Formation::Tactical));
}

#[test]
fn action_serializes_to_expected_json() {
    // Externally-tagged serde: the spec's replay JSON uses these exact shapes.
    assert_eq!(serde_json::to_string(&Action::Work).unwrap(), "\"Work\"");
    assert_eq!(
        serde_json::to_string(&Action::Buy { ship_id: 3 }).unwrap(),
        "{\"Buy\":{\"ship_id\":3}}"
    );
    assert_eq!(
        serde_json::to_string(&Action::Battle { opponent_id: 5, formation: Formation::Aggressive, boarding: None })
            .unwrap(),
        "{\"Battle\":{\"opponent_id\":5,\"formation\":\"Aggressive\",\"boarding\":null}}"
    );
    // Replay JSON recorded before boarding existed still deserializes.
    let old: Action =
        serde_json::from_str("{\"Battle\":{\"opponent_id\":5,\"formation\":\"Aggressive\"}}").unwrap();
    assert_eq!(old, Action::Battle { opponent_id: 5, formation: Formation::Aggressive, boarding: None });
    assert_eq!(serde_json::to_string(&Action::Refresh(View::Leaderboard)).unwrap(), "{\"Refresh\":\"Leaderboard\"}");
}

use network::LocalApi;
use testkit::env::{ActionOutcome, AgentEnv, ApiEnv};

fn seeded_env() -> ApiEnv {
    ApiEnv::new(Box::new(LocalApi::open_seeded(":memory:", 7).unwrap()))
}

#[test]
fn fresh_player_can_only_work_or_refresh_or_set_formation() {
    let mut env = seeded_env();
    // Logged out: no actions are advertised until the caller registers/logs in.
    assert!(env.legal_actions().unwrap().is_empty());
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

#[test]
fn work_disappears_from_legal_actions_after_working() {
    let mut env = seeded_env();
    env.act(&Action::Register { nickname: "T".into(), password: "pwd".into() }).unwrap();
    // Work is legal before the cooldown starts.
    assert!(env.legal_actions().unwrap().contains(&Action::Work));
    let out = env.act(&Action::Work).unwrap();
    assert!(out.ok, "work should succeed: {}", out.status);
    // Cooldown is now active, so Work is no longer advertised.
    assert!(!env.legal_actions().unwrap().contains(&Action::Work));
}

#[test]
fn illegal_act_returns_ok_false_with_observation() {
    let mut env = seeded_env();
    env.act(&Action::Register { nickname: "T".into(), password: "pwd".into() }).unwrap();
    let out = env.act(&Action::Buy { ship_id: 999 }).unwrap();
    // Rejected by the backend, but still returns a well-formed observation.
    assert!(!out.ok);
    assert!(out.observation.player.is_some());
    assert!(!out.status.is_empty(), "status should carry the backend message");
}

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

#[test]
fn replay_json_round_trips() {
    // Full form: expect present, tolerate_rejections omitted → default false.
    let json = r#"{"seed":7,"actions":["Work",{"Buy":{"ship_id":1}}],"expect":{"rank":"Recruit"}}"#;
    let replay: Replay = serde_json::from_str(json).unwrap();
    assert_eq!(replay.seed, 7);
    assert_eq!(replay.actions, vec![Action::Work, Action::Buy { ship_id: 1 }]);
    assert_eq!(replay.expect.rank.as_deref(), Some("Recruit"));
    assert_eq!(replay.expect.credits, None);
    assert!(!replay.tolerate_rejections);

    // Serialize → re-parse → structurally equal.
    let reserialized = serde_json::to_string(&replay).unwrap();
    let round_tripped: Replay = serde_json::from_str(&reserialized).unwrap();
    assert_eq!(round_tripped.seed, replay.seed);
    assert_eq!(round_tripped.actions, replay.actions);
    assert_eq!(round_tripped.expect.rank, replay.expect.rank);
    assert_eq!(round_tripped.expect.credits, replay.expect.credits);
    assert_eq!(round_tripped.expect.state_hash, replay.expect.state_hash);
    assert_eq!(round_tripped.tolerate_rejections, replay.tolerate_rejections);

    // Minimal form: expect omitted → defaults.
    let minimal: Replay = serde_json::from_str(r#"{"seed":7,"actions":["Work"]}"#).unwrap();
    assert_eq!(minimal.seed, 7);
    assert_eq!(minimal.actions, vec![Action::Work]);
    assert_eq!(minimal.expect.credits, None);
    assert_eq!(minimal.expect.rank, None);
    assert_eq!(minimal.expect.state_hash, None);
    assert!(!minimal.tolerate_rejections);
}

#[test]
fn replay_expect_unknown_field_fails_parse() {
    // A typo'd expectation key must fail parse rather than pass vacuously.
    let json = r#"{"seed":7,"actions":[],"expect":{"credit":1}}"#;
    let parsed: Result<Replay, _> = serde_json::from_str(json);
    assert!(parsed.is_err(), "unknown expect field should fail to parse: {parsed:?}");
}

#[test]
fn replay_state_hash_self_referential() {
    // Run a replay, then feed its own hash back as an expectation → passes.
    let replay = Replay {
        seed: 42,
        actions: vec![Action::Register { nickname: "R".into(), password: "pwd".into() }],
        expect: Expect::default(),
        tolerate_rejections: false,
    };
    let result = run_replay(&replay).unwrap();

    let matching = Replay {
        expect: Expect { state_hash: Some(result.state_hash.clone()), ..Expect::default() },
        ..replay.clone()
    };
    assert!(run_replay(&matching).is_ok(), "self-referential state_hash should match");

    // Mutate one hex char → fails with a message naming state_hash.
    let mut bad = result.state_hash.clone();
    let first = bad.remove(0);
    let flipped = if first == '0' { '1' } else { '0' };
    bad.insert(0, flipped);
    let mismatch = Replay {
        expect: Expect { state_hash: Some(bad), ..Expect::default() },
        ..replay.clone()
    };
    let err = run_replay(&mismatch).unwrap_err();
    assert!(err.contains("state_hash"), "error should mention state_hash: {err}");

    // A rank mismatch (expect Admiral on a fresh recruit) fails naming rank.
    let rank_mismatch = Replay {
        expect: Expect { rank: Some("Admiral".into()), ..Expect::default() },
        ..replay.clone()
    };
    let rank_err = run_replay(&rank_mismatch).unwrap_err();
    assert!(rank_err.contains("rank"), "error should mention rank: {rank_err}");
}

#[test]
fn tolerant_replay_skips_rejections() {
    // Register, then an illegal Buy{999} (rejected), then a legal Buy{1}.
    // Work has a cooldown, so we sandwich the rejection with buys instead.
    let actions = vec![
        Action::Register { nickname: "R".into(), password: "pwd".into() },
        Action::Buy { ship_id: 999 }, // illegal: no such catalog ship
        Action::Buy { ship_id: 1 },   // legal: Falcon, affordable from 2000 credits
    ];

    // Tolerant: the rejection is recorded history; the replay completes.
    let tolerant = Replay {
        seed: 7,
        actions: actions.clone(),
        expect: Expect::default(),
        tolerate_rejections: true,
    };
    assert!(run_replay(&tolerant).is_ok(), "tolerant replay should skip the rejection");

    // Strict: the same file errors, naming the rejection.
    let strict = Replay {
        seed: 7,
        actions,
        expect: Expect::default(),
        tolerate_rejections: false,
    };
    let err = run_replay(&strict).unwrap_err();
    assert!(err.contains("rejected"), "strict replay should report the rejection: {err}");
}

#[test]
fn observe_errors_when_logged_in_snapshot_fails() {
    // A backend that reports "logged in" to ApiEnv (via a successful register)
    // but whose snapshot() then fails must surface EnvError::Backend, not an
    // empty logged-out observation.
    use testkit::env::{AgentEnv, ApiEnv, EnvError};
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
        fn upgrade_defense(&mut self) -> Result<network::PlayerSnapshot, String> { Err("x".into()) }
        fn work(&mut self) -> Result<(String, i64, network::PlayerSnapshot), String> { Err("x".into()) }
        fn opponents(&mut self) -> Result<Vec<network::OpponentInfo>, String> { Ok(vec![]) }
        fn battle(&mut self, _: u32, _: sim::user::Formation, _: Option<sim::BoardingOutcome>) -> Result<(network::BattleResultDto, network::PlayerSnapshot), String> { Err("x".into()) }
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

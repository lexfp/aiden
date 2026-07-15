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
        Action::Battle { opponent_id: 1, formation: Formation::Aggressive, boarding: None },
    ];
    for (i, action) in actions.iter().enumerate() {
        let out = env.act(action).expect("env act must not error");
        assert!(out.ok, "action {i} ({action:?}) rejected: {}", out.status);
    }

    let player = env.observe().unwrap().player.expect("player after campaign");
    assert_eq!(player.user.rank.title(), "Recruit");
}

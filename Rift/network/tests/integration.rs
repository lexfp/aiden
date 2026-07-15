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

    // Register a fresh pilot.
    let snap = api.register("Ace", "hunter2").expect("register");
    assert_eq!(snap.user.currency_value, 2000);
    assert_eq!(snap.user.nickname, "Ace");

    // Buy and activate a Falcon.
    let falcon = sim::ship::template_by_name("Falcon").unwrap();
    let snap = api.buy(falcon.ship_id).expect("buy");
    assert_eq!(snap.user.currency_value, 500);
    let ship_number = snap.ships[0].ship_number;
    let snap = api.activate(ship_number).expect("activate");
    assert_eq!(snap.active_count, 1);

    // The NPCs should be available as opponents.
    let opponents = api.opponents().expect("opponents");
    let astro = opponents.iter().find(|o| o.nickname == "NPC_Astro").expect("NPC_Astro present");

    // Fight, then confirm the battle was recorded.
    let (result, _snap) = api.battle(astro.user_id, Formation::Aggressive, None).expect("battle");
    assert_eq!(result.opponent_nickname, "NPC_Astro");
    assert!(!result.log.is_empty());

    // Fight again with a boarding outcome: the raid lines appear in the log,
    // round-tripped over the live TCP connection.
    let raid = sim::BoardingOutcome {
        destroyed: vec![sim::Subsystem::ReactorCore],
        duration_secs: 42.0,
        extracted: true,
    };
    let (result, _snap) =
        api.battle(astro.user_id, Formation::Aggressive, Some(raid)).expect("boarded battle");
    assert!(
        result.log.iter().any(|l| l.contains("Boarding raid")),
        "boarding log lines must survive the wire: {:?}",
        result.log
    );

    let history = api.history().expect("history");
    assert_eq!(history.len(), 2); // the plain battle and the boarded battle

    // The leaderboard includes us and the NPCs.
    let lb = api.leaderboard().expect("leaderboard");
    assert!(lb.iter().any(|e| e.nickname == "Ace"));
    assert!(lb.len() >= 2);
}

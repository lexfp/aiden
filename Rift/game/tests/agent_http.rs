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
        let verbs = if obs.player.is_some() {
            vec!["RefreshPlayer".to_string()]
        } else {
            vec![]
        };
        Ok(StateReport {
            ui: UiState {
                screen: screen.into(),
                selected_opponent: None,
                fleet_travel: None,
                battle_animating: false,
                battle_finished: false,
                boarding: None,
                available_ui_verbs: verbs,
            },
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
            if out.ok {
                self.recorded.lock().unwrap().push(a.clone());
            }
        }
        self.state().map_err(ActError::Bridge)
    }
    fn wait_idle(&self, _t: u64) -> Result<bool, String> {
        Ok(true)
    }
    fn replay(&self) -> Result<testkit::replay::Replay, String> {
        Ok(testkit::replay::Replay {
            seed: self.seed,
            actions: self.recorded.lock().unwrap().clone(),
            expect: Default::default(),
            tolerate_rejections: true,
        })
    }
    fn screenshot(&self) -> Result<Option<Vec<u8>>, String> {
        Ok(None)
    }
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
    std::thread::spawn(move || {
        let _ = agent_mode::serve(bridge, 0, Some(tx));
    });
    let port = rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
    let mut env = HttpEnv::new(format!("http://127.0.0.1:{port}"));

    // Register → Work → Buy → Activate, asserting observations each step.
    let out = env
        .act(&Action::Register { nickname: "Campaigner".into(), password: "pwd".into() })
        .unwrap();
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

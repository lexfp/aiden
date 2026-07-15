//! Localhost-only HTTP control surface for live agent play. Compiled only with
//! the `agent` feature and inert unless `--agent-mode` is passed at runtime.
//! The HTTP thread talks to the game exclusively through an [`AgentBridge`];
//! it never touches `network::GameApi` directly.

use serde::{Deserialize, Serialize};

/// The seam between the HTTP layer and the game. The HTTP thread only ever
/// holds a `Box<dyn AgentBridge>` and never touches `GameApi` directly.
pub trait AgentBridge: Send {
    /// Current observation + live UI state. Blocks only as long as the handoff needs.
    fn state(&self) -> Result<StateReport, String>;
    /// Legal core actions derived from the current observation (advisory).
    fn actions(&self) -> Result<Vec<testkit::env::Action>, String>;
    /// Execute one UiCommand; returns the resulting StateReport (post-action).
    /// Errors distinguish a game-rule rejection ([`ActError::Rejected`], a 400)
    /// from a transport/bridge failure ([`ActError::Bridge`], a 5xx).
    fn act(&self, cmd: UiCommand) -> Result<StateReport, ActError>;
    /// Block until no scene/travel is animating, or `timeout_ms` elapses.
    /// Returns true if idle, false on timeout.
    fn wait_idle(&self, timeout_ms: u64) -> Result<bool, String>;
    /// The session's recorded CORE actions as a Phase-1 Replay.
    fn replay(&self) -> Result<testkit::replay::Replay, String>;
    /// A PNG of the current frame, or None if the backend cannot render one
    /// (the headless test bridge). One-frame latency for ChannelBridge.
    fn screenshot(&self) -> Result<Option<Vec<u8>>, String>;
}

/// Failure classes for [`AgentBridge::act`]. `Rejected` is a game-rule refusal
/// (the app called `error(msg)` → a client 400); `Bridge` is a transport failure
/// (game thread gone, timed out, or a malformed reply → a server 5xx). An
/// unattended agent must be able to tell "my command was invalid" from "the game
/// backend is unreachable".
#[derive(Debug)]
pub enum ActError {
    Rejected(String),
    Bridge(String),
}

/// Sent from the HTTP thread into `RiftApp::update()`'s drain. Crosses an mpsc
/// channel (not JSON), so only `Debug` is derived.
#[derive(Debug)]
pub enum AgentRequest {
    State,
    Actions,
    Act(UiCommand),
    Replay,
    Screenshot, // triggers ViewportCommand::Screenshot; reply is deferred one frame
}

/// The reply to an [`AgentRequest`], sent back over a per-call mpsc channel.
// Variants differ in size (StateReport is large), but the shape is pinned:
// mpsc-only, a few messages per HTTP call, so boxing buys nothing here.
#[allow(clippy::large_enum_variant)]
#[derive(Debug)]
pub enum AgentResponse {
    State(StateReport),
    Actions(Vec<testkit::env::Action>),
    Replay(testkit::replay::Replay),
    Screenshot(Option<Vec<u8>>),
    Err(String),
}

/// The `/act` payload: either a core testkit action executed through `RiftApp`'s
/// own code paths, or a UI-only verb.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum UiCommand {
    /// A core testkit action executed through RiftApp's own code paths.
    /// `Battle{..}` is NOT accepted here and returns an error.
    Core(testkit::env::Action),
    Goto(String), // screen name, e.g. "Galaxy"
    SelectOpponent { user_id: u32 },
    LaunchFleet {
        user_id: u32,
        instant: bool,
        /// Board the enemy flagship on arrival (defaults off so pre-boarding
        /// agent scripts keep working unchanged).
        #[serde(default)]
        board: bool,
    },
    RecallFleet,
    SkipBattleAnimation,
    ContinueAfterBattle,
    /// Resolve the in-progress boarding raid headlessly (no GL, no real-time
    /// input): the given subsystems count as destroyed and the battle fires.
    ResolveBoarding { destroyed: Vec<sim::Subsystem>, extracted: bool },
    /// Teleport the raid camera (debug/screenshot framing).
    BoardingSetPose { x: f32, y: f32, z: f32, yaw: f32, pitch: f32 },
    /// Re-fetch the player snapshot (backend.snapshot() → apply_snapshot) so
    /// time-based fields like work_cooldown_remaining decay without a mutating
    /// action. UI-only; not recorded.
    RefreshPlayer,
}

/// The `GET /state` / post-`/act` payload: an observation plus live UI state.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StateReport {
    pub observation: testkit::env::Observation, // same shape as testkit, built from RiftApp caches
    pub ui: UiState,
}

/// Live UI state that is not part of the core observation.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UiState {
    pub screen: String, // Screen::name()
    pub selected_opponent: Option<u32>,
    pub fleet_travel: Option<FleetTravelState>, // {target_id,target_name,elapsed,duration,remaining} | null
    pub battle_animating: bool,                 // battle_scene present && !finished
    pub battle_finished: bool,                  // battle_scene present && finished
    /// Present while a boarding raid is on screen.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub boarding: Option<BoardingState>,
    /// UI verbs currently applicable (not core Actions, so absent from /actions).
    /// Includes "RefreshPlayer" when logged in, "RecallFleet" while a fleet is in
    /// transit, "SkipBattleAnimation"/"ContinueAfterBattle" during/after a battle.
    pub available_ui_verbs: Vec<String>,
}

/// Live boarding-raid state for `/state`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BoardingState {
    pub phase: String, // "Briefing" | "Active" | "Complete"
    pub time_remaining: f32,
    pub player_hp: f32,
    pub destroyed: Vec<String>,
    pub pos: [f32; 3],
}

/// A fleet in transit toward an opponent's system.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FleetTravelState {
    pub target_id: u32,
    pub target_name: String,
    pub elapsed: f32,
    pub duration: f32,
    pub remaining: f32,
}

use std::sync::mpsc::Sender;

/// One queued request plus the channel to answer it on.
pub type AgentCall = (AgentRequest, Sender<AgentResponse>);

/// Production bridge: forwards requests into `RiftApp::update()`'s drain and
/// wakes the reactive loop via a cloned egui::Context.
pub struct ChannelBridge {
    tx: Sender<AgentCall>,
    ctx: eframe::egui::Context,
}

impl ChannelBridge {
    pub fn new(tx: Sender<AgentCall>, ctx: eframe::egui::Context) -> Self {
        ChannelBridge { tx, ctx }
    }

    /// Send one request, wake the UI, and block up to 10s for the reply.
    fn call(&self, req: AgentRequest) -> Result<AgentResponse, String> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.tx.send((req, reply_tx)).map_err(|_| "game thread gone".to_string())?;
        self.ctx.request_repaint();
        reply_rx
            .recv_timeout(std::time::Duration::from_secs(10))
            .map_err(|_| "timed out waiting for the game thread (hung app?)".to_string())
    }
}

impl AgentBridge for ChannelBridge {
    fn state(&self) -> Result<StateReport, String> {
        match self.call(AgentRequest::State)? {
            AgentResponse::State(s) => Ok(s),
            AgentResponse::Err(e) => Err(e),
            _ => Err("bad reply".into()),
        }
    }
    fn actions(&self) -> Result<Vec<testkit::env::Action>, String> {
        match self.call(AgentRequest::Actions)? {
            AgentResponse::Actions(a) => Ok(a),
            AgentResponse::Err(e) => Err(e),
            _ => Err("bad reply".into()),
        }
    }
    fn act(&self, cmd: UiCommand) -> Result<StateReport, ActError> {
        // call()'s Err is always a transport failure (game thread gone / timeout).
        match self.call(AgentRequest::Act(cmd)).map_err(ActError::Bridge)? {
            AgentResponse::State(s) => Ok(s),
            AgentResponse::Err(e) => Err(ActError::Rejected(e)),
            _ => Err(ActError::Bridge("bad reply".into())),
        }
    }
    fn wait_idle(&self, timeout_ms: u64) -> Result<bool, String> {
        // Poll /state's animation flags on this side; the UI thread answers State fast.
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
        loop {
            let s = self.state()?;
            if !s.ui.battle_animating && s.ui.fleet_travel.is_none() {
                return Ok(true);
            }
            if std::time::Instant::now() >= deadline {
                return Ok(false);
            }
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
    }
    fn replay(&self) -> Result<testkit::replay::Replay, String> {
        match self.call(AgentRequest::Replay)? {
            AgentResponse::Replay(r) => Ok(r),
            AgentResponse::Err(e) => Err(e),
            _ => Err("bad reply".into()),
        }
    }
    fn screenshot(&self) -> Result<Option<Vec<u8>>, String> {
        match self.call(AgentRequest::Screenshot)? {
            AgentResponse::Screenshot(s) => Ok(s),
            AgentResponse::Err(e) => Err(e),
            _ => Err("bad reply".into()),
        }
    }
}

/// Run the localhost HTTP control server on `127.0.0.1:port` (port 0 = OS
/// picks one). If `port_report` is given, the bound port is sent once bound.
/// Blocks, serving requests, until the process exits.
///
/// Sequential single-client server: one in-flight request at a time; `/idle`
/// long-polls block all other requests while they wait. Point one agent at it;
/// don't multiplex several clients onto the same port.
pub fn serve(bridge: Box<dyn AgentBridge>, port: u16, port_report: Option<Sender<u16>>) -> Result<(), String> {
    let server = tiny_http::Server::http(("127.0.0.1", port))
        .map_err(|e| format!("agent server: could not bind 127.0.0.1:{port}: {e}"))?;
    // tiny_http 0.12: server_addr() -> ListenAddr; to_ip() -> Option<SocketAddr>.
    // (If a future tiny_http renames this, read the bound port off the SocketAddr accordingly.)
    let bound = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(port);
    log::info!("agent mode: HTTP control on http://127.0.0.1:{bound}");
    if let Some(tx) = port_report { let _ = tx.send(bound); }
    for request in server.incoming_requests() {
        handle_request(bridge.as_ref(), request);
    }
    Ok(())
}

fn json_response(status: u16, body: String) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
    let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
    tiny_http::Response::from_string(body).with_status_code(status).with_header(header)
}

fn err_response(status: u16, kind: &str, msg: &str) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
    let body = serde_json::json!({ "error": msg, "kind": kind }).to_string();
    json_response(status, body)
}

/// A successful route reply: HTTP status, body bytes, and content-type.
type RouteOk = (u16, Vec<u8>, &'static str);
/// A route error: HTTP status, error `kind`, and human message.
type RouteErr = (u16, String, String);

fn handle_request(bridge: &dyn AgentBridge, mut request: tiny_http::Request) {
    let url = request.url().to_string();
    let method = request.method().clone();
    let path = url.split('?').next().unwrap_or("");
    // Catch a panic in the handler so an unattended agent sees a 500, not a
    // refused connection (a dropped Request would drop the socket mid-reply).
    let result: Result<RouteOk, RouteErr> = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        match (&method, path) {
            (tiny_http::Method::Get, "/state") => {
                let r = bridge.state().map_err(|e| (500, "bridge".into(), e))?;
                Ok((200, serde_json::to_vec(&r).unwrap(), "application/json"))
            }
            (tiny_http::Method::Get, "/actions") => {
                let a = bridge.actions().map_err(|e| (500, "bridge".into(), e))?;
                Ok((200, serde_json::to_vec(&a).unwrap(), "application/json"))
            }
            (tiny_http::Method::Post, "/act") => {
                let mut body = String::new();
                use std::io::Read;
                // Cap the body at 1 MiB so a runaway client cannot exhaust memory.
                request.as_reader().take(1 << 20).read_to_string(&mut body).map_err(|e| (400, "body".into(), e.to_string()))?;
                let cmd: UiCommand = serde_json::from_str(&body).map_err(|e| (400, "parse".into(), e.to_string()))?;
                let r = bridge.act(cmd).map_err(|e| match e {
                    ActError::Rejected(m) => (400, "rejected".to_string(), m),
                    ActError::Bridge(m) => (503, "bridge".to_string(), m),
                })?;
                Ok((200, serde_json::to_vec(&r).unwrap(), "application/json"))
            }
            (tiny_http::Method::Get, "/idle") => {
                let timeout_ms = query_param(&url, "timeout_ms").and_then(|v| v.parse().ok()).unwrap_or(10_000);
                let idle = bridge.wait_idle(timeout_ms).map_err(|e| (500, "bridge".into(), e))?;
                Ok((200, serde_json::json!({ "idle": idle }).to_string().into_bytes(), "application/json"))
            }
            (tiny_http::Method::Get, "/replay") => {
                let r = bridge.replay().map_err(|e| (500, "bridge".into(), e))?;
                Ok((200, serde_json::to_vec(&r).unwrap(), "application/json"))
            }
            (tiny_http::Method::Get, "/screenshot") => {
                match bridge.screenshot().map_err(|e| (500, "bridge".into(), e))? {
                    Some(png) => Ok((200, png, "image/png")),
                    None => Err((501, "unsupported".into(), "screenshots unavailable on this bridge".into())),
                }
            }
            _ => Err((404, "not_found".into(), format!("no route for {} {}", method, path))),
        }
    }))
    .unwrap_or_else(|_| Err((500, "panic".into(), "internal error handling request".into())));
    let _ = match result {
        Ok((status, bytes, ctype)) => {
            let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], ctype.as_bytes()).unwrap();
            request.respond(tiny_http::Response::from_data(bytes).with_status_code(status).with_header(header))
        }
        Err((status, kind, msg)) => request.respond(err_response(status, &kind, &msg)),
    };
}

fn query_param(url: &str, key: &str) -> Option<String> {
    let q = url.split('?').nth(1)?;
    q.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=')?;
        if k == key { Some(v.to_string()) } else { None }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uicommand_json_roundtrips() {
        let cmds = vec![
            UiCommand::Core(testkit::env::Action::Work),
            UiCommand::Core(testkit::env::Action::Buy { ship_id: 1 }),
            UiCommand::Goto("Galaxy".into()),
            UiCommand::SelectOpponent { user_id: 1 },
            UiCommand::LaunchFleet { user_id: 1, instant: true, board: false },
            UiCommand::RecallFleet,
            UiCommand::SkipBattleAnimation,
            UiCommand::ContinueAfterBattle,
            UiCommand::RefreshPlayer,
        ];
        for c in cmds {
            let s = serde_json::to_string(&c).unwrap();
            let back: UiCommand = serde_json::from_str(&s).unwrap();
            assert_eq!(format!("{c:?}"), format!("{back:?}"));
        }
    }
    #[test]
    fn statereport_serializes_ui_and_observation() {
        let report = StateReport {
            observation: testkit::env::Observation {
                player: None, catalog: vec![], opponents: vec![], leaderboard: vec![],
                history: vec![], status: "hi".into(), status_is_error: false,
                screen: Some("Hangar".into()),
            },
            ui: UiState {
                screen: "Hangar".into(), selected_opponent: Some(2),
                fleet_travel: Some(FleetTravelState { target_id: 2, target_name: "NPC".into(), elapsed: 1.0, duration: 3.0, remaining: 2.0 }),
                battle_animating: false, battle_finished: false, boarding: None,
                available_ui_verbs: vec!["RefreshPlayer".into()],
            },
        };
        let s = serde_json::to_string(&report).unwrap();
        assert!(s.contains("\"screen\":\"Hangar\""));
        assert!(s.contains("\"remaining\":2.0"));
        assert!(s.contains("RefreshPlayer"));
    }

    #[test]
    fn serve_routes_state_actions_act_idle_replay() {
        use std::sync::Mutex;
        // A fake bridge backed by an ApiEnv, standing in for the live game.
        struct FakeBridge(Mutex<testkit::env::ApiEnv>);
        impl AgentBridge for FakeBridge {
            fn state(&self) -> Result<StateReport, String> {
                use testkit::env::AgentEnv;
                let obs = self.0.lock().unwrap().observe().map_err(|e| e.to_string())?;
                let screen = if obs.player.is_some() { "Hangar" } else { "Login" };
                let verbs = if obs.player.is_some() { vec!["RefreshPlayer".to_string()] } else { vec![] };
                Ok(StateReport {
                    ui: UiState { screen: screen.into(), selected_opponent: None, fleet_travel: None,
                                  battle_animating: false, battle_finished: false, boarding: None,
                                  available_ui_verbs: verbs },
                    observation: obs,
                })
            }
            fn actions(&self) -> Result<Vec<testkit::env::Action>, String> {
                use testkit::env::AgentEnv;
                // Mirror the drain: never advertise Battle (agents use LaunchFleet).
                let mut a = self.0.lock().unwrap().legal_actions().map_err(|e| e.to_string())?;
                a.retain(|act| !matches!(act, testkit::env::Action::Battle { .. }));
                Ok(a)
            }
            fn act(&self, cmd: UiCommand) -> Result<StateReport, ActError> {
                use testkit::env::AgentEnv;
                if let UiCommand::Core(a) = cmd {
                    if matches!(a, testkit::env::Action::Battle { .. }) {
                        return Err(ActError::Rejected("Battle is not a direct command; use LaunchFleet".into()));
                    }
                    self.0.lock().unwrap().act(&a).map_err(|e| ActError::Rejected(e.to_string()))?;
                }
                self.state().map_err(ActError::Bridge)
            }
            fn wait_idle(&self, _timeout_ms: u64) -> Result<bool, String> { Ok(true) }
            fn replay(&self) -> Result<testkit::replay::Replay, String> {
                Ok(testkit::replay::Replay { seed: 0, actions: vec![], expect: Default::default(), tolerate_rejections: true })
            }
            fn screenshot(&self) -> Result<Option<Vec<u8>>, String> { Ok(None) }
        }
        let api = network::LocalApi::open_seeded(":memory:", 9).unwrap();
        let bridge: Box<dyn AgentBridge> = Box::new(FakeBridge(Mutex::new(testkit::env::ApiEnv::new(Box::new(api)))));
        // Start the server on an ephemeral port; serve() reports the bound port.
        let (port_tx, port_rx) = std::sync::mpsc::channel();
        let handle = std::thread::spawn(move || { let _ = serve(bridge, 0, Some(port_tx)); });
        let port = port_rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
        let base = format!("http://127.0.0.1:{port}");

        // /state before login → Login screen.
        let body: serde_json::Value = ureq::get(&format!("{base}/state")).call().unwrap().into_json().unwrap();
        assert_eq!(body["ui"]["screen"], "Login");
        // /act Register → Hangar screen.
        let reg = serde_json::json!({ "Core": { "Register": { "nickname": "Ada", "password": "pwd" } } });
        let body: serde_json::Value = ureq::post(&format!("{base}/act")).send_json(reg).unwrap().into_json().unwrap();
        assert_eq!(body["ui"]["screen"], "Hangar");
        // /actions has SetFormation/Refresh at minimum.
        let acts: serde_json::Value = ureq::get(&format!("{base}/actions")).call().unwrap().into_json().unwrap();
        assert!(acts.as_array().unwrap().len() >= 6);
        // Direct Battle core action is rejected (400).
        let bad = serde_json::json!({ "Core": { "Battle": { "opponent_id": 1, "formation": "Aggressive" } } });
        let err = ureq::post(&format!("{base}/act")).send_json(bad).unwrap_err();
        assert!(matches!(err, ureq::Error::Status(400, _)));
        // /idle returns idle=true.
        let idle: serde_json::Value = ureq::get(&format!("{base}/idle?timeout_ms=100")).call().unwrap().into_json().unwrap();
        assert_eq!(idle["idle"], true);
        // /replay parses as a Replay.
        let _replay: testkit::replay::Replay =
            ureq::get(&format!("{base}/replay")).call().unwrap().into_json().unwrap();
        // /screenshot with a None-returning bridge → 501.
        let shot = ureq::get(&format!("{base}/screenshot")).call().unwrap_err();
        assert!(matches!(shot, ureq::Error::Status(501, _)));
        // Malformed /act body → 400 with kind "parse".
        let parse_err = ureq::post(&format!("{base}/act"))
            .set("Content-Type", "application/json")
            .send_string("not json").unwrap_err();
        match parse_err {
            ureq::Error::Status(400, r) => {
                let body: serde_json::Value = r.into_json().unwrap();
                assert_eq!(body["kind"], "parse");
            }
            other => panic!("expected 400 parse, got {other:?}"),
        }
        // Unknown route → 404.
        let nope = ureq::get(&format!("{base}/nope")).call().unwrap_err();
        assert!(matches!(nope, ureq::Error::Status(404, _)));
        // Wrong method (POST to a GET-only route) → 404.
        let wrong_method = ureq::post(&format!("{base}/state")).send_string("").unwrap_err();
        assert!(matches!(wrong_method, ureq::Error::Status(404, _)));
        drop(handle); // server thread exits with the test process
    }

    #[test]
    fn act_bridge_failure_maps_to_503() {
        // A bridge whose act() fails at the transport layer (not a game-rule
        // rejection) must surface as 503 "bridge", distinct from a 400 rejection.
        struct BrokenBridge;
        impl AgentBridge for BrokenBridge {
            fn state(&self) -> Result<StateReport, String> { Err("no state".into()) }
            fn actions(&self) -> Result<Vec<testkit::env::Action>, String> { Ok(vec![]) }
            fn act(&self, _cmd: UiCommand) -> Result<StateReport, ActError> {
                Err(ActError::Bridge("boom".into()))
            }
            fn wait_idle(&self, _timeout_ms: u64) -> Result<bool, String> { Ok(true) }
            fn replay(&self) -> Result<testkit::replay::Replay, String> { Err("no replay".into()) }
            fn screenshot(&self) -> Result<Option<Vec<u8>>, String> { Ok(None) }
        }
        let bridge: Box<dyn AgentBridge> = Box::new(BrokenBridge);
        let (port_tx, port_rx) = std::sync::mpsc::channel();
        let handle = std::thread::spawn(move || { let _ = serve(bridge, 0, Some(port_tx)); });
        let port = port_rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
        let base = format!("http://127.0.0.1:{port}");

        let cmd = serde_json::json!("RefreshPlayer"); // unit variant → bare string
        let err = ureq::post(&format!("{base}/act")).send_json(cmd).unwrap_err();
        match err {
            ureq::Error::Status(503, r) => {
                let body: serde_json::Value = r.into_json().unwrap();
                assert_eq!(body["kind"], "bridge");
                assert_eq!(body["error"], "boom");
            }
            other => panic!("expected 503 bridge, got {other:?}"),
        }
        drop(handle);
    }
}

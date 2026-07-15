//! The dedicated server: accepts TCP clients, dispatches their requests against
//! the shared [`World`], and runs a background bot tick so NPC fleets keep
//! battling even when no humans are online.

use crate::protocol::{Request, Response};
use crate::wire::{read_msg, write_msg};
use crate::world::World;
use log::{info, warn};
use rand::rngs::StdRng;
use rand::SeedableRng;
use sim::bot::{self, BotAction};
use sim::user::Formation;
use std::io::{BufReader, BufWriter};
use std::net::{TcpListener, TcpStream};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

type Shared = Arc<Mutex<World>>;

/// Run the dedicated server on `port`, persisting to `rift-server.db`.
pub fn run(port: u16) {
    run_with_db_seeded(port, "rift-server.db", None);
}

/// Run the dedicated server on `port`, persisting to `rift-server.db`, with an optional deterministic seed.
pub fn run_seeded(port: u16, seed: Option<u64>) {
    run_with_db_seeded(port, "rift-server.db", seed);
}

/// Run the server with an explicit database path (entropy RNG).
pub fn run_with_db(port: u16, db_path: &str) {
    run_with_db_seeded(port, db_path, None);
}

/// Run the server with an explicit database path and optional seed.
pub fn run_with_db_seeded(port: u16, db_path: &str, seed: Option<u64>) {
    let opened = match seed {
        Some(s) => World::open_seeded(db_path, s),
        None => World::open(db_path),
    };
    let world = match opened {
        Ok(w) => Arc::new(Mutex::new(w)),
        Err(e) => {
            warn!("failed to open world database '{}': {}", db_path, e);
            return;
        }
    };

    spawn_bot_tick(Arc::clone(&world));

    let addr = format!("0.0.0.0:{}", port);
    let listener = match TcpListener::bind(&addr) {
        Ok(l) => l,
        Err(e) => {
            warn!("failed to bind {}: {}", addr, e);
            return;
        }
    };
    info!("Rift server listening on {} — pilots may now connect", addr);

    for stream in listener.incoming() {
        match stream {
            Ok(s) => {
                let world = Arc::clone(&world);
                thread::spawn(move || handle_client(s, world));
            }
            Err(e) => warn!("accept error: {}", e),
        }
    }
}

/// Bind an in-memory-DB server on `port` (use 0 for an OS-assigned ephemeral
/// port), send the actually-bound port back over `ready`, then serve forever.
/// For tests only: no bot tick, deterministic seed 0. On world-open or bind
/// failure the error text is sent over `ready` so the test names the real cause.
#[doc(hidden)]
pub fn serve_ephemeral_for_test(port: u16, ready: Sender<Result<u16, String>>) {
    let world = match World::open_seeded(":memory:", 0) {
        Ok(w) => Arc::new(Mutex::new(w)),
        Err(e) => {
            let _ = ready.send(Err(format!("test server failed to open world: {}", e)));
            return;
        }
    };
    let listener = match TcpListener::bind(("127.0.0.1", port)) {
        Ok(l) => l,
        Err(e) => {
            let _ = ready.send(Err(format!("test server failed to bind: {}", e)));
            return;
        }
    };
    let bound = listener.local_addr().map(|a| a.port()).unwrap_or(port);
    let _ = ready.send(Ok(bound));
    for stream in listener.incoming() {
        match stream {
            Ok(s) => {
                let world = Arc::clone(&world);
                thread::spawn(move || handle_client(s, world));
            }
            Err(e) => warn!("accept error: {}", e),
        }
    }
}

fn handle_client(stream: TcpStream, world: Shared) {
    let peer = stream.peer_addr().ok();
    info!("client connected from {:?}", peer);

    let read_stream = match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    };
    let mut reader = BufReader::new(read_stream);
    let mut writer = BufWriter::new(stream);

    // The connection's logged-in user, set after Register/Login.
    let mut user_id: Option<u32> = None;

    loop {
        let request: Request = match read_msg(&mut reader) {
            Ok(r) => r,
            Err(_) => break, // disconnected
        };
        let response = dispatch(&world, &mut user_id, request);
        if write_msg(&mut writer, &response).is_err() {
            break;
        }
    }
    info!("client {:?} disconnected", peer);
}

/// Resolve a single request against the world, updating the connection's
/// authenticated user as needed.
fn dispatch(world: &Shared, user_id: &mut Option<u32>, request: Request) -> Response {
    let w = world.lock().unwrap();

    // Authentication requests don't require a prior login.
    match &request {
        Request::Register { nickname, password } => {
            return match w.register(nickname, password).and_then(|id| {
                *user_id = Some(id);
                w.snapshot(id).map(|snap| Response::Auth { user_id: id, snapshot: snap })
            }) {
                Ok(r) => r,
                Err(e) => Response::Error(e),
            };
        }
        Request::Login { nickname, password } => {
            return match w.login(nickname, password).and_then(|id| {
                *user_id = Some(id);
                w.snapshot(id).map(|snap| Response::Auth { user_id: id, snapshot: snap })
            }) {
                Ok(r) => r,
                Err(e) => Response::Error(e),
            };
        }
        _ => {}
    }

    let id = match *user_id {
        Some(id) => id,
        None => return Response::Error("Not logged in".into()),
    };

    let result: Result<Response, String> = match request {
        Request::Register { .. } | Request::Login { .. } => unreachable!(),
        Request::Snapshot => w.snapshot(id).map(Response::Snapshot),
        Request::Catalog => Ok(Response::Catalog(sim::ship::catalog())),
        Request::Buy { ship_id } => w.buy(id, ship_id).and_then(|_| w.snapshot(id)).map(Response::Snapshot),
        Request::Sell { ship_number } => {
            w.sell(id, ship_number).and_then(|_| w.snapshot(id)).map(Response::Snapshot)
        }
        Request::Repair { ship_number } => {
            w.repair(id, ship_number).and_then(|_| w.snapshot(id)).map(Response::Snapshot)
        }
        Request::Activate { ship_number } => {
            w.activate(id, ship_number).and_then(|_| w.snapshot(id)).map(Response::Snapshot)
        }
        Request::Deactivate { ship_number } => {
            w.deactivate(id, ship_number).and_then(|_| w.snapshot(id)).map(Response::Snapshot)
        }
        Request::SetFormation { formation } => {
            w.set_formation(id, formation).and_then(|_| w.snapshot(id)).map(Response::Snapshot)
        }
        Request::UpgradeDefense => {
            w.upgrade_defense(id).and_then(|_| w.snapshot(id)).map(Response::Snapshot)
        }
        Request::Work => w.work(id).and_then(|(work_type, income)| {
            w.snapshot(id).map(|snap| Response::Worked { work_type, income, snapshot: snap })
        }),
        Request::ListOpponents => w.list_opponents(id).map(Response::Opponents),
        Request::Battle { opponent_id, formation, boarding } => {
            w.battle(id, opponent_id, formation, boarding).and_then(|result| {
                w.snapshot(id).map(|snap| Response::Battle { result, snapshot: snap })
            })
        }
        Request::Leaderboard => w.leaderboard().map(Response::Leaderboard),
        Request::History => w.history(id).map(Response::History),
    };

    result.unwrap_or_else(Response::Error)
}

/// Periodically let NPC fleets act so the world stays alive. NPCs only fight
/// other NPCs here, so unattended human fleets are never griefed.
fn spawn_bot_tick(world: Shared) {
    thread::spawn(move || {
        let mut rng = StdRng::from_entropy();
        loop {
            thread::sleep(Duration::from_secs(20));
            let w = world.lock().unwrap();
            let ids = match w.all_user_ids() {
                Ok(ids) => ids,
                Err(_) => continue,
            };
            // NPC ids and the pool of NPC opponents.
            let npc_ids: Vec<u32> = ids
                .iter()
                .copied()
                .filter(|&id| matches!(w.load_user(id), Ok(Some(u)) if u.is_npc()))
                .collect();
            for &id in &npc_ids {
                let user = match w.load_user(id) {
                    Ok(Some(u)) => u,
                    _ => continue,
                };
                let ships = match w.ships_of(id) {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                let opponents: Vec<u32> = npc_ids.iter().copied().filter(|&o| o != id).collect();
                match bot::decide(&user, &ships, &opponents, &mut rng) {
                    BotAction::Repair { ship_number } => {
                        let _ = w.repair(id, ship_number);
                    }
                    BotAction::Activate { ship_number } => {
                        let _ = w.activate(id, ship_number);
                    }
                    BotAction::Buy { ship_id } => {
                        let _ = w.buy(id, ship_id);
                    }
                    BotAction::Attack { opponent_id } => {
                        let _ = w.battle(id, opponent_id, Formation::Aggressive, None);
                    }
                    BotAction::Work => {
                        let _ = w.work(id);
                    }
                    BotAction::Idle => {}
                }
            }
        }
    });
}

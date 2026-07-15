// On Windows release builds, run as a GUI app so no console window pops up.
// Debug builds keep the console so developers still see logs.
#![cfg_attr(
    all(target_os = "windows", not(debug_assertions)),
    windows_subsystem = "windows"
)]

#[cfg(feature = "client")]
use std::env;
#[cfg(feature = "client")]
use std::path::PathBuf;
use std::process;
use structopt::StructOpt;

/// Default multiplayer server: the recurse.click relay the project already uses.
#[cfg(feature = "client")]
const DEFAULT_SERVER: &str = "ws://aiden.recurse.click/game";

#[derive(StructOpt)]
#[structopt(name = "Rift", about = "Rift — a spaceship fleet-battle game in pure Rust.")]
// Some fields are only read by the graphical client; the headless server build
// (`--no-default-features`) still needs them for argument parsing.
#[cfg_attr(not(feature = "client"), allow(dead_code))]
struct App {
    /// Override the default multiplayer server (e.g. 127.0.0.1:7777 or ws://host/path).
    #[structopt(long = "connect", value_name = "ADDR")]
    connect: Option<String>,

    /// Your pilot name (prefilled on the login screen; defaults to system username).
    #[structopt(long = "name", value_name = "NAME")]
    player_name: Option<String>,

    /// Play offline against a local save instead of connecting to a server.
    #[structopt(long = "offline")]
    offline: bool,

    /// Deterministic seed for the offline world (reproducible battles/work; best used with a fresh save).
    #[structopt(long = "seed", value_name = "N")]
    seed: Option<u64>,

    /// Start a localhost-only HTTP control server so an agent can play the live game.
    #[structopt(long = "agent-mode")]
    agent_mode: bool,

    /// Port for the agent-mode HTTP server (localhost only).
    #[structopt(long = "agent-port", default_value = "7878", value_name = "PORT")]
    agent_port: u16,

    /// Initial window size.
    #[structopt(
        short = "r",
        long = "resolution",
        default_value = "1280x800",
        value_name = "WIDTHxHEIGHT",
        parse(try_from_str = parse_resolution)
    )]
    resolution: (u32, u32),

    #[structopt(subcommand)]
    command: Option<Command>,
}

#[derive(StructOpt)]
enum Command {
    /// Run a dedicated, headless multiplayer server (no window, no GPU).
    Server {
        #[structopt(short = "p", long = "port", default_value = "7777", value_name = "PORT")]
        port: u16,

        /// Deterministic seed for the server world.
        #[structopt(long = "seed", value_name = "N")]
        seed: Option<u64>,
    },
}

fn main() {
    env_logger::Builder::from_env(
        env_logger::Env::default().filter_or(env_logger::DEFAULT_FILTER_ENV, "info"),
    )
    .format_timestamp(None)
    .init();

    let app = App::from_args();

    match app.command {
        Some(Command::Server { port, seed }) => {
            match seed {
                Some(s) => log::info!("Starting Rift server on port {} (seed {})", port, s),
                None => log::info!("Starting Rift server on port {}", port),
            }
            network::server::run_seeded(port, seed);
        }
        None => {
            if let Err(e) = run_client(&app) {
                log::error!("Fatal error: {}", e);
                process::exit(1);
            }
        }
    }
}

#[cfg(feature = "client")]
fn run_client(app: &App) -> Result<(), String> {
    let server_addr = if app.offline {
        None
    } else {
        Some(app.connect.clone().unwrap_or_else(|| DEFAULT_SERVER.to_string()))
    };

    let player_name = app.player_name.clone().unwrap_or_else(|| {
        env::var("USER")
            .or_else(|_| env::var("USERNAME"))
            .unwrap_or_else(|_| "Pilot".to_string())
    });

    let config = game::GameConfig {
        server_addr,
        save_path: save_path(),
        player_name,
        version: env!("CARGO_PKG_VERSION"),
        width: app.resolution.0,
        height: app.resolution.1,
        seed: app.seed,
        agent_port: if app.agent_mode { Some(app.agent_port) } else { None },
    };
    game::run(config)
}

#[cfg(not(feature = "client"))]
fn run_client(_app: &App) -> Result<(), String> {
    Err("This build has no graphical client. Run `rift server` instead.".into())
}

/// Where the offline single-player world is saved.
#[cfg(feature = "client")]
fn save_path() -> PathBuf {
    let dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")).join("Rift");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("save.db")
}

fn parse_resolution(s: &str) -> Result<(u32, u32), String> {
    let (w, h) = s.split_once('x').ok_or("Resolution must be WIDTHxHEIGHT")?;
    let w = w.parse::<u32>().map_err(|_| "bad width")?;
    let h = h.parse::<u32>().map_err(|_| "bad height")?;
    if w == 0 || h == 0 {
        return Err("Resolution must be positive".into());
    }
    Ok((w, h))
}

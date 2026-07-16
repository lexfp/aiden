//! The Rift client: a native egui app for fleet management and battle. Talks to
//! the game through [`network::GameApi`], so the same screens drive either a
//! local offline world or a remote server.

pub mod app;
#[cfg(feature = "agent")]
pub mod agent_mode;
mod backdrops;
mod battle_scene;
pub mod boarding;
mod icons;
mod ship_art;
pub mod theme;

#[cfg(not(target_arch = "wasm32"))]
use network::{GameApi, LocalApi, RemoteApi};
#[cfg(not(target_arch = "wasm32"))]
use std::path::PathBuf;

/// How to launch the client.
#[cfg(not(target_arch = "wasm32"))]
pub struct GameConfig {
    /// Server to connect to. `None` runs offline against a local save.
    pub server_addr: Option<String>,
    /// Local single-player save-file path (also the fallback if a server is
    /// unreachable).
    pub save_path: PathBuf,
    /// Prefilled pilot name on the login screen.
    pub player_name: String,
    pub version: &'static str,
    pub width: u32,
    pub height: u32,
    /// When `Some`, the offline world is opened deterministically with this seed.
    pub seed: Option<u64>,
    /// When `Some`, start the localhost agent-mode HTTP server on this port.
    pub agent_port: Option<u16>,
}

/// Build the backend and run the app. Blocks until the window closes.
#[cfg(not(target_arch = "wasm32"))]
pub fn run(config: GameConfig) -> Result<(), String> {
    let save_path = config.save_path.to_string_lossy().to_string();

    // Choose the backend: a live server when requested (falling back to offline
    // if it can't be reached), otherwise the local world.
    let open_local = |path: &str| -> Result<LocalApi, String> {
        match config.seed {
            Some(seed) => LocalApi::open_seeded(path, seed),
            None => LocalApi::open(path),
        }
    };
    let (backend, online, notice): (Box<dyn GameApi>, bool, Option<String>) = match &config.server_addr {
        Some(addr) => match RemoteApi::connect(addr) {
            Ok(remote) => {
                if config.seed.is_some() {
                    log::warn!("--seed ignored: connected to server {addr} (only offline worlds are seeded)");
                }
                (Box::new(remote), true, None)
            }
            Err(e) => {
                log::warn!("could not reach server {}: {} — starting offline", addr, e);
                let local = open_local(&save_path)?;
                (Box::new(local), false, Some(format!("Server unreachable ({e}) — playing offline.")))
            }
        },
        None => (Box::new(open_local(&save_path)?), false, None),
    };

    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([config.width as f32, config.height as f32])
            .with_min_inner_size([900.0, 600.0])
            .with_title(format!("Rift {}", config.version)),
        // The boarding mode draws its 3D viewport through a glow paint
        // callback, so run on the glow backend with a real depth buffer
        // (eframe defaults to 0 bits — no depth test — since egui alone
        // doesn't need one).
        renderer: eframe::Renderer::Glow,
        depth_buffer: 24,
        ..Default::default()
    };

    let player_name = config.player_name.clone();
    let seed = config.seed;
    let agent_port = config.agent_port;
    eframe::run_native(
        "Rift",
        options,
        Box::new(move |cc| {
            theme::install(&cc.egui_ctx);
            #[cfg(feature = "agent")]
            {
                let mut app = app::RiftApp::new(backend, online, player_name, notice);
                app.attach_gl(cc.gl.clone());
                if let Some(port) = agent_port {
                    let (tx, rx) = std::sync::mpsc::channel::<agent_mode::AgentCall>();
                    app.attach_agent(rx, seed);
                    let bridge: Box<dyn agent_mode::AgentBridge> =
                        Box::new(agent_mode::ChannelBridge::new(tx, cc.egui_ctx.clone()));
                    std::thread::spawn(move || {
                        if let Err(e) = agent_mode::serve(bridge, port, None) {
                            log::error!("{e}");
                        }
                    });
                }
                Ok(Box::new(app))
            }
            #[cfg(not(feature = "agent"))]
            {
                let _ = (seed, agent_port);
                let mut app = app::RiftApp::new(backend, online, player_name, notice);
                app.attach_gl(cc.gl.clone());
                Ok(Box::new(app))
            }
        }),
    )
    .map_err(|e| format!("window error: {e}"))
}

//! Rift on phones: compiles the same egui client to WebAssembly, drives the
//! in-memory world through [`network::LocalApi`], and persists the save to
//! localStorage after every action so closing the tab (or the installed app)
//! never loses progress.

#[cfg(target_arch = "wasm32")]
mod app {
    use network::{
        BattleResultDto, BattleSummary, GameApi, LeaderboardEntry, LocalApi, OpponentInfo,
        PlayerSnapshot,
    };
    use sim::ship::ShipTemplate;
    use sim::user::Formation;
    use wasm_bindgen::JsCast;

    const SAVE_KEY: &str = "rift-save-v1";

    fn local_storage() -> Option<web_sys::Storage> {
        web_sys::window().and_then(|w| w.local_storage().ok().flatten())
    }

    pub fn load_save() -> Option<String> {
        local_storage().and_then(|s| s.get_item(SAVE_KEY).ok().flatten())
    }

    /// [`LocalApi`] plus a write-through to localStorage: every call that can
    /// change the world re-exports the save. The world is a few kilobytes of
    /// JSON, so serializing per action is cheap.
    pub struct PersistingApi {
        inner: LocalApi,
    }

    impl PersistingApi {
        pub fn new(inner: LocalApi) -> Self {
            PersistingApi { inner }
        }

        fn persist(&self) {
            match self.inner.export_save() {
                Ok(json) => {
                    if let Some(storage) = local_storage() {
                        if storage.set_item(SAVE_KEY, &json).is_err() {
                            log::warn!("could not write save to localStorage");
                        }
                    }
                }
                Err(e) => log::warn!("could not export save: {e}"),
            }
        }

        /// Run a mutating call and persist on success.
        fn saving<T>(
            &mut self,
            f: impl FnOnce(&mut LocalApi) -> Result<T, String>,
        ) -> Result<T, String> {
            let result = f(&mut self.inner);
            if result.is_ok() {
                self.persist();
            }
            result
        }
    }

    impl GameApi for PersistingApi {
        fn register(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.register(nickname, password))
        }
        fn login(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String> {
            self.inner.login(nickname, password)
        }
        fn snapshot(&mut self) -> Result<PlayerSnapshot, String> {
            self.inner.snapshot()
        }
        fn catalog(&mut self) -> Result<Vec<ShipTemplate>, String> {
            self.inner.catalog()
        }
        fn buy(&mut self, ship_id: u32) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.buy(ship_id))
        }
        fn sell(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.sell(ship_number))
        }
        fn repair(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.repair(ship_number))
        }
        fn activate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.activate(ship_number))
        }
        fn deactivate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.deactivate(ship_number))
        }
        fn set_formation(&mut self, formation: Formation) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.set_formation(formation))
        }
        fn upgrade_defense(&mut self) -> Result<PlayerSnapshot, String> {
            self.saving(|api| api.upgrade_defense())
        }
        fn work(&mut self) -> Result<(String, i64, PlayerSnapshot), String> {
            self.saving(|api| api.work())
        }
        fn opponents(&mut self) -> Result<Vec<OpponentInfo>, String> {
            self.inner.opponents()
        }
        fn battle(
            &mut self,
            opponent_id: u32,
            formation: Formation,
            boarding: Option<sim::BoardingOutcome>,
        ) -> Result<(BattleResultDto, PlayerSnapshot), String> {
            self.saving(|api| api.battle(opponent_id, formation, boarding))
        }
        fn leaderboard(&mut self) -> Result<Vec<LeaderboardEntry>, String> {
            self.inner.leaderboard()
        }
        fn history(&mut self) -> Result<Vec<BattleSummary>, String> {
            self.inner.history()
        }
    }

    pub fn start() {
        console_error_panic_hook::set_once();
        eframe::WebLogger::init(log::LevelFilter::Info).ok();

        wasm_bindgen_futures::spawn_local(async {
            let window = web_sys::window().expect("no window");
            let document = window.document().expect("no document");
            let canvas = document
                .get_element_by_id("rift_canvas")
                .expect("no #rift_canvas element")
                .dyn_into::<web_sys::HtmlCanvasElement>()
                .expect("#rift_canvas is not a <canvas>");

            let backend = PersistingApi::new(
                LocalApi::open_mem(load_save().as_deref()).expect("could not open world"),
            );

            let web_options = eframe::WebOptions::default();
            eframe::WebRunner::new()
                .start(
                    canvas,
                    web_options,
                    Box::new(move |cc| {
                        game::theme::install(&cc.egui_ctx);
                        // The UI was laid out for a ~1280-point desktop window;
                        // shrink egui's point size so a phone fits the whole
                        // screen instead of showing a corner of it.
                        let css_width = web_sys::window()
                            .and_then(|w| w.inner_width().ok())
                            .and_then(|v| v.as_f64())
                            .unwrap_or(1024.0) as f32;
                        let zoom = (css_width / 1000.0).clamp(0.55, 1.0);
                        cc.egui_ctx.set_zoom_factor(zoom);

                        let mut app = game::app::RiftApp::new(
                            Box::new(backend),
                            false, // solo world — there is no server connection on mobile
                            String::new(),
                            None,
                        );
                        app.attach_gl(cc.gl.clone());
                        Ok(Box::new(app))
                    }),
                )
                .await
                .expect("failed to start Rift");
        });
    }
}

#[cfg(target_arch = "wasm32")]
fn main() {
    app::start();
}

#[cfg(not(target_arch = "wasm32"))]
fn main() {
    eprintln!("rift-web is the wasm entry point — build it with `trunk build` (see web/README).");
}

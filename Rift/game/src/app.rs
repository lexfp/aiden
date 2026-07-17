//! The egui application: top-level state, navigation, and every screen.

use crate::icons::{self, Icon};
use crate::theme;
use eframe::egui::{self, Color32, RichText, Vec2};
use network::{
    BattleResultDto, BattleSummary, GameApi, LeaderboardEntry, OpponentInfo, PlayerSnapshot,
};
use sim::ship::{OwnedShip, ShipStatus, ShipStats, ShipTemplate};
use sim::user::Formation;

/// Which view the player is looking at.
#[derive(Clone, Copy, PartialEq)]
enum Screen {
    Login,
    Hangar,
    Market,
    Work,
    Galaxy,
    Boarding,
    Battle,
    Leaderboard,
    History,
}

impl Screen {
    /// Stable machine-readable name for the agent-mode `/state` payload.
    #[cfg(feature = "agent")]
    fn name(&self) -> &'static str {
        match self {
            Screen::Login => "Login",
            Screen::Hangar => "Hangar",
            Screen::Market => "Market",
            Screen::Work => "Work",
            Screen::Galaxy => "Galaxy",
            Screen::Boarding => "Boarding",
            Screen::Battle => "Battle",
            Screen::Leaderboard => "Leaderboard",
            Screen::History => "History",
        }
    }
}

const FORMATIONS: [(Formation, &str, &str); 3] = [
    (Formation::Aggressive, "Aggressive", "Normal evasion · random targets"),
    (Formation::Defensive, "Defensive", "+20% evasion · finish weak ships"),
    (Formation::Tactical, "Tactical", "-10% evasion · target threats"),
];

/// Sidebar navigation: (screen, icon, label, description).
const NAV: [(Screen, Icon, &str, &str); 6] = [
    (Screen::Hangar, Icon::Ship, "Hangar", "Manage your fleet"),
    (Screen::Market, Icon::Market, "Market", "Buy and sell ships"),
    (Screen::Work, Icon::Hammer, "Work", "Earn credits"),
    (Screen::Galaxy, Icon::Galaxy, "Galaxy", "Star map & targets"),
    (Screen::Leaderboard, Icon::Trophy, "Leaderboard", "Top pilots"),
    (Screen::History, Icon::History, "History", "Past battles"),
];

/// Tier accent colour (common → legendary), used to tint ship art tiles.
fn tier_color(tier: u8) -> Color32 {
    match tier {
        1 => Color32::from_rgb(0x64, 0x74, 0x8B), // slate
        2 => theme::BLUE,
        3 => theme::CYAN,
        4 => theme::PURPLE,
        5 => theme::GOLD,
        _ => theme::RED_BRIGHT, // tier 6, legendary
    }
}

/// Stable position of a star system on the galaxy map, derived from the user id
/// so a given opponent always sits in the same place. Returns normalized world
/// coordinates roughly within a unit disc around the home system.
fn system_pos(user_id: u32) -> (f32, f32) {
    let hash01 = |n: f32| {
        let v = (n * 12.9898).sin() * 43758.547;
        v - v.floor()
    };
    let id = user_id as f32;
    let angle = hash01(id * 1.7 + 0.3) * std::f32::consts::TAU;
    let radius = 0.28 + hash01(id * 2.91 + 1.1) * 0.82;
    (angle.cos() * radius, angle.sin() * radius)
}

/// An in-progress fleet jump from the home system out to a target system.
struct FleetTravel {
    target_id: u32,
    target_name: String,
    elapsed: f32,
    duration: f32,
    /// Deploy as a troop into the enemy flagship on arrival.
    board: bool,
}

/// Where the boarding raid's on-screen touch controls sit inside the viewport.
struct BoardingTouchLayout {
    /// Resting spot of the virtual move stick (its base follows the finger).
    stick_rest: egui::Pos2,
    stick_radius: f32,
    /// Resting spot of the virtual look stick (its base follows the finger).
    look_rest: egui::Pos2,
    look_radius: f32,
    fire_center: egui::Pos2,
    fire_radius: f32,
    extract: egui::Rect,
    pause: egui::Rect,
}

impl BoardingTouchLayout {
    fn new(rect: egui::Rect) -> Self {
        BoardingTouchLayout {
            stick_rest: rect.left_bottom() + Vec2::new(110.0, -110.0),
            stick_radius: 64.0,
            look_rest: rect.right_bottom() + Vec2::new(-110.0, -110.0),
            look_radius: 64.0,
            fire_center: rect.right_bottom() + Vec2::new(-110.0, -240.0),
            fire_radius: 44.0,
            extract: egui::Rect::from_center_size(
                rect.left_bottom() + Vec2::new(110.0, -235.0),
                Vec2::new(110.0, 40.0),
            ),
            pause: egui::Rect::from_center_size(
                rect.right_top() + Vec2::new(-30.0, 64.0),
                Vec2::new(36.0, 36.0),
            ),
        }
    }
}

pub struct RiftApp {
    backend: Box<dyn GameApi>,
    online: bool,

    screen: Screen,

    // Login form.
    login_nick: String,
    login_pass: String,
    register_mode: bool,

    // Cached state.
    snapshot: Option<PlayerSnapshot>,
    catalog: Vec<ShipTemplate>,
    opponents: Vec<OpponentInfo>,
    leaderboard: Vec<LeaderboardEntry>,
    history: Vec<BattleSummary>,

    // Battle.
    chosen_formation: Formation,
    selected_opponent: Option<u32>,
    last_battle: Option<BattleResultDto>,
    battle_scene: Option<crate::battle_scene::BattleScene>,

    // Galaxy map view state.
    galaxy_pan: egui::Vec2,
    galaxy_zoom: f32,
    fleet_travel: Option<FleetTravel>,

    // Photo backdrops (NASA imagery), decoded lazily on the first frame.
    backdrops: Option<crate::backdrops::Backdrops>,

    // The glow GL context, when running on the glow backend. `None` under
    // kittest/wgpu — every screen must stay fully functional without it
    // (boarding is simply unavailable).
    gl: Option<std::sync::Arc<eframe::glow::Context>>,

    // Boarding raid (FPS mode) state.
    boarding: Option<crate::boarding::BoardingGame>,
    boarding_renderer: Option<std::sync::Arc<std::sync::Mutex<crate::boarding::renderer::BoardingRenderer>>>,
    boarding_opponent: Option<u32>,
    boarding_paused: bool,
    /// Galaxy-card checkbox: board the flagship before the fleet battle.
    board_first: bool,
    cursor_grabbed: bool,

    // Touch controls for the boarding raid (phones). A touchscreen has no
    // WASD or mouse-look, so the raid gets dual virtual joysticks — move
    // (left half) and look (right half) — plus FIRE/EXTRACT/pause buttons.
    // Activated the first time a touch event is seen.
    touch_seen: bool,
    /// Virtual move stick: (touch id, stick origin, current drag offset).
    touch_move: Option<(u64, egui::Pos2, egui::Vec2)>,
    /// Virtual look stick: (touch id, stick origin, current drag offset).
    touch_look: Option<(u64, egui::Pos2, egui::Vec2)>,
    /// Touch id currently holding the FIRE button.
    touch_fire: Option<u64>,
    /// Touch id currently holding the EXTRACT button.
    touch_extract: Option<u64>,

    // Status line.
    status: String,
    status_is_error: bool,

    // Agent mode (feature "agent"): drained in update(); records core actions.
    #[cfg(feature = "agent")]
    agent_rx: Option<std::sync::mpsc::Receiver<crate::agent_mode::AgentCall>>,
    #[cfg(feature = "agent")]
    recorded: Vec<testkit::env::Action>,
    #[cfg(feature = "agent")]
    agent_seed: Option<u64>,
    #[cfg(feature = "agent")]
    pending_screenshot: Vec<std::sync::mpsc::Sender<crate::agent_mode::AgentResponse>>,
    #[cfg(feature = "agent")]
    pending_screenshot_frames: u32,
}

impl RiftApp {
    /// Read-only access to the app's cached player snapshot, for the kittest
    /// parity test (Task B5). Returns `None` until the first successful login.
    #[doc(hidden)]
    pub fn cached_snapshot_for_test(&self) -> Option<&PlayerSnapshot> {
        self.snapshot.as_ref()
    }

    pub fn new(backend: Box<dyn GameApi>, online: bool, player_name: String, notice: Option<String>) -> Self {
        RiftApp {
            backend,
            online,
            login_nick: player_name,
            screen: Screen::Login,
            login_pass: String::new(),
            register_mode: false,
            snapshot: None,
            catalog: Vec::new(),
            opponents: Vec::new(),
            leaderboard: Vec::new(),
            history: Vec::new(),
            chosen_formation: Formation::Aggressive,
            selected_opponent: None,
            last_battle: None,
            battle_scene: None,
            galaxy_pan: egui::Vec2::ZERO,
            galaxy_zoom: 1.0,
            fleet_travel: None,
            backdrops: None,
            gl: None,
            boarding: None,
            boarding_renderer: None,
            boarding_opponent: None,
            boarding_paused: false,
            board_first: false,
            cursor_grabbed: false,
            touch_seen: false,
            touch_move: None,
            touch_look: None,
            touch_fire: None,
            touch_extract: None,
            status: notice.clone().unwrap_or_default(),
            status_is_error: notice.is_some(),
            #[cfg(feature = "agent")]
            agent_rx: None,
            #[cfg(feature = "agent")]
            recorded: Vec::new(),
            #[cfg(feature = "agent")]
            agent_seed: None,
            #[cfg(feature = "agent")]
            pending_screenshot: Vec::new(),
            #[cfg(feature = "agent")]
            pending_screenshot_frames: 0,
        }
    }

    /// Hand the app the glow context (from `CreationContext::gl`). Without it
    /// the boarding mode is disabled but everything else works.
    pub fn attach_gl(&mut self, gl: Option<std::sync::Arc<eframe::glow::Context>>) {
        self.gl = gl;
    }

    #[cfg(feature = "agent")]
    pub fn attach_agent(
        &mut self,
        rx: std::sync::mpsc::Receiver<crate::agent_mode::AgentCall>,
        seed: Option<u64>,
    ) {
        self.agent_rx = Some(rx);
        self.agent_seed = seed;
    }

    fn info(&mut self, msg: impl Into<String>) {
        self.status = msg.into();
        self.status_is_error = false;
    }

    fn error(&mut self, msg: impl Into<String>) {
        self.status = msg.into();
        self.status_is_error = true;
    }

    fn apply_snapshot(&mut self, snap: PlayerSnapshot) {
        self.chosen_formation = snap.user.default_formation;
        self.snapshot = Some(snap);
    }

    // -- top-level frame ----------------------------------------------------

    fn ui_main(&mut self, ui: &mut egui::Ui) {
        // Left sidebar (navy panel with the user card + nav).
        egui::Panel::left("sidebar")
            .resizable(false)
            .exact_size(250.0)
            .frame(
                egui::Frame::new()
                    .fill(theme::SLATE_900)
                    .stroke(egui::Stroke::new(1.0, theme::SLATE_700))
                    .inner_margin(egui::Margin::symmetric(12, 16)),
            )
            .show(ui, |ui| self.ui_sidebar(ui));

        // Bottom status strip.
        egui::Panel::bottom("status")
            .frame(egui::Frame::new().fill(theme::SLATE_900).inner_margin(egui::Margin::symmetric(14, 8)))
            .show(ui, |ui| {
                let color = if self.status_is_error { theme::RED_BRIGHT } else { theme::TEXT_DIM };
                ui.horizontal(|ui| {
                    let dot_color = if self.online { theme::GREEN } else { theme::SLATE_400 };
                    let (dot, _) = ui.allocate_exact_size(Vec2::splat(8.0), egui::Sense::hover());
                    if self.online {
                        ui.painter().circle_filled(dot.center(), 3.0, dot_color);
                    } else {
                        ui.painter().circle_stroke(dot.center(), 3.0, egui::Stroke::new(1.2, dot_color));
                    }
                    ui.label(
                        RichText::new(if self.online { "ONLINE" } else { "OFFLINE" })
                            .small()
                            .color(dot_color),
                    );
                    if !self.status.is_empty() {
                        ui.separator();
                        ui.label(RichText::new(&self.status).color(color));
                    }
                });
            });

        // Main content, drawn over an animated starfield.
        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(theme::SLATE_950).inner_margin(20.0))
            .show(ui, |ui| {
                let t = ui.ctx().input(|i| i.time) as f32;
                theme::draw_starfield(ui.painter(), ui.max_rect(), t);
                match self.screen {
                    Screen::Hangar => self.ui_hangar(ui),
                    Screen::Market => self.ui_market(ui),
                    Screen::Work => self.ui_work(ui),
                    Screen::Galaxy => self.ui_galaxy(ui),
                    Screen::Battle => self.ui_battle(ui),
                    Screen::Leaderboard => self.ui_leaderboard(ui),
                    Screen::History => self.ui_history(ui),
                    // Boarding renders full-window from App::ui, never here.
                    Screen::Login | Screen::Boarding => {}
                }
            });
    }

    fn ui_sidebar(&mut self, ui: &mut egui::Ui) {
        ui.add_space(2.0);
        ui.label(RichText::new("RIFT").font(theme::display_font(34.0)).color(theme::TEXT));
        ui.label(RichText::new("FLEET COMMAND").font(theme::display_font(10.0)).color(theme::BLUE_SOFT));
        ui.add_space(14.0);

        // User card: avatar + name + rank + credits.
        if let Some(snap) = self.snapshot.clone() {
            let u = &snap.user;
            egui::Frame::new().fill(theme::SLATE_800).corner_radius(12).inner_margin(12.0).show(ui, |ui| {
                ui.set_width(ui.available_width());
                ui.horizontal(|ui| {
                    let (rect, _) = ui.allocate_exact_size(Vec2::splat(42.0), egui::Sense::hover());
                    theme::avatar(ui, rect, u.nickname.chars().next().unwrap_or('P'));
                    ui.add_space(4.0);
                    ui.vertical(|ui| {
                        ui.label(RichText::new(&u.nickname).strong().size(16.0).color(theme::TEXT));
                        ui.horizontal(|ui| {
                            ui.spacing_mut().item_spacing.x = 5.0;
                            let (badge, _) = ui.allocate_exact_size(Vec2::new(16.0, 13.0), egui::Sense::hover());
                            icons::rank_insignia(ui.painter(), badge, u.rank);
                            ui.label(
                                RichText::new(format!("{} · Lv {}", u.rank.title(), u.level))
                                    .small()
                                    .color(theme::SLATE_400),
                            );
                        });
                    });
                });
                ui.add_space(8.0);
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 6.0;
                    icons::draw_inline(ui, 14.0, Icon::Credits, theme::GOLD);
                    ui.label(RichText::new(format!("{} credits", u.currency_value)).strong().color(theme::GOLD));
                });
                ui.horizontal(|ui| {
                    ui.label(RichText::new(format!("Fleet {}/{}", snap.active_count, snap.max_active_ships)).small().color(theme::SLATE_400));
                    ui.label(RichText::new(format!("· {:.0} ELO", u.elo_rank)).small().color(theme::BLUE_SOFT));
                });
            });
            ui.add_space(14.0);
        }

        // Navigation.
        let mut next = self.screen;
        for (screen, icon, label, desc) in NAV {
            if self.nav_item(ui, icon, label, desc, self.screen == screen).clicked() {
                next = screen;
            }
        }
        if next != self.screen {
            self.go(next);
        }

        // Sign-out pinned near the bottom.
        let remaining = ui.available_height();
        if remaining > 50.0 {
            ui.add_space(remaining - 40.0);
        }
        if ui
            .add_sized(
                [ui.available_width(), 32.0],
                egui::Button::new(RichText::new("Sign out").color(theme::BLUE_SOFT)).fill(theme::SLATE_800),
            )
            .clicked()
        {
            self.do_logout();
        }
    }

    /// One sidebar nav row: vector icon + label + description, highlighted when active.
    fn nav_item(&self, ui: &mut egui::Ui, icon: Icon, label: &str, desc: &str, selected: bool) -> egui::Response {
        let fill = if selected { theme::BLUE.linear_multiply(0.22) } else { theme::SLATE_900 };
        let inner = egui::Frame::new()
            .fill(fill)
            .corner_radius(10)
            .inner_margin(egui::Margin::symmetric(10, 8))
            .show(ui, |ui| {
                ui.set_width(ui.available_width());
                ui.horizontal(|ui| {
                    let icon_color = if selected { theme::BLUE_SOFT } else { theme::SLATE_400 };
                    icons::draw_inline(ui, 20.0, icon, icon_color);
                    ui.add_space(2.0);
                    ui.vertical(|ui| {
                        ui.label(RichText::new(label).strong().color(theme::TEXT));
                        ui.label(RichText::new(desc).small().color(theme::SLATE_400));
                    });
                });
            });
        if selected {
            ui.painter().rect_stroke(inner.response.rect, 10, egui::Stroke::new(1.0, theme::BLUE), egui::StrokeKind::Inside);
        }
        let resp = ui
            .interact(inner.response.rect, ui.make_persistent_id(label), egui::Sense::click())
            .on_hover_cursor(egui::CursorIcon::PointingHand);
        ui.add_space(4.0);
        resp
    }

    fn do_logout(&mut self) {
        self.snapshot = None;
        self.last_battle = None;
        self.login_pass.clear();
        self.screen = Screen::Login;
        self.info("Signed out.");
    }

    /// Switch screens, loading any data the destination needs.
    fn go(&mut self, screen: Screen) {
        self.screen = screen;
        match screen {
            Screen::Galaxy => self.refresh_opponents(),
            Screen::Leaderboard => self.refresh_leaderboard(),
            Screen::History => self.refresh_history(),
            _ => {}
        }
    }

    // -- data refreshers ----------------------------------------------------

    fn refresh_opponents(&mut self) {
        match self.backend.opponents() {
            Ok(o) => self.opponents = o,
            Err(e) => self.error(e),
        }
    }

    fn refresh_leaderboard(&mut self) {
        match self.backend.leaderboard() {
            Ok(l) => self.leaderboard = l,
            Err(e) => self.error(e),
        }
    }

    fn refresh_history(&mut self) {
        match self.backend.history() {
            Ok(h) => self.history = h,
            Err(e) => self.error(e),
        }
    }

    // -- login --------------------------------------------------------------

    fn ui_login(&mut self, ui: &mut egui::Ui) {
        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(theme::SLATE_950))
            .show(ui, |ui| {
                let t = ui.ctx().input(|i| i.time) as f32;
                theme::draw_starfield(ui.painter(), ui.max_rect(), t);

                ui.vertical_centered(|ui| {
                    ui.add_space(70.0);
                    ui.label(RichText::new("RIFT").font(theme::display_font(76.0)).color(theme::TEXT));
                    ui.label(RichText::new("FLEET COMMAND").font(theme::display_font(14.0)).color(theme::BLUE_SOFT));
                    ui.add_space(8.0);
                    ui.label(
                        RichText::new(if self.online {
                            "Connected to the shared galaxy"
                        } else {
                            "Single-player — your fleet is saved locally"
                        })
                        .color(theme::SLATE_400),
                    );
                    ui.add_space(28.0);
                });

                ui.vertical_centered(|ui| {
                    egui::Frame::new()
                        .fill(theme::SLATE_900)
                        .stroke(egui::Stroke::new(1.0, theme::SLATE_700))
                        .corner_radius(16)
                        .inner_margin(24.0)
                        .show(ui, |ui| {
                            ui.set_width(340.0);
                            ui.label(
                                RichText::new(if self.register_mode { "Enlist a new pilot" } else { "Sign in" })
                                    .strong()
                                    .size(18.0),
                            );
                            ui.add_space(12.0);
                            ui.label(RichText::new("PILOT NAME").small().color(theme::SLATE_400));
                            ui.add_sized([340.0, 28.0], egui::TextEdit::singleline(&mut self.login_nick).hint_text("Pilot name"));
                            ui.add_space(8.0);
                            ui.label(RichText::new("PASSWORD").small().color(theme::SLATE_400));
                            ui.add_sized([340.0, 28.0], egui::TextEdit::singleline(&mut self.login_pass).password(true).hint_text("Password"));
                            ui.add_space(16.0);

                            let label = if self.register_mode { "Enlist" } else { "Sign in" };
                            let submit = theme::primary_button(ui, label, Vec2::new(340.0, 40.0), true)
                                || (ui.input(|i| i.key_pressed(egui::Key::Enter)) && !self.login_nick.is_empty());
                            if submit {
                                self.do_auth();
                            }

                            ui.add_space(10.0);
                            ui.vertical_centered(|ui| {
                                let toggle = if self.register_mode {
                                    "Already enlisted? Sign in"
                                } else {
                                    "New pilot? Enlist here"
                                };
                                if ui.link(RichText::new(toggle).color(theme::BLUE_SOFT)).clicked() {
                                    self.register_mode = !self.register_mode;
                                }
                            });
                        });
                });

                if !self.status.is_empty() {
                    ui.add_space(12.0);
                    ui.vertical_centered(|ui| {
                        let color = if self.status_is_error { theme::RED_BRIGHT } else { theme::SLATE_400 };
                        ui.label(RichText::new(&self.status).color(color));
                    });
                }
            });
    }

    fn do_auth(&mut self) {
        let nick = self.login_nick.trim().to_string();
        let pass = self.login_pass.clone();
        if nick.is_empty() {
            self.error("Enter a pilot name.");
            return;
        }
        let result = if self.register_mode {
            self.backend.register(&nick, &pass)
        } else {
            self.backend.login(&nick, &pass)
        };
        match result {
            Ok(snap) => {
                self.apply_snapshot(snap);
                self.login_pass.clear();
                match self.backend.catalog() {
                    Ok(c) => self.catalog = c,
                    Err(e) => self.error(e),
                }
                self.info(format!("Welcome, {nick}."));
                self.screen = Screen::Hangar;
            }
            Err(e) => self.error(e),
        }
    }

    // -- hangar -------------------------------------------------------------

    fn ui_hangar(&mut self, ui: &mut egui::Ui) {
        let Some(snap) = self.snapshot.clone() else { return };
        let u = &snap.user;

        ui.horizontal(|ui| {
            ui.heading("Hangar");
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(format!("Fleet {}/{}", snap.active_count, snap.max_active_ships));
            });
        });
        theme::header_rule(ui);

        egui::Frame::new().fill(theme::SURFACE).inner_margin(12.0).show(ui, |ui| {
            egui::Grid::new("stats").num_columns(4).spacing([24.0, 4.0]).show(ui, |ui| {
                stat(ui, "Rank", u.rank.title());
                stat(ui, "Level", &u.level.to_string());
                stat(ui, "ELO", &format!("{:.0}", u.elo_rank));
                stat(ui, "Credits", &format!("{}", u.currency_value));
                ui.end_row();
                stat(ui, "Experience", &u.experience.to_string());
                stat(ui, "Victories", &u.victories.to_string());
                stat(ui, "Defeats", &u.defeats.to_string());
                stat(ui, "Ships destroyed", &u.ships_destroyed_by_user.to_string());
                ui.end_row();
            });
        });

        ui.add_space(8.0);
        ui.horizontal(|ui| {
            ui.label("Battle formation:");
            for (formation, label, tip) in FORMATIONS {
                let selected = self.chosen_formation == formation;
                if ui.selectable_label(selected, label).on_hover_text(tip).clicked() && !selected {
                    match self.backend.set_formation(formation) {
                        Ok(s) => {
                            self.apply_snapshot(s);
                            self.info(format!("Formation set to {label}."));
                        }
                        Err(e) => self.error(e),
                    }
                }
            }
        });

        // Ship defenses: turrets that fight anyone who boards YOUR flagship,
        // even while you are offline.
        ui.add_space(4.0);
        ui.horizontal(|ui| {
            let level = u.defense_level;
            ui.label("Ship defenses:");
            ui.label(
                RichText::new(match level {
                    0 => "None — boarders roam free".to_string(),
                    n => format!("Level {n} — {n} automated turret{}", if n == 1 { "" } else { "s" }),
                })
                .color(if level == 0 { theme::AMBER } else { theme::GREEN }),
            );
            if level < sim::DEFENSE_LEVEL_MAX {
                let cost = sim::defense_upgrade_cost(level);
                let affordable = u.currency_value >= cost;
                let label = format!("Upgrade ({cost} cr)");
                if ui
                    .add_enabled(affordable, egui::Button::new(label))
                    .on_hover_text("Adds an automated turret to your flagship's interior. Turrets attack enemy pilots who board you, even while you are offline.")
                    .clicked()
                {
                    self.act(|b| b.upgrade_defense(), "Ship defenses upgraded.");
                }
            } else {
                ui.label(RichText::new("MAX").small().color(theme::BLUE_SOFT));
            }
        });

        ui.add_space(8.0);
        ui.separator();

        if snap.ships.iter().all(|s| matches!(s.status, ShipStatus::Sold)) {
            ui.add_space(20.0);
            ui.vertical_centered(|ui| {
                ui.label(RichText::new("Your hangar is empty.").color(theme::TEXT_DIM));
                if ui.button("Visit the market").clicked() {
                    self.go(Screen::Market);
                }
            });
            return;
        }

        egui::ScrollArea::vertical().show(ui, |ui| {
            for ship in &snap.ships {
                if ship.status == ShipStatus::Sold {
                    continue;
                }
                self.ui_owned_ship(ui, ship);
            }
        });
    }

    fn ui_owned_ship(&mut self, ui: &mut egui::Ui, ship: &OwnedShip) {
        egui::Frame::new()
            .fill(theme::SURFACE)
            .stroke(egui::Stroke::new(1.0, theme::BORDER))
            .inner_margin(10.0)
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    let tier = sim::ship::template_by_id(ship.ship_id).map(|t| t.tier).unwrap_or(1);
                    crate::ship_art::ship_tile(ui, 46.0, crate::ship_art::archetype_of(ship.ship_id), tier_color(tier), tier);
                    ui.add_space(6.0);
                    ui.vertical(|ui| {
                        ui.label(RichText::new(&ship.ship_name).strong().size(16.0));
                        let (txt, col) = match ship.status {
                            ShipStatus::Active => ("ACTIVE", theme::GREEN),
                            ShipStatus::Owned => ("RESERVE", theme::TEXT_DIM),
                            ShipStatus::Destroyed => ("DESTROYED", theme::RED_BRIGHT),
                            ShipStatus::Sold => ("SOLD", theme::TEXT_DIM),
                        };
                        ui.label(RichText::new(txt).small().color(col));
                    });
                    ui.add_space(16.0);
                    ship_stat_bars(ui, &ship.actual, Some(&ship.base));

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        match ship.status {
                            ShipStatus::Active => {
                                if ui.button("Stand down").clicked() {
                                    self.act(|b| b.deactivate(ship.ship_number), "Ship stood down.");
                                }
                            }
                            ShipStatus::Owned => {
                                if ui.button("Activate").clicked() {
                                    self.act(|b| b.activate(ship.ship_number), "Ship activated.");
                                }
                            }
                            _ => {}
                        }
                        if ship.status != ShipStatus::Destroyed {
                            if ui.button("Sell").clicked() {
                                self.act(|b| b.sell(ship.ship_number), "Ship sold.");
                            }
                            if ship.needs_repair() && ui.button("Repair").clicked() {
                                self.act(|b| b.repair(ship.ship_number), "Ship repaired.");
                            }
                        }
                    });
                });
            });
        ui.add_space(6.0);
    }

    // -- market -------------------------------------------------------------

    fn ui_market(&mut self, ui: &mut egui::Ui) {
        ui.heading("Shipyard Market");
        let credits = self.snapshot.as_ref().map(|s| s.user.currency_value).unwrap_or(0);
        ui.label(RichText::new(format!("{credits} credits available")).color(theme::AMBER));
        theme::header_rule(ui);
        ui.add_space(2.0);

        let catalog = self.catalog.clone();
        egui::ScrollArea::vertical().show(ui, |ui| {
            let mut current_tier = 0u8;
            for t in &catalog {
                if t.tier != current_tier {
                    current_tier = t.tier;
                    ui.add_space(6.0);
                    ui.label(RichText::new(format!("Tier {} — {}", t.tier, t.series)).color(tier_color(t.tier)).strong());
                }
                let affordable = credits >= t.stats.value as i64;
                egui::Frame::new()
                    .fill(theme::SURFACE)
                    .stroke(egui::Stroke::new(1.0, theme::BORDER))
                    .inner_margin(10.0)
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            crate::ship_art::ship_tile(ui, 46.0, crate::ship_art::archetype_of(t.ship_id), tier_color(t.tier), t.tier);
                            ui.add_space(6.0);
                            ui.vertical(|ui| {
                                ui.label(RichText::new(&t.name).strong().size(16.0));
                                ui.label(RichText::new(format!("{} cr", t.stats.value as i64)).color(theme::AMBER));
                            });
                            ui.add_space(16.0);
                            ship_stat_bars(ui, &t.stats, None);
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                if theme::primary_button(ui, "Buy", Vec2::new(96.0, 30.0), affordable) {
                                    let ship_id = t.ship_id;
                                    self.act(move |b| b.buy(ship_id), "Ship purchased.");
                                }
                            });
                        });
                    });
                ui.add_space(6.0);
            }
        });
    }

    // -- work ---------------------------------------------------------------

    fn ui_work(&mut self, ui: &mut egui::Ui) {
        ui.heading("Work Detail");
        theme::header_rule(ui);
        let Some(snap) = self.snapshot.clone() else { return };
        let bonus = snap.user.rank.bonus();
        let (lo, hi) = sim::economy::work_income_range(snap.user.rank);
        let work_type = sim::economy::work_type_for_rank(snap.user.rank);

        ui.add_space(8.0);
        egui::Frame::new().fill(theme::SURFACE).inner_margin(16.0).show(ui, |ui| {
            ui.label(RichText::new(format!("Assignment: {work_type}")).strong().size(18.0));
            ui.label(RichText::new(format!("As a {}, you earn {}–{} credits per shift.", snap.user.rank.title(), lo, hi)).color(theme::TEXT_DIM));
            ui.label(RichText::new(format!("Shift cooldown: {} minutes.", bonus.work_cooldown_minutes)).color(theme::TEXT_DIM));
            ui.add_space(12.0);

            if snap.work_cooldown_remaining > 0 {
                ui.label(RichText::new(format!("Resting — ready in {}s.", snap.work_cooldown_remaining)).color(theme::AMBER));
            } else if theme::primary_button(ui, "Report for duty", Vec2::new(220.0, 40.0), true) {
                match self.backend.work() {
                    Ok((work, income, snap)) => {
                        self.apply_snapshot(snap);
                        self.info(format!("{work} complete — earned {income} credits."));
                    }
                    Err(e) => self.error(e),
                }
            }
        });
    }

    // -- battle -------------------------------------------------------------

    fn ui_battle(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.heading("Battle");
            if ui.button("Back to Galaxy").clicked() {
                self.battle_scene = None;
                self.go(Screen::Galaxy);
            }
        });
        theme::header_rule(ui);

        if self.battle_scene.is_some() {
            // Animated space battle fills the top of the arena.
            let avail = ui.available_size();
            let scene_h = (avail.y * 0.58).max(220.0);
            let (scene_rect, _) = ui.allocate_exact_size(Vec2::new(avail.x, scene_h), egui::Sense::hover());
            let dt = ui.input(|i| i.stable_dt);
            let battle_bg = self.backdrops.as_ref().map(|b| b.battle.clone());
            let mut finished = false;
            if let Some(scene) = &mut self.battle_scene {
                scene.update(dt);
                scene.draw(ui.painter(), scene_rect, battle_bg.as_ref());
                finished = scene.finished;
            }
            ui.add_space(8.0);
            if finished {
                if theme::primary_button(ui, "Continue", Vec2::new(160.0, 34.0), true) {
                    self.battle_scene = None;
                    self.go(Screen::Galaxy);
                }
                ui.add_space(6.0);
                if let Some(result) = self.last_battle.clone() {
                    self.ui_battle_result(ui, &result);
                }
            } else {
                ui.vertical_centered(|ui| {
                    ui.label(RichText::new("Fleets engaging…").color(theme::TEXT_DIM));
                });
            }
        } else if let Some(result) = self.last_battle.clone() {
            self.ui_battle_result(ui, &result);
        } else {
            ui.add_space(40.0);
            ui.vertical_centered(|ui| {
                ui.label(RichText::new("Choose a target in the Galaxy to engage.").color(theme::TEXT_DIM));
            });
        }
    }

    // -- galaxy map ---------------------------------------------------------

    fn ui_galaxy(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.heading("Galaxy");
            if ui.button("Refresh").clicked() {
                self.refresh_opponents();
            }
            if ui.button("Recenter").clicked() {
                self.galaxy_pan = Vec2::ZERO;
                self.galaxy_zoom = 1.0;
            }
            ui.label(RichText::new("drag to pan · scroll to zoom · click a system").small().color(theme::SLATE_400));
        });
        theme::header_rule(ui);

        let active = self.snapshot.as_ref().map(|s| s.active_count).unwrap_or(0);
        if active == 0 {
            ui.add_space(8.0);
            ui.label(RichText::new("Activate at least one ship in the Hangar before you can engage.").color(theme::GOLD));
        }

        // Interactive map area.
        let rect = ui.available_rect_before_wrap();
        let resp = ui.interact(rect, ui.id().with("galaxy_map"), egui::Sense::click_and_drag());
        if resp.dragged() {
            self.galaxy_pan += resp.drag_delta();
        }
        if resp.hovered() {
            let scroll = ui.input(|i| i.smooth_scroll_delta.y);
            if scroll != 0.0 {
                self.galaxy_zoom = (self.galaxy_zoom * (1.0 + scroll * 0.0015)).clamp(0.5, 3.0);
            }
        }

        let painter = ui.painter_at(rect);
        if let Some(b) = &self.backdrops {
            crate::backdrops::draw_cover(&painter, rect, &b.galaxy, 100);
        }
        let scale = rect.size().min_elem() * 0.42 * self.galaxy_zoom;
        let origin = rect.center() + self.galaxy_pan;
        let to_screen = |wx: f32, wy: f32| origin + Vec2::new(wx * scale, wy * scale);

        let opponents = self.opponents.clone();
        let my_nick = self.snapshot.as_ref().map(|s| s.user.nickname.clone()).unwrap_or_default();

        // Route lines from the home system to every star system.
        let t = ui.ctx().input(|i| i.time) as f32;
        let home = to_screen(0.0, 0.0);
        for o in &opponents {
            let (wx, wy) = system_pos(o.user_id);
            let sp = to_screen(wx, wy);
            painter.add(egui::Shape::dashed_line(
                &[home, sp],
                egui::Stroke::new(1.0, theme::SLATE_700.linear_multiply(0.7)),
                5.0,
                7.0,
            ));
        }

        // Star systems.
        let pointer = resp.interact_pointer_pos();
        let mut clicked_system: Option<u32> = None;
        for o in &opponents {
            let (wx, wy) = system_pos(o.user_id);
            let sp = to_screen(wx, wy);
            let selected = self.selected_opponent == Some(o.user_id);
            let color = if o.is_npc { theme::GOLD } else { theme::CYAN };
            let r = 5.0 + (o.active_ships as f32).min(8.0) * 0.8;

            painter.circle_filled(sp, r * 2.4, color.linear_multiply(0.16)); // glow
            painter.circle_filled(sp, r, color);
            painter.circle_stroke(sp, r, egui::Stroke::new(1.0, Color32::WHITE));
            if selected {
                let pulse = r + 6.0 + (t * 3.0).sin() * 1.5;
                painter.circle_stroke(sp, pulse, egui::Stroke::new(2.0, theme::BLUE));
                painter.circle_stroke(sp, pulse + 3.0, egui::Stroke::new(1.0, theme::BLUE.linear_multiply(0.35)));
            }
            painter.text(
                sp + Vec2::new(0.0, r + 10.0),
                egui::Align2::CENTER_CENTER,
                &o.nickname,
                egui::FontId::proportional(12.0),
                theme::TEXT,
            );
            painter.text(
                sp + Vec2::new(0.0, r + 24.0),
                egui::Align2::CENTER_CENTER,
                format!("Lv{} · {} ships", o.level, o.active_ships),
                egui::FontId::proportional(10.0),
                theme::SLATE_400,
            );

            if resp.clicked() {
                if let Some(p) = pointer {
                    if p.distance(sp) <= r + 8.0 {
                        clicked_system = Some(o.user_id);
                    }
                }
            }
        }
        if let Some(id) = clicked_system {
            self.selected_opponent = Some(id);
        }

        // Home system marker.
        painter.circle_filled(home, 16.0, theme::PURPLE.linear_multiply(0.25));
        painter.circle_filled(home, 8.0, theme::BLUE);
        painter.circle_stroke(home, 8.0, egui::Stroke::new(1.5, theme::BLUE_SOFT));
        painter.text(home + Vec2::new(0.0, -18.0), egui::Align2::CENTER_CENTER, "HOME", egui::FontId::proportional(12.0), theme::BLUE_SOFT);
        if !my_nick.is_empty() {
            painter.text(home + Vec2::new(0.0, 20.0), egui::Align2::CENTER_CENTER, &my_nick, egui::FontId::proportional(11.0), theme::TEXT);
        }

        // A fleet in transit: highlighted route plus a moving ship marker.
        if let Some(mv) = &self.fleet_travel {
            let (tx, ty) = system_pos(mv.target_id);
            let target = to_screen(tx, ty);
            let p = (mv.elapsed / mv.duration).clamp(0.0, 1.0);
            let pos = home + (target - home) * p;
            painter.line_segment([home, target], egui::Stroke::new(2.0, theme::BLUE.linear_multiply(0.85)));
            let dir = (target - home).normalized();
            let perp = Vec2::new(-dir.y, dir.x);
            painter.add(egui::Shape::convex_polygon(
                vec![pos + dir * 9.0, pos - dir * 6.0 + perp * 5.0, pos - dir * 6.0 - perp * 5.0],
                theme::CYAN,
                egui::Stroke::new(1.0, Color32::WHITE),
            ));
            painter.circle_filled(pos - dir * 6.0, 2.5, theme::GOLD); // engine glow
        }

        if opponents.is_empty() {
            painter.text(rect.center() + Vec2::new(0.0, 40.0), egui::Align2::CENTER_CENTER, "No systems in range. Refresh.", egui::FontId::proportional(13.0), theme::SLATE_400);
        }

        // Overlay: an en-route banner while a fleet is in transit, otherwise the
        // target/engage card for the selected system.
        if let Some(mv) = &self.fleet_travel {
            let remaining = (mv.duration - mv.elapsed).max(0.0);
            let name = mv.target_name.clone();
            let mut recall = false;
            egui::Area::new("enroute".into())
                .fixed_pos(rect.left_bottom() + Vec2::new(16.0, -100.0))
                .show(ui.ctx(), |ui| {
                    egui::Frame::new()
                        .fill(theme::SLATE_900)
                        .stroke(egui::Stroke::new(1.0, theme::BLUE))
                        .corner_radius(12)
                        .inner_margin(14.0)
                        .show(ui, |ui| {
                            ui.set_width(260.0);
                            ui.label(RichText::new(format!("Fleet en route to {name}")).strong());
                            ui.label(RichText::new(format!("Arriving in {:.1}s", remaining)).color(theme::CYAN));
                            ui.add_space(6.0);
                            if ui.button("Recall fleet").clicked() {
                                recall = true;
                            }
                        });
                });
            if recall {
                self.fleet_travel = None;
                self.info("Fleet recalled to home.");
            }
        } else {
            let selected = self
                .selected_opponent
                .and_then(|id| opponents.iter().find(|o| o.user_id == id).cloned());
            if let Some(o) = selected {
                let mut engage = false;
                egui::Area::new("target_card".into())
                    .fixed_pos(rect.left_bottom() + Vec2::new(16.0, -170.0))
                    .show(ui.ctx(), |ui| {
                        egui::Frame::new()
                            .fill(theme::SLATE_900)
                            .stroke(egui::Stroke::new(1.0, theme::SLATE_700))
                            .corner_radius(12)
                            .inner_margin(14.0)
                            .show(ui, |ui| {
                                ui.set_width(260.0);
                                ui.horizontal(|ui| {
                                    ui.spacing_mut().item_spacing.x = 6.0;
                                    let icon = if o.is_npc { Icon::Satellite } else { Icon::Ship };
                                    let color = if o.is_npc { theme::GOLD } else { theme::CYAN };
                                    icons::draw_inline(ui, 16.0, icon, color);
                                    ui.label(RichText::new(&o.nickname).strong().size(16.0));
                                });
                                ui.label(RichText::new(format!("{} · Lv {} · {:.0} ELO", o.rank, o.level, o.elo)).small().color(theme::SLATE_400));
                                ui.label(RichText::new(format!("{} active ships", o.active_ships)).small().color(theme::SLATE_400));
                                ui.add_space(8.0);
                                ui.label(RichText::new("FORMATION").small().color(theme::SLATE_400));
                                ui.horizontal(|ui| {
                                    for (formation, label, _) in FORMATIONS {
                                        if ui.selectable_label(self.chosen_formation == formation, label).clicked() {
                                            self.chosen_formation = formation;
                                        }
                                    }
                                });
                                ui.add_space(6.0);
                                let can_board = self.gl.is_some();
                                ui.add_enabled(
                                    can_board,
                                    egui::Checkbox::new(&mut self.board_first, "Board flagship first"),
                                )
                                .on_hover_text(
                                    "Deploy as a troop inside their flagship and sabotage vital \
                                     systems before the fleet battle.",
                                );
                                ui.add_space(6.0);
                                let can = active > 0;
                                if theme::primary_button(ui, "Launch fleet", Vec2::new(232.0, 36.0), can) {
                                    engage = true;
                                }
                            });
                    });
                if engage {
                    let (wx, wy) = system_pos(o.user_id);
                    let dist = (wx * wx + wy * wy).sqrt();
                    self.fleet_travel = Some(FleetTravel {
                        target_id: o.user_id,
                        target_name: o.nickname.clone(),
                        elapsed: 0.0,
                        duration: 1.5 + dist * 3.5,
                        board: self.board_first && self.gl.is_some(),
                    });
                    self.info(format!("Fleet launched toward {}.", o.nickname));
                }
            }
        }
    }

    fn do_battle(&mut self, opponent_id: u32, boarding: Option<sim::BoardingOutcome>) {
        // Capture the formation before apply_snapshot resets chosen_formation, so
        // both the backend call and the recorded action use the same value.
        let formation = self.chosen_formation;
        // Fleet sizes before the fight, for the animation.
        let player_total = self.snapshot.as_ref().map(|s| s.active_count).unwrap_or(1);
        let enemy_total = self
            .opponents
            .iter()
            .find(|o| o.user_id == opponent_id)
            .map(|o| o.active_ships)
            .unwrap_or(1);

        match self.backend.battle(opponent_id, formation, boarding.clone()) {
            Ok((result, snap)) => {
                let seed = (result.total_damage_dealt as u64)
                    .wrapping_mul(1_000_003)
                    ^ ((result.ships_lost as u64) << 8)
                    ^ ((result.ships_destroyed as u64) << 16)
                    ^ (opponent_id as u64);
                self.battle_scene = Some(crate::battle_scene::BattleScene::new(
                    player_total,
                    enemy_total,
                    result.ships_lost,
                    result.ships_destroyed,
                    result.player_won,
                    seed,
                ));
                self.apply_snapshot(snap);
                let msg = result.message.clone();
                self.last_battle = Some(result);
                self.info(msg);
                self.refresh_opponents();
                // Fires for human-clicked launches too — per the playtest guide,
                // don't mix human play with a recording session.
                #[cfg(feature = "agent")]
                self.recorded.push(testkit::env::Action::Battle {
                    opponent_id,
                    formation, // the value captured before apply_snapshot reset it
                    boarding,
                });
            }
            Err(e) => self.error(e),
        }
    }

    // -- boarding raid (FPS mode) --------------------------------------------

    /// Begin a boarding raid against `opponent_id`'s flagship. Falls back to a
    /// plain battle if there is no GL context or the renderer fails.
    fn start_boarding(&mut self, opponent_id: u32) {
        // The opponents cache may be cold (e.g. an agent launch that never
        // visited the Galaxy); the raid needs the defender's name and defense
        // level, so refresh before giving up on the lookup.
        if !self.opponents.iter().any(|o| o.user_id == opponent_id) {
            self.refresh_opponents();
        }
        let opponent = self.opponents.iter().find(|o| o.user_id == opponent_id);
        let name = opponent.map(|o| o.nickname.clone()).unwrap_or_else(|| format!("system {opponent_id}"));
        let defense_level = opponent.map(|o| o.defense_level).unwrap_or(0);

        #[cfg(feature = "agent")]
        let base_seed = self.agent_seed.unwrap_or(0x52_49_46_54);
        #[cfg(not(feature = "agent"))]
        let base_seed = 0x52_49_46_54u64;
        let seed = base_seed ^ ((opponent_id as u64) << 24) ^ 0xb0a2d;

        let game = crate::boarding::BoardingGame::new(seed, &name, defense_level);
        let Some(gl) = self.gl.clone() else {
            self.error("3D unavailable — engaging the fleet directly.");
            self.do_battle(opponent_id, None);
            self.screen = Screen::Battle;
            return;
        };
        match crate::boarding::renderer::BoardingRenderer::new(&gl, &game.interior) {
            Ok(renderer) => {
                self.boarding_renderer = Some(std::sync::Arc::new(std::sync::Mutex::new(renderer)));
                self.boarding = Some(game);
                self.boarding_opponent = Some(opponent_id);
                self.boarding_paused = false;
                self.screen = Screen::Boarding;
                self.info(format!("Boarding {name}'s flagship."));
            }
            Err(e) => {
                self.error(format!("Boarding renderer failed ({e}) — engaging the fleet directly."));
                self.do_battle(opponent_id, None);
                self.screen = Screen::Battle;
            }
        }
    }

    /// Tear down the raid and resolve the battle with its outcome (`None` if
    /// the player skipped boarding from the briefing).
    fn finish_boarding(&mut self, ctx: &egui::Context, outcome: Option<sim::BoardingOutcome>) {
        self.set_cursor_grab(ctx, false);
        if let (Some(gl), Some(renderer)) = (self.gl.clone(), self.boarding_renderer.take()) {
            if let Ok(r) = renderer.lock() {
                r.destroy(&gl);
            }
        }
        self.boarding = None;
        self.boarding_paused = false;
        if let Some(id) = self.boarding_opponent.take() {
            self.do_battle(id, outcome.filter(|o| !o.is_noop()));
            self.screen = Screen::Battle;
        } else {
            self.screen = Screen::Galaxy;
        }
    }

    fn set_cursor_grab(&mut self, ctx: &egui::Context, grab: bool) {
        if self.cursor_grabbed == grab {
            return;
        }
        self.cursor_grabbed = grab;
        // `Locked` is unsupported by winit on Windows: confine + hide instead,
        // and read raw device motion for the look delta.
        ctx.send_viewport_cmd(egui::ViewportCommand::CursorGrab(if grab {
            egui::CursorGrab::Confined
        } else {
            egui::CursorGrab::None
        }));
        ctx.send_viewport_cmd(egui::ViewportCommand::CursorVisible(!grab));
    }

    fn ui_boarding(&mut self, ui: &mut egui::Ui) {
        use crate::boarding::BoardingPhase;
        let ctx = ui.ctx().clone();
        let Some(phase) = self.boarding.as_ref().map(|g| g.phase) else {
            // No raid (e.g. stale screen after an agent command): recover.
            self.screen = Screen::Galaxy;
            return;
        };
        let rect = ui.max_rect();

        match phase {
            BoardingPhase::Briefing => {
                self.ui_boarding_briefing(ui, &ctx, rect);
            }
            BoardingPhase::Active | BoardingPhase::Complete => {
                self.ui_boarding_active(ui, &ctx, rect, phase == BoardingPhase::Complete);
            }
        }
    }

    fn ui_boarding_briefing(&mut self, ui: &mut egui::Ui, ctx: &egui::Context, rect: egui::Rect) {
        let t = ui.ctx().input(|i| i.time) as f32;
        theme::draw_starfield(ui.painter(), rect, t);
        let enemy = self.boarding.as_ref().map(|g| g.enemy_name.clone()).unwrap_or_default();
        let turrets = self.boarding.as_ref().map(|g| g.interior.turrets.len()).unwrap_or(0);
        let mut deploy = false;
        let mut skip = false;
        ui.vertical_centered(|ui| {
            ui.add_space(rect.height() * 0.16);
            ui.label(RichText::new("BOARDING ASSAULT").font(theme::display_font(34.0)).color(theme::TEXT));
            ui.label(RichText::new(format!("Target: {enemy}'s flagship")).color(theme::BLUE_SOFT));
            ui.add_space(16.0);
            egui::Frame::new()
                .fill(theme::SLATE_900)
                .stroke(egui::Stroke::new(1.0, theme::SLATE_700))
                .corner_radius(14)
                .inner_margin(20.0)
                .show(ui, |ui| {
                    ui.set_width(420.0);
                    ui.label(RichText::new("MISSION").small().color(theme::SLATE_400));
                    ui.label("Sabotage the flagship's vital systems, then extract at the airlock.");
                    ui.add_space(8.0);
                    for line in [
                        "Engines — cripples the enemy fleet's evasion",
                        "Shield generator — collapses their shields",
                        "Weapons bay — blunts their attack",
                        "Reactor core — leaves the flagship nearly dead",
                    ] {
                        ui.label(RichText::new(format!("· {line}")).color(theme::TEXT_DIM));
                    }
                    ui.add_space(8.0);
                    let defense_note = match turrets {
                        0 => "Intel: no automated defenses detected.".to_string(),
                        n => format!("Intel: {n} automated turret{} guarding the interior.", if n == 1 { "" } else { "s" }),
                    };
                    ui.label(RichText::new(defense_note).color(theme::AMBER));
                    let controls_hint = if self.touch_seen {
                        "left stick move · right stick aim · FIRE button shoots · hold EXTRACT at the airlock"
                    } else {
                        "WASD move · mouse aim · click fire · F extract · ESC pause"
                    };
                    ui.label(
                        RichText::new(format!(
                            "Time limit {:.0}s · {controls_hint}",
                            crate::boarding::TIME_LIMIT_SECS
                        ))
                        .small()
                        .color(theme::SLATE_400),
                    );
                    ui.add_space(12.0);
                    deploy = theme::primary_button(ui, "Deploy", Vec2::new(380.0, 40.0), true);
                    ui.add_space(6.0);
                    if ui.button("Skip boarding — engage the fleet directly").clicked() {
                        skip = true;
                    }
                });
        });
        if deploy {
            if let Some(g) = &mut self.boarding {
                g.start();
            }
            self.set_cursor_grab(ctx, true);
        }
        if skip {
            self.finish_boarding(ctx, None);
        }
    }

    fn ui_boarding_active(&mut self, ui: &mut egui::Ui, ctx: &egui::Context, rect: egui::Rect, complete: bool) {
        use crate::boarding::FrameInput;

        // Pause toggling (only while the raid is live).
        if !complete && ui.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.boarding_paused = !self.boarding_paused;
            let grab = !self.boarding_paused;
            self.set_cursor_grab(ctx, grab);
        }
        if complete {
            self.set_cursor_grab(ctx, false);
        }

        // Touch controls (phones): dual virtual joysticks + buttons.
        // Processed every frame so a tap on the on-screen pause button works
        // even while paused.
        self.process_boarding_touches(ui, rect, complete);

        // Map input and advance the simulation.
        let dt = ui.input(|i| i.stable_dt).min(0.05);
        let paused = self.boarding_paused;
        let grabbed = self.cursor_grabbed;
        let input = if paused || complete {
            FrameInput::default()
        } else if self.touch_seen {
            let layout = BoardingTouchLayout::new(rect);
            let (move_x, move_y) = match self.touch_move {
                Some((_, _, offset)) => (
                    (offset.x / 60.0).clamp(-1.0, 1.0),
                    (-offset.y / 60.0).clamp(-1.0, 1.0),
                ),
                None => (0.0, 0.0),
            };
            // The look stick turns at a rate set by its deflection (squared
            // for fine aim near center), expressed as mouse-pixels per second
            // so it runs through the same LOOK_SENSITIVITY as a mouse. Full
            // deflection is roughly a half turn per second.
            let look = match self.touch_look {
                Some((_, _, offset)) => {
                    let mut v = offset / layout.look_radius;
                    if v.length() > 1.0 {
                        v = v.normalized();
                    }
                    let rate = v * v.length() * 1100.0;
                    (rate.x * dt, rate.y * dt)
                }
                None => (0.0, 0.0),
            };
            FrameInput {
                move_x,
                move_y,
                look,
                shoot: self.touch_fire.is_some(),
                extract: self.touch_extract.is_some(),
                abort: false,
            }
        } else {
            ui.input(|i| FrameInput {
                move_x: (i.key_down(egui::Key::D) as i32 - i.key_down(egui::Key::A) as i32) as f32,
                move_y: (i.key_down(egui::Key::W) as i32 - i.key_down(egui::Key::S) as i32) as f32,
                look: {
                    if grabbed {
                        let d = i.pointer.motion().unwrap_or_else(|| i.pointer.delta());
                        (d.x, d.y)
                    } else {
                        (0.0, 0.0)
                    }
                },
                shoot: grabbed && i.pointer.primary_down(),
                extract: i.key_down(egui::Key::F),
                abort: false,
            })
        };
        if let Some(game) = &mut self.boarding {
            game.update(&input, dt);
        }

        // 3D viewport via the glow paint callback.
        let resp = ui.allocate_rect(rect, egui::Sense::click());
        if resp.clicked() && !self.touch_seen && !self.cursor_grabbed && !paused && !complete {
            self.set_cursor_grab(ctx, true);
        }
        if let (Some(game), Some(renderer)) = (&self.boarding, &self.boarding_renderer) {
            let time = ui.input(|i| i.time) as f32;
            let frame = crate::boarding::renderer::SceneFrame::from_game(
                game,
                rect.width() / rect.height().max(1.0),
                time,
            );
            let renderer = renderer.clone();
            ui.painter().add(egui::PaintCallback {
                rect,
                callback: std::sync::Arc::new(eframe::egui_glow::CallbackFn::new(move |_info, painter| {
                    if let Ok(r) = renderer.lock() {
                        r.paint(painter.gl(), &frame);
                    }
                })),
            });
        }

        self.ui_boarding_hud(ui, rect, paused, complete);
        if self.touch_seen && !paused && !complete {
            self.draw_boarding_touch_controls(ui, rect);
        }

        // Overlays with real buttons come last so they sit above the HUD.
        if paused && !complete {
            let mut resume = false;
            let mut give_up = false;
            egui::Area::new("boarding_pause".into())
                .fixed_pos(rect.center() - Vec2::new(130.0, 60.0))
                .show(ctx, |ui| {
                    egui::Frame::new()
                        .fill(theme::SLATE_900)
                        .stroke(egui::Stroke::new(1.0, theme::SLATE_700))
                        .corner_radius(12)
                        .inner_margin(18.0)
                        .show(ui, |ui| {
                            ui.set_width(240.0);
                            ui.label(RichText::new("PAUSED").font(theme::display_font(20.0)));
                            ui.add_space(8.0);
                            resume = theme::primary_button(ui, "Resume", Vec2::new(200.0, 34.0), true);
                            ui.add_space(4.0);
                            if ui.button("Abort raid — engage the fleet").clicked() {
                                give_up = true;
                            }
                        });
                });
            if resume {
                self.boarding_paused = false;
                self.set_cursor_grab(ctx, true);
            }
            if give_up {
                let outcome = self.boarding.as_ref().map(|g| g.outcome());
                self.finish_boarding(ctx, outcome);
                return;
            }
        }

        if complete {
            let (outcome, knocked_out) = match &self.boarding {
                Some(g) => (g.outcome(), g.player_hp <= 0.0),
                None => return,
            };
            let mut engage = false;
            egui::Area::new("boarding_summary".into())
                .fixed_pos(rect.center() - Vec2::new(170.0, 120.0))
                .show(ctx, |ui| {
                    egui::Frame::new()
                        .fill(theme::SLATE_900)
                        .stroke(egui::Stroke::new(1.0, theme::BLUE))
                        .corner_radius(14)
                        .inner_margin(20.0)
                        .show(ui, |ui| {
                            ui.set_width(320.0);
                            let (title, color) = if knocked_out {
                                ("KNOCKED OUT", theme::RED_BRIGHT)
                            } else if outcome.extracted {
                                ("RAID COMPLETE", theme::GREEN)
                            } else {
                                ("RAID OVER", theme::AMBER)
                            };
                            ui.label(RichText::new(title).font(theme::display_font(24.0)).color(color));
                            ui.add_space(6.0);
                            if outcome.destroyed.is_empty() {
                                ui.label(RichText::new("No subsystems destroyed.").color(theme::TEXT_DIM));
                            } else {
                                for s in &outcome.destroyed {
                                    ui.label(
                                        RichText::new(format!("{} destroyed", s.name()))
                                            .color(theme::GREEN),
                                    );
                                }
                            }
                            ui.add_space(10.0);
                            engage =
                                theme::primary_button(ui, "Engage the fleet", Vec2::new(280.0, 38.0), true);
                        });
                });
            if engage {
                self.finish_boarding(ctx, Some(outcome));
            }
        }
    }

    /// Painter-drawn HUD: crosshair, timer, HP, objectives, toasts, hints.
    /// Consume this frame's touch events for the boarding raid. Touch roles
    /// are assigned where the finger lands: the FIRE/EXTRACT/pause buttons
    /// first, then left half = move stick, right half = look stick. Each
    /// stick's base is planted where its finger first touched.
    fn process_boarding_touches(&mut self, ui: &egui::Ui, rect: egui::Rect, complete: bool) {
        let events = ui.input(|i| i.events.clone());
        for event in events {
            let egui::Event::Touch { id, phase, pos, .. } = event else { continue };
            self.touch_seen = true;
            match phase {
                egui::TouchPhase::Start => {
                    let layout = BoardingTouchLayout::new(rect);
                    if layout.pause.contains(pos) {
                        if !complete {
                            self.boarding_paused = !self.boarding_paused;
                        }
                    } else if pos.distance(layout.fire_center) <= layout.fire_radius {
                        self.touch_fire = Some(id.0);
                    } else if layout.extract.contains(pos) {
                        self.touch_extract = Some(id.0);
                    } else if pos.x < rect.center().x {
                        self.touch_move = Some((id.0, pos, egui::Vec2::ZERO));
                    } else {
                        self.touch_look = Some((id.0, pos, egui::Vec2::ZERO));
                    }
                }
                egui::TouchPhase::Move => {
                    if let Some((move_id, origin, offset)) = &mut self.touch_move {
                        if *move_id == id.0 {
                            *offset = pos - *origin;
                        }
                    }
                    if let Some((look_id, origin, offset)) = &mut self.touch_look {
                        if *look_id == id.0 {
                            *offset = pos - *origin;
                        }
                    }
                }
                egui::TouchPhase::End | egui::TouchPhase::Cancel => {
                    if matches!(self.touch_move, Some((move_id, ..)) if move_id == id.0) {
                        self.touch_move = None;
                    }
                    if matches!(self.touch_look, Some((look_id, ..)) if look_id == id.0) {
                        self.touch_look = None;
                    }
                    if self.touch_fire == Some(id.0) {
                        self.touch_fire = None;
                    }
                    if self.touch_extract == Some(id.0) {
                        self.touch_extract = None;
                    }
                }
            }
        }
    }

    /// Draw the on-screen boarding controls (only once a touch has been seen).
    fn draw_boarding_touch_controls(&self, ui: &egui::Ui, rect: egui::Rect) {
        let layout = BoardingTouchLayout::new(rect);
        let painter = ui.painter();
        let ring = egui::Stroke::new(1.5, Color32::from_white_alpha(70));

        // Joysticks: base ring at the touch origin (or resting spot), knob at
        // the drag offset clamped to the ring.
        let stick = |state: Option<(u64, egui::Pos2, egui::Vec2)>, rest: egui::Pos2, radius: f32| {
            let (base, offset) = match state {
                Some((_, origin, offset)) => (origin, offset),
                None => (rest, egui::Vec2::ZERO),
            };
            let clamped = if offset.length() > radius {
                offset.normalized() * radius
            } else {
                offset
            };
            painter.circle_stroke(base, radius, ring);
            painter.circle_filled(base + clamped, 22.0, Color32::from_white_alpha(60));
            (base, radius)
        };
        let (move_base, move_radius) = stick(self.touch_move, layout.stick_rest, layout.stick_radius);
        let (look_base, look_radius) = stick(self.touch_look, layout.look_rest, layout.look_radius);
        painter.text(
            move_base + Vec2::new(0.0, move_radius + 14.0),
            egui::Align2::CENTER_CENTER,
            "MOVE",
            egui::FontId::proportional(11.0),
            Color32::from_white_alpha(80),
        );
        painter.text(
            look_base + Vec2::new(0.0, look_radius + 14.0),
            egui::Align2::CENTER_CENTER,
            "LOOK",
            egui::FontId::proportional(11.0),
            Color32::from_white_alpha(80),
        );

        // FIRE button.
        let firing = self.touch_fire.is_some();
        let fire_fill = if firing { theme::RED_BRIGHT } else { Color32::from_rgba_unmultiplied(0xC4, 0x1A, 0x1A, 90) };
        painter.circle_filled(layout.fire_center, layout.fire_radius, fire_fill);
        painter.circle_stroke(layout.fire_center, layout.fire_radius, ring);
        painter.text(
            layout.fire_center,
            egui::Align2::CENTER_CENTER,
            "FIRE",
            theme::display_font(18.0),
            Color32::WHITE,
        );

        // EXTRACT (hold) button.
        let extracting = self.touch_extract.is_some();
        let ex_fill = if extracting { theme::GREEN } else { Color32::from_white_alpha(24) };
        painter.rect_filled(layout.extract, 8, ex_fill);
        painter.rect_stroke(layout.extract, 8, ring, egui::StrokeKind::Inside);
        painter.text(
            layout.extract.center(),
            egui::Align2::CENTER_CENTER,
            "EXTRACT",
            egui::FontId::proportional(13.0),
            if extracting { Color32::BLACK } else { theme::TEXT },
        );

        // Pause button.
        painter.rect_stroke(layout.pause, 6, ring, egui::StrokeKind::Inside);
        painter.text(
            layout.pause.center(),
            egui::Align2::CENTER_CENTER,
            "▮▮",
            egui::FontId::proportional(12.0),
            theme::TEXT_DIM,
        );
    }

    fn ui_boarding_hud(&mut self, ui: &mut egui::Ui, rect: egui::Rect, paused: bool, complete: bool) {
        let Some(game) = &self.boarding else { return };
        let painter = ui.painter();

        // Hurt flash.
        if game.hurt_flash {
            painter.rect_filled(rect, 0, Color32::from_rgba_unmultiplied(0xE0, 0x20, 0x10, 40));
        }

        // Crosshair.
        if !paused && !complete {
            let c = rect.center();
            let col = Color32::from_white_alpha(190);
            for (a, b) in [
                (Vec2::new(-9.0, 0.0), Vec2::new(-3.0, 0.0)),
                (Vec2::new(3.0, 0.0), Vec2::new(9.0, 0.0)),
                (Vec2::new(0.0, -9.0), Vec2::new(0.0, -3.0)),
                (Vec2::new(0.0, 3.0), Vec2::new(0.0, 9.0)),
            ] {
                painter.line_segment([c + a, c + b], egui::Stroke::new(1.5, col));
            }
            painter.circle_filled(c, 1.0, col);
        }

        // Timer, top center.
        let secs = game.time_remaining();
        let timer_color = if secs < 15.0 { theme::RED_BRIGHT } else { theme::TEXT };
        painter.text(
            egui::Pos2::new(rect.center().x, rect.top() + 26.0),
            egui::Align2::CENTER_CENTER,
            format!("{:02}:{:04.1}", (secs / 60.0) as u32, secs % 60.0),
            theme::display_font(26.0),
            timer_color,
        );

        // HP bar, top left.
        let hp_frac = (game.player_hp / crate::boarding::PLAYER_HP).clamp(0.0, 1.0);
        let bar = egui::Rect::from_min_size(rect.min + Vec2::new(16.0, 16.0), Vec2::new(180.0, 12.0));
        painter.rect_filled(bar, 4, theme::SLATE_800);
        let fill = egui::Rect::from_min_size(bar.min, Vec2::new(bar.width() * hp_frac, bar.height()));
        let hp_color = if hp_frac > 0.5 { theme::GREEN } else if hp_frac > 0.25 { theme::AMBER } else { theme::RED_BRIGHT };
        painter.rect_filled(fill, 4, hp_color);
        painter.text(
            bar.left_bottom() + Vec2::new(0.0, 6.0),
            egui::Align2::LEFT_TOP,
            format!("HP {:.0}", game.player_hp.max(0.0)),
            egui::FontId::proportional(12.0),
            theme::TEXT_DIM,
        );

        // Objective checklist, top right.
        let mut y = rect.top() + 16.0;
        for v in &game.interior.vitals {
            let x1 = rect.right() - 16.0;
            let label = v.subsystem.name().to_uppercase();
            let (text, color) = if v.destroyed {
                (format!("{label} — DESTROYED"), theme::GREEN)
            } else {
                (format!("{label} — {:.0}%", (v.hp / v.max_hp * 100.0).ceil()), theme::TEXT_DIM)
            };
            painter.text(
                egui::Pos2::new(x1, y),
                egui::Align2::RIGHT_TOP,
                text,
                egui::FontId::proportional(13.0),
                color,
            );
            y += 18.0;
        }
        // Turrets remaining.
        let live_turrets = game.interior.turrets.iter().filter(|t| t.alive).count();
        if live_turrets > 0 {
            painter.text(
                egui::Pos2::new(rect.right() - 16.0, y + 4.0),
                egui::Align2::RIGHT_TOP,
                format!("Turrets active: {live_turrets}"),
                egui::FontId::proportional(12.0),
                theme::AMBER,
            );
        }

        // Toasts, upper center.
        let mut ty = rect.top() + 64.0;
        for t in &game.toasts {
            let alpha = ((1.0 - (t.age / 3.0).powi(2)) * 255.0) as u8;
            painter.text(
                egui::Pos2::new(rect.center().x, ty),
                egui::Align2::CENTER_TOP,
                &t.text,
                egui::FontId::proportional(16.0),
                Color32::from_rgba_unmultiplied(0xFB, 0xBF, 0x24, alpha),
            );
            ty += 22.0;
        }

        // Extraction prompt when near the airlock.
        let near_airlock = {
            use math::prelude::*;
            let d2 = (game.controller.pos - game.interior.extraction).magnitude2();
            d2 <= game.interior.extraction_radius * game.interior.extraction_radius
        };
        if near_airlock && !complete {
            painter.text(
                egui::Pos2::new(rect.center().x, rect.bottom() - 64.0),
                egui::Align2::CENTER_CENTER,
                if self.touch_seen { "Hold EXTRACT to extract" } else { "Press F to extract" },
                theme::display_font(18.0),
                theme::CYAN,
            );
        }

        // Control hints, bottom.
        painter.text(
            egui::Pos2::new(rect.center().x, rect.bottom() - 18.0),
            egui::Align2::CENTER_CENTER,
            if self.touch_seen {
                "left stick move · right stick aim"
            } else if self.cursor_grabbed {
                "WASD move · mouse aim · click fire · F extract at the airlock · ESC pause"
            } else {
                "Click to take control"
            },
            egui::FontId::proportional(12.0),
            theme::SLATE_400,
        );
    }

    fn ui_battle_result(&mut self, ui: &mut egui::Ui, result: &BattleResultDto) {
        let (banner, color) = if result.player_won {
            (format!("VICTORY vs {}", result.opponent_nickname), theme::GREEN)
        } else {
            (format!("DEFEAT vs {}", result.opponent_nickname), theme::RED_BRIGHT)
        };
        ui.label(RichText::new(banner).size(24.0).strong().color(color));
        ui.horizontal(|ui| {
            ui.label(format!("Damage dealt: {:.0}", result.total_damage_dealt));
            ui.separator();
            ui.label(format!("Damage taken: {:.0}", result.total_damage_taken));
            ui.separator();
            ui.label(format!("Ships lost: {}", result.ships_lost));
            ui.separator();
            ui.label(format!("Destroyed: {}", result.ships_destroyed));
        });
        if result.credits_awarded > 0 {
            ui.label(RichText::new(format!("+{} credits", result.credits_awarded)).color(theme::AMBER));
        }
        ui.add_space(6.0);
        ui.label(RichText::new("Combat log").strong());
        egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
            for line in &result.log {
                let color = if line.contains("destroyed") || line.contains("wins") {
                    theme::AMBER
                } else if line.contains("evaded") {
                    theme::TEXT_DIM
                } else {
                    theme::TEXT
                };
                ui.label(RichText::new(line).small().color(color));
            }
        });
    }

    // -- leaderboard --------------------------------------------------------

    fn ui_leaderboard(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.heading("Leaderboard");
            if ui.button("Refresh").clicked() {
                self.refresh_leaderboard();
            }
        });
        theme::header_rule(ui);
        ui.add_space(2.0);
        let me = self.snapshot.as_ref().map(|s| s.user.nickname.clone()).unwrap_or_default();
        egui::ScrollArea::vertical().show(ui, |ui| {
            egui::Grid::new("lb").num_columns(6).striped(true).spacing([20.0, 6.0]).show(ui, |ui| {
                for h in ["#", "Pilot", "Rank", "Lv", "ELO", "W/L"] {
                    ui.label(RichText::new(h).strong().color(theme::TEXT_DIM));
                }
                ui.end_row();
                for (i, e) in self.leaderboard.iter().enumerate() {
                    let highlight = e.nickname == me;
                    let name = if highlight {
                        RichText::new(&e.nickname).strong().color(theme::AMBER)
                    } else {
                        RichText::new(&e.nickname)
                    };
                    ui.label(format!("{}", i + 1));
                    ui.label(name);
                    ui.label(&e.rank);
                    ui.label(format!("{}", e.level));
                    ui.label(format!("{:.0}", e.elo));
                    ui.label(format!("{}/{}", e.victories, e.defeats));
                    ui.end_row();
                }
            });
        });
    }

    // -- history ------------------------------------------------------------

    fn ui_history(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.heading("Battle History");
            if ui.button("Refresh").clicked() {
                self.refresh_history();
            }
        });
        theme::header_rule(ui);
        ui.add_space(2.0);
        egui::ScrollArea::vertical().show(ui, |ui| {
            if self.history.is_empty() {
                ui.label(RichText::new("No battles fought yet.").color(theme::TEXT_DIM));
            }
            for h in &self.history {
                let (txt, col) = if h.won { ("WON", theme::GREEN) } else { ("LOST", theme::RED_BRIGHT) };
                egui::Frame::new().fill(theme::SURFACE).inner_margin(8.0).show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(txt).strong().color(col));
                        ui.label(format!("vs {}", h.opponent_nickname));
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.label(RichText::new(&h.message).small().color(theme::TEXT_DIM));
                        });
                    });
                });
                ui.add_space(4.0);
            }
        });
    }

    /// Run a backend action that returns a fresh snapshot, then apply it.
    fn act(&mut self, f: impl FnOnce(&mut dyn GameApi) -> Result<PlayerSnapshot, String>, ok_msg: &str) {
        match f(self.backend.as_mut()) {
            Ok(snap) => {
                self.apply_snapshot(snap);
                self.info(ok_msg.to_string());
            }
            Err(e) => self.error(e),
        }
    }
}

#[cfg(feature = "agent")]
impl RiftApp {
    fn agent_observation(&self) -> testkit::env::Observation {
        testkit::env::Observation {
            player: self.snapshot.clone(),
            catalog: self.catalog.clone(),
            opponents: self.opponents.clone(),
            leaderboard: self.leaderboard.clone(),
            history: self.history.clone(),
            status: self.status.clone(),
            status_is_error: self.status_is_error,
            screen: Some(self.screen.name().to_string()),
        }
    }

    fn agent_state(&self) -> crate::agent_mode::StateReport {
        use crate::agent_mode::{FleetTravelState, StateReport, UiState};
        let fleet_travel = self.fleet_travel.as_ref().map(|mv| FleetTravelState {
            target_id: mv.target_id,
            target_name: mv.target_name.clone(),
            elapsed: mv.elapsed,
            duration: mv.duration,
            remaining: (mv.duration - mv.elapsed).max(0.0),
        });
        let battle_animating = self.battle_scene.as_ref().is_some_and(|s| !s.finished);
        let battle_finished = self.battle_scene.as_ref().is_some_and(|s| s.finished);
        let boarding = self.boarding.as_ref().map(|g| crate::agent_mode::BoardingState {
            phase: format!("{:?}", g.phase),
            time_remaining: g.time_remaining(),
            player_hp: g.player_hp,
            destroyed: g
                .interior
                .vitals
                .iter()
                .filter(|v| v.destroyed)
                .map(|v| v.subsystem.name().to_string())
                .collect(),
            pos: [g.controller.pos.x, g.controller.pos.y, g.controller.pos.z],
        });
        // UI verbs applicable right now (not core Actions, so absent from /actions).
        let mut available_ui_verbs = Vec::new();
        if self.snapshot.is_some() {
            available_ui_verbs.push("RefreshPlayer".to_string());
        }
        if self.fleet_travel.is_some() {
            available_ui_verbs.push("RecallFleet".to_string());
        }
        if battle_animating {
            available_ui_verbs.push("SkipBattleAnimation".to_string());
        }
        if battle_finished {
            available_ui_verbs.push("ContinueAfterBattle".to_string());
        }
        if boarding.is_some() {
            available_ui_verbs.push("ResolveBoarding".to_string());
            available_ui_verbs.push("BoardingSetPose".to_string());
        }
        StateReport {
            observation: self.agent_observation(),
            ui: UiState {
                screen: self.screen.name().to_string(),
                selected_opponent: self.selected_opponent,
                fleet_travel,
                battle_animating,
                battle_finished,
                boarding,
                available_ui_verbs,
            },
        }
    }

    /// Execute one UiCommand through the same code paths the buttons use.
    fn agent_apply(&mut self, ctx: &egui::Context, cmd: crate::agent_mode::UiCommand) -> Result<(), String> {
        use crate::agent_mode::UiCommand;
        use testkit::env::Action;
        match cmd {
            UiCommand::Core(Action::Battle { .. }) => {
                Err("Battle is not a direct command; use LaunchFleet".into())
            }
            UiCommand::Core(action) => self.agent_core(action),
            UiCommand::Goto(name) => match self.screen_by_name(&name) {
                Some(s) => {
                    self.go(s);
                    Ok(())
                }
                None => Err(format!("unknown screen {name}")),
            },
            UiCommand::SelectOpponent { user_id } => {
                self.selected_opponent = Some(user_id);
                Ok(())
            }
            UiCommand::LaunchFleet { user_id, instant, board } => self.agent_launch(user_id, instant, board),
            UiCommand::ResolveBoarding { destroyed, extracted } => {
                if self.screen != Screen::Boarding || self.boarding.is_none() {
                    return Err("no boarding raid in progress".into());
                }
                let outcome = sim::BoardingOutcome {
                    destroyed,
                    duration_secs: self.boarding.as_ref().map_or(0.0, |g| g.elapsed),
                    extracted,
                }
                .sanitized();
                self.finish_boarding(ctx, Some(outcome));
                Ok(())
            }
            UiCommand::BoardingSetPose { x, y, z, yaw, pitch } => {
                match &mut self.boarding {
                    Some(game) => {
                        // Debug/screenshot verb: skip the briefing so the 3D
                        // scene is on screen, then frame the shot.
                        game.start();
                        game.set_pose(x, y, z, yaw, pitch);
                        Ok(())
                    }
                    None => Err("no boarding raid in progress".into()),
                }
            }
            UiCommand::RecallFleet => {
                self.fleet_travel = None;
                self.info("Fleet recalled to home.");
                Ok(())
            }
            UiCommand::SkipBattleAnimation => {
                if let Some(s) = &mut self.battle_scene {
                    s.skip();
                }
                Ok(())
            }
            UiCommand::ContinueAfterBattle => {
                if self.battle_scene.as_ref().is_some_and(|s| s.finished) {
                    self.battle_scene = None;
                    self.go(Screen::Galaxy);
                    Ok(())
                } else {
                    Err("no finished battle to continue from".into())
                }
            }
            UiCommand::RefreshPlayer => {
                if self.snapshot.is_none() {
                    return Err("not logged in".into());
                }
                let snap = self.backend.snapshot()?;
                self.apply_snapshot(snap);
                Ok(())
            }
        }
    }

    fn agent_core(&mut self, action: testkit::env::Action) -> Result<(), String> {
        use testkit::env::Action;
        // Run through the same backend calls + apply_snapshot the buttons use.
        match action {
            Action::Register { nickname, password } => {
                let snap = self.backend.register(&nickname, &password)?;
                self.apply_snapshot(snap);
                self.catalog = self.backend.catalog().unwrap_or_default();
                self.screen = Screen::Hangar;
                self.recorded.push(Action::Register { nickname, password });
            }
            Action::Login { nickname, password } => {
                let snap = self.backend.login(&nickname, &password)?;
                self.apply_snapshot(snap);
                self.catalog = self.backend.catalog().unwrap_or_default();
                self.screen = Screen::Hangar;
                self.recorded.push(Action::Login { nickname, password });
            }
            Action::Work => {
                let (work, income, snap) = self.backend.work()?;
                self.apply_snapshot(snap);
                self.info(format!("{work} complete — earned {income} credits."));
                self.recorded.push(Action::Work);
            }
            // S1: each success calls self.info(..) for button parity, so agent
            // activity is visible in the window (the drain surfaces errors).
            Action::Buy { ship_id } => {
                let s = self.backend.buy(ship_id)?;
                self.apply_snapshot(s);
                self.info(format!("Bought ship {ship_id}."));
                self.recorded.push(Action::Buy { ship_id });
            }
            Action::Sell { ship_number } => {
                let s = self.backend.sell(ship_number)?;
                self.apply_snapshot(s);
                self.info(format!("Sold ship {ship_number}."));
                self.recorded.push(Action::Sell { ship_number });
            }
            Action::Repair { ship_number } => {
                let s = self.backend.repair(ship_number)?;
                self.apply_snapshot(s);
                self.info(format!("Repaired ship {ship_number}."));
                self.recorded.push(Action::Repair { ship_number });
            }
            Action::Activate { ship_number } => {
                let s = self.backend.activate(ship_number)?;
                self.apply_snapshot(s);
                self.info(format!("Activated ship {ship_number}."));
                self.recorded.push(Action::Activate { ship_number });
            }
            Action::Deactivate { ship_number } => {
                let s = self.backend.deactivate(ship_number)?;
                self.apply_snapshot(s);
                self.info(format!("Deactivated ship {ship_number}."));
                self.recorded.push(Action::Deactivate { ship_number });
            }
            Action::SetFormation(f) => {
                let s = self.backend.set_formation(f)?;
                self.apply_snapshot(s);
                self.info(format!("Formation set to {}.", f.as_str()));
                self.recorded.push(Action::SetFormation(f));
            }
            Action::Refresh(view) => {
                match view {
                    testkit::env::View::Opponents => self.refresh_opponents(),
                    testkit::env::View::Leaderboard => self.refresh_leaderboard(),
                    testkit::env::View::History => self.refresh_history(),
                }
                self.recorded.push(Action::Refresh(view));
            }
            Action::Battle { .. } => unreachable!("handled by agent_apply"),
        }
        Ok(())
    }

    fn agent_launch(&mut self, user_id: u32, instant: bool, board: bool) -> Result<(), String> {
        // The real UI hides the launch button while a fleet is already travelling.
        if self.fleet_travel.is_some() {
            return Err("a fleet is already in transit; recall it first".into());
        }
        let active = self.snapshot.as_ref().map_or(0, |s| s.active_count);
        if active == 0 {
            return Err("activate at least one ship before launching".into());
        }
        let name = self
            .opponents
            .iter()
            .find(|o| o.user_id == user_id)
            .map(|o| o.nickname.clone())
            .unwrap_or_else(|| format!("system {user_id}"));
        // Mirror ui_galaxy's launch math.
        let (wx, wy) = system_pos(user_id);
        let dist = (wx * wx + wy * wy).sqrt();
        let duration = 1.5 + dist * 3.5;
        self.selected_opponent = Some(user_id);
        self.fleet_travel = Some(FleetTravel {
            target_id: user_id,
            target_name: name.clone(),
            elapsed: if instant { duration } else { 0.0 },
            duration,
            board,
        });
        self.info(format!("Fleet launched toward {name}."));
        Ok(())
    }

    fn screen_by_name(&self, name: &str) -> Option<Screen> {
        // "Login" is intentionally excluded: Goto must not fake a logged-in
        // client onto the Login screen. (A real Logout verb is deferred.)
        Some(match name {
            "Hangar" => Screen::Hangar,
            "Market" => Screen::Market,
            "Work" => Screen::Work,
            "Galaxy" => Screen::Galaxy,
            "Battle" => Screen::Battle,
            "Leaderboard" => Screen::Leaderboard,
            "History" => Screen::History,
            _ => return None,
        })
    }

    fn agent_replay(&self) -> testkit::replay::Replay {
        testkit::replay::Replay {
            seed: self.agent_seed.unwrap_or(0),
            actions: self.recorded.clone(),
            expect: Default::default(),
            tolerate_rejections: true,
        }
    }

    /// Drain queued agent requests; called at the top of update(). Screenshot
    /// requests are deferred one frame (reply parked in pending_screenshot).
    fn drain_agent(&mut self, ctx: &egui::Context) {
        use crate::agent_mode::{AgentRequest, AgentResponse};
        // First, satisfy any screenshot parked from a previous frame.
        if !self.pending_screenshot.is_empty() {
            let shot = ctx.input(|i| {
                i.raw.events.iter().find_map(|e| match e {
                    egui::Event::Screenshot { image, .. } => Some(color_image_to_png(image)),
                    _ => None,
                })
            });
            if let Some(png) = shot {
                for reply in self.pending_screenshot.drain(..) {
                    let _ = reply.send(AgentResponse::Screenshot(Some(png.clone())));
                }
                self.pending_screenshot_frames = 0;
            } else {
                // N6: bail out if the Screenshot event never arrives (a lost event
                // must not pin `animating`/repaint forever). ~60 frames ≈ 1s.
                self.pending_screenshot_frames += 1;
                if self.pending_screenshot_frames > 60 {
                    for reply in self.pending_screenshot.drain(..) {
                        let _ = reply
                            .send(AgentResponse::Err("screenshot timed out (no frame captured)".into()));
                    }
                    self.pending_screenshot_frames = 0;
                }
            }
        }
        let Some(rx) = self.agent_rx.take() else { return };
        while let Ok((req, reply)) = rx.try_recv() {
            let resp = match req {
                AgentRequest::State => AgentResponse::State(self.agent_state()),
                AgentRequest::Actions => {
                    // S3: never advertise Battle — it is a 400 over /act; agents
                    // reach combat via LaunchFleet.
                    let mut acts = testkit::env::legal_actions_from(&self.agent_observation());
                    acts.retain(|a| !matches!(a, testkit::env::Action::Battle { .. }));
                    AgentResponse::Actions(acts)
                }
                AgentRequest::Replay => AgentResponse::Replay(self.agent_replay()),
                AgentRequest::Act(cmd) => match self.agent_apply(ctx, cmd) {
                    // S1: button parity — surface success/rejection in the window
                    // so agent activity is visible, and never report ok on reject.
                    Ok(()) => AgentResponse::State(self.agent_state()),
                    Err(e) => {
                        self.error(e.clone()); // visible in the window; sets status_is_error
                        AgentResponse::Err(e)
                    }
                },
                AgentRequest::Screenshot => {
                    // egui 0.30+: Screenshot carries a UserData payload (echoed back on the
                    // Event::Screenshot). We don't need to correlate requests, so send default.
                    ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(egui::UserData::default()));
                    self.pending_screenshot.push(reply);
                    self.pending_screenshot_frames = 0;
                    ctx.request_repaint();
                    continue; // reply deferred to next frame
                }
            };
            let _ = reply.send(resp);
        }
        self.agent_rx = Some(rx);
    }
}

#[cfg(feature = "agent")]
fn color_image_to_png(image: &egui::ColorImage) -> Vec<u8> {
    let [w, h] = image.size;
    let mut rgba = Vec::with_capacity(w * h * 4);
    for p in &image.pixels {
        rgba.extend_from_slice(&[p.r(), p.g(), p.b(), p.a()]);
    }
    let mut out = std::io::Cursor::new(Vec::new());
    let encoder = image::codecs::png::PngEncoder::new(&mut out);
    use image::ImageEncoder;
    encoder
        .write_image(&rgba, w as u32, h as u32, image::ExtendedColorType::Rgba8)
        .ok();
    out.into_inner()
}

impl eframe::App for RiftApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        let ctx = &ctx;
        if self.backdrops.is_none() {
            self.backdrops = Some(crate::backdrops::Backdrops::load(ctx));
        }
        // A touchscreen player gets touch-first hints and on-screen boarding
        // controls from the first tap anywhere in the app.
        if !self.touch_seen
            && ui.input(|i| i.events.iter().any(|e| matches!(e, egui::Event::Touch { .. })))
        {
            self.touch_seen = true;
        }
        #[cfg(feature = "agent")]
        self.drain_agent(ctx);
        // Advance any in-flight fleet; on arrival, board or resolve the battle.
        let arrived = if let Some(mv) = &mut self.fleet_travel {
            mv.elapsed += ctx.input(|i| i.stable_dt).min(0.5); // clamp huge frame gaps
            if mv.elapsed >= mv.duration {
                Some((mv.target_id, mv.board))
            } else {
                None
            }
        } else {
            None
        };
        if let Some((id, board)) = arrived {
            self.fleet_travel = None;
            if board {
                self.start_boarding(id);
            } else {
                self.do_battle(id, None);
                self.screen = Screen::Battle;
            }
        }

        if self.screen == Screen::Login {
            self.ui_login(ui);
        } else if self.screen == Screen::Boarding {
            // Full-window raid: no sidebar, total immersion.
            egui::CentralPanel::default()
                .frame(egui::Frame::new().fill(theme::SLATE_950))
                .show(ui, |ui| self.ui_boarding(ui));
        } else {
            self.ui_main(ui);
        }
        // Animate battles/travel/raids at full frame rate; otherwise just keep
        // the starfield twinkling without pegging the CPU.
        let animating = self.fleet_travel.is_some()
            || self.boarding.is_some()
            || self.battle_scene.as_ref().is_some_and(|s| !s.finished);
        #[cfg(feature = "agent")]
        let animating = animating || !self.pending_screenshot.is_empty();
        if animating {
            ctx.request_repaint();
        } else {
            ctx.request_repaint_after(std::time::Duration::from_millis(50));
        }
    }
}

// -- small UI helpers -------------------------------------------------------

fn stat(ui: &mut egui::Ui, label: &str, value: &str) {
    ui.vertical(|ui| {
        // Extend, don't wrap: grid columns are sized to content and short words
        // like "Victories" would otherwise break mid-word.
        ui.add(egui::Label::new(RichText::new(label).small().color(theme::TEXT_DIM)).wrap_mode(egui::TextWrapMode::Extend));
        ui.add(egui::Label::new(RichText::new(value).strong()).wrap_mode(egui::TextWrapMode::Extend));
    });
}

/// Draw a compact stat readout for a ship. If `base` is given, degraded stats
/// are tinted to show damage.
fn ship_stat_bars(ui: &mut egui::Ui, s: &ShipStats, base: Option<&ShipStats>) {
    let degraded = |cur: f64, base: Option<f64>| -> Color32 {
        match base {
            Some(b) if cur < b - 0.001 => theme::AMBER,
            _ => theme::TEXT,
        }
    };
    egui::Grid::new(ui.next_auto_id()).num_columns(3).spacing([18.0, 2.0]).show(ui, |ui| {
        ui.label(RichText::new(format!("ATK {:.0}", s.attack)).color(degraded(s.attack, base.map(|b| b.attack))));
        ui.label(RichText::new(format!("SHD {:.0}", s.shield)).color(degraded(s.shield, base.map(|b| b.shield))));
        ui.label(RichText::new(format!("HP {:.0}", s.hp)).color(degraded(s.hp, base.map(|b| b.hp))));
        ui.end_row();
        ui.label(RichText::new(format!("EVA {:.0}%", s.evasion * 100.0)).color(theme::TEXT_DIM));
        ui.label(RichText::new(format!("RATE {:.1}", s.fire_rate)).color(theme::TEXT_DIM));
        ui.label(RichText::new(format!("VAL {:.0}", s.value)).color(theme::TEXT_DIM));
        ui.end_row();
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(feature = "agent")]
    #[test]
    fn screen_names_are_stable() {
        assert_eq!(Screen::Login.name(), "Login");
        assert_eq!(Screen::Hangar.name(), "Hangar");
        assert_eq!(Screen::Galaxy.name(), "Galaxy");
        assert_eq!(Screen::Boarding.name(), "Boarding");
        assert_eq!(Screen::Battle.name(), "Battle");
        assert_eq!(Screen::History.name(), "History");
    }
}

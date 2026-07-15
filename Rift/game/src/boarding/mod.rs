//! Boarding Assault: the first-person raid inside an enemy flagship that runs
//! after fleet travel and before the stat battle. This module is pure CPU —
//! rendering lives in `renderer`, input mapping in the app. Fixed-timestep so
//! the same inputs produce the same raid regardless of frame rate.

pub mod collision;
pub mod controller;
pub mod geometry;
pub mod interior;
pub mod renderer;
pub mod shaders;

use controller::FpsController;
use interior::Interior;
use math::prelude::*;
use sim::BoardingOutcome;
#[cfg(test)]
use sim::Subsystem;

/// Raid timer, seconds.
pub const TIME_LIMIT_SECS: f32 = 90.0;
/// Hitscan damage per shot.
pub const GUN_DAMAGE: f32 = 20.0;
/// Seconds between shots while holding the trigger.
pub const GUN_COOLDOWN: f32 = 0.18;
/// Maximum hitscan range.
pub const GUN_RANGE: f32 = 60.0;
/// Player hit points.
pub const PLAYER_HP: f32 = 100.0;
/// Fixed simulation step (120 Hz).
pub const FIXED_DT: f32 = 1.0 / 120.0;
/// Mouse-look sensitivity (radians per pixel of raw motion).
pub const LOOK_SENSITIVITY: f32 = 0.0022;

// Turret tuning.
const TURRET_RANGE: f32 = 20.0;
const TURRET_WARMUP: f32 = 0.8;
const TURRET_REFIRE: f32 = 0.9;
const TURRET_DAMAGE: f32 = 9.0;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum BoardingPhase {
    /// Mission card shown; the world is built but time is not running.
    Briefing,
    /// The raid.
    Active,
    /// Raid over (extracted, knocked out, timed out, or aborted).
    Complete,
}

/// Per-frame player input, already mapped from egui (or the agent) by the app.
#[derive(Clone, Copy, Default)]
pub struct FrameInput {
    /// Strafe (-1..1, right positive).
    pub move_x: f32,
    /// Forward (-1..1, forward positive).
    pub move_y: f32,
    /// Mouse delta since last frame, pixels.
    pub look: (f32, f32),
    pub shoot: bool,
    pub extract: bool,
    pub abort: bool,
}

/// A transient HUD message ("Engines destroyed!").
pub struct Toast {
    pub text: String,
    pub age: f32,
}

pub struct BoardingGame {
    pub phase: BoardingPhase,
    pub interior: Interior,
    pub controller: FpsController,
    pub player_hp: f32,
    pub time_left: f32,
    pub elapsed: f32,
    pub enemy_name: String,
    pub toasts: Vec<Toast>,
    /// True once the raid ended by walking out (or clearing every subsystem).
    extracted: bool,
    gun_cooldown: f32,
    accumulator: f32,
    /// Set for one frame after a shot lands/fires, for HUD muzzle flash.
    pub shot_fired: bool,
    /// Set for one frame when the player takes damage, for HUD hurt flash.
    pub hurt_flash: bool,
}

impl BoardingGame {
    pub fn new(seed: u64, enemy_name: &str, defense_level: u8) -> Self {
        let interior = interior::generate(seed, defense_level);
        let controller = FpsController::new(interior.spawn, interior.spawn_yaw);
        BoardingGame {
            phase: BoardingPhase::Briefing,
            interior,
            controller,
            player_hp: PLAYER_HP,
            time_left: TIME_LIMIT_SECS,
            elapsed: 0.0,
            enemy_name: enemy_name.to_string(),
            toasts: vec![],
            extracted: false,
            gun_cooldown: 0.0,
            accumulator: 0.0,
            shot_fired: false,
            hurt_flash: false,
        }
    }

    /// Leave the briefing card and start the clock.
    pub fn start(&mut self) {
        if self.phase == BoardingPhase::Briefing {
            self.phase = BoardingPhase::Active;
        }
    }

    pub fn finished(&self) -> bool {
        self.phase == BoardingPhase::Complete
    }

    pub fn time_remaining(&self) -> f32 {
        self.time_left.max(0.0)
    }

    /// The raid's result, as the sim consumes it.
    pub fn outcome(&self) -> BoardingOutcome {
        BoardingOutcome {
            destroyed: self.interior.vitals.iter().filter(|v| v.destroyed).map(|v| v.subsystem).collect(),
            duration_secs: self.elapsed,
            extracted: self.extracted,
        }
        .sanitized()
    }

    /// Debug/agent helper: teleport the camera (used to frame screenshots).
    pub fn set_pose(&mut self, x: f32, y: f32, z: f32, yaw: f32, pitch: f32) {
        self.controller.pos = math::Pnt3f::new(x, y.max(controller::BODY_CENTER), z);
        self.controller.yaw = yaw;
        self.controller.pitch = pitch.clamp(-1.4, 1.4);
    }

    /// Advance by a real-time `dt` (clamped), running fixed substeps. Mouse
    /// look applies once per call (it is already a per-frame delta).
    pub fn update(&mut self, input: &FrameInput, dt: f32) {
        self.shot_fired = false;
        self.hurt_flash = false;
        for t in &mut self.toasts {
            t.age += dt;
        }
        self.toasts.retain(|t| t.age < 3.0);

        match self.phase {
            BoardingPhase::Briefing => {
                // Any movement/shoot input launches the raid; the app also
                // calls start() from the briefing button.
                if input.shoot || input.move_y != 0.0 || input.move_x != 0.0 {
                    self.start();
                }
                return;
            }
            BoardingPhase::Complete => return,
            BoardingPhase::Active => {}
        }

        self.controller.look(input.look.0, input.look.1, LOOK_SENSITIVITY);
        if input.abort {
            self.toast("Raid aborted — returning to the fleet.");
            self.complete(false);
            return;
        }

        self.accumulator += dt.min(0.05);
        while self.accumulator >= FIXED_DT && self.phase == BoardingPhase::Active {
            self.accumulator -= FIXED_DT;
            self.tick(input);
        }
    }

    fn tick(&mut self, input: &FrameInput) {
        self.elapsed += FIXED_DT;
        self.time_left -= FIXED_DT;
        if self.time_left <= 0.0 {
            self.toast("Time's up — enemy lockdown engaged!");
            self.complete(false);
            return;
        }

        self.controller.step(&self.interior.collision, input.move_x, input.move_y, FIXED_DT);

        // Shooting.
        self.gun_cooldown = (self.gun_cooldown - FIXED_DT).max(0.0);
        if input.shoot && self.gun_cooldown == 0.0 {
            self.gun_cooldown = GUN_COOLDOWN;
            self.shoot();
        }

        // Turrets.
        self.update_turrets();

        // Extraction: at the airlock with the extract key, or every vital gone.
        let all_destroyed = self.interior.vitals.iter().all(|v| v.destroyed);
        if all_destroyed {
            self.toast("All subsystems destroyed — beaming out!");
            self.complete(true);
            return;
        }
        if input.extract {
            let d2 = (self.controller.pos - self.interior.extraction).magnitude2();
            let r = self.interior.extraction_radius;
            if d2 <= r * r {
                self.toast("Extracted!");
                self.complete(true);
            }
        }
    }

    fn shoot(&mut self) {
        self.shot_fired = true;
        let origin = self.controller.eye();
        let dir = self.controller.forward();
        let wall = self.interior.collision.raycast(origin, dir, GUN_RANGE).unwrap_or(GUN_RANGE);

        // Nearest shootable target in front of the wall hit.
        enum Target {
            Vital(usize),
            Turret(usize),
        }
        let mut best: Option<(f32, Target)> = None;
        for (i, v) in self.interior.vitals.iter().enumerate() {
            if v.destroyed {
                continue;
            }
            if let Some(t) = collision::ray_sphere(origin, dir, v.pos, v.radius, wall) {
                if best.as_ref().is_none_or(|(bt, _)| t < *bt) {
                    best = Some((t, Target::Vital(i)));
                }
            }
        }
        for (i, t) in self.interior.turrets.iter().enumerate() {
            if !t.alive {
                continue;
            }
            if let Some(d) = collision::ray_sphere(origin, dir, t.pos, t.radius, wall) {
                if best.as_ref().is_none_or(|(bt, _)| d < *bt) {
                    best = Some((d, Target::Turret(i)));
                }
            }
        }

        match best {
            Some((_, Target::Vital(i))) => {
                let v = &mut self.interior.vitals[i];
                v.hp -= GUN_DAMAGE;
                if v.hp <= 0.0 {
                    v.destroyed = true;
                    let name = v.subsystem.name().to_uppercase();
                    self.toast(format!("{name} DESTROYED"));
                }
            }
            Some((_, Target::Turret(i))) => {
                let t = &mut self.interior.turrets[i];
                t.hp -= GUN_DAMAGE;
                if t.hp <= 0.0 {
                    t.alive = false;
                    self.toast("Turret down");
                }
            }
            None => {}
        }
    }

    fn update_turrets(&mut self) {
        let eye = self.controller.eye();
        let mut damage = 0.0;
        for t in &mut self.interior.turrets {
            if !t.alive {
                continue;
            }
            let to_player = eye - t.pos;
            let dist = to_player.magnitude();
            let in_range = dist < TURRET_RANGE && dist > 1e-3;
            // Line of sight: no wall between turret and player. The ray starts
            // just past the turret's own head geometry so it can't blind itself.
            let visible = in_range && {
                let dir = to_player / dist;
                let start = t.pos + dir * 0.55;
                let span = dist - 0.9;
                span <= 0.0 || self.interior.collision.raycast(start, dir, span).is_none()
            };
            if visible {
                t.warmup += FIXED_DT;
                t.cooldown = (t.cooldown - FIXED_DT).max(0.0);
                if t.warmup >= TURRET_WARMUP && t.cooldown == 0.0 {
                    t.cooldown = TURRET_REFIRE;
                    damage += TURRET_DAMAGE;
                }
            } else {
                t.warmup = (t.warmup - FIXED_DT * 2.0).max(0.0);
            }
        }
        if damage > 0.0 {
            self.player_hp -= damage;
            self.hurt_flash = true;
            if self.player_hp <= 0.0 {
                self.player_hp = 0.0;
                self.toast("You were knocked out — raid over.");
                self.complete(false);
            }
        }
    }

    fn complete(&mut self, extracted: bool) {
        self.extracted = extracted;
        self.phase = BoardingPhase::Complete;
    }

    fn toast(&mut self, text: impl Into<String>) {
        self.toasts.push(Toast { text: text.into(), age: 0.0 });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn active_game(seed: u64, defense: u8) -> BoardingGame {
        let mut g = BoardingGame::new(seed, "Bob", defense);
        g.start();
        g
    }

    /// Destroy every vital directly (tests outcome plumbing, not aim).
    fn destroy_all_vitals(g: &mut BoardingGame) {
        for v in &mut g.interior.vitals {
            v.hp = 0.0;
            v.destroyed = true;
        }
    }

    #[test]
    fn timer_runs_out_and_ends_the_raid_unextracted() {
        let mut g = active_game(1, 0);
        let input = FrameInput::default();
        for _ in 0..((TIME_LIMIT_SECS as usize + 2) * 25) {
            g.update(&input, 0.04);
            if g.finished() {
                break;
            }
        }
        assert!(g.finished(), "raid must end when the timer runs out");
        let o = g.outcome();
        assert!(!o.extracted);
        assert!(o.destroyed.is_empty());
    }

    #[test]
    fn clearing_all_vitals_auto_extracts() {
        let mut g = active_game(2, 0);
        destroy_all_vitals(&mut g);
        g.update(&FrameInput::default(), 0.02);
        assert!(g.finished());
        let o = g.outcome();
        assert!(o.extracted);
        assert_eq!(o.destroyed.len(), 4);
    }

    #[test]
    fn extract_at_airlock_keeps_partial_progress() {
        let mut g = active_game(3, 0);
        // Destroy just the engines.
        for v in &mut g.interior.vitals {
            if v.subsystem == Subsystem::Engines {
                v.hp = 0.0;
                v.destroyed = true;
            }
        }
        // Stand at the airlock and extract.
        let e = g.interior.extraction;
        g.set_pose(e.x, 0.9, e.z, 0.0, 0.0);
        g.update(&FrameInput { extract: true, ..Default::default() }, 0.02);
        assert!(g.finished());
        let o = g.outcome();
        assert!(o.extracted);
        assert_eq!(o.destroyed, vec![Subsystem::Engines]);
    }

    #[test]
    fn shooting_the_core_from_point_blank_destroys_it() {
        let mut g = active_game(4, 0);
        let core = g.interior.vitals.iter().find(|v| v.subsystem == Subsystem::ReactorCore).unwrap();
        let (cx, cz) = (core.pos.x, core.pos.z);
        // Stand 4m in front of the core, aim at it.
        g.set_pose(cx, 0.9, cz - 4.0, 0.0, 0.35);
        let shots_needed = (120.0 / GUN_DAMAGE).ceil() as usize;
        let mut fired = 0;
        // Hold the trigger; each update fires at most one shot per cooldown.
        for _ in 0..(shots_needed * 10) {
            g.update(&FrameInput { shoot: true, ..Default::default() }, GUN_COOLDOWN + 0.01);
            fired += 1;
            let core = g.interior.vitals.iter().find(|v| v.subsystem == Subsystem::ReactorCore).unwrap();
            if core.destroyed {
                break;
            }
            assert!(fired < shots_needed * 10, "core never died");
        }
        let core = g.interior.vitals.iter().find(|v| v.subsystem == Subsystem::ReactorCore).unwrap();
        assert!(core.destroyed, "core should be destroyed after sustained fire");
    }

    #[test]
    fn turrets_knock_out_a_stationary_player() {
        // Max defenses; stand on open floor two meters in front of a turret.
        // (Deterministic seed: turret 0 sits in the reactor chamber with clear
        // floor toward the corridor, -Z of it.)
        let mut g = active_game(5, 5);
        let tpos = g.interior.turrets[0].pos;
        g.set_pose(tpos.x, 0.9, tpos.z - 2.0, 0.0, 0.0);
        let input = FrameInput::default();
        for _ in 0..2000 {
            g.update(&input, 0.03);
            if g.finished() {
                break;
            }
        }
        assert!(g.finished(), "turret fire should end the raid");
        assert!(g.player_hp <= 0.0, "player should be knocked out, hp = {}", g.player_hp);
        assert!(!g.outcome().extracted);
    }

    #[test]
    fn briefing_phase_freezes_the_clock() {
        let mut g = BoardingGame::new(6, "Bob", 0);
        g.update(&FrameInput::default(), 1.0);
        assert_eq!(g.time_remaining(), TIME_LIMIT_SECS);
        assert_eq!(g.phase, BoardingPhase::Briefing);
    }
}

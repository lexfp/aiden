//! A real-time visual space battle: the player's fleet and the enemy fleet are
//! drawn as ships trading laser fire, with hits, explosions, and a final result.
//! Purely cosmetic — the authoritative outcome comes from the sim; this scene is
//! seeded from the battle report so the right ships survive.

use crate::theme;
use eframe::egui::{self, Color32, Pos2, Rect, Stroke, Vec2};

/// Total run time of the animation, in seconds.
const DURATION: f32 = 4.5;

struct Ship {
    /// Normalised position within the scene rect (0..1).
    nx: f32,
    ny: f32,
    /// 0 = player (faces right), 1 = enemy (faces left).
    side: u8,
    color: Color32,
    archetype: u8,
    tier: u8,
    /// Time (seconds) at which this ship is destroyed, or `None` if it survives.
    die_at: Option<f32>,
    alive: bool,
}

struct Laser {
    from: (f32, f32),
    to: (f32, f32),
    age: f32,
    color: Color32,
}

struct Explosion {
    nx: f32,
    ny: f32,
    age: f32,
}

pub struct BattleScene {
    ships: Vec<Ship>,
    lasers: Vec<Laser>,
    explosions: Vec<Explosion>,
    elapsed: f32,
    fire_timer: f32,
    rng: u64,
    player_won: bool,
    /// True once the animation has fully played out.
    pub finished: bool,
}

fn rand01(state: &mut u64) -> f32 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    ((*state >> 33) as f32) / ((1u64 << 31) as f32)
}

impl BattleScene {
    /// Build a scene. `player_total`/`enemy_total` are fleet sizes; the losers
    /// are chosen to match the real battle (`player_lost`, `enemy_lost`).
    pub fn new(
        player_total: u32,
        enemy_total: u32,
        player_lost: u32,
        enemy_lost: u32,
        player_won: bool,
        seed: u64,
    ) -> Self {
        let mut rng = seed | 1;
        let mut ships = Vec::new();

        let add_side = |ships: &mut Vec<Ship>, total: u32, lost: u32, side: u8, rng: &mut u64| {
            let total = total.max(1);
            let cols = if total > 6 { 2 } else { 1 };
            let per_col = (total as f32 / cols as f32).ceil() as u32;
            let base_x = if side == 0 { 0.20 } else { 0.80 };
            let col_step = if side == 0 { -0.09 } else { 0.09 };
            for i in 0..total {
                let col = i / per_col;
                let row = i % per_col;
                let rows_here = per_col.min(total - col * per_col).max(1);
                let ny = 0.5 + (row as f32 - (rows_here as f32 - 1.0) / 2.0) * 0.13;
                let nx = base_x + col as f32 * col_step;
                let color = if side == 0 { theme::CYAN } else { theme::RED_BRIGHT };
                // Ships marked to die do so in the back half of the fight.
                let will_die = i < lost;
                let die_at = if will_die { Some(DURATION * (0.45 + rand01(rng) * 0.5)) } else { None };
                let archetype = (rand01(rng) * 5.0) as u8;
                let tier = 1 + (rand01(rng) * 6.0) as u8;
                ships.push(Ship { nx, ny, side, color, archetype, tier, die_at, alive: true });
            }
        };
        add_side(&mut ships, player_total, player_lost, 0, &mut rng);
        add_side(&mut ships, enemy_total, enemy_lost, 1, &mut rng);

        BattleScene {
            ships,
            lasers: Vec::new(),
            explosions: Vec::new(),
            elapsed: 0.0,
            fire_timer: 0.0,
            rng,
            player_won,
            finished: false,
        }
    }

    /// Advance the simulation by `dt` seconds.
    pub fn update(&mut self, dt: f32) {
        let dt = dt.min(0.05); // guard against big frame gaps
        self.elapsed += dt;

        // Retire ships whose death time has passed, spawning an explosion.
        for i in 0..self.ships.len() {
            if self.ships[i].alive {
                if let Some(t) = self.ships[i].die_at {
                    if self.elapsed >= t {
                        self.ships[i].alive = false;
                        let (nx, ny) = (self.ships[i].nx, self.ships[i].ny);
                        self.explosions.push(Explosion { nx, ny, age: 0.0 });
                    }
                }
            }
        }

        // Fire lasers between living opposing ships at a steady cadence.
        self.fire_timer -= dt;
        if self.elapsed < DURATION && self.fire_timer <= 0.0 {
            self.fire_timer = 0.10;
            self.spawn_laser();
            self.spawn_laser();
        }

        for l in &mut self.lasers {
            l.age += dt;
        }
        self.lasers.retain(|l| l.age < 0.35);

        for e in &mut self.explosions {
            e.age += dt;
        }
        self.explosions.retain(|e| e.age < 0.6);

        if self.elapsed >= DURATION && self.lasers.is_empty() && self.explosions.is_empty() {
            self.finished = true;
        }
    }

    /// Instantly end the animation: mark it finished and drop any in-flight
    /// lasers/explosions so the result banner shows immediately.
    #[cfg_attr(not(feature = "agent"), allow(dead_code))]
    pub fn skip(&mut self) {
        self.elapsed = DURATION;
        self.lasers.clear();
        self.explosions.clear();
        // Retire doomed ships without spawning explosions, so a skipped scene
        // doesn't flash explosions (or leave dying ships drawn) on the next frame.
        for s in &mut self.ships {
            if s.die_at.is_some() {
                s.alive = false;
            }
        }
        self.finished = true;
    }

    fn spawn_laser(&mut self) {
        let attackers: Vec<usize> = (0..self.ships.len()).filter(|&i| self.ships[i].alive).collect();
        if attackers.is_empty() {
            return;
        }
        let a = attackers[(rand01(&mut self.rng) * attackers.len() as f32) as usize % attackers.len()];
        let side = self.ships[a].side;
        let targets: Vec<usize> =
            (0..self.ships.len()).filter(|&i| self.ships[i].alive && self.ships[i].side != side).collect();
        if targets.is_empty() {
            return;
        }
        let t = targets[(rand01(&mut self.rng) * targets.len() as f32) as usize % targets.len()];
        self.lasers.push(Laser {
            from: (self.ships[a].nx, self.ships[a].ny),
            to: (self.ships[t].nx, self.ships[t].ny),
            age: 0.0,
            color: self.ships[a].color,
        });
    }

    /// Draw the scene into `rect`, over an optional photo backdrop.
    pub fn draw(&self, painter: &egui::Painter, rect: Rect, background: Option<&egui::TextureHandle>) {
        if let Some(tex) = background {
            crate::backdrops::draw_cover(painter, rect, tex, 150);
        }
        let map = |nx: f32, ny: f32| Pos2::new(rect.left() + nx * rect.width(), rect.top() + ny * rect.height());

        // Lasers first (behind ships): a wide soft bloom pass under a hot core.
        for l in &self.lasers {
            let from = map(l.from.0, l.from.1);
            let to = map(l.to.0, l.to.1);
            let head = from + (to - from) * (l.age / 0.35).min(1.0);
            painter.line_segment([from, head], Stroke::new(4.5, l.color.linear_multiply(0.25)));
            painter.line_segment([from, head], Stroke::new(1.5, l.color));
            painter.circle_filled(head, 3.5, l.color.linear_multiply(0.35));
            painter.circle_filled(head, 2.0, Color32::WHITE);
        }

        // Ships (original procedural sprites).
        for s in &self.ships {
            if !s.alive {
                continue;
            }
            let c = map(s.nx, s.ny);
            let dir = if s.side == 0 { 1.0 } else { -1.0 };
            crate::ship_art::draw_ship(painter, c, 16.0, dir, s.archetype, s.color, s.tier);
        }

        // Explosions on top: expanding shockwave ring + hot core + soft flash.
        for e in &self.explosions {
            let p = map(e.nx, e.ny);
            let f = e.age / 0.6;
            let r = 6.0 + f * 26.0;
            let alpha = ((1.0 - f) * 220.0) as u8;
            painter.circle_filled(p, r * 1.5, Color32::from_rgba_unmultiplied(0xFF, 0x99, 0x33, alpha / 5));
            painter.circle_stroke(p, r, Stroke::new(2.0, Color32::from_rgba_unmultiplied(0xFF, 0x88, 0x22, alpha)));
            painter.circle_stroke(p, r * 1.25, Stroke::new(1.0, Color32::from_rgba_unmultiplied(0xFF, 0xFF, 0xFF, alpha / 3)));
            painter.circle_filled(p, r * 0.4, Color32::from_rgba_unmultiplied(0xFF, 0xD0, 0x66, alpha));
        }

        // "VS" divider label while fighting.
        if !self.finished {
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                "VS",
                egui::FontId::proportional(28.0),
                theme::SLATE_700,
            );
        } else {
            let (txt, col) = if self.player_won {
                ("VICTORY", theme::GREEN)
            } else {
                ("DEFEAT", theme::RED_BRIGHT)
            };
            painter.text(
                rect.center_top() + Vec2::new(0.0, 24.0),
                egui::Align2::CENTER_CENTER,
                txt,
                egui::FontId::proportional(32.0),
                col,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn skip_finishes_and_clears_effects() {
        let mut s = BattleScene::new(3, 3, 1, 2, true, 42);
        s.update(0.05);
        s.skip();
        assert!(s.finished, "skip must set finished");
        assert!(s.lasers.is_empty() && s.explosions.is_empty(), "skip must clear in-flight effects");
        // Doomed ships must be retired (no lingering explosions next frame).
        assert!(
            s.ships.iter().all(|sh| sh.die_at.is_none() || !sh.alive),
            "skip must retire all doomed ships",
        );
    }
}

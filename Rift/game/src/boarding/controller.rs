//! First-person character controller: mouse-look with pitch clamp and
//! slide-along-surface movement via iterative swept-sphere clipping, ported
//! from the original engine's player controller. Interiors are flat, so there
//! is no gravity — the collision sphere stays at chest height.

use super::collision::CollisionMesh;
use math::prelude::*;
use math::{vec3, Pnt3f, Sphere, Vec3f};

/// Radius of the player's collision sphere.
pub const PLAYER_RADIUS: f32 = 0.45;
/// Height of the sphere center above the floor.
pub const BODY_CENTER: f32 = 0.9;
/// Eye height above the floor.
pub const EYE_HEIGHT: f32 = 1.6;
/// Walk speed, m/s.
pub const WALK_SPEED: f32 = 5.0;
/// How quickly velocity approaches the wished velocity (1/s).
const ACCEL: f32 = 14.0;
/// Pitch clamp, radians (just under straight up/down).
const PITCH_LIMIT: f32 = 1.45;
/// Pull-back from a contact so the sphere never rests exactly on a surface.
const SKIN: f32 = 1e-3;

pub struct FpsController {
    /// Collision-sphere center (y is locked to `BODY_CENTER` above the floor).
    pub pos: Pnt3f,
    pub vel: Vec3f,
    /// Yaw around +Y; 0 looks down +Z.
    pub yaw: f32,
    pub pitch: f32,
}

impl FpsController {
    pub fn new(spawn_floor: Pnt3f, yaw: f32) -> Self {
        FpsController {
            pos: Pnt3f::new(spawn_floor.x, spawn_floor.y + BODY_CENTER, spawn_floor.z),
            vel: vec3(0.0, 0.0, 0.0),
            yaw,
            pitch: 0.0,
        }
    }

    /// Apply a mouse delta (pixels); positive `dy` looks down.
    pub fn look(&mut self, dx: f32, dy: f32, sensitivity: f32) {
        self.yaw -= dx * sensitivity;
        self.pitch = (self.pitch - dy * sensitivity).clamp(-PITCH_LIMIT, PITCH_LIMIT);
    }

    /// Unit view direction from yaw and pitch.
    pub fn forward(&self) -> Vec3f {
        let (sy, cy) = self.yaw.sin_cos();
        let (sp, cp) = self.pitch.sin_cos();
        vec3(sy * cp, sp, cy * cp)
    }

    /// Eye position (camera origin).
    pub fn eye(&self) -> Pnt3f {
        self.pos + vec3(0.0, EYE_HEIGHT - BODY_CENTER, 0.0)
    }

    /// One fixed step: accelerate toward the wished direction (`move_x` strafe,
    /// `move_y` forward, both -1..1 in view space) and slide along walls.
    pub fn step(&mut self, collision: &CollisionMesh, move_x: f32, move_y: f32, dt: f32) {
        let (sy, cy) = self.yaw.sin_cos();
        let fwd = vec3(sy, 0.0, cy);
        let right = vec3(cy, 0.0, -sy);
        let wish = (fwd * move_y + right * move_x).normalize_or_zero() * WALK_SPEED;
        let blend = 1.0 - (-ACCEL * dt).exp();
        self.vel += (wish - self.vel) * blend;
        self.vel.y = 0.0;
        self.clip(collision, self.vel * dt);
    }

    /// Iterative slide: advance to the first contact, remove the velocity
    /// component into the surface, and retry with the remaining displacement.
    fn clip(&mut self, collision: &CollisionMesh, mut displacement: Vec3f) {
        for _ in 0..4 {
            if displacement.magnitude2() < 1e-12 {
                break;
            }
            let sphere = Sphere { center: self.pos, radius: PLAYER_RADIUS };
            match collision.sweep_sphere(sphere, displacement) {
                None => {
                    self.pos += displacement;
                    break;
                }
                Some(contact) => {
                    let t = (contact.time - SKIN / displacement.magnitude().max(SKIN)).max(0.0);
                    self.pos += displacement * t;
                    let remaining = displacement * (1.0 - t);
                    // Remove the component into the surface from both the
                    // remaining displacement and the persistent velocity.
                    displacement = remaining - contact.normal * remaining.dot(contact.normal);
                    self.vel -= contact.normal * self.vel.dot(contact.normal);
                }
            }
        }
        // Interiors are flat: never leave the walking plane.
        self.pos.y = BODY_CENTER;
        self.vel.y = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::boarding::geometry::{p3, Builder};

    fn room() -> CollisionMesh {
        let mut b = Builder::default();
        b.box_interior(p3(-5.0, 0.0, -5.0), p3(5.0, 3.0, 5.0), [0.5; 3], [0.4; 3], [0.3; 3]);
        CollisionMesh { tris: b.collision }
    }

    #[test]
    fn walking_forward_moves_forward() {
        let m = room();
        let mut c = FpsController::new(p3(0.0, 0.0, 0.0), 0.0);
        for _ in 0..120 {
            c.step(&m, 0.0, 1.0, 1.0 / 120.0);
        }
        assert!(c.pos.z > 2.0, "should have covered ground, z = {}", c.pos.z);
        assert!(c.pos.x.abs() < 1e-3);
    }

    #[test]
    fn walls_contain_the_player() {
        let m = room();
        let mut c = FpsController::new(p3(0.0, 0.0, 0.0), 0.0);
        // Walk into the +Z wall for three seconds.
        for _ in 0..360 {
            c.step(&m, 0.0, 1.0, 1.0 / 120.0);
        }
        assert!(c.pos.z < 5.0 - PLAYER_RADIUS + 0.05, "went through the wall: z = {}", c.pos.z);
    }

    #[test]
    fn sliding_along_a_wall_keeps_tangential_motion() {
        let m = room();
        let mut c = FpsController::new(p3(0.0, 0.0, 4.4), 0.0); // almost touching +Z wall
        // Walk diagonally into the wall; x should still advance.
        let start_x = c.pos.x;
        for _ in 0..240 {
            c.step(&m, 1.0, 1.0, 1.0 / 120.0);
        }
        assert!(c.pos.x > start_x + 1.0, "should slide along the wall, x = {}", c.pos.x);
    }

    #[test]
    fn random_walk_never_escapes_the_room() {
        let m = room();
        let mut c = FpsController::new(p3(0.0, 0.0, 0.0), 0.3);
        let mut state = 0x9e3779b97f4a7c15u64;
        let mut rand = || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            (state >> 33) as f32 / (1u64 << 31) as f32 - 0.5
        };
        for _ in 0..2000 {
            let (mx, my, turn) = (rand() * 2.0, rand() * 2.0, rand());
            c.yaw += turn * 0.2;
            c.step(&m, mx, my, 1.0 / 120.0);
            assert!(
                c.pos.x.abs() < 5.0 && c.pos.z.abs() < 5.0,
                "escaped the room at {:?}",
                c.pos
            );
        }
    }
}

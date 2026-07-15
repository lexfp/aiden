//! Collision queries over the interior's triangle soup: swept-sphere movement
//! (ported from the original engine's level `Volume`) and a small-radius
//! raycast for hitscan shooting, plus ray-vs-sphere for vital-point proxies.

use super::geometry::Tri;
use math::prelude::*;
use math::{ContactInfo, Pnt3f, Sphere, Vec3f};

/// A few thousand triangles at most — brute force is plenty.
pub struct CollisionMesh {
    pub tris: Vec<Tri>,
}

impl CollisionMesh {
    /// Earliest contact for a sphere displaced by `displacement` this step.
    /// `ContactInfo::time` is the fraction of the displacement (0..=1).
    pub fn sweep_sphere(&self, sphere: Sphere, displacement: Vec3f) -> Option<ContactInfo> {
        if displacement.magnitude2() < 1e-12 {
            return None;
        }
        let mut best: Option<ContactInfo> = None;
        for tri in &self.tris {
            if let Some(c) = sphere.sweep_triangle(&tri.verts, tri.normal, displacement) {
                if c.time <= 1.0 && best.as_ref().is_none_or(|b| c.time < b.time) {
                    best = Some(c);
                }
            }
        }
        best
    }

    /// Distance along `dir` (unit) to the nearest wall within `max_dist`.
    pub fn raycast(&self, origin: Pnt3f, dir: Vec3f, max_dist: f32) -> Option<f32> {
        // A swept hairline sphere doubles as a ray without new triangle code.
        let sphere = Sphere { center: origin, radius: 0.01 };
        self.sweep_sphere(sphere, dir * max_dist).map(|c| c.time * max_dist)
    }
}

/// Distance along `dir` (unit) to a sphere at `center` with `radius`, if the
/// ray starting at `origin` hits it within `max_dist`.
pub fn ray_sphere(origin: Pnt3f, dir: Vec3f, center: Pnt3f, radius: f32, max_dist: f32) -> Option<f32> {
    let oc = origin - center;
    let b = oc.dot(dir);
    let c = oc.magnitude2() - radius * radius;
    let disc = b * b - c;
    if disc < 0.0 {
        return None;
    }
    let t = -b - disc.sqrt();
    if t >= 0.0 && t <= max_dist {
        Some(t)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::boarding::geometry::{p3, v3, Builder};

    fn room() -> CollisionMesh {
        let mut b = Builder::default();
        b.box_interior(p3(-5.0, 0.0, -5.0), p3(5.0, 3.0, 5.0), [0.5; 3], [0.4; 3], [0.3; 3]);
        CollisionMesh { tris: b.collision }
    }

    #[test]
    fn sweep_hits_a_wall_before_passing_through() {
        let m = room();
        let s = Sphere { center: p3(0.0, 1.0, 0.0), radius: 0.45 };
        let hit = m.sweep_sphere(s, v3(10.0, 0.0, 0.0)).expect("must hit the +X wall");
        // Wall at x=5, sphere radius 0.45 → contact after ~4.55 of 10 units.
        assert!((hit.time - 0.455).abs() < 0.01, "time was {}", hit.time);
        // Contact normal points back toward the room (-X).
        assert!(hit.normal.x < -0.99);
    }

    #[test]
    fn sweep_misses_when_wall_is_out_of_reach() {
        let m = room();
        let s = Sphere { center: p3(0.0, 1.0, 0.0), radius: 0.45 };
        assert!(m.sweep_sphere(s, v3(1.0, 0.0, 0.0)).is_none());
    }

    #[test]
    fn raycast_measures_distance_to_wall() {
        let m = room();
        let d = m.raycast(p3(0.0, 1.5, 0.0), v3(0.0, 0.0, 1.0), 100.0).expect("hits the +Z wall");
        assert!((d - 5.0).abs() < 0.05, "distance was {d}");
    }

    #[test]
    fn ray_sphere_hits_and_misses() {
        let hit = ray_sphere(p3(0.0, 0.0, 0.0), v3(1.0, 0.0, 0.0), p3(5.0, 0.0, 0.0), 1.0, 100.0);
        assert!((hit.unwrap() - 4.0).abs() < 1e-4);
        let miss = ray_sphere(p3(0.0, 0.0, 0.0), v3(1.0, 0.0, 0.0), p3(5.0, 3.0, 0.0), 1.0, 100.0);
        assert!(miss.is_none());
        // Behind the origin: no hit.
        let behind = ray_sphere(p3(0.0, 0.0, 0.0), v3(1.0, 0.0, 0.0), p3(-5.0, 0.0, 0.0), 1.0, 100.0);
        assert!(behind.is_none());
    }
}

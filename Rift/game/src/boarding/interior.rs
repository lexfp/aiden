//! Seeded procedural generation of the enemy flagship interior: an airlock, a
//! long spine corridor, three subsystem rooms branching off it, and the
//! reactor chamber at the far end. Deterministic for a given seed so tests
//! (and future live-PvP sync) can rebuild the identical ship.

use super::collision::CollisionMesh;
use super::geometry::{p3, Builder, MeshData};
use sim::Subsystem;

/// Corridor half-width.
const HALF_W: f32 = 1.6;
/// Corridor ceiling height.
const CORRIDOR_H: f32 = 2.8;
/// Corridor length (airlock to reactor-room door).
const CORRIDOR_LEN: f32 = 42.0;
/// Doorway width / height.
const DOOR_W: f32 = 2.4;
const DOOR_H: f32 = 2.2;

// Linear-space albedos: slate-blue hull, darker floor, near-black ceiling.
const WALL: [f32; 3] = [0.16, 0.19, 0.26];
const FLOOR: [f32; 3] = [0.10, 0.115, 0.15];
const CEIL: [f32; 3] = [0.08, 0.09, 0.12];
const CRATE: [f32; 3] = [0.22, 0.19, 0.14];
const MACHINE: [f32; 3] = [0.14, 0.15, 0.18];

/// Emissive base colors per subsystem (the renderer adds these on top of the
/// lit albedo while the subsystem is intact).
pub fn subsystem_emissive(s: Subsystem) -> [f32; 3] {
    match s {
        Subsystem::Engines => [1.0, 0.42, 0.08],
        Subsystem::ShieldGenerator => [0.1, 0.85, 0.95],
        Subsystem::WeaponsBay => [0.95, 0.15, 0.12],
        Subsystem::ReactorCore => [0.22, 0.62, 0.68],
    }
}

/// What a render batch is, deciding its emissive behaviour.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum BatchKind {
    /// Plain lit hull geometry.
    Hull,
    /// A vital point's machinery: emissive while intact, dead red after.
    Vital(Subsystem),
    /// A defense turret (index into `Interior::turrets`): red eye while alive.
    Turret(usize),
}

pub struct VitalPoint {
    pub subsystem: Subsystem,
    pub pos: math::Pnt3f,
    pub radius: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub destroyed: bool,
}

pub struct Turret {
    pub pos: math::Pnt3f, // aim/hit sphere center
    pub radius: f32,
    pub hp: f32,
    pub alive: bool,
    /// Seconds of continuous line-of-sight; fires once warmed up.
    pub warmup: f32,
    pub cooldown: f32,
}

#[derive(Clone, Copy)]
pub struct PointLight {
    pub pos: [f32; 3],
    pub color: [f32; 3],
    pub radius: f32,
}

pub struct Interior {
    pub batches: Vec<(BatchKind, MeshData)>,
    pub collision: CollisionMesh,
    pub vitals: Vec<VitalPoint>,
    pub turrets: Vec<Turret>,
    pub lights: Vec<PointLight>,
    pub spawn: math::Pnt3f,
    pub spawn_yaw: f32,
    pub extraction: math::Pnt3f,
    pub extraction_radius: f32,
    /// Overall AABB of the walkable volume (for containment tests).
    pub bounds: (math::Pnt3f, math::Pnt3f),
}

/// Tiny deterministic xorshift so the crate needs no rand dependency.
pub struct XorShift(u64);

impl XorShift {
    pub fn new(seed: u64) -> Self {
        XorShift(seed | 1)
    }
    pub fn next_f32(&mut self) -> f32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 33) as f32 / (1u64 << 31) as f32
    }
    /// Uniform in `lo..hi`.
    pub fn range(&mut self, lo: f32, hi: f32) -> f32 {
        lo + self.next_f32() * (hi - lo)
    }
    pub fn chance(&mut self, p: f32) -> bool {
        self.next_f32() < p
    }
}

struct RoomSpec {
    side: f32, // -1.0 = left (-X), +1.0 = right (+X)
    z_center: f32,
    width: f32,
    depth: f32,
    height: f32,
    subsystem: Subsystem,
}

/// Build the ship interior for `seed`. `defense_level` (0..=5) is how many
/// automated turrets guard it.
pub fn generate(seed: u64, defense_level: u8) -> Interior {
    let mut rng = XorShift::new(seed);
    let mut hull = Builder::default();

    // --- Rooms: subsystem order is fixed, sides and dimensions are seeded. ---
    let first_side = if rng.chance(0.5) { -1.0 } else { 1.0 };
    let rooms = [
        RoomSpec {
            side: first_side,
            z_center: rng.range(9.0, 12.0),
            width: rng.range(9.0, 12.0),
            depth: rng.range(8.0, 10.0),
            height: 3.6,
            subsystem: Subsystem::Engines,
        },
        RoomSpec {
            side: -first_side,
            z_center: rng.range(19.0, 23.0),
            width: rng.range(6.5, 8.5),
            depth: rng.range(6.0, 8.0),
            height: 3.4,
            subsystem: Subsystem::ShieldGenerator,
        },
        RoomSpec {
            side: if rng.chance(0.5) { -1.0 } else { 1.0 },
            z_center: rng.range(29.0, 33.0),
            width: rng.range(8.0, 10.0),
            depth: rng.range(7.0, 9.0),
            height: 3.4,
            subsystem: Subsystem::WeaponsBay,
        },
    ];

    // --- Corridor shell. (Floor winds min→max in z first so its normal is +Y;
    // the ceiling winds the other way for -Y.) ---
    hull.quad(
        p3(-HALF_W, 0.0, 0.0),
        p3(-HALF_W, 0.0, CORRIDOR_LEN),
        p3(HALF_W, 0.0, CORRIDOR_LEN),
        p3(HALF_W, 0.0, 0.0),
        FLOOR,
        true,
    );
    hull.quad(
        p3(-HALF_W, CORRIDOR_H, 0.0),
        p3(HALF_W, CORRIDOR_H, 0.0),
        p3(HALF_W, CORRIDOR_H, CORRIDOR_LEN),
        p3(-HALF_W, CORRIDOR_H, CORRIDOR_LEN),
        CEIL,
        true,
    );
    // Airlock end wall (behind the spawn).
    hull.wall_z(0.0, -HALF_W, HALF_W, 0.0, CORRIDOR_H, 1.0, WALL);

    // Corridor side walls, with a doorway per room on that side.
    for side in [-1.0f32, 1.0] {
        let x = side * HALF_W;
        let facing = -side; // wall normal points into the corridor
        let mut spans: Vec<(f32, f32)> = rooms
            .iter()
            .filter(|r| r.side == side)
            .map(|r| (r.z_center - DOOR_W * 0.5, r.z_center + DOOR_W * 0.5))
            .collect();
        spans.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        let mut z0 = 0.0;
        for (d0, d1) in &spans {
            hull.wall_x(x, z0, *d0, 0.0, CORRIDOR_H, facing, WALL);
            // Lintel above the door.
            hull.wall_x(x, *d0, *d1, DOOR_H, CORRIDOR_H, facing, WALL);
            z0 = *d1;
        }
        hull.wall_x(x, z0, CORRIDOR_LEN, 0.0, CORRIDOR_H, facing, WALL);
    }

    let mut lights = vec![];
    // Corridor strip lights: cool blue-white ceiling strips with a warm amber
    // accent every other fixture, so the slate hull stays the base tone.
    let mut z = 4.0;
    let mut warm = false;
    while z < CORRIDOR_LEN {
        let color = if warm { [0.9, 0.55, 0.25] } else { [0.5, 0.62, 0.9] };
        lights.push(PointLight { pos: [0.0, CORRIDOR_H - 0.2, z], color, radius: 9.0 });
        warm = !warm;
        z += 8.0;
    }

    let mut vitals = vec![];
    let mut vital_batches: Vec<(BatchKind, MeshData)> = vec![];
    let mut turret_spots: Vec<math::Pnt3f> = vec![];

    // --- Side rooms. ---
    for room in &rooms {
        let (x_in, x_out) = if room.side < 0.0 {
            (-HALF_W, -HALF_W - room.width)
        } else {
            (HALF_W, HALF_W + room.width)
        };
        let x_min = x_in.min(x_out);
        let x_max = x_in.max(x_out);
        let z_min = room.z_center - room.depth * 0.5;
        let z_max = room.z_center + room.depth * 0.5;
        let d0 = room.z_center - DOOR_W * 0.5;
        let d1 = room.z_center + DOOR_W * 0.5;

        // Floor + ceiling.
        hull.quad(p3(x_min, 0.0, z_min), p3(x_min, 0.0, z_max), p3(x_max, 0.0, z_max), p3(x_max, 0.0, z_min), FLOOR, true);
        hull.quad(
            p3(x_min, room.height, z_min),
            p3(x_max, room.height, z_min),
            p3(x_max, room.height, z_max),
            p3(x_min, room.height, z_max),
            CEIL,
            true,
        );
        // Outer wall (parallel to corridor) and the two end walls.
        hull.wall_x(x_out, z_min, z_max, 0.0, room.height, if room.side < 0.0 { 1.0 } else { -1.0 }, WALL);
        hull.wall_z(z_min, x_min, x_max, 0.0, room.height, 1.0, WALL);
        hull.wall_z(z_max, x_min, x_max, 0.0, room.height, -1.0, WALL);
        // Corridor-side wall seen from inside the room, with the same doorway.
        hull.wall_x_with_door(
            x_in,
            z_min,
            z_max,
            0.0,
            room.height,
            d0,
            d1,
            DOOR_H,
            if room.side < 0.0 { -1.0 } else { 1.0 },
            WALL,
        );

        // Cool key light at the room ceiling.
        let cx = (x_min + x_max) * 0.5;
        lights.push(PointLight {
            pos: [cx, room.height - 0.3, room.z_center],
            color: [0.55, 0.65, 0.85],
            radius: 13.0,
        });

        // Room contents + the vital point, hugging the outer wall.
        let back_x = x_out - room.side * 1.2; // 1.2m off the outer wall, inside the room
        let mut vital_b = Builder::default();
        let (vital_pos, vital_r, vital_hp) = match room.subsystem {
            Subsystem::Engines => {
                // Two engine blocks with a glowing gap between them.
                for dz in [-1.8f32, 0.6] {
                    let bmin = p3(back_x - 1.0, 0.0, room.z_center + dz);
                    let bmax = p3(back_x + 1.0, 2.0, room.z_center + dz + 1.2);
                    vital_b.box_exterior(bmin, bmax, [0.35, 0.18, 0.06]);
                }
                (p3(back_x, 1.2, room.z_center), 0.9, 60.0)
            }
            Subsystem::ShieldGenerator => {
                let base = p3(cx, 0.0, room.z_center);
                hull.cylinder(base, 0.9, 0.9, 14, MACHINE);
                vital_b.cylinder(p3(cx, 0.9, room.z_center), 0.55, 1.3, 14, [0.05, 0.3, 0.35]);
                (p3(cx, 1.6, room.z_center), 0.75, 40.0)
            }
            Subsystem::WeaponsBay => {
                // Ammo racks (hull) and one volatile red magazine (vital).
                for dx in [-2.2f32, 2.2] {
                    let rmin = p3(cx + dx - 0.5, 0.0, z_min + 1.0);
                    let rmax = p3(cx + dx + 0.5, 1.6, z_max - 1.0);
                    hull.box_exterior(rmin, rmax, MACHINE);
                }
                let mmin = p3(back_x - 0.7, 0.0, room.z_center - 0.7);
                let mmax = p3(back_x + 0.7, 1.4, room.z_center + 0.7);
                vital_b.box_exterior(mmin, mmax, [0.3, 0.05, 0.04]);
                (p3(back_x, 0.7, room.z_center), 0.8, 40.0)
            }
            Subsystem::ReactorCore => unreachable!("reactor is built separately"),
        };
        // Colored glow light by the vital machinery.
        let e = subsystem_emissive(room.subsystem);
        lights.push(PointLight {
            pos: [vital_pos.x, vital_pos.y + 0.8, vital_pos.z],
            color: [e[0] * 1.6, e[1] * 1.6, e[2] * 1.6],
            radius: 8.0,
        });
        vitals.push(VitalPoint {
            subsystem: room.subsystem,
            pos: vital_pos,
            radius: vital_r,
            hp: vital_hp,
            max_hp: vital_hp,
            destroyed: false,
        });
        hull.collision.append(&mut vital_b.collision);
        vital_batches.push((BatchKind::Vital(room.subsystem), vital_b.mesh));

        // A candidate turret position guarding the door, inside the room.
        turret_spots.push(p3(cx, 0.0, d0 - 1.0_f32.min(room.depth * 0.2)));

        // A seeded crate or two for cover.
        if rng.chance(0.8) {
            let crx = rng.range(x_min + 1.0, x_max - 1.0);
            let crz = rng.range(z_min + 1.0, z_max - 1.0);
            let s = rng.range(0.5, 0.9);
            hull.box_exterior(p3(crx - s, 0.0, crz - s), p3(crx + s, s * 1.4, crz + s), CRATE);
        }
    }

    // --- Reactor chamber at the far end. ---
    let rw = 7.0; // half-width
    let rz0 = CORRIDOR_LEN;
    let rz1 = CORRIDOR_LEN + 14.0;
    let rh = 5.5;
    hull.quad(p3(-rw, 0.0, rz0), p3(-rw, 0.0, rz1), p3(rw, 0.0, rz1), p3(rw, 0.0, rz0), FLOOR, true);
    hull.quad(p3(-rw, rh, rz0), p3(rw, rh, rz0), p3(rw, rh, rz1), p3(-rw, rh, rz1), CEIL, true);
    hull.wall_x(-rw, rz0, rz1, 0.0, rh, 1.0, WALL);
    hull.wall_x(rw, rz0, rz1, 0.0, rh, -1.0, WALL);
    hull.wall_z(rz1, -rw, rw, 0.0, rh, -1.0, WALL);
    // Front wall facing into the chamber, leaving the corridor-sized opening.
    hull.wall_z(rz0, -rw, -HALF_W, 0.0, rh, 1.0, WALL);
    hull.wall_z(rz0, HALF_W, rw, 0.0, rh, 1.0, WALL);
    // Lintel over the corridor opening.
    hull.quad(
        p3(-HALF_W, CORRIDOR_H, rz0),
        p3(HALF_W, CORRIDOR_H, rz0),
        p3(HALF_W, rh, rz0),
        p3(-HALF_W, rh, rz0),
        WALL,
        true,
    );

    let core_z = rz0 + 7.0;
    // The core: a tall smooth cylinder, plus four hull pillars as cover.
    let mut core_b = Builder::default();
    core_b.cylinder(p3(0.0, 0.0, core_z), 1.3, 4.4, 24, [0.1, 0.32, 0.36]);
    for (px, pz) in [(-4.5, -4.0), (4.5, -4.0), (-4.5, 4.0), (4.5, 4.0)] {
        hull.box_exterior(
            p3(px - 0.5, 0.0, core_z + pz - 0.5),
            p3(px + 0.5, rh, core_z + pz + 0.5),
            MACHINE,
        );
    }
    vitals.push(VitalPoint {
        subsystem: Subsystem::ReactorCore,
        pos: p3(0.0, 2.2, core_z),
        radius: 1.5,
        hp: 120.0,
        max_hp: 120.0,
        destroyed: false,
    });
    let ce = subsystem_emissive(Subsystem::ReactorCore);
    lights.push(PointLight {
        pos: [0.0, 3.5, core_z],
        color: [ce[0] * 2.4, ce[1] * 2.4, ce[2] * 2.4],
        radius: 18.0,
    });
    // A cool overhead key so the chamber's own geometry reads, with the core
    // glow as the accent rather than the only light.
    lights.push(PointLight { pos: [0.0, rh - 0.4, rz0 + 3.0], color: [0.5, 0.6, 0.85], radius: 15.0 });
    hull.collision.append(&mut core_b.collision);
    vital_batches.push((BatchKind::Vital(Subsystem::ReactorCore), core_b.mesh));

    // Reactor chamber turret spots (the best-defended room).
    turret_spots.push(p3(-3.0, 0.0, rz0 + 2.5));
    turret_spots.push(p3(3.0, 0.0, rz0 + 11.0));

    // --- Turrets: the first `defense_level` spots, seeded rotation. ---
    let mut turrets = vec![];
    let mut batches: Vec<(BatchKind, MeshData)> = vec![];
    let offset = (rng.next_f32() * turret_spots.len() as f32) as usize;
    for i in 0..(defense_level as usize).min(turret_spots.len()) {
        let spot = turret_spots[(offset + i) % turret_spots.len()];
        let mut tb = Builder::default();
        tb.cylinder(p3(spot.x, 0.0, spot.z), 0.22, 1.2, 10, MACHINE);
        tb.box_exterior(
            p3(spot.x - 0.28, 1.2, spot.z - 0.28),
            p3(spot.x + 0.28, 1.72, spot.z + 0.28),
            [0.3, 0.08, 0.08],
        );
        hull.collision.append(&mut tb.collision);
        batches.push((BatchKind::Turret(turrets.len()), tb.mesh));
        turrets.push(Turret {
            pos: p3(spot.x, 1.45, spot.z),
            radius: 0.42,
            hp: 30.0,
            alive: true,
            warmup: 0.0,
            cooldown: 0.0,
        });
    }

    // A couple of corridor crates for cover on the approach.
    for _ in 0..3 {
        if rng.chance(0.7) {
            let side = if rng.chance(0.5) { -1.0 } else { 1.0 };
            let cz = rng.range(5.0, CORRIDOR_LEN - 3.0);
            let s = rng.range(0.4, 0.6);
            let cx = side * (HALF_W - s - 0.15);
            hull.box_exterior(p3(cx - s, 0.0, cz - s), p3(cx + s, s * 1.5, cz + s), CRATE);
        }
    }

    // Assemble: hull first, then vitals, then turrets.
    let mut all_batches = vec![(BatchKind::Hull, hull.mesh)];
    all_batches.append(&mut vital_batches);
    all_batches.append(&mut batches);

    // Bounds from the collision soup.
    let mut bmin = p3(f32::MAX, f32::MAX, f32::MAX);
    let mut bmax = p3(f32::MIN, f32::MIN, f32::MIN);
    for t in &hull.collision {
        for v in t.verts {
            bmin = p3(bmin.x.min(v.x), bmin.y.min(v.y), bmin.z.min(v.z));
            bmax = p3(bmax.x.max(v.x), bmax.y.max(v.y), bmax.z.max(v.z));
        }
    }

    Interior {
        batches: all_batches,
        collision: CollisionMesh { tris: hull.collision },
        vitals,
        turrets,
        lights,
        spawn: p3(0.0, 0.0, 2.0),
        spawn_yaw: 0.0,
        extraction: p3(0.0, 0.0, 1.2),
        extraction_radius: 2.4,
        bounds: (bmin, bmax),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Digest of the generated geometry, for determinism checks.
    fn digest(i: &Interior) -> (usize, usize, u64) {
        let tri_count = i.collision.tris.len();
        let vert_count: usize = i.batches.iter().map(|(_, m)| m.vertices.len()).sum();
        let mut hash = 0xcbf29ce484222325u64;
        for (_, m) in &i.batches {
            for v in &m.vertices {
                for f in v.pos.iter().chain(&v.normal).chain(&v.albedo) {
                    hash = (hash ^ f.to_bits() as u64).wrapping_mul(0x100000001b3);
                }
            }
        }
        (tri_count, vert_count, hash)
    }

    #[test]
    fn same_seed_same_ship() {
        let a = generate(42, 3);
        let b = generate(42, 3);
        assert_eq!(digest(&a), digest(&b));
    }

    #[test]
    fn different_seeds_differ() {
        let a = generate(1, 3);
        let b = generate(2, 3);
        assert_ne!(digest(&a).2, digest(&b).2);
    }

    #[test]
    fn has_all_four_vitals_and_requested_turrets() {
        for level in 0..=5u8 {
            let i = generate(7, level);
            assert_eq!(i.vitals.len(), 4);
            assert!(i.vitals.iter().any(|v| v.subsystem == Subsystem::Engines));
            assert!(i.vitals.iter().any(|v| v.subsystem == Subsystem::ShieldGenerator));
            assert!(i.vitals.iter().any(|v| v.subsystem == Subsystem::WeaponsBay));
            assert!(i.vitals.iter().any(|v| v.subsystem == Subsystem::ReactorCore));
            assert_eq!(i.turrets.len(), level as usize);
        }
    }

    #[test]
    fn spawn_is_inside_bounds_and_lights_exist() {
        let i = generate(99, 2);
        let (min, max) = i.bounds;
        assert!(i.spawn.x > min.x && i.spawn.x < max.x);
        assert!(i.spawn.z > min.z && i.spawn.z < max.z);
        assert!(i.lights.len() >= 6);
    }

    #[test]
    fn corridor_raycast_hits_far_geometry_not_infinity() {
        let i = generate(3, 0);
        // From the spawn looking down the corridor: must hit something (the
        // reactor chamber's far wall at the latest).
        let d = i
            .collision
            .raycast(p3(0.0, 1.5, 2.0), math::vec3(0.0, 0.0, 1.0), 200.0)
            .expect("must hit the far wall");
        assert!(d > 30.0 && d < 60.0, "distance was {d}");
    }
}

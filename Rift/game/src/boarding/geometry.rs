//! Procedural interior geometry: quad/box/cylinder builders that emit both the
//! render mesh (positions + normals + per-vertex albedo) and the mirrored
//! collision triangles. Hull surfaces use hard per-face normals; the reactor
//! core cylinder uses smooth normals so its silhouette reads as curved.

use math::prelude::*;
use math::{vec3, Pnt3f, Vec3f};

/// One render vertex: 36 bytes, matching the glow renderer's attribute layout.
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct Vertex {
    pub pos: [f32; 3],
    pub normal: [f32; 3],
    pub albedo: [f32; 3],
}

/// A triangle-list mesh ready for upload.
#[derive(Default)]
pub struct MeshData {
    pub vertices: Vec<Vertex>,
    pub indices: Vec<u32>,
}

impl MeshData {
    pub fn is_empty(&self) -> bool {
        self.indices.is_empty()
    }
}

/// A collision triangle: vertices plus the (unit) face normal.
#[derive(Clone, Copy, Debug)]
pub struct Tri {
    pub verts: [Pnt3f; 3],
    pub normal: Vec3f,
}

/// Accumulates one mesh batch plus collision triangles.
#[derive(Default)]
pub struct Builder {
    pub mesh: MeshData,
    pub collision: Vec<Tri>,
}

impl Builder {
    /// Push a quad `a→b→c→d` (counter-clockwise when seen from the front, i.e.
    /// from the side its normal points toward). Adds two collision triangles
    /// when `collide` is set.
    pub fn quad(&mut self, a: Pnt3f, b: Pnt3f, c: Pnt3f, d: Pnt3f, albedo: [f32; 3], collide: bool) {
        let normal = (b - a).cross(d - a).normalize_or_zero();
        let n = [normal.x, normal.y, normal.z];
        let base = self.mesh.vertices.len() as u32;
        for p in [a, b, c, d] {
            self.mesh.vertices.push(Vertex { pos: [p.x, p.y, p.z], normal: n, albedo });
        }
        self.mesh.indices.extend_from_slice(&[base, base + 1, base + 2, base, base + 2, base + 3]);
        if collide {
            self.collision.push(Tri { verts: [a, b, c], normal });
            self.collision.push(Tri { verts: [a, c, d], normal });
        }
    }

    /// The six inward-facing walls of an axis-aligned room volume.
    /// `floor`, `ceiling` and `walls` are separate albedos.
    pub fn box_interior(
        &mut self,
        min: Pnt3f,
        max: Pnt3f,
        walls: [f32; 3],
        floor: [f32; 3],
        ceiling: [f32; 3],
    ) {
        let (a, b) = (min, max);
        // Floor (normal +Y) and ceiling (normal -Y). Winding: with normal =
        // (b-a)×(d-a), an upward face must walk (min,min)→(min,max) in xz.
        self.quad(
            Pnt3f::new(a.x, a.y, a.z),
            Pnt3f::new(a.x, a.y, b.z),
            Pnt3f::new(b.x, a.y, b.z),
            Pnt3f::new(b.x, a.y, a.z),
            floor,
            true,
        );
        self.quad(
            Pnt3f::new(a.x, b.y, a.z),
            Pnt3f::new(b.x, b.y, a.z),
            Pnt3f::new(b.x, b.y, b.z),
            Pnt3f::new(a.x, b.y, b.z),
            ceiling,
            true,
        );
        // -X wall faces +X inward; +X wall faces -X; same for Z.
        self.wall_x(a.x, a.z, b.z, a.y, b.y, 1.0, walls);
        self.wall_x(b.x, a.z, b.z, a.y, b.y, -1.0, walls);
        self.wall_z(a.z, a.x, b.x, a.y, b.y, 1.0, walls);
        self.wall_z(b.z, a.x, b.x, a.y, b.y, -1.0, walls);
    }

    /// A wall on the plane `x = x0` spanning `z0..z1`, `y0..y1`, facing
    /// `facing` (+1.0 → normal +X). No opening.
    pub fn wall_x(&mut self, x0: f32, z0: f32, z1: f32, y0: f32, y1: f32, facing: f32, albedo: [f32; 3]) {
        let (za, zb) = if facing > 0.0 { (z1, z0) } else { (z0, z1) };
        self.quad(
            Pnt3f::new(x0, y0, za),
            Pnt3f::new(x0, y0, zb),
            Pnt3f::new(x0, y1, zb),
            Pnt3f::new(x0, y1, za),
            albedo,
            true,
        );
    }

    /// A wall on the plane `x = x0` with a doorway spanning `door_z0..door_z1`
    /// up to `door_h`: emits the strips before/after the door plus the lintel.
    #[allow(clippy::too_many_arguments)]
    pub fn wall_x_with_door(
        &mut self,
        x0: f32,
        z0: f32,
        z1: f32,
        y0: f32,
        y1: f32,
        door_z0: f32,
        door_z1: f32,
        door_h: f32,
        facing: f32,
        albedo: [f32; 3],
    ) {
        if door_z0 > z0 {
            self.wall_x(x0, z0, door_z0, y0, y1, facing, albedo);
        }
        if z1 > door_z1 {
            self.wall_x(x0, door_z1, z1, y0, y1, facing, albedo);
        }
        if y1 > y0 + door_h {
            self.wall_x(x0, door_z0, door_z1, y0 + door_h, y1, facing, albedo);
        }
    }

    /// A wall on the plane `z = z0` spanning `x0..x1`, `y0..y1`, facing
    /// `facing` (+1.0 → normal +Z). No opening.
    pub fn wall_z(&mut self, z0: f32, x0: f32, x1: f32, y0: f32, y1: f32, facing: f32, albedo: [f32; 3]) {
        let (xa, xb) = if facing > 0.0 { (x0, x1) } else { (x1, x0) };
        self.quad(
            Pnt3f::new(xa, y0, z0),
            Pnt3f::new(xb, y0, z0),
            Pnt3f::new(xb, y1, z0),
            Pnt3f::new(xa, y1, z0),
            albedo,
            true,
        );
    }

    /// An outward-facing axis-aligned box (crates, consoles, engine blocks).
    pub fn box_exterior(&mut self, min: Pnt3f, max: Pnt3f, albedo: [f32; 3]) {
        let (a, b) = (min, max);
        // Top and bottom.
        self.quad(
            Pnt3f::new(a.x, b.y, a.z),
            Pnt3f::new(a.x, b.y, b.z),
            Pnt3f::new(b.x, b.y, b.z),
            Pnt3f::new(b.x, b.y, a.z),
            albedo,
            true,
        );
        self.quad(
            Pnt3f::new(a.x, a.y, a.z),
            Pnt3f::new(b.x, a.y, a.z),
            Pnt3f::new(b.x, a.y, b.z),
            Pnt3f::new(a.x, a.y, b.z),
            albedo,
            true,
        );
        self.wall_x(a.x, a.z, b.z, a.y, b.y, -1.0, albedo);
        self.wall_x(b.x, a.z, b.z, a.y, b.y, 1.0, albedo);
        self.wall_z(a.z, a.x, b.x, a.y, b.y, -1.0, albedo);
        self.wall_z(b.z, a.x, b.x, a.y, b.y, 1.0, albedo);
    }

    /// A vertical cylinder with smooth side normals (base center at `base`).
    /// The top cap uses a hard +Y normal; there is no bottom cap.
    pub fn cylinder(&mut self, base: Pnt3f, radius: f32, height: f32, segments: u32, albedo: [f32; 3]) {
        let seg = segments.max(3);
        let ring: Vec<(f32, f32)> = (0..=seg)
            .map(|i| {
                let a = std::f32::consts::TAU * i as f32 / seg as f32;
                (a.cos(), a.sin())
            })
            .collect();
        let base_idx = self.mesh.vertices.len() as u32;
        for &(cx, cz) in &ring {
            let n = [cx, 0.0, cz];
            let p0 = [base.x + cx * radius, base.y, base.z + cz * radius];
            let p1 = [base.x + cx * radius, base.y + height, base.z + cz * radius];
            self.mesh.vertices.push(Vertex { pos: p0, normal: n, albedo });
            self.mesh.vertices.push(Vertex { pos: p1, normal: n, albedo });
        }
        for i in 0..seg {
            let i0 = base_idx + i * 2;
            self.mesh.indices.extend_from_slice(&[i0, i0 + 2, i0 + 3, i0, i0 + 3, i0 + 1]);
        }
        // Top cap fan (hard normal).
        let cap_center = self.mesh.vertices.len() as u32;
        self.mesh.vertices.push(Vertex {
            pos: [base.x, base.y + height, base.z],
            normal: [0.0, 1.0, 0.0],
            albedo,
        });
        let cap_start = self.mesh.vertices.len() as u32;
        for &(cx, cz) in &ring {
            self.mesh.vertices.push(Vertex {
                pos: [base.x + cx * radius, base.y + height, base.z + cz * radius],
                normal: [0.0, 1.0, 0.0],
                albedo,
            });
        }
        for i in 0..seg {
            self.mesh.indices.extend_from_slice(&[cap_center, cap_start + i + 1, cap_start + i]);
        }
        // Collision: approximate with the bounding box (cheap, good enough for
        // a pillar the player walks around).
        let cmin = Pnt3f::new(base.x - radius, base.y, base.z - radius);
        let cmax = Pnt3f::new(base.x + radius, base.y + height, base.z + radius);
        self.collision_box(cmin, cmax);
    }

    /// Add collision-only box triangles (no render geometry).
    pub fn collision_box(&mut self, min: Pnt3f, max: Pnt3f) {
        let mesh_len = self.mesh.vertices.len();
        let idx_len = self.mesh.indices.len();
        self.box_exterior(min, max, [0.0, 0.0, 0.0]);
        // Roll back the render geometry, keep the collision triangles.
        self.mesh.vertices.truncate(mesh_len);
        self.mesh.indices.truncate(idx_len);
    }
}

/// Convenience for point construction in the interior generator.
pub fn p3(x: f32, y: f32, z: f32) -> Pnt3f {
    Pnt3f::new(x, y, z)
}

/// Convenience vector.
pub fn v3(x: f32, y: f32, z: f32) -> Vec3f {
    vec3(x, y, z)
}

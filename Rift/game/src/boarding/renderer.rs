//! A compact glow (OpenGL 3.3) renderer for the boarding interior, drawn
//! inside the egui window via `egui::PaintCallback` + `egui_glow::CallbackFn`.
//! Geometry is static (uploaded once per raid); per-frame state arrives as a
//! [`SceneFrame`] computed on the CPU, so this file is the only GL-touching
//! code in the feature.

use super::interior::{subsystem_emissive, BatchKind, Interior};
use super::shaders::{FRAG, MAX_LIGHTS, VERT};
use super::BoardingGame;
use eframe::glow::{self, HasContext};
use math::prelude::*;
use math::{Deg, Mat4, Pnt3f};

/// Everything the GL callback needs for one frame. Pure data — built by
/// [`SceneFrame::from_game`] on the UI thread, moved into the paint closure.
pub struct SceneFrame {
    pub view_proj: [f32; 16],
    pub camera_pos: [f32; 3],
    /// Up to [`MAX_LIGHTS`] lights, already selected nearest-first.
    pub light_pos: Vec<[f32; 3]>,
    pub light_color: Vec<[f32; 3]>,
    pub light_radius: Vec<f32>,
    /// Per-batch emissive color and pulse amount, parallel to the interior's
    /// batch list (and therefore to `BoardingRenderer::batches`).
    pub emissive: Vec<([f32; 3], f32)>,
    pub time: f32,
}

impl SceneFrame {
    pub fn from_game(game: &BoardingGame, aspect: f32, time: f32) -> Self {
        let eye = game.controller.eye();
        let dir = game.controller.forward();
        let view = Mat4::look_to_rh(eye, dir, math::vec3(0.0, 1.0, 0.0));
        let proj = math::perspective(Deg(65.0f32), aspect.max(0.1), 0.05, 120.0);
        let vp = proj * view;
        let m: &[f32; 16] = vp.as_ref();

        // Nearest lights win the 8 uniform slots.
        let mut lights: Vec<_> = game.interior.lights.iter().collect();
        lights.sort_by(|a, b| {
            let da = dist2(a.pos, eye);
            let db = dist2(b.pos, eye);
            da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
        });
        lights.truncate(MAX_LIGHTS);

        // Batch emissives: vitals glow until destroyed, turret eyes until dead.
        let emissive = game
            .interior
            .batches
            .iter()
            .map(|(kind, _)| match kind {
                BatchKind::Hull => ([0.0, 0.0, 0.0], 0.0),
                BatchKind::Vital(s) => {
                    let destroyed =
                        game.interior.vitals.iter().any(|v| v.subsystem == *s && v.destroyed);
                    if destroyed {
                        ([0.05, 0.008, 0.006], 0.0) // dull dead ember
                    } else {
                        let e = subsystem_emissive(*s);
                        let pulse = if *s == sim::Subsystem::ReactorCore { 1.0 } else { 0.3 };
                        (e, pulse)
                    }
                }
                BatchKind::Turret(i) => {
                    if game.interior.turrets.get(*i).is_some_and(|t| t.alive) {
                        ([0.5, 0.03, 0.02], 0.2)
                    } else {
                        ([0.01, 0.01, 0.01], 0.0)
                    }
                }
            })
            .collect();

        SceneFrame {
            view_proj: *m,
            camera_pos: [eye.x, eye.y, eye.z],
            light_pos: lights.iter().map(|l| l.pos).collect(),
            light_color: lights.iter().map(|l| l.color).collect(),
            light_radius: lights.iter().map(|l| l.radius).collect(),
            emissive,
            time,
        }
    }
}

fn dist2(p: [f32; 3], eye: Pnt3f) -> f32 {
    let d = math::vec3(p[0] - eye.x, p[1] - eye.y, p[2] - eye.z);
    d.magnitude2()
}

struct Batch {
    vao: glow::VertexArray,
    vbo: glow::Buffer,
    ebo: glow::Buffer,
    index_count: i32,
}

pub struct BoardingRenderer {
    program: glow::Program,
    batches: Vec<Batch>,
}

impl BoardingRenderer {
    /// Compile the program and upload every interior batch. GL 3.3 core.
    pub fn new(gl: &glow::Context, interior: &Interior) -> Result<Self, String> {
        unsafe {
            let program = gl.create_program().map_err(|e| format!("create_program: {e}"))?;
            let mut shaders = Vec::new();
            for (kind, src) in [(glow::VERTEX_SHADER, VERT), (glow::FRAGMENT_SHADER, FRAG)] {
                let shader = gl.create_shader(kind).map_err(|e| format!("create_shader: {e}"))?;
                gl.shader_source(shader, &format!("{}{}", super::shaders::GLSL_HEADER, src));
                gl.compile_shader(shader);
                if !gl.get_shader_compile_status(shader) {
                    return Err(format!("shader compile: {}", gl.get_shader_info_log(shader)));
                }
                gl.attach_shader(program, shader);
                shaders.push(shader);
            }
            gl.link_program(program);
            if !gl.get_program_link_status(program) {
                return Err(format!("program link: {}", gl.get_program_info_log(program)));
            }
            for s in shaders {
                gl.detach_shader(program, s);
                gl.delete_shader(s);
            }

            let mut batches = Vec::new();
            for (_, mesh) in &interior.batches {
                let vao = gl.create_vertex_array().map_err(|e| e.to_string())?;
                let vbo = gl.create_buffer().map_err(|e| e.to_string())?;
                let ebo = gl.create_buffer().map_err(|e| e.to_string())?;
                gl.bind_vertex_array(Some(vao));

                gl.bind_buffer(glow::ARRAY_BUFFER, Some(vbo));
                let vbytes: &[u8] = std::slice::from_raw_parts(
                    mesh.vertices.as_ptr() as *const u8,
                    std::mem::size_of_val(mesh.vertices.as_slice()),
                );
                gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, vbytes, glow::STATIC_DRAW);

                gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(ebo));
                let ibytes: &[u8] = std::slice::from_raw_parts(
                    mesh.indices.as_ptr() as *const u8,
                    std::mem::size_of_val(mesh.indices.as_slice()),
                );
                gl.buffer_data_u8_slice(glow::ELEMENT_ARRAY_BUFFER, ibytes, glow::STATIC_DRAW);

                let stride = std::mem::size_of::<super::geometry::Vertex>() as i32; // 36
                gl.enable_vertex_attrib_array(0);
                gl.vertex_attrib_pointer_f32(0, 3, glow::FLOAT, false, stride, 0);
                gl.enable_vertex_attrib_array(1);
                gl.vertex_attrib_pointer_f32(1, 3, glow::FLOAT, false, stride, 12);
                gl.enable_vertex_attrib_array(2);
                gl.vertex_attrib_pointer_f32(2, 3, glow::FLOAT, false, stride, 24);

                gl.bind_vertex_array(None);
                batches.push(Batch { vao, vbo, ebo, index_count: mesh.indices.len() as i32 });
            }
            Ok(BoardingRenderer { program, batches })
        }
    }

    /// Draw the scene. Runs inside egui's paint callback: egui has already set
    /// the viewport/scissor to the allocated rect, so the depth clear stays
    /// inside it. GL state egui cares about is restored before returning.
    pub fn paint(&self, gl: &glow::Context, frame: &SceneFrame) {
        unsafe {
            gl.enable(glow::DEPTH_TEST);
            gl.depth_func(glow::LESS);
            gl.depth_mask(true);
            gl.enable(glow::CULL_FACE);
            gl.cull_face(glow::BACK);
            gl.disable(glow::BLEND);
            gl.clear(glow::DEPTH_BUFFER_BIT);

            gl.use_program(Some(self.program));
            let loc = |name: &str| gl.get_uniform_location(self.program, name);
            gl.uniform_matrix_4_f32_slice(loc("u_view_proj").as_ref(), false, &frame.view_proj);
            gl.uniform_3_f32_slice(loc("u_camera_pos").as_ref(), &frame.camera_pos);
            let n = frame.light_pos.len().min(MAX_LIGHTS);
            gl.uniform_1_i32(loc("u_light_count").as_ref(), n as i32);
            if n > 0 {
                let pos: Vec<f32> = frame.light_pos[..n].iter().flatten().copied().collect();
                let col: Vec<f32> = frame.light_color[..n].iter().flatten().copied().collect();
                gl.uniform_3_f32_slice(loc("u_light_pos").as_ref(), &pos);
                gl.uniform_3_f32_slice(loc("u_light_color").as_ref(), &col);
                gl.uniform_1_f32_slice(loc("u_light_radius").as_ref(), &frame.light_radius[..n]);
            }
            gl.uniform_3_f32_slice(loc("u_ambient").as_ref(), &[0.018, 0.02, 0.028]);
            gl.uniform_3_f32_slice(loc("u_fog_color").as_ref(), &[0.004, 0.006, 0.012]);
            gl.uniform_1_f32(loc("u_fog_density").as_ref(), 0.045);
            gl.uniform_1_f32(loc("u_time").as_ref(), frame.time);

            for (batch, (emissive, pulse)) in self.batches.iter().zip(&frame.emissive) {
                gl.uniform_3_f32_slice(loc("u_emissive").as_ref(), emissive);
                gl.uniform_1_f32(loc("u_pulse").as_ref(), *pulse);
                gl.bind_vertex_array(Some(batch.vao));
                gl.draw_elements(glow::TRIANGLES, batch.index_count, glow::UNSIGNED_INT, 0);
            }

            gl.bind_vertex_array(None);
            gl.use_program(None);
            gl.disable(glow::DEPTH_TEST);
            gl.disable(glow::CULL_FACE);
            gl.enable(glow::BLEND);
        }
    }

    pub fn destroy(&self, gl: &glow::Context) {
        unsafe {
            gl.delete_program(self.program);
            for b in &self.batches {
                gl.delete_vertex_array(b.vao);
                gl.delete_buffer(b.vbo);
                gl.delete_buffer(b.ebo);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scene_frame_selects_nearest_lights_and_tracks_destruction() {
        let mut game = BoardingGame::new(11, "Bob", 2);
        game.start();
        let frame = SceneFrame::from_game(&game, 16.0 / 9.0, 1.0);
        assert!(frame.light_pos.len() <= MAX_LIGHTS);
        assert_eq!(frame.emissive.len(), game.interior.batches.len());
        // Hull batch has no emissive; some batch glows.
        assert_eq!(frame.emissive[0].0, [0.0, 0.0, 0.0]);
        assert!(frame.emissive.iter().any(|(e, _)| e[0] + e[1] + e[2] > 0.5));

        // Destroy the engines: its batch dims to the dead ember color.
        for v in &mut game.interior.vitals {
            if v.subsystem == sim::Subsystem::Engines {
                v.destroyed = true;
            }
        }
        let frame = SceneFrame::from_game(&game, 16.0 / 9.0, 1.0);
        let engines_batch = game
            .interior
            .batches
            .iter()
            .position(|(k, _)| *k == super::super::interior::BatchKind::Vital(sim::Subsystem::Engines))
            .unwrap();
        assert!(frame.emissive[engines_batch].0[0] < 0.1);
    }
}

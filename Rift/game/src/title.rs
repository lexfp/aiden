//! Cinematic title screen shown before gameplay begins.
//!
//! While [`TitleState::active`] is set, this system detaches the render camera
//! (so the engine renderer draws nothing) and takes over the frame itself: a
//! full-screen procedural "rift" shader — a glowing vertical seam, drifting fog
//! and rising embers — with the game title and a blinking prompt drawn on top.
//! Pressing Enter / Space / left-click restores the camera and starts the game.

use engine::{
    DependenciesFrom, EntityId, Gesture, InfallibleSystem, Input, MouseButton, RenderPipeline,
    Scancode, TextId, TextRenderer, Tick, Window,
};
use glium::index::{NoIndices, PrimitiveType};
use glium::{implement_vertex, uniform, DrawParameters, Program, Surface, VertexBuffer};
use log::error;
use math::Pnt2f;

/// Shared flag so other systems (e.g. the HUD) can tell whether the title screen
/// is still up and suppress their own overlays until gameplay starts.
pub struct TitleState {
    pub active: bool,
}

impl Default for TitleState {
    fn default() -> Self {
        TitleState { active: true }
    }
}

#[derive(DependenciesFrom)]
pub struct Dependencies<'context> {
    window: &'context Window,
    input: &'context Input,
    text: &'context mut TextRenderer,
    render: &'context mut RenderPipeline,
    tick: &'context Tick,
    state: &'context mut TitleState,
}

pub struct TitleScreen {
    // `None` if the shader failed to compile on this driver — in that case we
    // skip the title entirely and gameplay starts immediately.
    program: Option<Program>,
    quad: Option<VertexBuffer<QuadVertex>>,
    draw_params: DrawParameters<'static>,

    saved_camera: Option<EntityId>,
    elapsed: f32,
    start: Gesture,

    title_text: Option<TextId>,
    subtitle_text: Option<TextId>,
    prompt_text: Option<TextId>,
}

impl<'context> InfallibleSystem<'context> for TitleScreen {
    type Dependencies = Dependencies<'context>;

    fn debug_name() -> &'static str {
        "title_screen"
    }

    fn create(deps: Dependencies) -> Self {
        let facade = deps.window.facade();

        let start = Gesture::AnyOf(vec![
            Gesture::KeyTrigger(Scancode::Return),
            Gesture::KeyTrigger(Scancode::Space),
            Gesture::ButtonTrigger(MouseButton::Left),
        ]);
        let mut screen = TitleScreen {
            program: None,
            quad: None,
            draw_params: DrawParameters::default(),
            saved_camera: None,
            elapsed: 0.0,
            start,
            title_text: None,
            subtitle_text: None,
            prompt_text: None,
        };

        // If the title shader won't compile on this driver, skip the title
        // gracefully: leave the camera attached so gameplay starts immediately.
        let program = match Program::from_source(facade, VERTEX_SRC, FRAGMENT_SRC, None) {
            Ok(program) => program,
            Err(error) => {
                error!("Title screen shader failed to compile, skipping title: {}", error);
                deps.state.active = false;
                return screen;
            }
        };
        screen.program = Some(program);
        screen.quad = VertexBuffer::immutable(
            facade,
            &[
                QuadVertex { a_pos: [-1.0, -1.0] },
                QuadVertex { a_pos: [-1.0, 1.0] },
                QuadVertex { a_pos: [1.0, -1.0] },
                QuadVertex { a_pos: [1.0, 1.0] },
            ],
        )
        .ok();

        // Big centered title, subtitle, and a prompt below it.
        screen.title_text =
            Some(deps.text.insert_centered(deps.window, "RIFT", Pnt2f::new(0.5, 0.42), 10, 160.0));
        screen.subtitle_text = Some(deps.text.insert_centered(
            deps.window,
            "A DOOM ENGINE IN PURE RUST",
            Pnt2f::new(0.5, 0.56),
            6,
            26.0,
        ));
        screen.prompt_text = Some(deps.text.insert_centered(
            deps.window,
            "press  enter  to  descend",
            Pnt2f::new(0.5, 0.8),
            6,
            30.0,
        ));

        // Take over the frame: detach the camera so the engine renderer is a
        // no-op while we draw the title.
        screen.saved_camera = deps.render.camera();
        deps.render.clear_camera();
        deps.state.active = true;

        screen
    }

    fn update(&mut self, deps: Dependencies) {
        if !deps.state.active {
            return;
        }

        self.elapsed += deps.tick.timestep();

        // Start the game: restore the camera, hide our text, hand off to the
        // engine renderer (which runs before us, so gameplay shows next frame).
        if deps.input.poll_gesture(&self.start) {
            if let Some(camera) = self.saved_camera {
                deps.render.set_camera(camera);
            }
            for id in [self.title_text, self.subtitle_text, self.prompt_text]
                .iter()
                .flatten()
            {
                deps.text[*id].set_visible(false);
            }
            deps.state.active = false;
            return;
        }

        // Blink the prompt (~1.5 Hz) once the intro fade has settled.
        let blink = self.elapsed < 0.9 || ((self.elapsed * 1.5) as i32) % 2 == 0;
        if let Some(prompt) = self.prompt_text {
            deps.text[prompt].set_visible(blink);
        }

        // Draw the atmospheric background, then the title text on top.
        let (program, quad) = match (&self.program, &self.quad) {
            (Some(program), Some(quad)) => (program, quad),
            _ => return,
        };
        let fade = (self.elapsed / 0.9).min(1.0);
        let mut frame = deps.window.draw();
        let uniforms = uniform! {
            u_time: self.elapsed,
            u_fade: fade,
            u_aspect: deps.window.aspect_ratio(),
        };
        frame
            .draw(
                quad,
                NoIndices(PrimitiveType::TriangleStrip),
                program,
                &uniforms,
                &self.draw_params,
            )
            .expect("title-screen background draw failed");
        deps.text
            .render(&mut frame)
            .expect("title-screen text draw failed");
        frame.finish().expect("title-screen present failed");
    }

    fn teardown(&mut self, deps: Dependencies) {
        for id in [self.title_text, self.subtitle_text, self.prompt_text]
            .iter()
            .flatten()
        {
            deps.text.remove(*id);
        }
    }
}

#[repr(C)]
#[derive(Copy, Clone)]
struct QuadVertex {
    a_pos: [f32; 2],
}
implement_vertex!(QuadVertex, a_pos);

const VERTEX_SRC: &str = r#"
    #version 140
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
"#;

// Cinematic "rift": a glowing vertical seam down the centre, drifting fog and
// rising embers, vignetted and tonemapped. Animated by u_time, faded by u_fade.
const FRAGMENT_SRC: &str = r#"
    #version 140
    in vec2 v_uv;
    out vec4 color;

    uniform float u_time;
    uniform float u_fade;
    uniform float u_aspect;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
        }
        return v;
    }

    void main() {
        vec2 p = v_uv - 0.5;
        p.x *= u_aspect;
        float t = u_time;

        // Heat-haze: warp horizontally near the rift so the fog shimmers.
        float warp = (fbm(vec2(v_uv.y * 4.0, t * 0.25)) - 0.5) * 0.06 * exp(-abs(p.x) * 3.0);
        vec2 wuv = v_uv + vec2(warp, 0.0);

        // Drifting fog (two scrolling octaves rising upward), sampled through the warp.
        float fog = fbm(vec2(wuv.x * 3.0, wuv.y * 3.0 - t * 0.06));
        fog += 0.5 * fbm(vec2(wuv.x * 6.0 + 5.0, wuv.y * 6.0 - t * 0.13));
        fog = clamp(fog * 0.5, 0.0, 1.0);

        // Central rift: tight hot core, soft halo, wide volumetric shaft.
        float flicker = 0.82 + 0.12 * sin(t * 3.1) + 0.06 * sin(t * 13.0) + 0.04 * sin(t * 27.0);
        float vmask = smoothstep(0.0, 0.32, v_uv.y) * smoothstep(1.0, 0.6, v_uv.y);
        float seam = exp(-abs(p.x) * 24.0) * flicker * mix(0.5, 1.0, vmask);
        float halo = exp(-abs(p.x) * 4.5) * 0.55 * mix(0.6, 1.0, vmask);
        float shaft = exp(-abs(p.x) * 1.4) * 0.18 * (0.35 + 0.65 * fog);

        vec3 core_col = vec3(1.0, 0.96, 0.88);
        vec3 ember_col = vec3(1.0, 0.36, 0.09);
        vec3 deep_col = vec3(0.45, 0.06, 0.04);

        // Depth grade: warmer toward the floor, cooler toward the top.
        vec3 col = mix(vec3(0.05, 0.022, 0.016), vec3(0.012, 0.013, 0.022), v_uv.y);
        col += ember_col * shaft;
        col += ember_col * halo * (0.4 + 0.6 * fog);
        col += ember_col * seam * 1.25;
        col += core_col * pow(seam, 2.0) * 1.7;          // hot core
        col += ember_col * fog * fog * 0.18;             // glowing haze

        // Ground ember glow rising from the bottom edge.
        float ground = smoothstep(0.0, 0.32, 0.32 - v_uv.y);
        col += deep_col * ground * (0.5 + 0.5 * fog) * 0.9;

        // Rising embers: varied size and brightness, swaying and fading as they climb.
        for (int i = 0; i < 10; i++) {
            float fi = float(i);
            float seed = hash(vec2(fi, 3.0));
            float ey = fract(seed + t * (0.04 + 0.05 * seed));
            float sway = 0.10 * sin(fi * 7.0 + t * (0.4 + 0.5 * seed));
            float ex = (seed - 0.5) * 0.7 + sway * ey;
            vec2 e = vec2((v_uv.x - 0.5) * u_aspect - ex, v_uv.y - ey);
            float size = mix(2600.0, 900.0, seed);
            float bright = (0.5 + 0.7 * seed) * (1.0 - ey) * (0.4 + 0.6 * fog);
            col += ember_col * exp(-dot(e, e) * size) * bright;
        }

        // Vignette + filmic tonemap.
        col *= smoothstep(1.2, 0.25, length(p));
        col = col / (col + vec3(1.0));
        col = pow(col, vec3(0.85));

        color = vec4(col * u_fade, 1.0);
    }
"#;

//! GLSL sources for the boarding renderer. One forward pass: Lambert diffuse +
//! Blinn-Phong specular from up to 8 point lights, all math in linear space,
//! per-batch emissive (pulsed for the reactor core), exponential fog, then a
//! Reinhard tonemap and sRGB encode at the very end.

pub const MAX_LIGHTS: usize = 8;

/// Per-target GLSL preamble: desktop GL gets 330 core, WebGL2 gets ES 3.00
/// (which requires explicit fragment precision; the precision statements are
/// legal no-ops on desktop). The renderer prepends this to both stages.
#[cfg(not(target_arch = "wasm32"))]
pub const GLSL_HEADER: &str = "#version 330 core\n";
#[cfg(target_arch = "wasm32")]
pub const GLSL_HEADER: &str = "#version 300 es\nprecision highp float;\nprecision highp int;\n";

pub const VERT: &str = r#"
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_albedo;

uniform mat4 u_view_proj;

out vec3 v_pos;
out vec3 v_normal;
out vec3 v_albedo;

void main() {
    v_pos = a_pos;
    v_normal = a_normal;
    v_albedo = a_albedo;
    gl_Position = u_view_proj * vec4(a_pos, 1.0);
}
"#;

pub const FRAG: &str = r#"
in vec3 v_pos;
in vec3 v_normal;
in vec3 v_albedo;

uniform vec3 u_camera_pos;
uniform int u_light_count;
uniform vec3 u_light_pos[8];
uniform vec3 u_light_color[8];
uniform float u_light_radius[8];
uniform vec3 u_ambient;
uniform vec3 u_emissive;
uniform float u_pulse;      // 0 = steady, 1 = full breathing pulse
uniform float u_time;
uniform vec3 u_fog_color;
uniform float u_fog_density;

out vec4 frag;

void main() {
    vec3 n = normalize(v_normal);
    vec3 view = normalize(u_camera_pos - v_pos);

    // Linear-space accumulation starts from a cool ambient floor.
    vec3 color = v_albedo * u_ambient;

    for (int i = 0; i < u_light_count; i++) {
        vec3 to_light = u_light_pos[i] - v_pos;
        float dist = length(to_light);
        vec3 l = to_light / max(dist, 1e-4);

        // Smooth-windowed falloff: zero at the light radius, physical-ish inside.
        float w = clamp(1.0 - pow(dist / u_light_radius[i], 4.0), 0.0, 1.0);
        float att = (w * w) * 0.85 / (1.0 + 0.09 * dist * dist);

        float ndl = max(dot(n, l), 0.0);
        vec3 h = normalize(l + view);
        float spec = pow(max(dot(n, h), 0.0), 48.0) * 0.25;

        color += (v_albedo * ndl + vec3(spec) * ndl) * u_light_color[i] * att;
    }

    // Emissive (reactor core breathes). Shaped by the view angle so curved
    // emitters keep their silhouette instead of flattening into one tone.
    float pulse = 1.0 + u_pulse * 0.35 * sin(u_time * 2.6);
    float shape = 0.12 + 0.88 * abs(dot(n, view));
    color += u_emissive * pulse * shape * shape;

    // Exponential fog toward near-black blue: depth cue down the corridor.
    float view_dist = length(u_camera_pos - v_pos);
    float fog = exp(-u_fog_density * view_dist);
    color = mix(u_fog_color, color, clamp(fog, 0.0, 1.0));

    // Tonemap, then encode. The default framebuffer is non-sRGB (egui_glow
    // blends in gamma space), so encoding manually here is correct.
    color = color / (vec3(1.0) + color);
    color = pow(color, vec3(1.0 / 2.2));
    frag = vec4(color, 1.0);
}
"#;

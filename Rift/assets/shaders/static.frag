// Desktop GL (#version 140 / 330 core) defaults floats to highp, but some
// drivers wrongly honor `mediump` as ~fp16, which crushes the atlas-coordinate
// (uv / u_atlas_size, values up to ~1024) and palette-index precision below —
// collapsing every surface onto the low (grey) palette indices. Pin highp.
precision highp float;

out vec4 color;

uniform vec2 u_atlas_size;
uniform sampler2D u_atlas;
uniform sampler2D u_palette;

in float v_dist;
in vec2 v_tile_uv;
flat in vec2 v_atlas_uv;
flat in vec2 v_tile_size;
flat in float v_light;

const float DIST_SCALE = 0.9;
const float LIGHT_SCALE = 2.0;

void main() {
    vec2 uv = mod(v_tile_uv, v_tile_size) + v_atlas_uv;
    vec2 palette_index = texture(u_atlas, uv / u_atlas_size).rg;
    if (palette_index.g > .5) {  // Transparent pixel.
        discard;
    } else {
        float dist_term = min(1.0, 1.0 - DIST_SCALE / (v_dist + DIST_SCALE));
        float light = v_light * LIGHT_SCALE - dist_term;
        // The palette texture is created with NO mipmaps (see uniforms.rs), so
        // this dependent lookup can never fall into an averaged (grey) mip level
        // — the root cause of the monochrome world on some drivers.
        color = vec4(texture(u_palette, vec2(palette_index.r, 1.0 - light)).rgb, 1.0);
    }
}

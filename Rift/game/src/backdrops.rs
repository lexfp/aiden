//! Real-photograph backdrops (NASA public-domain imagery, see
//! `assets/img/CREDITS.txt`). The JPEGs are embedded in the binary, decoded
//! once on the first frame, and uploaded as egui textures. Every draw goes
//! through [`draw_cover`], which crops to fill and darkens so UI text on top
//! stays readable.

use eframe::egui::{self, Color32, Rect, TextureHandle};

const GALAXY_JPG: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../assets/img/galaxy_map.jpg"));
const BATTLE_JPG: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../assets/img/battle_backdrop.jpg"));

pub struct Backdrops {
    /// Hubble eXtreme Deep Field — behind the galaxy map.
    pub galaxy: TextureHandle,
    /// Webb "Cosmic Cliffs" (Carina Nebula) — behind the battle scene.
    pub battle: TextureHandle,
}

impl Backdrops {
    /// Decode and upload all embedded photos. Call once, on the first frame.
    pub fn load(ctx: &egui::Context) -> Self {
        Backdrops {
            galaxy: ctx.load_texture("backdrop_galaxy", decode(GALAXY_JPG), egui::TextureOptions::LINEAR),
            battle: ctx.load_texture("backdrop_battle", decode(BATTLE_JPG), egui::TextureOptions::LINEAR),
        }
    }
}

fn decode(bytes: &[u8]) -> egui::ColorImage {
    let img = image::load_from_memory(bytes).expect("embedded backdrop decodes").to_rgba8();
    let (w, h) = img.dimensions();
    egui::ColorImage::from_rgba_unmultiplied([w as usize, h as usize], img.as_raw())
}

/// Draw `tex` covering `rect` (center-cropped, aspect preserved), then darken
/// it with a black overlay so foreground UI keeps contrast. `darken_alpha` of
/// 130–170 works well over bright imagery.
pub fn draw_cover(painter: &egui::Painter, rect: Rect, tex: &TextureHandle, darken_alpha: u8) {
    let tex_size = tex.size_vec2();
    let tex_aspect = tex_size.x / tex_size.y;
    let rect_aspect = rect.width() / rect.height();
    // Sub-rect of [0,1]² with the rect's aspect, centered in the texture.
    let uv = if tex_aspect > rect_aspect {
        let w = rect_aspect / tex_aspect;
        Rect::from_min_max(
            egui::pos2(0.5 - w * 0.5, 0.0),
            egui::pos2(0.5 + w * 0.5, 1.0),
        )
    } else {
        let h = tex_aspect / rect_aspect;
        Rect::from_min_max(
            egui::pos2(0.0, 0.5 - h * 0.5),
            egui::pos2(1.0, 0.5 + h * 0.5),
        )
    };
    painter.image(tex.id(), rect, uv, Color32::WHITE);
    painter.rect_filled(rect, 0, Color32::from_black_alpha(darken_alpha));
    // Subtle vignette: darker band at the edges pulls focus to the center.
    let edge = Color32::from_black_alpha((darken_alpha / 2).max(40));
    let fade = rect.height() * 0.16;
    let top = Rect::from_min_max(rect.min, egui::pos2(rect.max.x, rect.min.y + fade));
    let bottom = Rect::from_min_max(egui::pos2(rect.min.x, rect.max.y - fade), rect.max);
    painter.rect_filled(top, 0, edge);
    painter.rect_filled(bottom, 0, edge);
}

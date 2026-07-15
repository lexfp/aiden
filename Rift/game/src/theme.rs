//! Visual theme — a faithful take on Bellum-Astrum's look: a dark navy
//! (Tailwind `slate-950`) starfield backdrop, a blue/purple/cyan accent set,
//! rounded cards, and gradient-style primary buttons.

use eframe::egui::{self, Color32, CornerRadius, Pos2, Rect, Sense, Stroke, Vec2};
use std::f32::consts::TAU;

// Tailwind slate scale.
pub const SLATE_950: Color32 = Color32::from_rgb(0x02, 0x06, 0x17); // app background
pub const SLATE_900: Color32 = Color32::from_rgb(0x0F, 0x17, 0x2A); // sidebar / panels
pub const SLATE_800: Color32 = Color32::from_rgb(0x1E, 0x29, 0x3B); // cards / hover
pub const SLATE_700: Color32 = Color32::from_rgb(0x33, 0x41, 0x55); // borders
pub const SLATE_400: Color32 = Color32::from_rgb(0x94, 0xA3, 0xB8); // dim text
pub const TEXT: Color32 = Color32::from_rgb(0xF1, 0xF5, 0xF9); // slate-100, near white

// Accents.
pub const BLUE_DEEP: Color32 = Color32::from_rgb(0x1D, 0x4E, 0xD8); // blue-700
pub const BLUE: Color32 = Color32::from_rgb(0x3B, 0x82, 0xF6); // blue-500
pub const BLUE_SOFT: Color32 = Color32::from_rgb(0x93, 0xC5, 0xFD); // blue-300
pub const CYAN: Color32 = Color32::from_rgb(0x22, 0xD3, 0xEE); // cyan-400
pub const PURPLE: Color32 = Color32::from_rgb(0x93, 0x33, 0xEA); // purple-600
pub const GOLD: Color32 = Color32::from_rgb(0xFB, 0xBF, 0x24); // credits
pub const GREEN: Color32 = Color32::from_rgb(0x22, 0xC5, 0x5E);
pub const RED_BRIGHT: Color32 = Color32::from_rgb(0xF8, 0x71, 0x71);

// Back-compat aliases used across screens (mapped onto the new palette).
pub const SURFACE: Color32 = SLATE_900;
pub const BORDER: Color32 = SLATE_700;
pub const TEXT_DIM: Color32 = SLATE_400;
pub const AMBER: Color32 = GOLD;

/// Font family name for headings and the logotype (Chakra Petch).
pub const DISPLAY_FAMILY: &str = "display";

/// A `FontId` in the display family, for one-off sizes like the logotype.
pub fn display_font(size: f32) -> egui::FontId {
    egui::FontId::new(size, egui::FontFamily::Name(DISPLAY_FAMILY.into()))
}

/// Apply the theme to an egui context.
pub fn install(ctx: &egui::Context) {
    install_fonts(ctx);
    // egui 0.35 keeps a separate style per theme (dark/light) and no longer has
    // `Context::style()`/`set_style()`. We force this dark look regardless of the
    // OS theme, so mutate both stored styles in place.
    ctx.all_styles_mut(install_style);
}

/// Ship real fonts instead of egui's defaults: Open Sans for body text and
/// Chakra Petch for headings. The egui defaults stay in the fallback chain so
/// glyph coverage (arrows, ellipsis, box drawing) is preserved.
fn install_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();
    fonts.font_data.insert(
        "body".to_owned(),
        std::sync::Arc::new(egui::FontData::from_static(include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../assets/ttf/OpenSans-Regular.ttf"
        )))),
    );
    fonts.font_data.insert(
        DISPLAY_FAMILY.to_owned(),
        std::sync::Arc::new(egui::FontData::from_static(include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../assets/ttf/ChakraPetch-SemiBold.ttf"
        )))),
    );
    if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Proportional) {
        family.insert(0, "body".to_owned());
    }
    let mut display_chain = vec![DISPLAY_FAMILY.to_owned(), "body".to_owned()];
    if let Some(proportional) = fonts.families.get(&egui::FontFamily::Proportional) {
        // Full fallback: display → body → egui defaults.
        display_chain.extend(proportional.iter().skip(1).cloned());
    }
    fonts
        .families
        .insert(egui::FontFamily::Name(DISPLAY_FAMILY.into()), display_chain);
    ctx.set_fonts(fonts);
}

fn install_style(style: &mut egui::Style) {
    let v = &mut style.visuals;

    v.dark_mode = true;
    v.override_text_color = Some(TEXT);
    v.panel_fill = SLATE_950;
    v.window_fill = SLATE_900;
    v.extreme_bg_color = SLATE_950;
    v.faint_bg_color = SLATE_800;
    v.window_stroke = Stroke::new(1.0, SLATE_700);
    v.window_corner_radius = CornerRadius::same(12);

    let rounding = CornerRadius::same(10);
    v.widgets.noninteractive.bg_fill = SLATE_900;
    v.widgets.noninteractive.bg_stroke = Stroke::new(1.0, SLATE_700);
    v.widgets.noninteractive.corner_radius = rounding;
    v.widgets.noninteractive.fg_stroke = Stroke::new(1.0, SLATE_400);

    v.widgets.inactive.bg_fill = SLATE_800;
    v.widgets.inactive.weak_bg_fill = SLATE_800;
    v.widgets.inactive.bg_stroke = Stroke::new(1.0, SLATE_700);
    v.widgets.inactive.corner_radius = rounding;
    v.widgets.inactive.fg_stroke = Stroke::new(1.0, TEXT);

    v.widgets.hovered.bg_fill = SLATE_700;
    v.widgets.hovered.weak_bg_fill = SLATE_700;
    v.widgets.hovered.bg_stroke = Stroke::new(1.0, BLUE);
    v.widgets.hovered.corner_radius = rounding;
    v.widgets.hovered.fg_stroke = Stroke::new(1.0, TEXT);

    v.widgets.active.bg_fill = BLUE;
    v.widgets.active.weak_bg_fill = BLUE;
    v.widgets.active.bg_stroke = Stroke::new(1.0, BLUE_SOFT);
    v.widgets.active.corner_radius = rounding;
    v.widgets.active.fg_stroke = Stroke::new(1.0, TEXT);

    v.selection.bg_fill = BLUE.linear_multiply(0.45);
    v.selection.stroke = Stroke::new(1.0, BLUE_SOFT);

    style.spacing.item_spacing = Vec2::new(10.0, 8.0);
    style.spacing.button_padding = Vec2::new(14.0, 8.0);

    use egui::{FontFamily, FontId, TextStyle};
    style.text_styles = [
        (TextStyle::Heading, FontId::new(22.0, FontFamily::Name(DISPLAY_FAMILY.into()))),
        (TextStyle::Body, FontId::new(14.5, FontFamily::Proportional)),
        (TextStyle::Button, FontId::new(14.5, FontFamily::Proportional)),
        (TextStyle::Small, FontId::new(11.5, FontFamily::Proportional)),
        (TextStyle::Monospace, FontId::new(13.0, FontFamily::Monospace)),
    ]
    .into();
}

/// A screen title (display font) with an optional dim subtitle underneath.
/// Rendered as real labels so AccessKit — and the kittest UI tests — can query
/// the title text.
pub fn screen_title(ui: &mut egui::Ui, title: &str, subtitle: &str) {
    ui.vertical(|ui| {
        ui.spacing_mut().item_spacing.y = 2.0;
        ui.label(egui::RichText::new(title).font(display_font(22.0)).color(TEXT));
        if !subtitle.is_empty() {
            ui.label(egui::RichText::new(subtitle).small().color(SLATE_400));
        }
    });
}

/// A thin separator rule under a screen header.
pub fn header_rule(ui: &mut egui::Ui) {
    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 1.0), Sense::hover());
    ui.painter().line_segment(
        [rect.left_center(), rect.right_center()],
        Stroke::new(1.0, SLATE_700),
    );
    ui.add_space(6.0);
}

/// Standard screen header: title + subtitle + rule, for screens without header
/// buttons. Screens with buttons compose `screen_title` + `header_rule`.
pub fn screen_header(ui: &mut egui::Ui, title: &str, subtitle: &str) {
    screen_title(ui, title, subtitle);
    ui.add_space(4.0);
    header_rule(ui);
}

/// Cheap deterministic hash in [0,1) for star placement.
fn hash01(n: f32) -> f32 {
    let v = (n * 12.9898).sin() * 43758.547;
    v - v.floor()
}

/// Paint a twinkling two-layer parallax starfield across `rect`. `t` is
/// elapsed seconds. A few stars carry a blue or gold tint, and the brightest
/// near-layer stars get a small cross flare.
pub fn draw_starfield(painter: &egui::Painter, rect: Rect, t: f32) {
    let base = ((rect.width() * rect.height()) / 5200.0) as i32;
    let base = base.clamp(60, 260);
    // (count, brightness, horizontal drift px/s): far layer then near layer.
    for (layer, (count, dim, drift)) in [(base / 2, 0.4f32, 1.6f32), (base, 1.0, 0.0)].into_iter().enumerate() {
        for i in 0..count {
            let fi = i as f32 + layer as f32 * 977.0;
            let x = rect.left() + (hash01(fi * 1.3 + 0.1) * rect.width() + t * drift).rem_euclid(rect.width());
            let y = rect.top() + hash01(fi * 2.7 + 3.7) * rect.height();
            let size = (0.6 + hash01(fi * 5.1 + 1.0) * 1.7) * if layer == 0 { 0.7 } else { 1.0 };
            let phase = hash01(fi * 7.3 + 2.0) * TAU;
            let speed = 1.0 + hash01(fi * 9.1) * 2.0;
            let twinkle = 0.35 + 0.65 * (0.5 + 0.5 * (t * speed + phase).sin());
            let alpha = (twinkle * 190.0 * dim) as u8;
            let tint = hash01(fi * 3.9 + 5.5);
            let color = if tint < 0.05 {
                Color32::from_rgba_unmultiplied(BLUE_SOFT.r(), BLUE_SOFT.g(), BLUE_SOFT.b(), alpha)
            } else if tint < 0.09 {
                Color32::from_rgba_unmultiplied(GOLD.r(), GOLD.g(), GOLD.b(), alpha)
            } else {
                Color32::from_white_alpha(alpha)
            };
            let pos = Pos2::new(x, y);
            painter.circle_filled(pos, size, color);
            // Cross flare on the brightest near-layer stars.
            if layer == 1 && size > 2.0 && twinkle > 0.85 {
                let flare = Color32::from_white_alpha(alpha / 3);
                let l = size * 2.4;
                painter.line_segment([pos - Vec2::new(l, 0.0), pos + Vec2::new(l, 0.0)], Stroke::new(0.7, flare));
                painter.line_segment([pos - Vec2::new(0.0, l), pos + Vec2::new(0.0, l)], Stroke::new(0.7, flare));
            }
        }
    }
}

/// Draw a circular avatar with a blue→purple sheen and a centered initial.
pub fn avatar(ui: &egui::Ui, rect: Rect, initial: char) {
    let painter = ui.painter();
    let center = rect.center();
    let r = rect.width().min(rect.height()) * 0.5;
    painter.circle_filled(center, r, PURPLE);
    // Offset blue disc gives a simple two-tone gradient feel.
    painter.circle_filled(center - Vec2::new(r * 0.22, r * 0.22), r * 0.92, BLUE);
    painter.circle_stroke(center, r, Stroke::new(1.5, BLUE_SOFT));
    painter.text(
        center,
        egui::Align2::CENTER_CENTER,
        initial.to_uppercase().to_string(),
        egui::FontId::proportional(r * 0.95),
        Color32::WHITE,
    );
}

/// A prominent rounded primary button (blue, cyan ring on hover). Returns true
/// when clicked. `enabled = false` renders it muted and non-interactive.
pub fn primary_button(ui: &mut egui::Ui, label: &str, size: Vec2, enabled: bool) -> bool {
    let sense = if enabled { Sense::click() } else { Sense::hover() };
    let (rect, resp) = ui.allocate_exact_size(size, sense);
    // The button paints its text directly on the painter (below), which leaves
    // the widget with no accessible name. Publish one so screen readers — and
    // the kittest UI tests — can find and click it by its label.
    resp.widget_info(|| egui::WidgetInfo::labeled(egui::WidgetType::Button, enabled, label));
    let rounding = CornerRadius::same(12);
    let painter = ui.painter();

    let (fill, ring) = if !enabled {
        (SLATE_800, SLATE_700)
    } else if resp.hovered() {
        (BLUE, CYAN)
    } else {
        (BLUE_DEEP, BLUE.linear_multiply(0.6))
    };
    painter.rect_filled(rect, rounding, fill);
    // A lighter top edge gives a subtle gradient/sheen.
    if enabled {
        let sheen = Rect::from_min_max(rect.min, Pos2::new(rect.max.x, rect.center().y));
        painter.rect_filled(sheen, CornerRadius { nw: 12, ne: 12, sw: 0, se: 0 }, Color32::from_white_alpha(14));
    }
    painter.rect_stroke(rect, rounding, Stroke::new(1.5, ring), egui::StrokeKind::Inside);
    let text_color = if enabled { Color32::WHITE } else { SLATE_400 };
    painter.text(
        rect.center(),
        egui::Align2::CENTER_CENTER,
        label,
        egui::FontId::proportional(15.0),
        text_color,
    );
    enabled && resp.clicked()
}

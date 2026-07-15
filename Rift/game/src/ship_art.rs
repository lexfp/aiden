//! Original procedural spacecraft art. Each ship is drawn from layered polygons
//! (hull, wings, cockpit, engines) so the fleet is visually distinct across the
//! five archetypes and six tiers — no external image assets.

use crate::theme;
use eframe::egui::{self, Color32, CornerRadius, Pos2, Sense, Shape, Stroke, Vec2};

fn shade(c: Color32, f: f32) -> Color32 {
    Color32::from_rgb((c.r() as f32 * f) as u8, (c.g() as f32 * f) as u8, (c.b() as f32 * f) as u8)
}

fn lighten(c: Color32, t: f32) -> Color32 {
    let m = |a: u8| (a as f32 + (255.0 - a as f32) * t) as u8;
    Color32::from_rgb(m(c.r()), m(c.g()), m(c.b()))
}

/// The archetype of a ship from its catalog id: each tier lists five hulls in a
/// fixed order (balanced, cannon, tank, interceptor, bruiser).
pub fn archetype_of(ship_id: u32) -> u8 {
    ((ship_id.saturating_sub(1)) % 5) as u8
}

/// Draw an original spacecraft centered at `center`. `dir` = +1 faces right,
/// -1 faces left; `size` is roughly the half-length in pixels; `archetype`
/// 0..4 selects the hull; `tier` 1..6 adds detailing.
pub fn draw_ship(painter: &egui::Painter, center: Pos2, size: f32, dir: f32, archetype: u8, accent: Color32, tier: u8) {
    let p = |x: f32, y: f32| center + Vec2::new(dir * x * size, y * size);
    let poly = |pts: Vec<Pos2>, fill: Color32, stroke: Stroke| {
        painter.add(Shape::convex_polygon(pts, fill, stroke));
    };
    let hull = accent;
    let body = shade(accent, 0.6);
    let plate = shade(accent, 0.42);
    let trim = lighten(accent, 0.45);
    let outline = Stroke::new(if tier >= 4 { 1.6 } else { 1.0 }, lighten(accent, 0.65));
    let cockpit = theme::CYAN;
    let engine = theme::GOLD;
    // Stacked translucent discs give each engine a soft exhaust glow.
    let eng = |x: f32, y: f32, r: f32| {
        painter.circle_filled(p(x, y), r * size * 2.1, engine.linear_multiply(0.16));
        painter.circle_filled(p(x, y), r * size * 1.4, engine.linear_multiply(0.35));
        painter.circle_filled(p(x, y), r * size, engine);
    };

    match archetype {
        // 1 — glass cannon: long dart with forward guns.
        1 => {
            poly(vec![p(-0.6, -0.14), p(-0.98, -0.42), p(-0.98, -0.14)], body, Stroke::NONE);
            poly(vec![p(-0.6, 0.14), p(-0.98, 0.42), p(-0.98, 0.14)], body, Stroke::NONE);
            poly(vec![p(1.1, 0.0), p(0.2, -0.13), p(-0.9, -0.13), p(-0.9, 0.13), p(0.2, 0.13)], hull, outline);
            poly(vec![p(0.5, -0.17), p(1.2, -0.15), p(1.2, -0.1), p(0.5, -0.12)], trim, Stroke::NONE);
            poly(vec![p(0.5, 0.17), p(1.2, 0.15), p(1.2, 0.1), p(0.5, 0.12)], trim, Stroke::NONE);
            poly(vec![p(0.5, 0.0), p(0.15, -0.08), p(-0.1, 0.0), p(0.15, 0.08)], cockpit, Stroke::NONE);
            eng(-0.9, 0.0, 0.15);
        }
        // 2 — tank: broad, heavily armored hull.
        2 => {
            poly(
                vec![p(0.85, 0.0), p(0.5, -0.42), p(-0.8, -0.48), p(-0.95, 0.0), p(-0.8, 0.48), p(0.5, 0.42)],
                hull,
                outline,
            );
            poly(vec![p(0.45, -0.22), p(-0.6, -0.26), p(-0.6, -0.02), p(0.45, -0.05)], plate, Stroke::NONE);
            poly(vec![p(0.45, 0.22), p(-0.6, 0.26), p(-0.6, 0.02), p(0.45, 0.05)], plate, Stroke::NONE);
            poly(vec![p(0.7, 0.0), p(0.35, -0.12), p(0.1, 0.0), p(0.35, 0.12)], cockpit, Stroke::NONE);
            eng(-0.9, -0.26, 0.11);
            eng(-0.98, 0.0, 0.12);
            eng(-0.9, 0.26, 0.11);
        }
        // 3 — interceptor: sleek needle with big engines and swept wings.
        3 => {
            poly(vec![p(0.1, -0.06), p(-0.7, -0.62), p(-0.95, -0.55), p(-0.35, -0.06)], body, Stroke::NONE);
            poly(vec![p(0.1, 0.06), p(-0.7, 0.62), p(-0.95, 0.55), p(-0.35, 0.06)], body, Stroke::NONE);
            poly(vec![p(1.35, 0.0), p(-0.85, -0.1), p(-0.85, 0.1)], hull, outline);
            poly(vec![p(0.7, 0.0), p(0.3, -0.05), p(0.1, 0.0), p(0.3, 0.05)], cockpit, Stroke::NONE);
            eng(-0.85, -0.09, 0.17);
            eng(-0.85, 0.09, 0.17);
        }
        // 4 — bruiser: bulky, rounded, high-mass hull.
        4 => {
            poly(
                vec![
                    p(0.95, 0.0), p(0.7, -0.28), p(0.2, -0.44), p(-0.4, -0.44), p(-0.8, -0.26),
                    p(-0.92, 0.0), p(-0.8, 0.26), p(-0.4, 0.44), p(0.2, 0.44), p(0.7, 0.28),
                ],
                hull,
                outline,
            );
            poly(vec![p(0.5, -0.2), p(-0.5, -0.22), p(-0.5, 0.22), p(0.5, 0.2)], plate, Stroke::NONE);
            poly(vec![p(0.7, 0.0), p(0.35, -0.13), p(0.05, 0.0), p(0.35, 0.13)], cockpit, Stroke::NONE);
            eng(-0.9, -0.16, 0.13);
            eng(-0.9, 0.16, 0.13);
        }
        // 0 — balanced fighter (default).
        _ => {
            poly(vec![p(0.0, -0.2), p(-0.35, -0.75), p(-0.65, -0.2)], body, Stroke::NONE);
            poly(vec![p(0.0, 0.2), p(-0.35, 0.75), p(-0.65, 0.2)], body, Stroke::NONE);
            poly(
                vec![p(1.0, 0.0), p(0.3, -0.28), p(-0.75, -0.2), p(-0.9, 0.0), p(-0.75, 0.2), p(0.3, 0.28)],
                hull,
                outline,
            );
            poly(vec![p(0.6, 0.0), p(0.25, -0.1), p(0.0, 0.0), p(0.25, 0.1)], cockpit, Stroke::NONE);
            eng(-0.85, -0.12, 0.11);
            eng(-0.85, 0.12, 0.11);
        }
    }

    // High-tier hulls get glowing wing-tip lights.
    if tier >= 5 {
        painter.circle_filled(p(-0.3, -0.7), 0.06 * size, trim);
        painter.circle_filled(p(-0.3, 0.7), 0.06 * size, trim);
    }
}

/// Draw a ship "art tile": a rounded, tier-tinted panel with the ship sprite.
pub fn ship_tile(ui: &mut egui::Ui, box_size: f32, archetype: u8, accent: Color32, tier: u8) {
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(box_size), Sense::hover());
    let painter = ui.painter();
    let rounding = CornerRadius::same(10);
    painter.rect_filled(rect, rounding, accent.linear_multiply(0.16));
    painter.rect_stroke(rect, rounding, Stroke::new(1.0, accent), egui::StrokeKind::Inside);
    draw_ship(painter, rect.center(), box_size * 0.33, 1.0, archetype, accent, tier);
}

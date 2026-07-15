//! Procedural vector icons: stroke-and-polygon line art painted directly with
//! the egui painter, in the same idiom as `ship_art` — no font glyphs, no
//! external image assets. Used for the sidebar navigation, rank insignia, and
//! small inline markers.

use crate::theme;
use eframe::egui::{self, Color32, Pos2, Rect, Shape, Stroke, Vec2};
use sim::rank::UserRank;

/// The icon set. Each glyph is drawn centered inside the rect it is given.
#[derive(Clone, Copy, PartialEq)]
pub enum Icon {
    /// A rocket in flight (Hangar).
    Ship,
    /// A storefront (Market).
    Market,
    /// A hammer (Work).
    Hammer,
    /// A spiral galaxy (Galaxy).
    Galaxy,
    /// A trophy cup (Leaderboard).
    Trophy,
    /// An envelope (History).
    History,
    /// A hexagonal credit chip.
    Credits,
    /// A satellite with solar panels (NPC systems).
    Satellite,
}

/// Translucent fill derived from the stroke colour, so glyphs read as solid
/// shapes on the dark theme without overpowering the text next to them.
fn fill_of(color: Color32) -> Color32 {
    color.linear_multiply(0.22)
}

/// Paint `icon` centered in `rect` using `color` for strokes and fills.
pub fn draw(painter: &egui::Painter, rect: Rect, icon: Icon, color: Color32) {
    let c = rect.center();
    let s = rect.width().min(rect.height()) * 0.5;
    // Map unit coords (x right, y down, both in [-1, 1]) into the rect.
    let p = |x: f32, y: f32| c + Vec2::new(x, y) * s;
    let stroke = Stroke::new((s * 0.16).clamp(1.2, 2.0), color);
    let fill = fill_of(color);
    let poly = |pts: Vec<Pos2>, f: Color32, st: Stroke| Shape::convex_polygon(pts, f, st);

    match icon {
        Icon::Ship => {
            // Fins first so the hull outline sits on top of them.
            painter.add(poly(vec![p(-0.32, 0.08), p(-0.68, 0.62), p(-0.32, 0.55)], fill, stroke));
            painter.add(poly(vec![p(0.32, 0.08), p(0.68, 0.62), p(0.32, 0.55)], fill, stroke));
            painter.add(poly(
                vec![p(0.0, -0.95), p(0.3, -0.25), p(0.3, 0.55), p(-0.3, 0.55), p(-0.3, -0.25)],
                fill,
                stroke,
            ));
            painter.circle_stroke(p(0.0, -0.18), s * 0.16, stroke);
            // Exhaust flame.
            painter.add(poly(
                vec![p(-0.16, 0.6), p(0.16, 0.6), p(0.0, 0.95)],
                color.linear_multiply(0.55),
                Stroke::NONE,
            ));
        }
        Icon::Market => {
            // Awning over the shopfront.
            painter.add(poly(
                vec![p(-0.7, -0.55), p(0.7, -0.55), p(0.85, -0.1), p(-0.85, -0.1)],
                fill,
                stroke,
            ));
            painter.rect_stroke(
                Rect::from_min_max(p(-0.65, -0.1), p(0.65, 0.75)),
                0,
                stroke,
                egui::StrokeKind::Middle,
            );
            painter.rect_stroke(
                Rect::from_min_max(p(-0.14, 0.22), p(0.14, 0.75)),
                0,
                stroke,
                egui::StrokeKind::Middle,
            );
        }
        Icon::Hammer => {
            // 45° handle with a perpendicular head, built from direction vectors.
            let d = Vec2::new(1.0, -1.0).normalized(); // along the handle, up-right
            let q = Vec2::new(1.0, 1.0).normalized(); // perpendicular
            let quad = |center: Pos2, along: Vec2, half_len: f32, across: Vec2, half_w: f32| {
                vec![
                    center + (along * half_len + across * half_w) * s,
                    center + (along * half_len - across * half_w) * s,
                    center - (along * half_len - across * half_w) * s,
                    center - (along * half_len + across * half_w) * s,
                ]
            };
            let handle_mid = c + Vec2::new(-0.12, 0.12) * s;
            painter.add(poly(quad(handle_mid, d, 0.62, q, 0.09), fill, stroke));
            let head_mid = c + Vec2::new(0.4, -0.4) * s;
            painter.add(poly(quad(head_mid, q, 0.42, d, 0.17), fill, stroke));
        }
        Icon::Galaxy => {
            painter.circle_filled(c, s * 0.16, color);
            for arm in 0..2 {
                let phase = arm as f32 * std::f32::consts::PI;
                let pts: Vec<Pos2> = (0..=14)
                    .map(|i| {
                        let t = i as f32 / 14.0;
                        let ang = phase + t * 3.4;
                        let r = (0.18 + t * 0.72) * s;
                        c + Vec2::new(ang.cos() * r, ang.sin() * r * 0.7)
                    })
                    .collect();
                painter.add(Shape::line(pts, stroke));
            }
        }
        Icon::Trophy => {
            // Handles behind the bowl.
            painter.circle_stroke(p(-0.58, -0.3), s * 0.2, stroke);
            painter.circle_stroke(p(0.58, -0.3), s * 0.2, stroke);
            painter.add(poly(
                vec![p(-0.5, -0.65), p(0.5, -0.65), p(0.3, 0.1), p(-0.3, 0.1)],
                fill,
                stroke,
            ));
            painter.rect_filled(Rect::from_min_max(p(-0.07, 0.1), p(0.07, 0.4)), 0, color);
            painter.add(poly(
                vec![p(-0.32, 0.4), p(0.32, 0.4), p(0.32, 0.58), p(-0.32, 0.58)],
                fill,
                stroke,
            ));
        }
        Icon::History => {
            let body = Rect::from_min_max(p(-0.78, -0.52), p(0.78, 0.52));
            painter.rect_filled(body, 0, fill);
            painter.rect_stroke(body, 0, stroke, egui::StrokeKind::Middle);
            painter.add(Shape::line(vec![p(-0.78, -0.52), p(0.0, 0.1), p(0.78, -0.52)], stroke));
        }
        Icon::Credits => {
            let hex: Vec<Pos2> = (0..6)
                .map(|i| {
                    let a = std::f32::consts::TAU * (i as f32) / 6.0 + std::f32::consts::FRAC_PI_6;
                    p(a.cos() * 0.82, a.sin() * 0.82)
                })
                .collect();
            painter.add(poly(hex, fill, stroke));
            painter.circle_stroke(c, s * 0.4, stroke);
        }
        Icon::Satellite => {
            // Solar panels + struts.
            for side in [-1.0f32, 1.0] {
                painter.line_segment([p(side * 0.24, 0.0), p(side * 0.4, 0.0)], stroke);
                let panel = Rect::from_min_max(p(side.min(0.0) * 0.95 + side.max(0.0) * 0.4, -0.16), p(side.min(0.0) * 0.4 + side.max(0.0) * 0.95, 0.16));
                painter.rect_filled(panel, 0, fill);
                painter.rect_stroke(panel, 0, stroke, egui::StrokeKind::Middle);
                // Panel cell divider.
                let mid_x = side * 0.675;
                painter.line_segment([p(mid_x, -0.16), p(mid_x, 0.16)], stroke);
            }
            let body = Rect::from_min_max(p(-0.22, -0.22), p(0.22, 0.22));
            painter.rect_filled(body, 0, fill);
            painter.rect_stroke(body, 0, stroke, egui::StrokeKind::Middle);
            painter.line_segment([p(0.0, -0.22), p(0.0, -0.52)], stroke);
            painter.circle_filled(p(0.0, -0.58), s * 0.08, color);
        }
    }
}

/// Military insignia for the 11-rank ladder, drawn centered in `rect`:
/// chevrons for enlisted ranks, bars for officers, a diamond for Captain, then
/// one to five stars for the flag ranks. Flag ranks are gold, the rest blue.
pub fn rank_insignia(painter: &egui::Painter, rect: Rect, rank: UserRank) {
    let flag = matches!(
        rank,
        UserRank::Commodore
            | UserRank::RearAdmiral
            | UserRank::ViceAdmiral
            | UserRank::Admiral
            | UserRank::FleetAdmiral
    );
    let color = if flag { theme::GOLD } else { theme::BLUE_SOFT };
    let c = rect.center();
    let s = rect.width().min(rect.height()) * 0.5;
    let stroke = Stroke::new((s * 0.22).clamp(1.2, 2.0), color);

    let chevrons = |n: usize| {
        for i in 0..n {
            let dy = (i as f32 - (n as f32 - 1.0) * 0.5) * 0.52 * s;
            let base = c + Vec2::new(0.0, dy);
            painter.add(Shape::line(
                vec![
                    base + Vec2::new(-0.7, 0.32) * s,
                    base + Vec2::new(0.0, -0.28) * s,
                    base + Vec2::new(0.7, 0.32) * s,
                ],
                stroke,
            ));
        }
    };
    let bars = |n: usize| {
        for i in 0..n {
            let dx = (i as f32 - (n as f32 - 1.0) * 0.5) * 0.62 * s;
            let r = Rect::from_center_size(c + Vec2::new(dx, 0.0), Vec2::new(0.34, 1.5) * s);
            painter.rect_filled(r, 1, color);
        }
    };
    // A four-point star: two thin diamonds (each convex) crossed at the center.
    let star = |center: Pos2, r: f32| {
        let diamond = |half_long: Vec2, half_short: Vec2| {
            Shape::convex_polygon(
                vec![
                    center + half_long,
                    center + half_short,
                    center - half_long,
                    center - half_short,
                ],
                color,
                Stroke::NONE,
            )
        };
        painter.add(diamond(Vec2::new(0.0, -r), Vec2::new(r * 0.38, 0.0)));
        painter.add(diamond(Vec2::new(r, 0.0), Vec2::new(0.0, r * 0.38)));
    };
    let stars = |n: usize| {
        for i in 0..n {
            let dx = (i as f32 - (n as f32 - 1.0) * 0.5) * 0.58 * s;
            // Arc the outer stars upward slightly when there are many.
            let dy = if n >= 4 { (i as f32 - (n as f32 - 1.0) * 0.5).abs() * -0.18 * s } else { 0.0 };
            star(c + Vec2::new(dx, dy), s * 0.34);
        }
    };

    match rank {
        UserRank::Recruit => chevrons(1),
        UserRank::Ensign => chevrons(2),
        UserRank::Lieutenant => bars(1),
        UserRank::LieutenantCommander => bars(2),
        UserRank::Commander => bars(3),
        UserRank::Captain => {
            painter.add(Shape::convex_polygon(
                vec![
                    c + Vec2::new(0.0, -0.8) * s,
                    c + Vec2::new(0.55, 0.0) * s,
                    c + Vec2::new(0.0, 0.8) * s,
                    c + Vec2::new(-0.55, 0.0) * s,
                ],
                fill_of(color),
                stroke,
            ));
        }
        UserRank::Commodore => stars(1),
        UserRank::RearAdmiral => stars(2),
        UserRank::ViceAdmiral => stars(3),
        UserRank::Admiral => stars(4),
        UserRank::FleetAdmiral => stars(5),
    }
}

/// Convenience: allocate a square icon slot inline and draw into it.
pub fn draw_inline(ui: &mut egui::Ui, size: f32, icon: Icon, color: Color32) {
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(size), egui::Sense::hover());
    draw(ui.painter(), rect, icon, color);
}

//! Boarding raids: the attacker deploys as a troop inside the defending
//! flagship before the fleet battle and destroys vital subsystems. The raid
//! itself runs client-side (it is a skill minigame); this module defines the
//! *outcome* the sim consumes and how it weakens the defender in
//! [`crate::combat::battle_with_boarding`].

use serde::{Deserialize, Serialize};

/// A vital subsystem inside the defending flagship.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Subsystem {
    /// Fleet-wide evasion collapses without engine coordination.
    Engines,
    /// Fleet-wide shielding collapses.
    ShieldGenerator,
    /// Fleet-wide attack power drops.
    WeaponsBay,
    /// The flagship itself starts the battle nearly destroyed.
    ReactorCore,
}

impl Subsystem {
    pub fn name(&self) -> &'static str {
        match self {
            Subsystem::Engines => "engines",
            Subsystem::ShieldGenerator => "shield generator",
            Subsystem::WeaponsBay => "weapons bay",
            Subsystem::ReactorCore => "reactor core",
        }
    }
}

/// What the boarding raid accomplished. Built by the client's boarding mode
/// and applied server-side as combat modifiers; always pass through
/// [`BoardingOutcome::sanitized`] before use.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct BoardingOutcome {
    /// Which subsystems were destroyed (deduplicated by `sanitized`).
    pub destroyed: Vec<Subsystem>,
    /// How long the raid took, in seconds (informational).
    pub duration_secs: f32,
    /// True if the boarder walked out of the airlock; false if the raid ended
    /// by timeout or the boarder being knocked out.
    pub extracted: bool,
}

impl BoardingOutcome {
    /// Deduplicate subsystems (order preserved) and clamp the duration, so a
    /// hand-crafted payload can never exceed the effect of a perfect raid.
    pub fn sanitized(&self) -> BoardingOutcome {
        let mut seen = Vec::new();
        for s in &self.destroyed {
            if !seen.contains(s) {
                seen.push(*s);
            }
        }
        BoardingOutcome {
            destroyed: seen,
            duration_secs: self.duration_secs.clamp(0.0, 600.0),
            extracted: self.extracted,
        }
    }

    /// True when the raid changed nothing about the battle.
    pub fn is_noop(&self) -> bool {
        self.destroyed.is_empty()
    }

    /// Human-readable log lines describing the raid, prefixed to the battle log.
    pub fn log_lines(&self, defender: &str) -> Vec<String> {
        let mut lines = Vec::new();
        if self.is_noop() {
            return lines;
        }
        lines.push(format!("Boarding raid on {}'s flagship!", defender));
        for s in &self.destroyed {
            lines.push(match s {
                Subsystem::Engines => format!("Enemy {} destroyed — fleet evasion crippled!", s.name()),
                Subsystem::ShieldGenerator => format!("Enemy {} destroyed — fleet shields failing!", s.name()),
                Subsystem::WeaponsBay => format!("Enemy {} destroyed — fleet attack power reduced!", s.name()),
                Subsystem::ReactorCore => format!("Enemy {} destroyed — flagship critically damaged!", s.name()),
            });
        }
        lines
    }
}

/// Highest purchasable ship-defense level (turret count inside the flagship).
pub const DEFENSE_LEVEL_MAX: u8 = 5;

/// Credits to upgrade ship defenses *from* `level` to `level + 1`. Escalates so
/// a fully hardened flagship is a serious investment.
pub fn defense_upgrade_cost(level: u8) -> i64 {
    match level {
        0 => 500,
        1 => 1_200,
        2 => 2_500,
        3 => 5_000,
        4 => 9_000,
        _ => i64::MAX, // already at max — unpurchasable
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_dedupes_and_clamps() {
        let o = BoardingOutcome {
            destroyed: vec![
                Subsystem::Engines,
                Subsystem::ReactorCore,
                Subsystem::Engines,
                Subsystem::ReactorCore,
            ],
            duration_secs: 9999.0,
            extracted: true,
        };
        let s = o.sanitized();
        assert_eq!(s.destroyed, vec![Subsystem::Engines, Subsystem::ReactorCore]);
        assert_eq!(s.duration_secs, 600.0);
        assert!(s.extracted);
    }

    #[test]
    fn noop_has_no_log_lines() {
        let o = BoardingOutcome::default();
        assert!(o.is_noop());
        assert!(o.log_lines("Bob").is_empty());
    }

    #[test]
    fn log_lines_name_the_defender_and_each_subsystem() {
        let o = BoardingOutcome {
            destroyed: vec![Subsystem::ShieldGenerator, Subsystem::WeaponsBay],
            duration_secs: 30.0,
            extracted: false,
        };
        let lines = o.log_lines("Bob");
        assert_eq!(lines.len(), 3);
        assert!(lines[0].contains("Bob"));
        assert!(lines[1].contains("shield generator"));
        assert!(lines[2].contains("weapons bay"));
    }

    #[test]
    fn defense_costs_escalate_and_cap() {
        for l in 0..DEFENSE_LEVEL_MAX - 1 {
            assert!(defense_upgrade_cost(l) < defense_upgrade_cost(l + 1));
        }
        assert_eq!(defense_upgrade_cost(DEFENSE_LEVEL_MAX), i64::MAX);
    }
}

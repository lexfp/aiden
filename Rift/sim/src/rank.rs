//! Military ranks: the 11-tier progression, the per-rank bonuses applied to
//! ships in battle, and the level/rank thresholds derived from experience.

use crate::ship::ShipStats;
use crate::{BASE_XP, GROWTH_FACTOR};
use serde::{Deserialize, Serialize};

/// The 11 ranks, lowest to highest.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum UserRank {
    Recruit,
    Ensign,
    Lieutenant,
    LieutenantCommander,
    Commander,
    Captain,
    Commodore,
    RearAdmiral,
    ViceAdmiral,
    Admiral,
    FleetAdmiral,
}

impl UserRank {
    pub const ALL: [UserRank; 11] = [
        UserRank::Recruit,
        UserRank::Ensign,
        UserRank::Lieutenant,
        UserRank::LieutenantCommander,
        UserRank::Commander,
        UserRank::Captain,
        UserRank::Commodore,
        UserRank::RearAdmiral,
        UserRank::ViceAdmiral,
        UserRank::Admiral,
        UserRank::FleetAdmiral,
    ];

    /// The human-facing rank name.
    pub fn title(self) -> &'static str {
        match self {
            UserRank::Recruit => "Recruit",
            UserRank::Ensign => "Ensign",
            UserRank::Lieutenant => "Lieutenant",
            UserRank::LieutenantCommander => "Lieutenant Commander",
            UserRank::Commander => "Commander",
            UserRank::Captain => "Captain",
            UserRank::Commodore => "Commodore",
            UserRank::RearAdmiral => "Rear Admiral",
            UserRank::ViceAdmiral => "Vice Admiral",
            UserRank::Admiral => "Admiral",
            UserRank::FleetAdmiral => "Fleet Admiral",
        }
    }

    /// The bonuses and limits granted at this rank.
    pub fn bonus(self) -> RankBonus {
        // (min_level, attack, shield, hp, evasion, fire_rate, value,
        //  max_active_ships, work_income, work_cooldown_minutes)
        let (min_level, attack, shield, hp, evasion, fire_rate, value, max_active, income, cooldown) =
            match self {
                UserRank::Recruit => (1, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1, 700, 2),
                UserRank::Ensign => (3, 0.05, 0.05, 0.05, 0.01, 0.05, 0.10, 2, 1000, 3),
                UserRank::Lieutenant => (5, 0.10, 0.10, 0.10, 0.02, 0.10, 0.20, 3, 1400, 3),
                UserRank::LieutenantCommander => (8, 0.15, 0.15, 0.15, 0.03, 0.15, 0.30, 4, 1900, 4),
                UserRank::Commander => (13, 0.20, 0.20, 0.20, 0.04, 0.20, 0.40, 5, 2600, 4),
                UserRank::Captain => (21, 0.25, 0.25, 0.25, 0.05, 0.25, 0.50, 6, 3500, 5),
                UserRank::Commodore => (35, 0.30, 0.30, 0.30, 0.06, 0.30, 0.60, 8, 4750, 6),
                UserRank::RearAdmiral => (55, 0.35, 0.35, 0.35, 0.07, 0.35, 0.70, 10, 6500, 7),
                UserRank::ViceAdmiral => (89, 0.40, 0.40, 0.40, 0.08, 0.40, 0.80, 12, 8750, 8),
                UserRank::Admiral => (144, 0.50, 0.50, 0.50, 0.10, 0.50, 1.00, 15, 12500, 10),
                UserRank::FleetAdmiral => (233, 0.60, 0.60, 0.60, 0.12, 0.60, 1.20, 20, 17500, 12),
            };
        RankBonus {
            rank: self,
            min_level,
            attack,
            shield,
            hp,
            evasion,
            fire_rate,
            value,
            max_active_ships: max_active,
            work_income: income,
            work_cooldown_minutes: cooldown,
        }
    }
}

/// Per-rank multipliers/limits. The stat fields are fractional bonuses
/// (e.g. 0.10 = +10%); evasion is an additive bonus.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct RankBonus {
    pub rank: UserRank,
    pub min_level: i64,
    pub attack: f64,
    pub shield: f64,
    pub hp: f64,
    pub evasion: f64,
    pub fire_rate: f64,
    pub value: f64,
    pub max_active_ships: u32,
    pub work_income: i64,
    pub work_cooldown_minutes: i64,
}

impl RankBonus {
    /// Apply this rank's bonuses to a ship's stats for battle. Each stat is
    /// scaled by `(1 + bonus)`; value is rounded to a whole number.
    pub fn apply_to(&self, stats: ShipStats) -> ShipStats {
        let mut s = stats;
        if self.attack != 0.0 {
            s.attack *= 1.0 + self.attack;
        }
        if self.shield != 0.0 {
            s.shield *= 1.0 + self.shield;
        }
        if self.hp != 0.0 {
            s.hp *= 1.0 + self.hp;
        }
        if self.evasion != 0.0 {
            s.evasion *= 1.0 + self.evasion;
        }
        if self.fire_rate != 0.0 {
            s.fire_rate *= 1.0 + self.fire_rate;
        }
        if self.value != 0.0 {
            s.value = (s.value * (1.0 + self.value)).round();
        }
        s
    }
}

/// Level for accumulated experience. Each level costs `BASE_XP * GROWTH_FACTOR^(n-1)`
/// (integer-truncated), matching the original exponential curve.
pub fn level_for_experience(experience: i64) -> i64 {
    let mut level = 1;
    let mut xp_needed = BASE_XP;
    let mut total_xp = 0;
    while experience >= total_xp + xp_needed {
        total_xp += xp_needed;
        xp_needed = (xp_needed as f64 * GROWTH_FACTOR) as i64;
        level += 1;
    }
    level
}

/// Rank for a given level, using the Fibonacci-like thresholds.
pub fn rank_for_level(level: i64) -> UserRank {
    if level < 3 {
        UserRank::Recruit
    } else if level < 5 {
        UserRank::Ensign
    } else if level < 8 {
        UserRank::Lieutenant
    } else if level < 13 {
        UserRank::LieutenantCommander
    } else if level < 21 {
        UserRank::Commander
    } else if level < 35 {
        UserRank::Captain
    } else if level < 55 {
        UserRank::Commodore
    } else if level < 89 {
        UserRank::RearAdmiral
    } else if level < 144 {
        UserRank::ViceAdmiral
    } else if level < 233 {
        UserRank::Admiral
    } else {
        UserRank::FleetAdmiral
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn level_thresholds_match_curve() {
        // Level 1: 0 XP, Level 2: 100 XP, Level 3: 250 XP, Level 4: 475 XP.
        assert_eq!(level_for_experience(0), 1);
        assert_eq!(level_for_experience(99), 1);
        assert_eq!(level_for_experience(100), 2);
        assert_eq!(level_for_experience(249), 2);
        assert_eq!(level_for_experience(250), 3);
        assert_eq!(level_for_experience(475), 4);
    }

    #[test]
    fn rank_thresholds() {
        assert_eq!(rank_for_level(1), UserRank::Recruit);
        assert_eq!(rank_for_level(2), UserRank::Recruit);
        assert_eq!(rank_for_level(3), UserRank::Ensign);
        assert_eq!(rank_for_level(5), UserRank::Lieutenant);
        assert_eq!(rank_for_level(233), UserRank::FleetAdmiral);
    }

    #[test]
    fn recruit_has_no_bonus_one_ship() {
        let b = UserRank::Recruit.bonus();
        assert_eq!(b.max_active_ships, 1);
        assert_eq!(b.attack, 0.0);
        // No stat change at Recruit.
        let s = ShipStats { attack: 10.0, shield: 5.0, evasion: 0.1, fire_rate: 2.0, hp: 100.0, value: 1000.0 };
        assert_eq!(b.apply_to(s), s);
    }

    #[test]
    fn admiral_applies_percentage_bonuses() {
        let b = UserRank::Admiral.bonus();
        let s = ShipStats { attack: 100.0, shield: 50.0, evasion: 0.10, fire_rate: 2.0, hp: 1000.0, value: 1000.0 };
        let out = b.apply_to(s);
        assert_eq!(out.attack, 150.0); // +50%
        assert_eq!(out.hp, 1500.0); // +50%
        assert_eq!(out.value, 2000.0); // +100%, rounded
    }
}

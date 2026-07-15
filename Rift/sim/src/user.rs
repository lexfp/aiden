//! The player account: identity, currency, battle statistics, and the
//! experience/level/rank progression that battles drive.

use crate::rank::{level_for_experience, rank_for_level, UserRank};
use serde::{Deserialize, Serialize};

/// Tactical stance chosen for a fleet. Affects evasion and target selection.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Formation {
    Defensive,
    Aggressive,
    Tactical,
}

impl Formation {
    pub fn as_str(self) -> &'static str {
        match self {
            Formation::Defensive => "DEFENSIVE",
            Formation::Aggressive => "AGGRESSIVE",
            Formation::Tactical => "TACTICAL",
        }
    }

    pub fn from_str(s: &str) -> Formation {
        match s {
            "DEFENSIVE" => Formation::Defensive,
            "TACTICAL" => Formation::Tactical,
            _ => Formation::Aggressive,
        }
    }

    /// Evasion multiplier applied to a fleet's ships when it is the defender.
    /// DEFENSIVE +20%, AGGRESSIVE none, TACTICAL -10%.
    pub fn evasion_modifier(self) -> f64 {
        match self {
            Formation::Defensive => 1.2,
            Formation::Aggressive => 1.0,
            Formation::Tactical => 0.9,
        }
    }
}

/// A player (human or NPC). `nickname`s beginning with `NPC_` are treated as
/// non-player characters: their ships restore after battle and they earn no
/// credits or XP, matching the original.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct User {
    pub user_id: u32,
    pub nickname: String,
    pub elo_rank: f64,
    pub currency_value: i64,
    pub victories: i64,
    pub defeats: i64,
    pub damage_dealt: f64,
    pub damage_taken: f64,
    pub ships_destroyed_by_user: i64,
    pub ships_lost_by_user: i64,
    pub experience: i64,
    pub level: i64,
    pub rank: UserRank,
    pub default_formation: Formation,
    /// Purchased flagship-interior defenses (turret count faced by boarders).
    /// `#[serde(default)]` so accounts saved before boarding existed load as
    /// undefended.
    #[serde(default)]
    pub defense_level: u8,
}

impl User {
    /// A brand-new human account with the starting defaults from the original.
    pub fn new(user_id: u32, nickname: impl Into<String>) -> Self {
        User {
            user_id,
            nickname: nickname.into(),
            elo_rank: 1000.0,
            currency_value: 2000,
            victories: 0,
            defeats: 0,
            damage_dealt: 0.0,
            damage_taken: 0.0,
            ships_destroyed_by_user: 0,
            ships_lost_by_user: 0,
            experience: 0,
            level: 1,
            rank: UserRank::Recruit,
            default_formation: Formation::Aggressive,
            defense_level: 0,
        }
    }

    /// NPC accounts are identified by the `NPC_` nickname prefix.
    pub fn is_npc(&self) -> bool {
        self.nickname.starts_with("NPC_")
    }

    /// Add experience, then recompute level and rank. Returns true if either
    /// the level or the rank changed.
    pub fn add_experience(&mut self, xp_gained: i64) -> bool {
        self.experience += xp_gained;
        let new_level = level_for_experience(self.experience);
        let new_rank = rank_for_level(new_level);
        let mut changed = false;
        if self.level != new_level {
            self.level = new_level;
            changed = true;
        }
        if self.rank != new_rank {
            self.rank = new_rank;
            changed = true;
        }
        changed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_user_defaults() {
        let u = User::new(1, "Pilot");
        assert_eq!(u.currency_value, 2000);
        assert_eq!(u.elo_rank, 1000.0);
        assert_eq!(u.level, 1);
        assert_eq!(u.rank, UserRank::Recruit);
        assert!(!u.is_npc());
    }

    #[test]
    fn experience_drives_level_and_rank() {
        let mut u = User::new(1, "Pilot");
        let changed = u.add_experience(250); // -> level 3 -> Ensign
        assert!(changed);
        assert_eq!(u.level, 3);
        assert_eq!(u.rank, UserRank::Ensign);
    }

    #[test]
    fn npc_detected_by_prefix() {
        assert!(User::new(2, "NPC_Astro").is_npc());
    }
}

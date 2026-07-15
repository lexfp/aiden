//! Rift game rules — a faithful Rust port of the Bellum-Astrum game logic.
//!
//! This crate is pure: no database, no network, no window. It owns the ship
//! catalog, rank table, progression, economy, ELO, and combat resolution so the
//! exact same rules run both in the offline client and on the authoritative
//! server.

pub mod boarding;
pub mod bot;
pub mod combat;
pub mod economy;
pub mod elo;
pub mod rank;
pub mod ship;
pub mod user;

pub use boarding::{defense_upgrade_cost, BoardingOutcome, Subsystem, DEFENSE_LEVEL_MAX};
pub use combat::{battle, battle_with_boarding, BattleReport, Combatant};
pub use rank::{RankBonus, UserRank};
pub use ship::{OwnedShip, ShipStatus, ShipStats, ShipTemplate};
pub use user::{Formation, User};

// ---------------------------------------------------------------------------
// Game constants (ported verbatim from Bellum-Astrum's utils/constants.py).
// ---------------------------------------------------------------------------

/// Experience awarded to the winner of a battle.
pub const BASE_XP_WIN: i64 = 100;
/// Experience awarded to the loser of a battle.
pub const BASE_XP_LOSS: i64 = 50;

/// +15% XP per level when fighting a higher-level opponent.
pub const XP_HIGHER_LEVEL: f64 = 0.15;
/// -10% XP per level when fighting a lower-level opponent.
pub const XP_LOWER_LEVEL: f64 = -0.10;
/// Minimum XP multiplier (30%).
pub const XP_MIN_MULTIPLIER: f64 = 0.3;

/// Base XP needed for the first level-up, and the per-level growth factor.
pub const BASE_XP: i64 = 100;
pub const GROWTH_FACTOR: f64 = 1.5;

/// Fraction of incoming damage a shield point cancels.
pub const SHIELD_DAMAGE_REDUCTION: f64 = 0.5;
/// Per-hit random damage spread.
pub const DAMAGE_VARIATION_MIN: f64 = 0.85;
pub const DAMAGE_VARIATION_MAX: f64 = 1.15;

/// Winner earns this fraction of the loser fleet's value as credits.
pub const CREDITS_AWARDED_MULTIPLIER: f64 = 0.1;

/// Cooldown between ship repairs, in seconds.
pub const SHIPYARD_REPAIR_COOLDOWN_SECONDS: i64 = 60;

/// Selling a ship returns this fraction of its current value.
pub const SELL_VALUE_MULTIPLIER: f64 = 0.4;

/// ELO: base K-factor and the expected-score divisor.
pub const ELO_BASE_CHANGE: f64 = 32.0;
pub const ELO_EXPECTED_SCORE_DIVISOR: f64 = 400.0;

/// Random variance applied to work income (±20%).
pub const WORK_VARIANCE_PERCENT: f64 = 20.0;

// ---------------------------------------------------------------------------
// Boarding-raid combat modifiers (see `boarding` module).
// ---------------------------------------------------------------------------

/// Enemy fleet evasion multiplier after its engines are destroyed.
pub const BOARDING_ENGINES_EVASION_MULT: f64 = 0.35;
/// Enemy fleet shield multiplier after its shield generator is destroyed.
pub const BOARDING_SHIELDS_MULT: f64 = 0.25;
/// Enemy fleet attack multiplier after its weapons bay is destroyed.
pub const BOARDING_WEAPONS_ATTACK_MULT: f64 = 0.65;
/// Fraction of HP the enemy flagship starts with after its reactor core blows.
pub const BOARDING_CORE_HP_FRAC: f64 = 0.10;
/// Bonus XP the attacker earns per subsystem destroyed while boarding.
pub const BOARDING_XP_PER_SUBSYSTEM: i64 = 15;

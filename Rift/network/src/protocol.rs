//! The client/server wire protocol for the Rift fleet game: request/response
//! RPC plus the data-transfer objects the UI consumes.

use serde::{Deserialize, Serialize};
use sim::ship::{OwnedShip, ShipTemplate};
use sim::user::{Formation, User};

/// Default TCP port for the dedicated server.
pub const DEFAULT_PORT: u16 = 7777;

/// A request from client to server. A connection first authenticates with
/// `Register`/`Login`; the server then ties that connection to the resulting
/// user, so later requests need not repeat credentials.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Request {
    Register { nickname: String, password: String },
    Login { nickname: String, password: String },
    /// Full state of the logged-in player.
    Snapshot,
    /// The fixed ship catalog.
    Catalog,
    Buy { ship_id: u32 },
    Sell { ship_number: u32 },
    Repair { ship_number: u32 },
    Activate { ship_number: u32 },
    Deactivate { ship_number: u32 },
    SetFormation { formation: Formation },
    /// Buy the next ship-defense level (turrets that fight boarders).
    UpgradeDefense,
    Work,
    /// Other users available to battle.
    ListOpponents,
    /// Fight `opponent_id` using the player's active fleet and `formation`.
    /// `boarding` carries the outcome of the client-side boarding raid, if the
    /// player boarded the enemy flagship before engaging.
    Battle { opponent_id: u32, formation: Formation, boarding: Option<sim::BoardingOutcome> },
    Leaderboard,
    History,
}

/// A response from server to client.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Response {
    Ok,
    Error(String),
    /// Sent after successful Register/Login.
    Auth { user_id: u32, snapshot: PlayerSnapshot },
    Snapshot(PlayerSnapshot),
    Catalog(Vec<ShipTemplate>),
    Opponents(Vec<OpponentInfo>),
    Leaderboard(Vec<LeaderboardEntry>),
    /// Result of a battle plus the player's refreshed state.
    Battle { result: BattleResultDto, snapshot: PlayerSnapshot },
    /// Result of a work shift plus refreshed state.
    Worked { work_type: String, income: i64, snapshot: PlayerSnapshot },
    History(Vec<BattleSummary>),
}

/// Everything the UI needs to draw the logged-in player's hangar.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlayerSnapshot {
    pub user: User,
    pub ships: Vec<OwnedShip>,
    pub max_active_ships: u32,
    pub active_count: u32,
    /// Seconds remaining before the player can work again (0 if ready).
    pub work_cooldown_remaining: i64,
}

/// A potential battle opponent.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OpponentInfo {
    pub user_id: u32,
    pub nickname: String,
    pub rank: String,
    pub level: i64,
    pub elo: f64,
    pub active_ships: u32,
    pub is_npc: bool,
    /// Turrets a boarder will face inside this opponent's flagship.
    pub defense_level: u8,
}

/// One row of the ELO leaderboard.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub nickname: String,
    pub elo: f64,
    pub victories: i64,
    pub defeats: i64,
    pub level: i64,
    pub rank: String,
}

/// A battle outcome reported to the client.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BattleResultDto {
    pub winner_nickname: String,
    pub loser_nickname: String,
    pub player_won: bool,
    pub opponent_nickname: String,
    pub credits_awarded: i64,
    pub total_damage_dealt: f64,
    pub total_damage_taken: f64,
    pub ships_lost: u32,
    pub ships_destroyed: u32,
    pub log: Vec<String>,
    pub message: String,
}

/// A condensed past-battle record.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BattleSummary {
    pub battle_id: i64,
    pub opponent_nickname: String,
    pub won: bool,
    pub message: String,
    pub timestamp: i64,
}

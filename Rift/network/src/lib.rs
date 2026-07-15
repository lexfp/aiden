//! Rift networking: the wire protocol, the SQLite-backed world, the dedicated
//! server, the RPC client, and the unified [`api::GameApi`] the UI talks to.

pub mod api;
pub mod client;
pub mod protocol;
pub mod server;
pub mod wire;
pub mod world;

pub use api::{GameApi, LocalApi, RemoteApi};
pub use protocol::{
    BattleResultDto, BattleSummary, LeaderboardEntry, OpponentInfo, PlayerSnapshot, Request, Response,
    DEFAULT_PORT,
};
pub use world::World;

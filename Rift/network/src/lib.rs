//! Rift networking: the wire protocol, the persistent world, the dedicated
//! server, the RPC client, and the unified [`api::GameApi`] the UI talks to.
//!
//! On wasm (the mobile/web build) only the protocol types, the in-memory
//! world, and [`api::LocalApi`] are compiled — there are no sockets in the
//! browser.

pub mod api;
#[cfg(not(target_arch = "wasm32"))]
pub mod client;
pub mod protocol;
#[cfg(not(target_arch = "wasm32"))]
pub mod server;
#[cfg(not(target_arch = "wasm32"))]
pub mod wire;
pub mod world;

#[cfg(not(target_arch = "wasm32"))]
pub use api::RemoteApi;
pub use api::{GameApi, LocalApi};
pub use protocol::{
    BattleResultDto, BattleSummary, LeaderboardEntry, OpponentInfo, PlayerSnapshot, Request, Response,
    DEFAULT_PORT,
};
pub use world::World;

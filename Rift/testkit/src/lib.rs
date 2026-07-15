//! Rift agent-testing kit. A gym-style `env::AgentEnv` over the game's
//! [`network::GameApi`], a deterministic JSON replay engine, scenario files,
//! and scripted + monkey bots. This crate is a test/dev tool and is never
//! linked into the shipped `rift` binary.

pub mod bots;
pub mod env;
#[cfg(feature = "http")]
pub mod http_env;
pub mod replay;
pub mod scenario;

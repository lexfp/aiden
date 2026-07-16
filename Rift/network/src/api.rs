//! A single interface the UI talks to, whether the game is offline (driving a
//! local [`World`] in-process) or online (sending requests to a server). The
//! screens never need to know which.

#[cfg(not(target_arch = "wasm32"))]
use crate::client::Client;
#[cfg(not(target_arch = "wasm32"))]
use crate::protocol::{Request, Response};
use crate::protocol::{
    BattleResultDto, BattleSummary, LeaderboardEntry, OpponentInfo, PlayerSnapshot,
};
use crate::world::World;
use sim::ship::ShipTemplate;
use sim::user::Formation;

/// Everything the screens can ask of the game backend. All calls return a
/// user-facing `String` on error.
pub trait GameApi: Send {
    fn register(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String>;
    fn login(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String>;
    fn snapshot(&mut self) -> Result<PlayerSnapshot, String>;
    fn catalog(&mut self) -> Result<Vec<ShipTemplate>, String>;
    fn buy(&mut self, ship_id: u32) -> Result<PlayerSnapshot, String>;
    fn sell(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String>;
    fn repair(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String>;
    fn activate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String>;
    fn deactivate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String>;
    fn set_formation(&mut self, formation: Formation) -> Result<PlayerSnapshot, String>;
    /// Buy the next ship-defense level (interior turrets vs boarders).
    fn upgrade_defense(&mut self) -> Result<PlayerSnapshot, String>;
    fn work(&mut self) -> Result<(String, i64, PlayerSnapshot), String>;
    fn opponents(&mut self) -> Result<Vec<OpponentInfo>, String>;
    /// Resolve a battle; `boarding` is the outcome of the pre-battle boarding
    /// raid, when the player boarded the enemy flagship first.
    fn battle(
        &mut self,
        opponent_id: u32,
        formation: Formation,
        boarding: Option<sim::BoardingOutcome>,
    ) -> Result<(BattleResultDto, PlayerSnapshot), String>;
    fn leaderboard(&mut self) -> Result<Vec<LeaderboardEntry>, String>;
    fn history(&mut self) -> Result<Vec<BattleSummary>, String>;
}

/// Offline backend: owns the world and runs all rules in-process.
pub struct LocalApi {
    world: World,
    user_id: Option<u32>,
}

impl LocalApi {
    /// Open a local single-player world at `path` (a save-file path, or
    /// ":memory:" for a throwaway world).
    #[cfg(not(target_arch = "wasm32"))]
    pub fn open(path: &str) -> Result<Self, String> {
        Ok(LocalApi { world: World::open(path)?, user_id: None })
    }

    /// Open a deterministic local world: all randomness is seeded from `seed`.
    #[cfg(not(target_arch = "wasm32"))]
    pub fn open_seeded(path: &str, seed: u64) -> Result<Self, String> {
        Ok(LocalApi { world: World::open_seeded(path, seed)?, user_id: None })
    }

    /// Open an in-memory single-player world, restoring `save_json` when given
    /// (a previous [`LocalApi::export_save`]). Used by the mobile/web build,
    /// which keeps the save in localStorage.
    pub fn open_mem(save_json: Option<&str>) -> Result<Self, String> {
        let world = match save_json {
            Some(json) => World::from_json(json)?,
            None => World::open_mem()?,
        };
        Ok(LocalApi { world, user_id: None })
    }

    /// Serialize the whole in-memory world so the caller can persist it.
    /// Errors on the SQLite backend (which persists itself).
    pub fn export_save(&self) -> Result<String, String> {
        self.world.to_json()
    }

    fn id(&self) -> Result<u32, String> {
        self.user_id.ok_or_else(|| "Not logged in".to_string())
    }
}

impl GameApi for LocalApi {
    fn register(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String> {
        let id = self.world.register(nickname, password)?;
        self.user_id = Some(id);
        self.world.snapshot(id)
    }
    fn login(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String> {
        let id = self.world.login(nickname, password)?;
        self.user_id = Some(id);
        self.world.snapshot(id)
    }
    fn snapshot(&mut self) -> Result<PlayerSnapshot, String> {
        self.world.snapshot(self.id()?)
    }
    fn catalog(&mut self) -> Result<Vec<ShipTemplate>, String> {
        Ok(sim::ship::catalog())
    }
    fn buy(&mut self, ship_id: u32) -> Result<PlayerSnapshot, String> {
        let id = self.id()?;
        self.world.buy(id, ship_id)?;
        self.world.snapshot(id)
    }
    fn sell(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        let id = self.id()?;
        self.world.sell(id, ship_number)?;
        self.world.snapshot(id)
    }
    fn repair(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        let id = self.id()?;
        self.world.repair(id, ship_number)?;
        self.world.snapshot(id)
    }
    fn activate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        let id = self.id()?;
        self.world.activate(id, ship_number)?;
        self.world.snapshot(id)
    }
    fn deactivate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        let id = self.id()?;
        self.world.deactivate(id, ship_number)?;
        self.world.snapshot(id)
    }
    fn set_formation(&mut self, formation: Formation) -> Result<PlayerSnapshot, String> {
        let id = self.id()?;
        self.world.set_formation(id, formation)?;
        self.world.snapshot(id)
    }
    fn upgrade_defense(&mut self) -> Result<PlayerSnapshot, String> {
        let id = self.id()?;
        self.world.upgrade_defense(id)?;
        self.world.snapshot(id)
    }
    fn work(&mut self) -> Result<(String, i64, PlayerSnapshot), String> {
        let id = self.id()?;
        let (work_type, income) = self.world.work(id)?;
        Ok((work_type, income, self.world.snapshot(id)?))
    }
    fn opponents(&mut self) -> Result<Vec<OpponentInfo>, String> {
        self.world.list_opponents(self.id()?)
    }
    fn battle(
        &mut self,
        opponent_id: u32,
        formation: Formation,
        boarding: Option<sim::BoardingOutcome>,
    ) -> Result<(BattleResultDto, PlayerSnapshot), String> {
        let id = self.id()?;
        let result = self.world.battle(id, opponent_id, formation, boarding)?;
        Ok((result, self.world.snapshot(id)?))
    }
    fn leaderboard(&mut self) -> Result<Vec<LeaderboardEntry>, String> {
        self.world.leaderboard()
    }
    fn history(&mut self) -> Result<Vec<BattleSummary>, String> {
        self.world.history(self.id()?)
    }
}

/// Online backend: forwards every call to the server as an RPC.
#[cfg(not(target_arch = "wasm32"))]
pub struct RemoteApi {
    client: Client,
}

#[cfg(not(target_arch = "wasm32"))]
impl RemoteApi {
    pub fn connect(addr: &str) -> Result<Self, String> {
        Ok(RemoteApi { client: Client::connect(addr)? })
    }

    /// Issue a request and require a plain snapshot response.
    fn snapshot_call(&mut self, request: Request) -> Result<PlayerSnapshot, String> {
        match self.client.call(request)? {
            Response::Snapshot(s) => Ok(s),
            Response::Auth { snapshot, .. } => Ok(snapshot),
            Response::Error(e) => Err(e),
            _ => Err("unexpected server response".into()),
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl GameApi for RemoteApi {
    fn register(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Register { nickname: nickname.into(), password: password.into() })
    }
    fn login(&mut self, nickname: &str, password: &str) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Login { nickname: nickname.into(), password: password.into() })
    }
    fn snapshot(&mut self) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Snapshot)
    }
    fn catalog(&mut self) -> Result<Vec<ShipTemplate>, String> {
        match self.client.call(Request::Catalog)? {
            Response::Catalog(c) => Ok(c),
            Response::Error(e) => Err(e),
            _ => Err("unexpected server response".into()),
        }
    }
    fn buy(&mut self, ship_id: u32) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Buy { ship_id })
    }
    fn sell(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Sell { ship_number })
    }
    fn repair(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Repair { ship_number })
    }
    fn activate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Activate { ship_number })
    }
    fn deactivate(&mut self, ship_number: u32) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::Deactivate { ship_number })
    }
    fn set_formation(&mut self, formation: Formation) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::SetFormation { formation })
    }
    fn upgrade_defense(&mut self) -> Result<PlayerSnapshot, String> {
        self.snapshot_call(Request::UpgradeDefense)
    }
    fn work(&mut self) -> Result<(String, i64, PlayerSnapshot), String> {
        match self.client.call(Request::Work)? {
            Response::Worked { work_type, income, snapshot } => Ok((work_type, income, snapshot)),
            Response::Error(e) => Err(e),
            _ => Err("unexpected server response".into()),
        }
    }
    fn opponents(&mut self) -> Result<Vec<OpponentInfo>, String> {
        match self.client.call(Request::ListOpponents)? {
            Response::Opponents(o) => Ok(o),
            Response::Error(e) => Err(e),
            _ => Err("unexpected server response".into()),
        }
    }
    fn battle(
        &mut self,
        opponent_id: u32,
        formation: Formation,
        boarding: Option<sim::BoardingOutcome>,
    ) -> Result<(BattleResultDto, PlayerSnapshot), String> {
        match self.client.call(Request::Battle { opponent_id, formation, boarding })? {
            Response::Battle { result, snapshot } => Ok((result, snapshot)),
            Response::Error(e) => Err(e),
            _ => Err("unexpected server response".into()),
        }
    }
    fn leaderboard(&mut self) -> Result<Vec<LeaderboardEntry>, String> {
        match self.client.call(Request::Leaderboard)? {
            Response::Leaderboard(l) => Ok(l),
            Response::Error(e) => Err(e),
            _ => Err("unexpected server response".into()),
        }
    }
    fn history(&mut self) -> Result<Vec<BattleSummary>, String> {
        match self.client.call(Request::History)? {
            Response::History(h) => Ok(h),
            Response::Error(e) => Err(e),
            _ => Err("unexpected server response".into()),
        }
    }
}

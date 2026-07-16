//! The authoritative game world. Both the dedicated server and the offline
//! single-player client drive the exact same `World` so the rules never
//! diverge. Two storage backends exist behind one API: SQLite on native
//! (server + desktop dev builds), and a serializable in-memory store used by
//! the mobile/web build, which persists it as JSON (e.g. to localStorage).

use crate::protocol::{
    BattleResultDto, BattleSummary, LeaderboardEntry, OpponentInfo, PlayerSnapshot,
};
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use rand_chacha::ChaCha8Rng;
#[cfg(not(target_arch = "wasm32"))]
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sim::economy;
use sim::ship::{OwnedShip, ShipStatus};
use sim::user::{Formation, User};
use sim::{combat, SHIPYARD_REPAIR_COOLDOWN_SECONDS};
use std::cell::RefCell;

/// Result type for world operations; the `String` is a user-facing message.
pub type WorldResult<T> = Result<T, String>;

// -- storage backends --------------------------------------------------------

/// One user row of the in-memory store.
#[derive(Clone, Serialize, Deserialize)]
struct MemUser {
    user_id: u32,
    nickname: String,
    password_hash: String,
    last_work_at: i64,
    data: User,
}

/// One owned-ship row of the in-memory store.
#[derive(Clone, Serialize, Deserialize)]
struct MemShip {
    ship_number: u32,
    user_id: u32,
    last_repair_at: i64,
    data: OwnedShip,
}

/// One battle-history row of the in-memory store.
#[derive(Clone, Serialize, Deserialize)]
struct MemBattle {
    battle_id: i64,
    timestamp: i64,
    winner_user_id: Option<u32>,
    user1_id: u32,
    user2_id: u32,
    data: BattleResultDto,
}

/// The whole world as plain data — serializable, so the web build can stash it
/// in localStorage between sessions. Mirrors the SQLite schema exactly.
#[derive(Default, Serialize, Deserialize)]
struct MemDb {
    next_user_id: u32,
    next_ship_number: u32,
    next_battle_id: i64,
    seeded: bool,
    users: Vec<MemUser>,
    ships: Vec<MemShip>,
    battles: Vec<MemBattle>,
}

impl MemDb {
    fn new() -> MemDb {
        MemDb { next_user_id: 1, next_ship_number: 1, next_battle_id: 1, ..Default::default() }
    }
}

enum Db {
    #[cfg(not(target_arch = "wasm32"))]
    Sqlite(Connection),
    Mem(RefCell<MemDb>),
}

pub struct World {
    db: Db,
    /// When `Some`, all battle/work randomness is drawn from this deterministic
    /// generator so runs are reproducible. `None` keeps the entropy behaviour
    /// used by normal play. `RefCell` so the existing `&self` methods can draw
    /// from it without a signature change.
    rng: RefCell<Option<ChaCha8Rng>>,
}

#[cfg(not(target_arch = "wasm32"))]
fn now_unix() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

/// `SystemTime::now` panics in the browser; use the JS clock instead.
#[cfg(target_arch = "wasm32")]
fn now_unix() -> i64 {
    (js_sys::Date::now() / 1000.0) as i64
}

fn hash_password(nickname: &str, password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("rift::{}::{}", nickname.to_lowercase(), password).as_bytes());
    hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

impl World {
    /// Open (or create) the world database at `path` (use ":memory:" for a
    /// transient world). Creates the schema and seeds NPCs on first use.
    #[cfg(not(target_arch = "wasm32"))]
    pub fn open(path: &str) -> WorldResult<World> {
        let db = Connection::open(path).map_err(map_err)?;
        let world = World { db: Db::Sqlite(db), rng: RefCell::new(None) };
        world.init_schema()?;
        world.seed_if_empty()?;
        Ok(world)
    }

    /// Like [`World::open`] but every battle/work roll is drawn from a
    /// deterministic `ChaCha8Rng` seeded with `seed`, so identical action
    /// sequences produce identical random outcomes (cooldown checks still use
    /// wall-clock time).
    #[cfg(not(target_arch = "wasm32"))]
    pub fn open_seeded(path: &str, seed: u64) -> WorldResult<World> {
        let db = Connection::open(path).map_err(map_err)?;
        let world =
            World { db: Db::Sqlite(db), rng: RefCell::new(Some(ChaCha8Rng::seed_from_u64(seed))) };
        world.init_schema()?;
        world.seed_if_empty()?;
        Ok(world)
    }

    /// Open a fresh in-memory world (NPCs seeded). Persist it with
    /// [`World::to_json`] and restore it with [`World::from_json`].
    pub fn open_mem() -> WorldResult<World> {
        let world = World { db: Db::Mem(RefCell::new(MemDb::new())), rng: RefCell::new(None) };
        world.seed_if_empty()?;
        Ok(world)
    }

    /// In-memory world with deterministic battle/work randomness.
    pub fn open_mem_seeded(seed: u64) -> WorldResult<World> {
        let world = World {
            db: Db::Mem(RefCell::new(MemDb::new())),
            rng: RefCell::new(Some(ChaCha8Rng::seed_from_u64(seed))),
        };
        world.seed_if_empty()?;
        Ok(world)
    }

    /// Restore an in-memory world from a [`World::to_json`] export.
    pub fn from_json(json: &str) -> WorldResult<World> {
        let mem: MemDb = serde_json::from_str(json).map_err(map_err)?;
        Ok(World { db: Db::Mem(RefCell::new(mem)), rng: RefCell::new(None) })
    }

    /// Export the whole world as JSON. Only supported on the in-memory backend.
    pub fn to_json(&self) -> WorldResult<String> {
        match &self.db {
            Db::Mem(mem) => serde_json::to_string(&*mem.borrow()).map_err(map_err),
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(_) => Err("export is only supported for in-memory worlds".into()),
        }
    }

    /// Run `f` with a mutable RNG: the deterministic one when seeded, otherwise
    /// a fresh entropy generator (matching legacy behaviour). `f` must not call
    /// back into `World` — the RefCell borrow is held for its duration and
    /// reentrancy will panic.
    fn with_rng<T>(&self, f: impl FnOnce(&mut dyn RngCore) -> T) -> T {
        let mut guard = self.rng.borrow_mut();
        match guard.as_mut() {
            Some(rng) => f(rng),
            None => {
                let mut rng = StdRng::from_entropy();
                f(&mut rng)
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn init_schema(&self) -> WorldResult<()> {
        let Db::Sqlite(db) = &self.db else { return Ok(()) };
        db.execute_batch(
            "CREATE TABLE IF NOT EXISTS users (
                user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname      TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                last_work_at  INTEGER NOT NULL DEFAULT 0,
                data          TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS owned_ships (
                ship_number    INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        INTEGER NOT NULL,
                last_repair_at INTEGER NOT NULL DEFAULT 0,
                data           TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_owned_user ON owned_ships(user_id);
             CREATE TABLE IF NOT EXISTS battle_history (
                battle_id      INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp      INTEGER NOT NULL,
                winner_user_id INTEGER,
                user1_id       INTEGER NOT NULL,
                user2_id       INTEGER NOT NULL,
                data           TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS meta ( key TEXT PRIMARY KEY, value TEXT );",
        )
        .map_err(map_err)?;
        Ok(())
    }

    // -- persistence helpers ------------------------------------------------

    fn load_user_by_id(&self, user_id: u32) -> WorldResult<Option<User>> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => db
                .query_row("SELECT data FROM users WHERE user_id = ?1", params![user_id], |row| {
                    row.get::<_, String>(0)
                })
                .optional()
                .map_err(map_err)?
                .map(|json| serde_json::from_str::<User>(&json).map_err(map_err))
                .transpose(),
            Db::Mem(mem) => {
                Ok(mem.borrow().users.iter().find(|u| u.user_id == user_id).map(|u| u.data.clone()))
            }
        }
    }

    fn user_id_by_nickname(&self, nickname: &str) -> WorldResult<Option<(u32, String)>> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => db
                .query_row(
                    "SELECT user_id, password_hash FROM users WHERE nickname = ?1 COLLATE NOCASE",
                    params![nickname],
                    |row| Ok((row.get::<_, u32>(0)?, row.get::<_, String>(1)?)),
                )
                .optional()
                .map_err(map_err),
            Db::Mem(mem) => Ok(mem
                .borrow()
                .users
                .iter()
                .find(|u| u.nickname.eq_ignore_ascii_case(nickname))
                .map(|u| (u.user_id, u.password_hash.clone()))),
        }
    }

    fn save_user(&self, user: &User) -> WorldResult<()> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let json = serde_json::to_string(user).map_err(map_err)?;
                db.execute(
                    "UPDATE users SET data = ?1 WHERE user_id = ?2",
                    params![json, user.user_id],
                )
                .map_err(map_err)?;
                Ok(())
            }
            Db::Mem(mem) => {
                if let Some(row) =
                    mem.borrow_mut().users.iter_mut().find(|u| u.user_id == user.user_id)
                {
                    row.data = user.clone();
                }
                Ok(())
            }
        }
    }

    fn load_ships(&self, user_id: u32) -> WorldResult<Vec<OwnedShip>> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let mut stmt = db
                    .prepare("SELECT data FROM owned_ships WHERE user_id = ?1 ORDER BY ship_number")
                    .map_err(map_err)?;
                let rows = stmt
                    .query_map(params![user_id], |row| row.get::<_, String>(0))
                    .map_err(map_err)?;
                let mut ships = Vec::new();
                for r in rows {
                    let json = r.map_err(map_err)?;
                    ships.push(serde_json::from_str::<OwnedShip>(&json).map_err(map_err)?);
                }
                Ok(ships)
            }
            Db::Mem(mem) => {
                // Rows are stored in insertion order == ship_number order.
                Ok(mem
                    .borrow()
                    .ships
                    .iter()
                    .filter(|s| s.user_id == user_id)
                    .map(|s| s.data.clone())
                    .collect())
            }
        }
    }

    fn save_ship(&self, ship: &OwnedShip) -> WorldResult<()> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let json = serde_json::to_string(ship).map_err(map_err)?;
                db.execute(
                    "UPDATE owned_ships SET data = ?1 WHERE ship_number = ?2",
                    params![json, ship.ship_number],
                )
                .map_err(map_err)?;
                Ok(())
            }
            Db::Mem(mem) => {
                if let Some(row) =
                    mem.borrow_mut().ships.iter_mut().find(|s| s.ship_number == ship.ship_number)
                {
                    row.data = ship.clone();
                }
                Ok(())
            }
        }
    }

    fn insert_ship(&self, user_id: u32, mut ship: OwnedShip) -> WorldResult<OwnedShip> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                // Insert with a placeholder, then patch the JSON with the real rowid.
                db.execute(
                    "INSERT INTO owned_ships (user_id, last_repair_at, data) VALUES (?1, 0, ?2)",
                    params![user_id, "{}"],
                )
                .map_err(map_err)?;
                let ship_number = db.last_insert_rowid() as u32;
                ship.ship_number = ship_number;
                self.save_ship(&ship)?;
                Ok(ship)
            }
            Db::Mem(mem) => {
                let mut mem = mem.borrow_mut();
                let ship_number = mem.next_ship_number;
                mem.next_ship_number += 1;
                ship.ship_number = ship_number;
                mem.ships.push(MemShip {
                    ship_number,
                    user_id,
                    last_repair_at: 0,
                    data: ship.clone(),
                });
                Ok(ship)
            }
        }
    }

    fn last_work_at(&self, user_id: u32) -> WorldResult<i64> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => Ok(db
                .query_row(
                    "SELECT last_work_at FROM users WHERE user_id = ?1",
                    params![user_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(map_err)?
                .unwrap_or(0)),
            Db::Mem(mem) => Ok(mem
                .borrow()
                .users
                .iter()
                .find(|u| u.user_id == user_id)
                .map(|u| u.last_work_at)
                .unwrap_or(0)),
        }
    }

    fn set_last_work_at(&self, user_id: u32, at: i64) -> WorldResult<()> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                db.execute(
                    "UPDATE users SET last_work_at = ?1 WHERE user_id = ?2",
                    params![at, user_id],
                )
                .map_err(map_err)?;
                Ok(())
            }
            Db::Mem(mem) => {
                if let Some(row) = mem.borrow_mut().users.iter_mut().find(|u| u.user_id == user_id)
                {
                    row.last_work_at = at;
                }
                Ok(())
            }
        }
    }

    fn last_repair_at(&self, user_id: u32, ship_number: u32) -> WorldResult<i64> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => db
                .query_row(
                    "SELECT last_repair_at FROM owned_ships WHERE ship_number = ?1 AND user_id = ?2",
                    params![ship_number, user_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(map_err)?
                .ok_or_else(|| "Owned ship not found".to_string()),
            Db::Mem(mem) => mem
                .borrow()
                .ships
                .iter()
                .find(|s| s.ship_number == ship_number && s.user_id == user_id)
                .map(|s| s.last_repair_at)
                .ok_or_else(|| "Owned ship not found".to_string()),
        }
    }

    fn set_last_repair_at(&self, ship_number: u32, at: i64) -> WorldResult<()> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                db.execute(
                    "UPDATE owned_ships SET last_repair_at = ?1 WHERE ship_number = ?2",
                    params![at, ship_number],
                )
                .map_err(map_err)?;
                Ok(())
            }
            Db::Mem(mem) => {
                if let Some(row) =
                    mem.borrow_mut().ships.iter_mut().find(|s| s.ship_number == ship_number)
                {
                    row.last_repair_at = at;
                }
                Ok(())
            }
        }
    }

    fn insert_battle(
        &self,
        timestamp: i64,
        winner_user_id: u32,
        user1_id: u32,
        user2_id: u32,
        dto: &BattleResultDto,
    ) -> WorldResult<()> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let history_json = serde_json::to_string(dto).map_err(map_err)?;
                db.execute(
                    "INSERT INTO battle_history (timestamp, winner_user_id, user1_id, user2_id, data) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![timestamp, winner_user_id, user1_id, user2_id, history_json],
                )
                .map_err(map_err)?;
                Ok(())
            }
            Db::Mem(mem) => {
                let mut mem = mem.borrow_mut();
                let battle_id = mem.next_battle_id;
                mem.next_battle_id += 1;
                mem.battles.push(MemBattle {
                    battle_id,
                    timestamp,
                    winner_user_id: Some(winner_user_id),
                    user1_id,
                    user2_id,
                    data: dto.clone(),
                });
                Ok(())
            }
        }
    }

    fn all_users(&self) -> WorldResult<Vec<(u32, User)>> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let mut stmt = db.prepare("SELECT user_id, data FROM users").map_err(map_err)?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok((row.get::<_, u32>(0)?, row.get::<_, String>(1)?))
                    })
                    .map_err(map_err)?;
                let mut out = Vec::new();
                for r in rows {
                    let (id, json) = r.map_err(map_err)?;
                    out.push((id, serde_json::from_str::<User>(&json).map_err(map_err)?));
                }
                Ok(out)
            }
            Db::Mem(mem) => {
                Ok(mem.borrow().users.iter().map(|u| (u.user_id, u.data.clone())).collect())
            }
        }
    }

    // -- seeding ------------------------------------------------------------

    fn seed_if_empty(&self) -> WorldResult<()> {
        let seeded = match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => db
                .query_row("SELECT value FROM meta WHERE key = 'seeded'", [], |row| {
                    row.get::<_, String>(0)
                })
                .optional()
                .map_err(map_err)?
                .is_some(),
            Db::Mem(mem) => mem.borrow().seeded,
        };
        if seeded {
            return Ok(());
        }
        self.seed_npcs()?;
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                db.execute("INSERT INTO meta (key, value) VALUES ('seeded', '1')", [])
                    .map_err(map_err)?;
            }
            Db::Mem(mem) => mem.borrow_mut().seeded = true,
        }
        Ok(())
    }

    /// Seed the NPC fleet so the world has opponents from the start. Each NPC is
    /// given a tier-appropriate set of active ships.
    fn seed_npcs(&self) -> WorldResult<()> {
        // (nickname, elo, currency, experience, level, ship names)
        let npcs: &[(&str, f64, i64, i64, &[&str])] = &[
            ("NPC_Astro", 800.0, 2500, 0, &["Falcon"]),
            ("NPC_Cyber", 950.0, 4000, 250, &["Sparrow", "Hawk"]),
            ("NPC_Orion", 1100.0, 8000, 625, &["Kestrel", "Eagle", "Swift"]),
            ("NPC_Vega", 1250.0, 20000, 1562, &["Breeze", "Osprey", "Harrier", "Raven"]),
            ("NPC_Nebula", 1400.0, 35000, 5859, &["Lightning", "Thunder", "Tempest", "Storm", "Sparrow"]),
            ("NPC_Pulsar", 1550.0, 60000, 28515, &["Comet", "Breeze", "Nova", "Meteor", "Pulsar", "Asteroid"]),
            ("NPC_Quasar", 1700.0, 100000, 185937, &["Nova", "Lightning", "Thunder", "Tempest", "Comet", "Meteor", "Pulsar", "Asteroid"]),
            ("NPC_Titan", 1850.0, 180000, 1532031, &["Galaxy", "Comet", "Nova", "Meteor", "Pulsar", "Asteroid", "Quasar", "Nebula", "Vortex", "Supernova"]),
            ("NPC_Solaris", 2000.0, 300000, 13672265, &["Quasar", "Galaxy", "Nebula", "Vortex", "Supernova", "Comet", "Nova", "Meteor", "Pulsar", "Asteroid", "Lightning", "Thunder"]),
            ("NPC_Andromeda", 2150.0, 500000, 125000000, &["Orion", "Galaxy", "Quasar", "Nebula", "Vortex", "Supernova", "Phoenix", "Titan", "Seraph", "Leviathan", "Comet", "Nova", "Meteor", "Pulsar", "Asteroid"]),
            ("NPC_Centauri", 2500.0, 1000000, 500000000, &["Phoenix", "Orion", "Titan", "Seraph", "Leviathan", "Galaxy", "Quasar", "Nebula", "Vortex", "Supernova"]),
        ];

        for &(nickname, elo, currency, experience, ships) in npcs {
            let mut user = User::new(0, nickname);
            user.elo_rank = elo;
            user.currency_value = currency;
            user.add_experience(experience); // sets level + rank
            let user_id = self.create_user_row(nickname, "", &user)?;
            user.user_id = user_id;
            self.save_user(&user)?;
            for ship_name in ships {
                if let Some(template) = sim::ship::template_by_name(ship_name) {
                    let mut owned = OwnedShip::from_template(0, &template);
                    owned.status = ShipStatus::Active;
                    self.insert_ship(user_id, owned)?;
                }
            }
        }
        Ok(())
    }

    /// Insert a fresh user row and return its assigned id. `data`'s `user_id`
    /// is patched to match the row id.
    fn create_user_row(&self, nickname: &str, password_hash: &str, user: &User) -> WorldResult<u32> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let json = serde_json::to_string(user).map_err(map_err)?;
                db.execute(
                    "INSERT INTO users (nickname, password_hash, last_work_at, data) VALUES (?1, ?2, 0, ?3)",
                    params![nickname, password_hash, json],
                )
                .map_err(|e| {
                    if e.to_string().contains("UNIQUE") {
                        "Nickname already taken".to_string()
                    } else {
                        e.to_string()
                    }
                })?;
                let user_id = db.last_insert_rowid() as u32;
                let mut fixed = user.clone();
                fixed.user_id = user_id;
                let json = serde_json::to_string(&fixed).map_err(map_err)?;
                db.execute("UPDATE users SET data = ?1 WHERE user_id = ?2", params![json, user_id])
                    .map_err(map_err)?;
                Ok(user_id)
            }
            Db::Mem(mem) => {
                let mut mem = mem.borrow_mut();
                if mem.users.iter().any(|u| u.nickname == nickname) {
                    return Err("Nickname already taken".to_string());
                }
                let user_id = mem.next_user_id;
                mem.next_user_id += 1;
                let mut fixed = user.clone();
                fixed.user_id = user_id;
                mem.users.push(MemUser {
                    user_id,
                    nickname: nickname.to_string(),
                    password_hash: password_hash.to_string(),
                    last_work_at: 0,
                    data: fixed,
                });
                Ok(user_id)
            }
        }
    }

    // -- public API ---------------------------------------------------------

    /// Register a new human account. Returns the new user id.
    pub fn register(&self, nickname: &str, password: &str) -> WorldResult<u32> {
        let nickname = nickname.trim();
        if nickname.is_empty() || nickname.len() > 50 {
            return Err("Nickname must be 1–50 characters".into());
        }
        if nickname.starts_with("NPC_") {
            return Err("Nickname may not start with NPC_".into());
        }
        if password.len() < 3 {
            return Err("Password must be at least 3 characters".into());
        }
        let user = User::new(0, nickname);
        self.create_user_row(nickname, &hash_password(nickname, password), &user)
    }

    /// Authenticate an existing account. Returns the user id.
    pub fn login(&self, nickname: &str, password: &str) -> WorldResult<u32> {
        match self.user_id_by_nickname(nickname.trim())? {
            Some((user_id, hash)) if hash == hash_password(nickname.trim(), password) => Ok(user_id),
            Some(_) => Err("Incorrect password".into()),
            None => Err("No such pilot".into()),
        }
    }

    /// Build the full snapshot for a player.
    pub fn snapshot(&self, user_id: u32) -> WorldResult<PlayerSnapshot> {
        let user = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        let ships = self.load_ships(user_id)?;
        let active_count = ships.iter().filter(|s| s.status == ShipStatus::Active).count() as u32;
        let bonus = user.rank.bonus();

        // Work cooldown remaining.
        let last_work_at = self.last_work_at(user_id)?;
        let cooldown = bonus.work_cooldown_minutes * 60;
        let elapsed = now_unix() - last_work_at;
        let work_cooldown_remaining = (cooldown - elapsed).max(0);

        Ok(PlayerSnapshot {
            user,
            ships,
            max_active_ships: bonus.max_active_ships,
            active_count,
            work_cooldown_remaining,
        })
    }

    pub fn buy(&self, user_id: u32, ship_id: u32) -> WorldResult<()> {
        let template = sim::ship::template_by_id(ship_id).ok_or("Unknown ship")?;
        let mut user = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        let owned = economy::buy_ship(&mut user, &template, 0)?;
        self.save_user(&user)?;
        self.insert_ship(user_id, owned)?;
        Ok(())
    }

    pub fn sell(&self, user_id: u32, ship_number: u32) -> WorldResult<i64> {
        let mut user = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        let mut ship = self.load_one_ship(user_id, ship_number)?;
        let credits = economy::sell_ship(&mut user, &mut ship)?;
        self.save_user(&user)?;
        self.save_ship(&ship)?;
        Ok(credits)
    }

    pub fn repair(&self, user_id: u32, ship_number: u32) -> WorldResult<()> {
        // Enforce the repair cooldown.
        let last_repair_at = self.last_repair_at(user_id, ship_number)?;
        let elapsed = now_unix() - last_repair_at;
        if elapsed < SHIPYARD_REPAIR_COOLDOWN_SECONDS {
            return Err(format!("Shipyard busy — wait {}s", SHIPYARD_REPAIR_COOLDOWN_SECONDS - elapsed));
        }
        let mut ship = self.load_one_ship(user_id, ship_number)?;
        if ship.status == ShipStatus::Destroyed {
            return Err("Destroyed ships cannot be repaired".into());
        }
        ship.repair();
        self.save_ship(&ship)?;
        self.set_last_repair_at(ship_number, now_unix())?;
        Ok(())
    }

    pub fn activate(&self, user_id: u32, ship_number: u32) -> WorldResult<()> {
        let user = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        let ships = self.load_ships(user_id)?;
        let current_active = ships.iter().filter(|s| s.status == ShipStatus::Active).count() as u32;
        let mut ship = self.load_one_ship(user_id, ship_number)?;
        economy::activate_ship(&user, &mut ship, current_active)?;
        self.save_ship(&ship)?;
        Ok(())
    }

    pub fn deactivate(&self, user_id: u32, ship_number: u32) -> WorldResult<()> {
        let mut ship = self.load_one_ship(user_id, ship_number)?;
        economy::deactivate_ship(&mut ship)?;
        self.save_ship(&ship)?;
        Ok(())
    }

    pub fn set_formation(&self, user_id: u32, formation: Formation) -> WorldResult<()> {
        let mut user = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        user.default_formation = formation;
        self.save_user(&user)
    }

    /// Buy the next ship-defense level (interior turrets that fight boarders).
    pub fn upgrade_defense(&self, user_id: u32) -> WorldResult<()> {
        let mut user = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        if user.defense_level >= sim::DEFENSE_LEVEL_MAX {
            return Err("Ship defenses are already at maximum".into());
        }
        let cost = sim::defense_upgrade_cost(user.defense_level);
        if user.currency_value < cost {
            return Err(format!("Insufficient credits: defense upgrade costs {cost}"));
        }
        user.currency_value -= cost;
        user.defense_level += 1;
        self.save_user(&user)
    }

    pub fn work(&self, user_id: u32) -> WorldResult<(String, i64)> {
        let mut user = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        let snap = self.snapshot(user_id)?;
        if snap.work_cooldown_remaining > 0 {
            return Err(format!("You must rest {}s before working again", snap.work_cooldown_remaining));
        }
        let (work_type, income) = self.with_rng(|mut rng| economy::perform_work(&mut user, &mut rng));
        self.save_user(&user)?;
        self.set_last_work_at(user_id, now_unix())?;
        Ok((work_type.to_string(), income))
    }

    pub fn list_opponents(&self, user_id: u32) -> WorldResult<Vec<OpponentInfo>> {
        let mut out = Vec::new();
        for (id, user) in self.all_users()? {
            if id == user_id {
                continue;
            }
            let ships = self.load_ships(id)?;
            let active = ships.iter().filter(|s| s.status == ShipStatus::Active).count() as u32;
            if active == 0 {
                continue; // can't be fought without an active fleet
            }
            out.push(OpponentInfo {
                user_id: id,
                nickname: user.nickname.clone(),
                rank: user.rank.title().to_string(),
                level: user.level,
                elo: user.elo_rank,
                active_ships: active,
                is_npc: user.is_npc(),
                // NPCs never buy defenses: derive theirs from level so tougher
                // systems are better defended. Humans use what they purchased.
                defense_level: if user.is_npc() {
                    ((user.level / 8) as u8).min(sim::DEFENSE_LEVEL_MAX)
                } else {
                    user.defense_level.min(sim::DEFENSE_LEVEL_MAX)
                },
            });
        }
        out.sort_by(|a, b| a.elo.partial_cmp(&b.elo).unwrap());
        Ok(out)
    }

    pub fn battle(
        &self,
        user_id: u32,
        opponent_id: u32,
        formation: Formation,
        boarding: Option<sim::BoardingOutcome>,
    ) -> WorldResult<BattleResultDto> {
        if user_id == opponent_id {
            return Err("You cannot fight yourself".into());
        }
        // Defensive sanitation: the raid outcome comes from the client.
        let boarding = boarding.map(|b| b.sanitized());
        let mut me = self.load_user_by_id(user_id)?.ok_or("User not found")?;
        let mut foe = self.load_user_by_id(opponent_id)?.ok_or("Opponent not found")?;
        let mut my_ships = self.load_ships(user_id)?;
        let mut foe_ships = self.load_ships(opponent_id)?;

        let foe_formation = foe.default_formation;
        let report = {
            let my_fleet: Vec<&mut OwnedShip> =
                my_ships.iter_mut().filter(|s| s.status == ShipStatus::Active).collect();
            let foe_fleet: Vec<&mut OwnedShip> =
                foe_ships.iter_mut().filter(|s| s.status == ShipStatus::Active).collect();
            self.with_rng(|mut rng| {
                combat::battle_with_boarding(
                    combat::Combatant { user: &mut me, fleet: my_fleet, formation },
                    combat::Combatant { user: &mut foe, fleet: foe_fleet, formation: foe_formation },
                    boarding.as_ref(),
                    &mut rng,
                )
            })?
        };

        // Persist both sides.
        self.save_user(&me)?;
        self.save_user(&foe)?;
        for s in &my_ships {
            self.save_ship(s)?;
        }
        for s in &foe_ships {
            self.save_ship(s)?;
        }

        let player_won = report.winner_nickname == me.nickname;
        let dto = BattleResultDto {
            winner_nickname: report.winner_nickname.clone(),
            loser_nickname: report.loser_nickname.clone(),
            player_won,
            opponent_nickname: foe.nickname.clone(),
            credits_awarded: if player_won { report.credits_awarded } else { 0 },
            total_damage_dealt: report.total_damage1,
            total_damage_taken: report.total_damage2,
            ships_lost: report.ships_lost_by_user1,
            ships_destroyed: report.ships_lost_by_user2,
            log: report.log.clone(),
            message: report.message.clone(),
        };

        // Record history.
        let winner_user_id = if player_won { user_id } else { opponent_id };
        self.insert_battle(now_unix(), winner_user_id, user_id, opponent_id, &dto)?;

        Ok(dto)
    }

    pub fn leaderboard(&self) -> WorldResult<Vec<LeaderboardEntry>> {
        let mut entries = Vec::new();
        for (_, user) in self.all_users()? {
            entries.push(LeaderboardEntry {
                nickname: user.nickname.clone(),
                elo: user.elo_rank,
                victories: user.victories,
                defeats: user.defeats,
                level: user.level,
                rank: user.rank.title().to_string(),
            });
        }
        entries.sort_by(|a, b| b.elo.partial_cmp(&a.elo).unwrap());
        entries.truncate(50);
        Ok(entries)
    }

    pub fn history(&self, user_id: u32) -> WorldResult<Vec<BattleSummary>> {
        let rows: Vec<(i64, i64, Option<u32>, BattleResultDto)> = match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let mut stmt = db
                    .prepare(
                        "SELECT battle_id, timestamp, winner_user_id, data FROM battle_history
                         WHERE user1_id = ?1 OR user2_id = ?1 ORDER BY battle_id DESC LIMIT 50",
                    )
                    .map_err(map_err)?;
                let mapped = stmt
                    .query_map(params![user_id], |row| {
                        Ok((
                            row.get::<_, i64>(0)?,
                            row.get::<_, i64>(1)?,
                            row.get::<_, Option<u32>>(2)?,
                            row.get::<_, String>(3)?,
                        ))
                    })
                    .map_err(map_err)?;
                let mut out = Vec::new();
                for r in mapped {
                    let (battle_id, timestamp, winner_user_id, json) = r.map_err(map_err)?;
                    out.push((
                        battle_id,
                        timestamp,
                        winner_user_id,
                        serde_json::from_str(&json).map_err(map_err)?,
                    ));
                }
                out
            }
            Db::Mem(mem) => mem
                .borrow()
                .battles
                .iter()
                .filter(|b| b.user1_id == user_id || b.user2_id == user_id)
                .rev()
                .take(50)
                .map(|b| (b.battle_id, b.timestamp, b.winner_user_id, b.data.clone()))
                .collect(),
        };

        Ok(rows
            .into_iter()
            .map(|(battle_id, timestamp, winner_user_id, dto)| BattleSummary {
                battle_id,
                opponent_nickname: dto.opponent_nickname.clone(),
                won: winner_user_id == Some(user_id),
                message: dto.message.clone(),
                timestamp,
            })
            .collect())
    }

    /// All non-NPC and NPC user ids — used by the bot tick on the server.
    pub fn all_user_ids(&self) -> WorldResult<Vec<u32>> {
        Ok(self.all_users()?.into_iter().map(|(id, _)| id).collect())
    }

    /// Load a NPC user (for the bot tick).
    pub fn load_user(&self, user_id: u32) -> WorldResult<Option<User>> {
        self.load_user_by_id(user_id)
    }

    pub fn ships_of(&self, user_id: u32) -> WorldResult<Vec<OwnedShip>> {
        self.load_ships(user_id)
    }

    fn load_one_ship(&self, user_id: u32, ship_number: u32) -> WorldResult<OwnedShip> {
        match &self.db {
            #[cfg(not(target_arch = "wasm32"))]
            Db::Sqlite(db) => {
                let json: String = db
                    .query_row(
                        "SELECT data FROM owned_ships WHERE ship_number = ?1 AND user_id = ?2",
                        params![ship_number, user_id],
                        |r| r.get(0),
                    )
                    .optional()
                    .map_err(map_err)?
                    .ok_or("Owned ship not found")?;
                serde_json::from_str(&json).map_err(map_err)
            }
            Db::Mem(mem) => mem
                .borrow()
                .ships
                .iter()
                .find(|s| s.ship_number == ship_number && s.user_id == user_id)
                .map(|s| s.data.clone())
                .ok_or_else(|| "Owned ship not found".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn world() -> World {
        World::open(":memory:").unwrap()
    }

    #[test]
    fn register_login_and_snapshot() {
        let w = world();
        let id = w.register("Pilot", "secret").unwrap();
        assert_eq!(w.login("Pilot", "secret").unwrap(), id);
        assert!(w.login("Pilot", "wrong").is_err());
        let snap = w.snapshot(id).unwrap();
        assert_eq!(snap.user.currency_value, 2000);
        assert_eq!(snap.ships.len(), 0);
        assert_eq!(snap.max_active_ships, 1);
    }

    #[test]
    fn npcs_are_seeded_as_opponents() {
        let w = world();
        let id = w.register("Pilot", "secret").unwrap();
        let opponents = w.list_opponents(id).unwrap();
        assert!(opponents.iter().any(|o| o.nickname == "NPC_Astro"));
        assert!(opponents.iter().all(|o| o.active_ships > 0));
    }

    #[test]
    fn buy_activate_and_battle_an_npc() {
        let w = world();
        let id = w.register("Pilot", "secret").unwrap();
        // Buy a strong-enough ship within starting funds (Falcon, 1500).
        w.buy(id, sim::ship::template_by_name("Falcon").unwrap().ship_id).unwrap();
        let snap = w.snapshot(id).unwrap();
        let ship_number = snap.ships[0].ship_number;
        w.activate(id, ship_number).unwrap();

        let astro = w.list_opponents(id).unwrap().into_iter().find(|o| o.nickname == "NPC_Astro").unwrap();
        let result = w.battle(id, astro.user_id, Formation::Aggressive, None).unwrap();
        assert_eq!(result.opponent_nickname, "NPC_Astro");
        assert!(!result.log.is_empty());

        // A battle was recorded in history.
        let history = w.history(id).unwrap();
        assert_eq!(history.len(), 1);
    }

    /// Register, buy a Falcon, activate it, and fight NPC_Astro; returns the battle log.
    fn play_one_battle(w: &World) -> Vec<String> {
        let id = w.register("Pilot", "secret").unwrap();
        w.buy(id, sim::ship::template_by_name("Falcon").unwrap().ship_id).unwrap();
        let snap = w.snapshot(id).unwrap();
        w.activate(id, snap.ships[0].ship_number).unwrap();
        let astro = w
            .list_opponents(id)
            .unwrap()
            .into_iter()
            .find(|o| o.nickname == "NPC_Astro")
            .unwrap();
        w.battle(id, astro.user_id, Formation::Aggressive, None).unwrap().log
    }

    #[test]
    fn same_seed_worlds_are_identical() {
        let a = World::open_seeded(":memory:", 42).unwrap();
        let b = World::open_seeded(":memory:", 42).unwrap();
        assert_eq!(play_one_battle(&a), play_one_battle(&b));
    }

    #[test]
    fn different_seeds_very_likely_differ() {
        let a = World::open_seeded(":memory:", 1).unwrap();
        let b = World::open_seeded(":memory:", 2).unwrap();
        assert_ne!(play_one_battle(&a), play_one_battle(&b));
    }

    // -- in-memory backend (what the mobile/web build ships) -----------------

    #[test]
    fn mem_world_matches_sqlite_behaviour() {
        let w = World::open_mem().unwrap();
        let id = w.register("Pilot", "secret").unwrap();
        assert_eq!(w.login("Pilot", "secret").unwrap(), id);
        assert!(w.login("Pilot", "wrong").is_err());

        w.buy(id, sim::ship::template_by_name("Falcon").unwrap().ship_id).unwrap();
        let snap = w.snapshot(id).unwrap();
        w.activate(id, snap.ships[0].ship_number).unwrap();

        let opponents = w.list_opponents(id).unwrap();
        assert!(opponents.iter().any(|o| o.nickname == "NPC_Astro"));

        let astro = opponents.into_iter().find(|o| o.nickname == "NPC_Astro").unwrap();
        let result = w.battle(id, astro.user_id, Formation::Aggressive, None).unwrap();
        assert_eq!(result.opponent_nickname, "NPC_Astro");
        assert_eq!(w.history(id).unwrap().len(), 1);
        assert!(!w.leaderboard().unwrap().is_empty());
    }

    #[test]
    fn mem_world_seeded_matches_sqlite_seeded() {
        // The two backends must produce identical battles for the same seed:
        // the rules and RNG stream are shared, only storage differs.
        let sqlite = World::open_seeded(":memory:", 42).unwrap();
        let mem = World::open_mem_seeded(42).unwrap();
        assert_eq!(play_one_battle(&sqlite), play_one_battle(&mem));
    }

    #[test]
    fn mem_world_json_round_trip() {
        let w = World::open_mem().unwrap();
        let id = w.register("Pilot", "secret").unwrap();
        w.buy(id, sim::ship::template_by_name("Falcon").unwrap().ship_id).unwrap();

        let json = w.to_json().unwrap();
        let restored = World::from_json(&json).unwrap();
        assert_eq!(restored.login("Pilot", "secret").unwrap(), id);
        let snap = restored.snapshot(id).unwrap();
        assert_eq!(snap.ships.len(), 1);
        assert_eq!(snap.user.nickname, "Pilot");
    }
}

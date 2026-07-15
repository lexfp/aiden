//! The authoritative game world, persisted in SQLite. Both the dedicated server
//! and the offline single-player client drive the exact same `World` so the
//! rules never diverge.

use crate::protocol::{
    BattleResultDto, BattleSummary, LeaderboardEntry, OpponentInfo, PlayerSnapshot,
};
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use rand_chacha::ChaCha8Rng;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use sim::economy;
use sim::ship::{OwnedShip, ShipStatus};
use sim::user::{Formation, User};
use sim::{combat, SHIPYARD_REPAIR_COOLDOWN_SECONDS};
use std::cell::RefCell;
use std::time::{SystemTime, UNIX_EPOCH};

/// Result type for world operations; the `String` is a user-facing message.
pub type WorldResult<T> = Result<T, String>;

pub struct World {
    db: Connection,
    /// When `Some`, all battle/work randomness is drawn from this deterministic
    /// generator so runs are reproducible. `None` keeps the entropy behaviour
    /// used by normal play. `RefCell` so the existing `&self` methods can draw
    /// from it without a signature change.
    rng: RefCell<Option<ChaCha8Rng>>,
}

fn now_unix() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
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
    pub fn open(path: &str) -> WorldResult<World> {
        let db = Connection::open(path).map_err(map_err)?;
        let world = World { db, rng: RefCell::new(None) };
        world.init_schema()?;
        world.seed_if_empty()?;
        Ok(world)
    }

    /// Like [`World::open`] but every battle/work roll is drawn from a
    /// deterministic `ChaCha8Rng` seeded with `seed`, so identical action
    /// sequences produce identical random outcomes (cooldown checks still use
    /// wall-clock time).
    pub fn open_seeded(path: &str, seed: u64) -> WorldResult<World> {
        let db = Connection::open(path).map_err(map_err)?;
        let world = World { db, rng: RefCell::new(Some(ChaCha8Rng::seed_from_u64(seed))) };
        world.init_schema()?;
        world.seed_if_empty()?;
        Ok(world)
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

    fn init_schema(&self) -> WorldResult<()> {
        self.db
            .execute_batch(
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
        self.db
            .query_row("SELECT data FROM users WHERE user_id = ?1", params![user_id], |row| {
                row.get::<_, String>(0)
            })
            .optional()
            .map_err(map_err)?
            .map(|json| serde_json::from_str::<User>(&json).map_err(map_err))
            .transpose()
    }

    fn user_id_by_nickname(&self, nickname: &str) -> WorldResult<Option<(u32, String)>> {
        self.db
            .query_row(
                "SELECT user_id, password_hash FROM users WHERE nickname = ?1 COLLATE NOCASE",
                params![nickname],
                |row| Ok((row.get::<_, u32>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(map_err)
    }

    fn save_user(&self, user: &User) -> WorldResult<()> {
        let json = serde_json::to_string(user).map_err(map_err)?;
        self.db
            .execute("UPDATE users SET data = ?1 WHERE user_id = ?2", params![json, user.user_id])
            .map_err(map_err)?;
        Ok(())
    }

    fn load_ships(&self, user_id: u32) -> WorldResult<Vec<OwnedShip>> {
        let mut stmt = self
            .db
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

    fn save_ship(&self, ship: &OwnedShip) -> WorldResult<()> {
        let json = serde_json::to_string(ship).map_err(map_err)?;
        self.db
            .execute(
                "UPDATE owned_ships SET data = ?1 WHERE ship_number = ?2",
                params![json, ship.ship_number],
            )
            .map_err(map_err)?;
        Ok(())
    }

    fn insert_ship(&self, user_id: u32, mut ship: OwnedShip) -> WorldResult<OwnedShip> {
        // Insert with a placeholder, then patch the JSON with the real rowid.
        self.db
            .execute(
                "INSERT INTO owned_ships (user_id, last_repair_at, data) VALUES (?1, 0, ?2)",
                params![user_id, "{}"],
            )
            .map_err(map_err)?;
        let ship_number = self.db.last_insert_rowid() as u32;
        ship.ship_number = ship_number;
        self.save_ship(&ship)?;
        Ok(ship)
    }

    // -- seeding ------------------------------------------------------------

    fn seed_if_empty(&self) -> WorldResult<()> {
        let seeded: Option<String> = self
            .db
            .query_row("SELECT value FROM meta WHERE key = 'seeded'", [], |row| row.get(0))
            .optional()
            .map_err(map_err)?;
        if seeded.is_some() {
            return Ok(());
        }
        self.seed_npcs()?;
        self.db
            .execute("INSERT INTO meta (key, value) VALUES ('seeded', '1')", [])
            .map_err(map_err)?;
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
        let json = serde_json::to_string(user).map_err(map_err)?;
        self.db
            .execute(
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
        let user_id = self.db.last_insert_rowid() as u32;
        let mut fixed = user.clone();
        fixed.user_id = user_id;
        let json = serde_json::to_string(&fixed).map_err(map_err)?;
        self.db
            .execute("UPDATE users SET data = ?1 WHERE user_id = ?2", params![json, user_id])
            .map_err(map_err)?;
        Ok(user_id)
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
        let last_work_at: i64 = self
            .db
            .query_row("SELECT last_work_at FROM users WHERE user_id = ?1", params![user_id], |r| r.get(0))
            .optional()
            .map_err(map_err)?
            .unwrap_or(0);
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
        let last_repair_at: i64 = self
            .db
            .query_row(
                "SELECT last_repair_at FROM owned_ships WHERE ship_number = ?1 AND user_id = ?2",
                params![ship_number, user_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(map_err)?
            .ok_or("Owned ship not found")?;
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
        self.db
            .execute(
                "UPDATE owned_ships SET last_repair_at = ?1 WHERE ship_number = ?2",
                params![now_unix(), ship_number],
            )
            .map_err(map_err)?;
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
        self.db
            .execute("UPDATE users SET last_work_at = ?1 WHERE user_id = ?2", params![now_unix(), user_id])
            .map_err(map_err)?;
        Ok((work_type.to_string(), income))
    }

    pub fn list_opponents(&self, user_id: u32) -> WorldResult<Vec<OpponentInfo>> {
        let mut stmt = self
            .db
            .prepare("SELECT user_id, data FROM users WHERE user_id != ?1")
            .map_err(map_err)?;
        let rows = stmt
            .query_map(params![user_id], |row| Ok((row.get::<_, u32>(0)?, row.get::<_, String>(1)?)))
            .map_err(map_err)?;
        let mut out = Vec::new();
        for r in rows {
            let (id, json) = r.map_err(map_err)?;
            let user: User = serde_json::from_str(&json).map_err(map_err)?;
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
        let history_json = serde_json::to_string(&dto).map_err(map_err)?;
        self.db
            .execute(
                "INSERT INTO battle_history (timestamp, winner_user_id, user1_id, user2_id, data) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![now_unix(), winner_user_id, user_id, opponent_id, history_json],
            )
            .map_err(map_err)?;

        Ok(dto)
    }

    pub fn leaderboard(&self) -> WorldResult<Vec<LeaderboardEntry>> {
        let mut stmt = self.db.prepare("SELECT data FROM users").map_err(map_err)?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(map_err)?;
        let mut entries = Vec::new();
        for r in rows {
            let user: User = serde_json::from_str(&r.map_err(map_err)?).map_err(map_err)?;
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
        let mut stmt = self
            .db
            .prepare(
                "SELECT battle_id, timestamp, winner_user_id, data FROM battle_history
                 WHERE user1_id = ?1 OR user2_id = ?1 ORDER BY battle_id DESC LIMIT 50",
            )
            .map_err(map_err)?;
        let rows = stmt
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
        for r in rows {
            let (battle_id, timestamp, winner_user_id, json) = r.map_err(map_err)?;
            let dto: BattleResultDto = serde_json::from_str(&json).map_err(map_err)?;
            out.push(BattleSummary {
                battle_id,
                opponent_nickname: dto.opponent_nickname.clone(),
                won: winner_user_id == Some(user_id),
                message: dto.message.clone(),
                timestamp,
            });
        }
        Ok(out)
    }

    /// All non-NPC and NPC user ids — used by the bot tick on the server.
    pub fn all_user_ids(&self) -> WorldResult<Vec<u32>> {
        let mut stmt = self.db.prepare("SELECT user_id FROM users").map_err(map_err)?;
        let rows = stmt.query_map([], |row| row.get::<_, u32>(0)).map_err(map_err)?;
        rows.map(|r| r.map_err(map_err)).collect()
    }

    /// Load a NPC user (for the bot tick).
    pub fn load_user(&self, user_id: u32) -> WorldResult<Option<User>> {
        self.load_user_by_id(user_id)
    }

    pub fn ships_of(&self, user_id: u32) -> WorldResult<Vec<OwnedShip>> {
        self.load_ships(user_id)
    }

    fn load_one_ship(&self, user_id: u32, ship_number: u32) -> WorldResult<OwnedShip> {
        let json: String = self
            .db
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
}

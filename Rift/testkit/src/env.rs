//! Gym-style agent interface over `network::GameApi`.
//!
//! [`Action`] is a superset of `sim::bot::BotAction`; [`Observation`] is the
//! serde payload every layer shares. [`AgentEnv`] is the observe/act/legal
//! loop; [`ApiEnv`] implements it over any `Box<dyn GameApi>`.

use network::protocol::{BattleSummary, LeaderboardEntry, OpponentInfo, PlayerSnapshot};
use serde::{Deserialize, Serialize};
use sim::ship::ShipTemplate;
use sim::user::Formation;

/// A single agent action. Externally-tagged so the replay JSON matches the
/// spec: `"Work"`, `{"Buy":{"ship_id":3}}`, etc.
///
/// (`PartialEq` only: `BoardingOutcome` carries an `f32` duration.)
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Action {
    Register { nickname: String, password: String },
    Login { nickname: String, password: String },
    Work,
    Buy { ship_id: u32 },
    Sell { ship_number: u32 },
    Repair { ship_number: u32 },
    Activate { ship_number: u32 },
    Deactivate { ship_number: u32 },
    SetFormation(Formation),
    Battle {
        opponent_id: u32,
        formation: Formation,
        /// Outcome of a pre-battle boarding raid. Defaults to `None` so replay
        /// JSON recorded before boarding existed still deserializes.
        #[serde(default)]
        boarding: Option<sim::BoardingOutcome>,
    },
    Refresh(View),
}

/// Which read-only view a `Refresh` pulls.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum View {
    Opponents,
    Leaderboard,
    History,
}

/// The serde observation snapshot shared by every layer.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Observation {
    pub player: Option<PlayerSnapshot>,
    pub catalog: Vec<ShipTemplate>,
    pub opponents: Vec<OpponentInfo>,
    pub leaderboard: Vec<LeaderboardEntry>,
    pub history: Vec<BattleSummary>,
    pub status: String,
    pub status_is_error: bool,
    /// Populated only when attached to the live UI (unused in Phase 1).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub screen: Option<String>,
}

/// The result of applying one [`Action`].
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActionOutcome {
    /// True if the backend accepted the action.
    pub ok: bool,
    /// A human-facing status line (the backend message, or the error text).
    pub status: String,
    /// The observation after the action was applied (or attempted).
    pub observation: Observation,
}

/// Errors an environment can raise that are not ordinary game rejections.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EnvError {
    /// The backend reported an error string for a read/observe call.
    Backend(String),
    /// An action referenced state that does not exist (e.g. no player yet).
    InvalidState(String),
}

impl std::fmt::Display for EnvError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EnvError::Backend(s) => write!(f, "backend error: {s}"),
            EnvError::InvalidState(s) => write!(f, "invalid state: {s}"),
        }
    }
}

impl std::error::Error for EnvError {}

/// The observe / legal-actions / act loop every bot and the LLM consume.
///
/// Methods take `&mut self` because backends (`GameApi`) require it: RemoteApi
/// reads are socket round-trips.
pub trait AgentEnv {
    fn observe(&mut self) -> Result<Observation, EnvError>;
    /// Advisory, not a guarantee: actions listed here can still be rejected
    /// (`ok == false`) — e.g. Repair during the 60s shipyard cooldown, which is
    /// not modelled here (post-merge, `GameApi::shipyard_status()` from the
    /// upstream realtime-fleet-combat branch can make Repair exact). The pure
    /// derivation lives in `legal_actions_from`, shared with agent mode.
    fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError>;
    fn act(&mut self, a: &Action) -> Result<ActionOutcome, EnvError>;
}

use network::GameApi;
use sim::ship::ShipStatus;

/// An [`AgentEnv`] over any `GameApi` backend: in-memory `LocalApi`, on-disk
/// save, or `RemoteApi`. Read calls that fail are treated as empty lists so a
/// pre-login observation is still well-formed.
///
/// Each observe issues up to 5 backend reads; through `RemoteApi` these are
/// socket round-trips — batch/cache at the backend if that ever matters.
pub struct ApiEnv {
    api: Box<dyn GameApi>,
    logged_in: bool,
}

impl ApiEnv {
    pub fn new(api: Box<dyn GameApi>) -> Self {
        ApiEnv { api, logged_in: false }
    }

    #[doc(hidden)]
    pub fn set_logged_in_for_test(&mut self, v: bool) {
        self.logged_in = v;
    }

    /// Build an observation from the backend. Read errors (e.g. not logged in)
    /// collapse to empty collections rather than failing the whole observe.
    /// The player snapshot is fetched here with the swallowing `snapshot().ok()`
    /// used by `act`'s post-action observation.
    fn build_observation(&mut self, status: String, status_is_error: bool) -> Observation {
        let player = if self.logged_in { self.api.snapshot().ok() } else { None };
        self.build_observation_with_player(player, status, status_is_error)
    }

    /// Build an observation from an already-fetched `player`, filling the rest
    /// (catalog/opponents/leaderboard/history) from the backend. `observe` uses
    /// this with a snapshot that hard-errors on failure; `build_observation`
    /// uses it with the swallowing `snapshot().ok()`.
    fn build_observation_with_player(
        &mut self,
        player: Option<PlayerSnapshot>,
        status: String,
        status_is_error: bool,
    ) -> Observation {
        let catalog = self.api.catalog().unwrap_or_default();
        let opponents = if self.logged_in { self.api.opponents().unwrap_or_default() } else { Vec::new() };
        let leaderboard = self.api.leaderboard().unwrap_or_default();
        let history = if self.logged_in { self.api.history().unwrap_or_default() } else { Vec::new() };
        Observation {
            player,
            catalog,
            opponents,
            leaderboard,
            history,
            status,
            status_is_error,
            screen: None,
        }
    }
}

/// The pure legal-actions derivation, shared by [`ApiEnv::legal_actions`] and
/// agent mode's `/actions`. Advisory: listed actions can still be rejected
/// (e.g. Repair during the 60s shipyard cooldown, which is not modelled here).
pub fn legal_actions_from(obs: &Observation) -> Vec<Action> {
    let mut actions = Vec::new();
    let snap = match &obs.player {
        Some(s) => s,
        None => return actions, // not logged in: caller must Register/Login
    };

    // SetFormation and Refresh are always available once logged in.
    for f in [Formation::Defensive, Formation::Aggressive, Formation::Tactical] {
        actions.push(Action::SetFormation(f));
    }
    for v in [View::Opponents, View::Leaderboard, View::History] {
        actions.push(Action::Refresh(v));
    }

    // Work when the cooldown has elapsed.
    if snap.work_cooldown_remaining == 0 {
        actions.push(Action::Work);
    }

    // Buy every affordable catalog ship.
    for t in &obs.catalog {
        if (t.stats.value as i64) <= snap.user.currency_value {
            actions.push(Action::Buy { ship_id: t.ship_id });
        }
    }

    // Per-ship actions.
    for ship in &snap.ships {
        match ship.status {
            ShipStatus::Owned => {
                actions.push(Action::Sell { ship_number: ship.ship_number });
                if ship.needs_repair() {
                    actions.push(Action::Repair { ship_number: ship.ship_number });
                }
                if snap.active_count < snap.max_active_ships {
                    actions.push(Action::Activate { ship_number: ship.ship_number });
                }
            }
            ShipStatus::Active => {
                actions.push(Action::Sell { ship_number: ship.ship_number });
                if ship.needs_repair() {
                    actions.push(Action::Repair { ship_number: ship.ship_number });
                }
                actions.push(Action::Deactivate { ship_number: ship.ship_number });
            }
            ShipStatus::Destroyed | ShipStatus::Sold => {}
        }
    }

    // Battle every opponent when we have an active fleet.
    if snap.active_count > 0 {
        for opp in &obs.opponents {
            actions.push(Action::Battle {
                opponent_id: opp.user_id,
                formation: snap.user.default_formation,
                boarding: None,
            });
        }
    }

    actions
}

impl AgentEnv for ApiEnv {
    fn observe(&mut self) -> Result<Observation, EnvError> {
        let player = if self.logged_in {
            Some(self.api.snapshot().map_err(EnvError::Backend)?)
        } else {
            None
        };
        Ok(self.build_observation_with_player(player, String::new(), false))
    }

    fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError> {
        let obs = self.observe()?;
        Ok(legal_actions_from(&obs))
    }

    fn act(&mut self, a: &Action) -> Result<ActionOutcome, EnvError> {
        let result: Result<String, String> = match a {
            Action::Register { nickname, password } => self.api.register(nickname, password).map(|_| {
                self.logged_in = true;
                format!("Registered {nickname}")
            }),
            Action::Login { nickname, password } => self.api.login(nickname, password).map(|_| {
                self.logged_in = true;
                format!("Logged in as {nickname}")
            }),
            Action::Work => self.api.work().map(|(kind, income, _)| format!("Worked {kind}: +{income}")),
            Action::Buy { ship_id } => self.api.buy(*ship_id).map(|_| format!("Bought ship {ship_id}")),
            Action::Sell { ship_number } => self.api.sell(*ship_number).map(|_| format!("Sold ship {ship_number}")),
            Action::Repair { ship_number } => {
                self.api.repair(*ship_number).map(|_| format!("Repaired ship {ship_number}"))
            }
            Action::Activate { ship_number } => {
                self.api.activate(*ship_number).map(|_| format!("Activated ship {ship_number}"))
            }
            Action::Deactivate { ship_number } => {
                self.api.deactivate(*ship_number).map(|_| format!("Deactivated ship {ship_number}"))
            }
            Action::SetFormation(f) => self.api.set_formation(*f).map(|_| format!("Formation set to {}", f.as_str())),
            Action::Battle { opponent_id, formation, boarding } => {
                self.api.battle(*opponent_id, *formation, boarding.clone()).map(|(r, _)| r.message)
            }
            Action::Refresh(view) => match view {
                View::Opponents => self.api.opponents().map(|o| format!("{} opponents", o.len())),
                View::Leaderboard => self.api.leaderboard().map(|l| format!("{} leaders", l.len())),
                View::History => self.api.history().map(|h| format!("{} battles", h.len())),
            },
        };
        let (ok, status) = match result {
            Ok(msg) => (true, msg),
            Err(e) => (false, e),
        };
        let observation = self.build_observation(status.clone(), !ok);
        Ok(ActionOutcome { ok, status, observation })
    }
}

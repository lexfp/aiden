//! `HttpEnv`: an [`AgentEnv`](crate::env::AgentEnv) client for the live
//! agent-mode HTTP channel (`GET /state`, `GET /actions`, `POST /act`, plus UI
//! verbs). Uses `ureq` (blocking) and `serde_json` directly — no framework.

use crate::env::{Action, ActionOutcome, AgentEnv, EnvError, Observation};
use serde::Deserialize;
use std::time::Duration;

/// Extract the best human message from a `ureq::Error`. For an HTTP status
/// error, read the response body and pull `{"error": ...}` (agent mode's error
/// shape), falling back to the raw body or `status code N`. For a transport
/// error, use its `Display`. This ensures a server-constructed message is never
/// discarded in favour of a generic ureq string.
fn error_body(e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(code, r) => {
            let body = r.into_string().unwrap_or_default();
            serde_json::from_str::<serde_json::Value>(&body)
                .ok()
                .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(|s| s.to_string()))
                .filter(|s| !s.is_empty())
                .or_else(|| (!body.is_empty()).then(|| body.clone()))
                .unwrap_or_else(|| format!("status code {code}"))
        }
        transport => transport.to_string(),
    }
}

/// A minimal mirror of agent_mode's StateReport for parsing (only the fields
/// HttpEnv needs). `ui` is captured as raw JSON so UI-verb callers can inspect
/// it without HttpEnv depending on the `game` crate.
#[derive(Deserialize)]
struct StateReport {
    observation: Observation,
    ui: serde_json::Value,
}

pub struct HttpEnv {
    base: String,
    agent: ureq::Agent,
}

impl HttpEnv {
    pub fn new(base: impl Into<String>) -> Self {
        HttpEnv { base: base.into(), agent: ureq::Agent::new() }
    }

    fn get_state(&self) -> Result<StateReport, EnvError> {
        self.agent
            .get(&format!("{}/state", self.base))
            .timeout(Duration::from_secs(30))
            .call()
            .map_err(|e| EnvError::Backend(error_body(e)))?
            .into_json()
            .map_err(|e| EnvError::Backend(e.to_string()))
    }

    /// The raw `ui` object from the last `/state` (screen, fleet_travel, etc.).
    pub fn ui_state(&self) -> Result<serde_json::Value, EnvError> {
        Ok(self.get_state()?.ui)
    }

    /// Long-poll `/idle`; returns true when animation settled, false on timeout.
    pub fn wait_idle(&self, timeout_ms: u64) -> Result<bool, EnvError> {
        // The client must outlive the server long-poll: give it the server's
        // timeout plus a 5s grace so the connection never times out first.
        let v: serde_json::Value = self.agent
            .get(&format!("{}/idle?timeout_ms={timeout_ms}", self.base))
            .timeout(Duration::from_millis(timeout_ms) + Duration::from_secs(5))
            .call().map_err(|e| EnvError::Backend(error_body(e)))?
            .into_json().map_err(|e| EnvError::Backend(e.to_string()))?;
        Ok(v.get("idle").and_then(|b| b.as_bool()).unwrap_or(false))
    }

    /// Download the session's recorded core actions as a replay.
    pub fn replay(&self) -> Result<crate::replay::Replay, EnvError> {
        self.agent.get(&format!("{}/replay", self.base))
            .timeout(Duration::from_secs(30))
            .call()
            .map_err(|e| EnvError::Backend(error_body(e)))?
            .into_json().map_err(|e| EnvError::Backend(e.to_string()))
    }

    // -- UI verbs (inherent methods; not part of AgentEnv) ------------------

    pub fn goto(&self, screen: &str) -> Result<(), EnvError> { self.post_verb(serde_json::json!({ "Goto": screen })) }
    pub fn select_opponent(&self, user_id: u32) -> Result<(), EnvError> {
        self.post_verb(serde_json::json!({ "SelectOpponent": { "user_id": user_id } }))
    }
    pub fn launch_fleet(&self, user_id: u32, instant: bool) -> Result<(), EnvError> {
        self.post_verb(serde_json::json!({ "LaunchFleet": { "user_id": user_id, "instant": instant } }))
    }
    pub fn recall_fleet(&self) -> Result<(), EnvError> { self.post_verb(serde_json::json!("RecallFleet")) }
    pub fn skip_battle_animation(&self) -> Result<(), EnvError> { self.post_verb(serde_json::json!("SkipBattleAnimation")) }
    pub fn continue_after_battle(&self) -> Result<(), EnvError> { self.post_verb(serde_json::json!("ContinueAfterBattle")) }

    fn post_verb(&self, cmd: serde_json::Value) -> Result<(), EnvError> {
        self.agent.post(&format!("{}/act", self.base))
            .timeout(Duration::from_secs(30))
            .send_json(cmd)
            // A rejected verb (or transport failure) surfaces the server's own
            // error message rather than a generic ureq string.
            .map_err(|e| EnvError::Backend(error_body(e)))?;
        Ok(())
    }

    /// POST a Core action. On HTTP 200 returns `(true, StateReport)`. On HTTP
    /// 400 the backend *rejected* the command: parse the `{"error": ...}` body
    /// for the message and recover a fresh `/state` for the observation, then
    /// return `(false, report_with_error_status)` — so `act()` reports
    /// `ok == false` with the real rejection message, never a stale "success".
    fn post_core(&self, action: &Action) -> Result<(bool, StateReport), EnvError> {
        let cmd = serde_json::json!({ "Core": action });
        let resp = self.agent.post(&format!("{}/act", self.base))
            .timeout(Duration::from_secs(30))
            .send_json(cmd);
        match resp {
            Ok(r) => {
                let report: StateReport = r.into_json().map_err(|e| EnvError::Backend(e.to_string()))?;
                Ok((true, report))
            }
            // A 400 means the backend rejected the action. Read the error body
            // for the message, then fetch a fresh /state for the observation.
            Err(e @ ureq::Error::Status(400, _)) => {
                let msg = error_body(e);
                let mut report = self.get_state()?;
                // Surface the rejection on the observation the caller reads.
                report.observation.status = msg;
                report.observation.status_is_error = true;
                Ok((false, report))
            }
            // Any other status / transport error: surface the server's message.
            Err(e) => Err(EnvError::Backend(error_body(e))),
        }
    }
}

impl AgentEnv for HttpEnv {
    fn observe(&mut self) -> Result<Observation, EnvError> {
        Ok(self.get_state()?.observation)
    }
    fn legal_actions(&mut self) -> Result<Vec<Action>, EnvError> {
        self.agent.get(&format!("{}/actions", self.base))
            .timeout(Duration::from_secs(30))
            .call()
            .map_err(|e| EnvError::Backend(error_body(e)))?
            .into_json().map_err(|e| EnvError::Backend(e.to_string()))
    }
    fn act(&mut self, a: &Action) -> Result<ActionOutcome, EnvError> {
        let (accepted, report) = self.post_core(a)?;
        let obs = report.observation;
        // ok comes from the HTTP result (400 → rejected), not from stale state.
        let ok = accepted && !obs.status_is_error;
        Ok(ActionOutcome { ok, status: obs.status.clone(), observation: obs })
    }
}

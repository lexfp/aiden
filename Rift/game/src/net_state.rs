use log::error;
use network::client::Client;
use network::protocol::RemotePlayer;

/// Shared multiplayer state injected into the game context.
/// Player writes position each tick; Hud reads remote players for display.
pub struct NetState {
    client: Option<Client>,
    pub remote_players: Vec<RemotePlayer>,
    pub player_id: Option<u32>,
}

impl NetState {
    pub fn offline() -> Self {
        NetState { client: None, remote_players: Vec::new(), player_id: None }
    }

    pub fn connect(server_addr: &str, player_name: &str) -> Self {
        match Client::connect(server_addr, player_name) {
            Ok(client) => {
                let player_id = Some(client.player_id);
                NetState { client: Some(client), remote_players: Vec::new(), player_id }
            }
            Err(e) => {
                error!("Multiplayer connect failed: {} — running offline", e);
                NetState::offline()
            }
        }
    }

    /// Called by Player each tick: sends local position to server, receives current world state.
    pub fn sync(&mut self, x: f32, y: f32, z: f32, yaw: f32) {
        if let Some(ref client) = self.client {
            client.send_state(x, y, z, yaw);
            let all = client.remote_players();
            // Exclude local player from the remote list
            let local_id = self.player_id.unwrap_or(u32::MAX);
            self.remote_players = all.into_iter().filter(|p| p.id != local_id).collect();
        }
    }

    pub fn is_connected(&self) -> bool {
        self.client.is_some()
    }
}

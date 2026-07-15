//! Scripted AI agents. The original drives NPCs with a local LLM; here we use
//! simple deterministic decision logic so NPC fleets buy, repair, and fight on
//! their own to keep the world active.

use crate::ship::{self, OwnedShip, ShipStatus};
use crate::user::User;
use rand::Rng;

/// An action a bot wants to take this tick. The caller (server) executes it
/// against the shared world.
#[derive(Clone, Debug, PartialEq)]
pub enum BotAction {
    /// Earn credits via the rank's work assignment.
    Work,
    /// Buy the affordable ship with this catalog id.
    Buy { ship_id: u32 },
    /// Repair this owned ship (by ship number).
    Repair { ship_number: u32 },
    /// Activate this owned ship into the battle fleet.
    Activate { ship_number: u32 },
    /// Challenge another user to a battle.
    Attack { opponent_id: u32 },
    /// Do nothing this tick.
    Idle,
}

/// Decide the bot's next action from its own state and the list of potential
/// opponents. Priorities, in order:
/// 1. Repair a damaged active ship.
/// 2. Activate an idle owned ship if below the rank's active cap.
/// 3. Buy the best ship it can afford if it has spare credits and a free slot.
/// 4. Attack a random opponent if it has an active, healthy fleet.
/// 5. Otherwise work for credits.
pub fn decide(user: &User, fleet: &[OwnedShip], opponent_ids: &[u32], rng: &mut impl Rng) -> BotAction {
    // 1. Repair a damaged ship.
    if let Some(s) = fleet.iter().find(|s| s.status == ShipStatus::Active && s.needs_repair()) {
        return BotAction::Repair { ship_number: s.ship_number };
    }

    let active_count = fleet.iter().filter(|s| s.status == ShipStatus::Active).count() as u32;
    let max_active = user.rank.bonus().max_active_ships;

    // 2. Activate a reserve ship if there is room.
    if active_count < max_active {
        if let Some(s) = fleet.iter().find(|s| s.status == ShipStatus::Owned) {
            return BotAction::Activate { ship_number: s.ship_number };
        }
    }

    // 3. Buy the most expensive ship affordable, if a slot will be free for it.
    if active_count < max_active {
        let affordable = ship::catalog()
            .into_iter()
            .filter(|t| (t.stats.value as i64) <= user.currency_value)
            .max_by(|a, b| a.stats.value.partial_cmp(&b.stats.value).unwrap());
        if let Some(t) = affordable {
            // Keep a little reserve so bots don't perpetually spend to zero.
            if user.currency_value >= (t.stats.value as i64) + 500 {
                return BotAction::Buy { ship_id: t.ship_id };
            }
        }
    }

    // 4. Attack if it has a usable fleet and there is someone to fight.
    let has_ready_fleet = active_count > 0 && fleet.iter().any(|s| s.status == ShipStatus::Active && !s.needs_repair());
    if has_ready_fleet && !opponent_ids.is_empty() {
        let opponent_id = opponent_ids[rng.gen_range(0..opponent_ids.len())];
        return BotAction::Attack { opponent_id };
    }

    // 5. Fall back to working for credits.
    BotAction::Work
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ship::ShipStatus;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    fn owned(name: &str, num: u32, status: ShipStatus) -> OwnedShip {
        let t = ship::template_by_name(name).unwrap();
        let mut s = OwnedShip::from_template(num, &t);
        s.status = status;
        s
    }

    #[test]
    fn repairs_damaged_active_ship_first() {
        let u = User::new(1, "NPC_Bot");
        let mut s = owned("Falcon", 1, ShipStatus::Active);
        s.actual.hp = 1.0; // damaged
        let mut rng = StdRng::seed_from_u64(1);
        assert_eq!(decide(&u, &[s], &[2], &mut rng), BotAction::Repair { ship_number: 1 });
    }

    #[test]
    fn activates_reserve_ship_when_slot_free() {
        let u = User::new(1, "NPC_Bot"); // Recruit, 1 active slot
        let s = owned("Falcon", 1, ShipStatus::Owned);
        let mut rng = StdRng::seed_from_u64(1);
        assert_eq!(decide(&u, &[s], &[2], &mut rng), BotAction::Activate { ship_number: 1 });
    }

    #[test]
    fn attacks_when_fleet_ready() {
        let u = User::new(1, "NPC_Bot");
        let s = owned("Falcon", 1, ShipStatus::Active);
        let mut rng = StdRng::seed_from_u64(1);
        assert_eq!(decide(&u, &[s], &[2], &mut rng), BotAction::Attack { opponent_id: 2 });
    }

    #[test]
    fn works_when_broke_and_empty() {
        let mut u = User::new(1, "NPC_Bot");
        u.currency_value = 0;
        let mut rng = StdRng::seed_from_u64(1);
        assert_eq!(decide(&u, &[], &[2], &mut rng), BotAction::Work);
    }
}

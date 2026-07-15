//! The credit economy: buying and selling ships, repairs, and the rank-gated
//! work system.

use crate::rank::UserRank;
use crate::ship::{OwnedShip, ShipStatus, ShipTemplate};
use crate::user::User;
use crate::{SELL_VALUE_MULTIPLIER, WORK_VARIANCE_PERCENT};
use rand::Rng;

/// Outcome of an economy action.
pub type EconResult<T> = Result<T, String>;

/// Buy a ship from the catalog: checks funds, deducts the price, and returns a
/// freshly owned (status `Owned`) hull built from the template.
pub fn buy_ship(user: &mut User, template: &ShipTemplate, next_ship_number: u32) -> EconResult<OwnedShip> {
    let price = template.stats.value as i64;
    if user.currency_value < price {
        return Err("Not enough currency to buy this ship".into());
    }
    user.currency_value -= price;
    Ok(OwnedShip::from_template(next_ship_number, template))
}

/// Sell an owned ship, crediting `SELL_VALUE_MULTIPLIER` of its current value
/// and marking it sold. Returns the credits gained.
pub fn sell_ship(user: &mut User, ship: &mut OwnedShip) -> EconResult<i64> {
    if ship.status == ShipStatus::Destroyed || ship.status == ShipStatus::Sold {
        return Err("Owned ship not found or already sold".into());
    }
    let sell_value = (ship.actual.value * SELL_VALUE_MULTIPLIER) as i64;
    user.currency_value += sell_value;
    ship.status = ShipStatus::Sold;
    Ok(sell_value)
}

/// Activate a ship into the battle fleet, respecting the rank's active-ship cap.
/// `current_active` is the number of ships already active for this user.
pub fn activate_ship(user: &User, ship: &mut OwnedShip, current_active: u32) -> EconResult<()> {
    let max_allowed = user.rank.bonus().max_active_ships;
    if current_active >= max_allowed {
        return Err(format!(
            "Maximum active ships limit reached ({}/{}) for rank {}",
            current_active,
            max_allowed,
            user.rank.title()
        ));
    }
    if ship.status != ShipStatus::Owned {
        return Err("Owned ship not found or not available to activate".into());
    }
    ship.status = ShipStatus::Active;
    Ok(())
}

/// Move an active ship back to the reserve, freeing a slot.
pub fn deactivate_ship(ship: &mut OwnedShip) -> EconResult<()> {
    if ship.status != ShipStatus::Active {
        return Err("Active ship not found or not available to deactivate".into());
    }
    ship.status = ShipStatus::Owned;
    Ok(())
}

/// The work assignment for a rank.
pub fn work_type_for_rank(rank: UserRank) -> &'static str {
    match rank {
        UserRank::Recruit => "maintenance",
        UserRank::Ensign => "patrol",
        UserRank::Lieutenant => "trading",
        UserRank::LieutenantCommander => "escort",
        UserRank::Commander => "reconnaissance",
        UserRank::Captain | UserRank::Commodore => "command",
        UserRank::RearAdmiral | UserRank::ViceAdmiral | UserRank::Admiral | UserRank::FleetAdmiral => {
            "strategy"
        }
    }
}

/// Perform a work shift: credits the user with their rank's base income ±20%
/// variance and returns `(work_type, income_earned)`. Cooldown enforcement is
/// the caller's responsibility (it depends on real time / the DB).
pub fn perform_work(user: &mut User, rng: &mut impl Rng) -> (&'static str, i64) {
    let bonus = user.rank.bonus();
    let base = bonus.work_income;
    let variance = base as f64 * (WORK_VARIANCE_PERCENT / 100.0);
    let min_income = (base as f64 - variance) as i64;
    let max_income = (base as f64 + variance) as i64;
    let income = rng.gen_range(min_income..=max_income);
    user.currency_value += income;
    (work_type_for_rank(user.rank), income)
}

/// The work income range for a rank, for display: `(min, max)`.
pub fn work_income_range(rank: UserRank) -> (i64, i64) {
    let base = rank.bonus().work_income;
    let variance = base as f64 * 0.2;
    ((base as f64 - variance) as i64, (base as f64 + variance) as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ship;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    #[test]
    fn buying_deducts_currency() {
        let mut u = User::new(1, "Pilot");
        u.currency_value = 2000;
        let falcon = ship::template_by_name("Falcon").unwrap(); // value 1500
        let owned = buy_ship(&mut u, &falcon, 1).unwrap();
        assert_eq!(u.currency_value, 500);
        assert_eq!(owned.status, ShipStatus::Owned);
        assert_eq!(owned.ship_name, "Falcon");
    }

    #[test]
    fn buying_requires_funds() {
        let mut u = User::new(1, "Pilot");
        u.currency_value = 100;
        let falcon = ship::template_by_name("Falcon").unwrap();
        assert!(buy_ship(&mut u, &falcon, 1).is_err());
    }

    #[test]
    fn selling_returns_forty_percent() {
        let mut u = User::new(1, "Pilot");
        u.currency_value = 0;
        let falcon = ship::template_by_name("Falcon").unwrap();
        let mut owned = OwnedShip::from_template(1, &falcon); // value 1500
        let credits = sell_ship(&mut u, &mut owned).unwrap();
        assert_eq!(credits, 600); // 1500 * 0.4
        assert_eq!(owned.status, ShipStatus::Sold);
    }

    #[test]
    fn active_ship_cap_enforced_for_recruit() {
        let u = User::new(1, "Pilot"); // Recruit: max 1 active
        let falcon = ship::template_by_name("Falcon").unwrap();
        let mut owned = OwnedShip::from_template(1, &falcon);
        // One already active -> cannot activate another.
        assert!(activate_ship(&u, &mut owned, 1).is_err());
        // None active -> ok.
        assert!(activate_ship(&u, &mut owned, 0).is_ok());
        assert_eq!(owned.status, ShipStatus::Active);
    }

    #[test]
    fn work_pays_within_variance() {
        let mut u = User::new(1, "Pilot"); // Recruit: 700 base
        let mut rng = StdRng::seed_from_u64(42);
        let (work, income) = perform_work(&mut u, &mut rng);
        assert_eq!(work, "maintenance");
        assert!((560..=840).contains(&income)); // 700 ± 20%
        assert_eq!(u.currency_value, 2000 + income);
    }
}

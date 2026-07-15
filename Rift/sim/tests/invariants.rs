use proptest::prelude::*;
use rand::rngs::StdRng;
use rand::SeedableRng;
use sim::combat::{battle, Combatant};
use sim::economy;
use sim::elo::elo_change;
use sim::rank::{level_for_experience, UserRank};
use sim::ship::{self, OwnedShip, ShipStatus};
use sim::user::{Formation, User};

fn active(name: &str, num: u32) -> OwnedShip {
    let t = ship::template_by_name(name).unwrap();
    let mut s = OwnedShip::from_template(num, &t);
    s.status = ShipStatus::Active;
    s
}

fn formation_from_index(which: u8) -> Formation {
    match which % 3 {
        0 => Formation::Defensive,
        1 => Formation::Aggressive,
        _ => Formation::Tactical,
    }
}

/// A fleet of `size` active Falcons with distinct ship numbers starting at
/// `base_num` (so both sides can use non-overlapping numbers).
fn active_fleet(size: u32, base_num: u32) -> Vec<OwnedShip> {
    (0..size).map(|i| active("Falcon", base_num + i)).collect()
}

proptest! {
    // A battle from any seed leaves both players with non-negative credits and
    // every ship with non-negative HP. Both sides start at zero credits so the
    // non-negative-credits assertion actually bites (battle only *adds* credits,
    // so a positive starting balance would mask a wrongful deduction). We fuzz
    // each side's formation and fleet size (1-3 ships) as well as the seed.
    #[test]
    fn battle_never_produces_negative_credits_or_hp(
        seed in any::<u64>(),
        fa in 0u8..3,
        fb in 0u8..3,
        na in 1u32..=3,
        nb in 1u32..=3,
    ) {
        let mut a = User::new(1, "Alice");
        let mut b = User::new(2, "Bob");
        a.currency_value = 0;
        b.currency_value = 0;
        let mut fleet_a = active_fleet(na, 1);
        let mut fleet_b = active_fleet(nb, 100);
        let mut rng = StdRng::seed_from_u64(seed);
        let _ = battle(
            Combatant { user: &mut a, fleet: fleet_a.iter_mut().collect(), formation: formation_from_index(fa) },
            Combatant { user: &mut b, fleet: fleet_b.iter_mut().collect(), formation: formation_from_index(fb) },
            &mut rng,
        ).unwrap();
        prop_assert!(a.currency_value >= 0, "Alice credits went negative: {}", a.currency_value);
        prop_assert!(b.currency_value >= 0, "Bob credits went negative: {}", b.currency_value);
        for s in &fleet_a {
            prop_assert!(s.actual.hp >= 0.0, "Alice ship {} hp negative: {}", s.ship_number, s.actual.hp);
        }
        for s in &fleet_b {
            prop_assert!(s.actual.hp >= 0.0, "Bob ship {} hp negative: {}", s.ship_number, s.actual.hp);
        }
    }

    // ELO transfer sums to (approximately) zero for any ratings.
    #[test]
    fn elo_is_zero_sum(w in 100.0f64..3000.0, l in 100.0f64..3000.0) {
        let (nw, nl) = elo_change(w, l);
        let delta = (nw - w) + (nl - l);
        prop_assert!(delta.abs() < 1e-6, "elo not zero-sum: delta={delta}");
    }

    // level_for_experience is monotonic non-decreasing in experience.
    #[test]
    fn level_is_monotonic(x in 0i64..2_000_000, step in 1i64..100_000) {
        let l0 = level_for_experience(x);
        let l1 = level_for_experience(x + step);
        prop_assert!(l1 >= l0, "level decreased: {l0} -> {l1}");
    }

    // Work income always lands within the advertised range for the rank. We fuzz
    // the rank (via UserRank::ALL) and the RNG seed.
    #[test]
    fn work_income_within_advertised_range(rank_idx in 0usize..11, seed in any::<u64>()) {
        let rank = UserRank::ALL[rank_idx];
        let mut user = User::new(1, "Worker");
        user.rank = rank;
        let (min, max) = economy::work_income_range(rank);
        let (_work, income) = economy::perform_work(&mut user, &mut StdRng::seed_from_u64(seed));
        prop_assert!(
            (min..=max).contains(&income),
            "income {income} out of range [{min}, {max}] for {:?}",
            rank
        );
    }
}

// Formation evasion modifier is always within the documented bounds. Only three
// variants exist, so an exhaustive check is clearer than a proptest.
#[test]
fn formation_modifier_bounded() {
    for f in [Formation::Defensive, Formation::Aggressive, Formation::Tactical] {
        let m = f.evasion_modifier();
        assert!((0.9..=1.2).contains(&m), "modifier out of bounds: {m}");
    }
}

#[test]
fn catalog_tiers_do_not_price_below_lower_tiers() {
    // The cheapest ship of each tier is at least as expensive as the most
    // expensive ship of the tier below it (tier/price ordering holds).
    let cat = ship::catalog();
    for tier in 2u8..=6 {
        let min_this = cat.iter().filter(|t| t.tier == tier).map(|t| t.stats.value).fold(f64::INFINITY, f64::min);
        let max_below = cat.iter().filter(|t| t.tier == tier - 1).map(|t| t.stats.value).fold(0.0, f64::max);
        assert!(min_this > max_below, "tier {tier} cheapest {min_this} !> tier {} dearest {max_below}", tier - 1);
    }
}

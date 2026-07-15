//! Battle resolution: 1v1 through 20v20 fleet engagements with tactical
//! formations, per-round fire, evasion, shield-reduced damage, post-battle ship
//! degradation, and the credit/ELO/XP awards that follow.

use crate::boarding::{BoardingOutcome, Subsystem};
use crate::elo::elo_change;
use crate::ship::{OwnedShip, ShipStatus};
use crate::user::{Formation, User};
use crate::{
    BASE_XP_LOSS, BASE_XP_WIN, BOARDING_CORE_HP_FRAC, BOARDING_ENGINES_EVASION_MULT, BOARDING_SHIELDS_MULT,
    BOARDING_WEAPONS_ATTACK_MULT, BOARDING_XP_PER_SUBSYSTEM, CREDITS_AWARDED_MULTIPLIER, DAMAGE_VARIATION_MAX,
    DAMAGE_VARIATION_MIN, SHIELD_DAMAGE_REDUCTION, XP_HIGHER_LEVEL, XP_LOWER_LEVEL, XP_MIN_MULTIPLIER,
};
use rand::Rng;

/// One side of a battle: the user, the active ships they are fielding, and the
/// chosen formation.
pub struct Combatant<'a> {
    pub user: &'a mut User,
    pub fleet: Vec<&'a mut OwnedShip>,
    pub formation: Formation,
}

/// The result of a resolved battle. The combatants' `User` and `OwnedShip`
/// records are mutated in place; this report summarizes what happened.
#[derive(Clone, Debug)]
pub struct BattleReport {
    pub log: Vec<String>,
    pub winner_nickname: String,
    pub loser_nickname: String,
    pub total_damage1: f64,
    pub total_damage2: f64,
    pub ships_lost_by_user1: u32,
    pub ships_lost_by_user2: u32,
    pub credits_awarded: i64,
    pub message: String,
}

/// A ship's transient battle state: enhanced (rank-bonused) stats plus the HP
/// remaining this fight. `fleet_idx` points back into the owner's fleet vector.
struct CombatShip {
    fleet_idx: usize,
    ship_name: String,
    attack: f64,
    shield: f64,
    evasion: f64,
    fire_rate: f64,
    enhanced_hp: f64,
    value: f64,
    current_hp: f64,
}

/// XP gain for winner and loser, scaled by level difference: fighting up is
/// worth more, fighting down less (floored at 30%).
fn xp_gain(winner_level: i64, loser_level: i64) -> (i64, i64) {
    let level_diff = (loser_level - winner_level) as f64;
    let multiplier = if level_diff > 0.0 {
        1.0 + level_diff * XP_HIGHER_LEVEL
    } else if level_diff < 0.0 {
        (1.0 + level_diff * XP_LOWER_LEVEL).max(XP_MIN_MULTIPLIER)
    } else {
        1.0
    };
    let winner_xp = (BASE_XP_WIN as f64 * multiplier) as i64;
    let loser_xp = (BASE_XP_LOSS as f64 * multiplier) as i64;
    (winner_xp, loser_xp)
}

/// Build the enhanced (rank-bonused) battle stats for a side's active ships.
fn enhance_fleet(combatant: &Combatant) -> Vec<CombatShip> {
    let bonus = combatant.user.rank.bonus();
    combatant
        .fleet
        .iter()
        .enumerate()
        .filter(|(_, s)| s.status == ShipStatus::Active)
        .map(|(idx, ship)| {
            let enhanced = bonus.apply_to(ship.actual);
            CombatShip {
                fleet_idx: idx,
                ship_name: ship.ship_name.clone(),
                attack: enhanced.attack,
                shield: enhanced.shield,
                evasion: enhanced.evasion,
                fire_rate: enhanced.fire_rate,
                enhanced_hp: enhanced.hp,
                value: enhanced.value,
                current_hp: enhanced.hp,
            }
        })
        .collect()
}

/// Pick a target from the live enemy ships per the attacker's formation:
/// DEFENSIVE finishes the weakest (lowest HP), TACTICAL eliminates the biggest
/// threat (highest attack), AGGRESSIVE spreads damage at random. Returns an
/// index into `live`.
fn select_target(formation: Formation, live: &[usize], ships: &[CombatShip], rng: &mut impl Rng) -> usize {
    match formation {
        Formation::Defensive => *live
            .iter()
            .min_by(|&&a, &&b| ships[a].current_hp.partial_cmp(&ships[b].current_hp).unwrap())
            .unwrap(),
        Formation::Tactical => *live
            .iter()
            .max_by(|&&a, &&b| ships[a].attack.partial_cmp(&ships[b].attack).unwrap())
            .unwrap(),
        Formation::Aggressive => live[rng.gen_range(0..live.len())],
    }
}

/// One side's attacking pass over the other. Returns the total damage dealt.
/// `live` is the list of still-alive indices for both fleets; it is updated as
/// ships die. Appends to the battle log.
#[allow(clippy::too_many_arguments)]
fn attack_pass(
    attackers: &[CombatShip],
    attacker_live: &[usize],
    attacker_formation: Formation,
    attacker_name: &str,
    defenders: &mut [CombatShip],
    defender_live: &mut Vec<usize>,
    defender_formation: Formation,
    defender_name: &str,
    log: &mut Vec<String>,
    rng: &mut impl Rng,
) -> f64 {
    let mut total_damage = 0.0;
    for &att_idx in attacker_live {
        if defender_live.is_empty() {
            break;
        }
        // `select_target` returns a ship index (a value from `defender_live`),
        // used directly to index into `defenders`.
        let target_idx = select_target(attacker_formation, defender_live, defenders, rng);

        // The defender's formation modifies its own evasion.
        let target_evasion = defenders[target_idx].evasion * defender_formation.evasion_modifier();

        let shots = attackers[att_idx].fire_rate as i64; // truncates, as in the original
        for _ in 0..shots {
            if defenders[target_idx].current_hp <= 0.0 {
                break;
            }
            if rng.gen::<f64>() < target_evasion {
                log.push(format!(
                    "{} ({}) evaded attack from {} ({})!",
                    defenders[target_idx].ship_name, defender_name, attackers[att_idx].ship_name, attacker_name
                ));
                continue;
            }
            let base_damage = attackers[att_idx].attack - defenders[target_idx].shield * SHIELD_DAMAGE_REDUCTION;
            let damage = (base_damage * rng.gen_range(DAMAGE_VARIATION_MIN..DAMAGE_VARIATION_MAX)).max(1.0);
            defenders[target_idx].current_hp -= damage;
            total_damage += damage;
            log.push(format!(
                "{} ({}) hits {} ({}) for {:.1} damage! HP: {:.1}",
                attackers[att_idx].ship_name,
                attacker_name,
                defenders[target_idx].ship_name,
                defender_name,
                damage,
                defenders[target_idx].current_hp.max(0.0)
            ));
            if defenders[target_idx].current_hp <= 0.0 {
                log.push(format!("{} destroyed!", defenders[target_idx].ship_name));
                defender_live.retain(|&i| i != target_idx);
                break;
            }
        }
    }
    total_damage
}

/// Apply post-battle outcomes to one side's owned ships: destroyed ships are
/// zeroed, surviving human ships degrade proportionally to HP lost, and NPC
/// ships restore to full. Mirrors the original degradation rules.
fn apply_degradation(combat: &[CombatShip], fleet: &mut [&mut OwnedShip], is_npc: bool) {
    for cs in combat {
        let ship = &mut fleet[cs.fleet_idx];
        if cs.current_hp <= 0.0 {
            ship.status = ShipStatus::Destroyed;
            ship.actual.hp = 0.0;
            ship.actual.attack = 0.0;
            ship.actual.shield = 0.0;
            ship.actual.evasion = 0.0;
            ship.actual.fire_rate = 0.0;
            ship.actual.value = 0.0;
        } else if !is_npc {
            // Surviving human ship: scale base stats by the fraction of enhanced
            // HP remaining (the proportion of damage taken).
            let damage_percent = if cs.enhanced_hp > 0.0 {
                (cs.current_hp / cs.enhanced_hp).max(0.0)
            } else {
                0.0
            };
            ship.actual.hp = (ship.base.hp * damage_percent).max(0.0);
            ship.actual.attack = ship.base.attack * damage_percent;
            ship.actual.shield = ship.base.shield * damage_percent;
            ship.actual.evasion = ship.base.evasion * damage_percent;
            ship.actual.fire_rate = ship.base.fire_rate * damage_percent;
            ship.actual.value = (ship.base.value * damage_percent).round();
        } else {
            // Surviving NPC ship: restore to full base condition.
            ship.actual = ship.base;
        }
    }
}

/// Restore destroyed NPC ships back to active full condition, as the original does.
fn restore_destroyed_npc(combat: &[CombatShip], fleet: &mut [&mut OwnedShip]) {
    for cs in combat {
        let ship = &mut fleet[cs.fleet_idx];
        if ship.status == ShipStatus::Destroyed {
            ship.status = ShipStatus::Active;
            ship.actual = ship.base;
        }
    }
}

/// Weaken the defender's transient battle stats per the boarding raid's
/// outcome. Only `CombatShip`s are touched — persisted `OwnedShip` stats stay
/// intact, so post-battle degradation math is unaffected.
fn apply_boarding(outcome: &BoardingOutcome, defenders: &mut [CombatShip]) {
    for subsystem in &outcome.destroyed {
        match subsystem {
            Subsystem::Engines => {
                for s in defenders.iter_mut() {
                    s.evasion *= BOARDING_ENGINES_EVASION_MULT;
                }
            }
            Subsystem::ShieldGenerator => {
                for s in defenders.iter_mut() {
                    s.shield *= BOARDING_SHIELDS_MULT;
                }
            }
            Subsystem::WeaponsBay => {
                for s in defenders.iter_mut() {
                    s.attack *= BOARDING_WEAPONS_ATTACK_MULT;
                }
            }
            Subsystem::ReactorCore => {
                // The flagship: highest enhanced value (ties → first).
                if let Some(flagship) = defenders
                    .iter_mut()
                    .max_by(|a, b| a.value.partial_cmp(&b.value).unwrap_or(std::cmp::Ordering::Equal))
                {
                    flagship.current_hp = flagship.enhanced_hp * BOARDING_CORE_HP_FRAC;
                }
            }
        }
    }
}

/// Resolve a battle between two combatants. Mutates both users' stats and their
/// ships in place; returns a [`BattleReport`]. Returns `Err` if either side has
/// no active ships.
pub fn battle(c1: Combatant, c2: Combatant, rng: &mut impl Rng) -> Result<BattleReport, String> {
    battle_with_boarding(c1, c2, None, rng)
}

/// [`battle`], preceded by an optional boarding raid by `c1` (the attacker)
/// against `c2`'s flagship. The sanitized outcome weakens `c2`'s fleet before
/// round 1 and awards the attacker bonus XP per destroyed subsystem.
pub fn battle_with_boarding(
    c1: Combatant,
    c2: Combatant,
    boarding: Option<&BoardingOutcome>,
    rng: &mut impl Rng,
) -> Result<BattleReport, String> {
    let boarding = boarding.map(|b| b.sanitized()).filter(|b| !b.is_noop());
    let Combatant { user: user1, fleet: mut fleet1, formation: f1 } = c1;
    let Combatant { user: user2, fleet: mut fleet2, formation: f2 } = c2;

    if user1.user_id == user2.user_id {
        return Err("Same user battle not allowed".into());
    }

    let mut combat1 = enhance_fleet(&Combatant {
        // Re-borrow immutably for stat enhancement without moving the fleet.
        user: user1,
        fleet: fleet1.iter_mut().map(|s| &mut **s).collect(),
        formation: f1,
    });
    let mut combat2 = enhance_fleet(&Combatant {
        user: user2,
        fleet: fleet2.iter_mut().map(|s| &mut **s).collect(),
        formation: f2,
    });

    if combat1.is_empty() || combat2.is_empty() {
        return Err("No active ships found for battle".into());
    }

    let mut total_damage1 = 0.0;
    let mut total_damage2 = 0.0;

    let n1 = combat1.len();
    let n2 = combat2.len();
    let battle_type = if n1 == 1 && n2 == 1 { "1v1" } else { "Fleet" };
    let fleet_info = format!("({}v{})", n1, n2);

    let mut log = vec![
        format!("{} Battle {} started: {} vs {}", battle_type, fleet_info, user1.nickname, user2.nickname),
        format!("{} formation: {} ({} ships)", user1.nickname, f1.as_str(), n1),
        format!("{} formation: {} ({} ships)", user2.nickname, f2.as_str(), n2),
    ];

    // A boarding raid weakens the defender before the first shot is fired.
    if let Some(outcome) = &boarding {
        log.extend(outcome.log_lines(&user2.nickname));
        apply_boarding(outcome, &mut combat2);
    }

    // Live-index lists, rebuilt each round from surviving ships.
    for round in 1..=20 {
        let mut live1: Vec<usize> = (0..combat1.len()).filter(|&i| combat1[i].current_hp > 0.0).collect();
        let mut live2: Vec<usize> = (0..combat2.len()).filter(|&i| combat2[i].current_hp > 0.0).collect();
        if live1.is_empty() || live2.is_empty() {
            break;
        }
        log.push(format!("--- Round {} ---", round));
        log.push(format!(
            "{}: {} ships active, {}: {} ships active",
            user1.nickname, live1.len(), user2.nickname, live2.len()
        ));

        // User1 attacks User2.
        total_damage1 += attack_pass(
            &combat1, &live1, f1, &user1.nickname, &mut combat2, &mut live2, f2, &user2.nickname, &mut log, rng,
        );
        if live2.is_empty() {
            break;
        }
        // User2 attacks User1.
        total_damage2 += attack_pass(
            &combat2, &live2, f2, &user2.nickname, &mut combat1, &mut live1, f1, &user1.nickname, &mut log, rng,
        );
    }

    // Determine the winner: last fleet standing, then total damage, then more
    // survivors, then a coin flip.
    let survivors1 = combat1.iter().filter(|s| s.current_hp > 0.0).count();
    let survivors2 = combat2.iter().filter(|s| s.current_hp > 0.0).count();

    // 1 => user1 wins, 2 => user2 wins.
    let winner_side: u8 = if survivors1 > 0 && survivors2 == 0 {
        log.push(format!("{} wins! All enemy ships destroyed.", user1.nickname));
        1
    } else if survivors2 > 0 && survivors1 == 0 {
        log.push(format!("{} wins! All enemy ships destroyed.", user2.nickname));
        2
    } else if total_damage1 > total_damage2 {
        log.push(format!("{} wins by total damage! ({:.1} vs {:.1})", user1.nickname, total_damage1, total_damage2));
        1
    } else if total_damage2 > total_damage1 {
        log.push(format!("{} wins by total damage! ({:.1} vs {:.1})", user2.nickname, total_damage2, total_damage1));
        2
    } else if survivors1 > survivors2 {
        log.push(format!("{} wins by more surviving ships!", user1.nickname));
        1
    } else if survivors2 > survivors1 {
        log.push(format!("{} wins by more surviving ships!", user2.nickname));
        2
    } else if rng.gen::<bool>() {
        log.push(format!("{} wins by chance in a perfect tie!", user1.nickname));
        1
    } else {
        log.push(format!("{} wins by chance in a perfect tie!", user2.nickname));
        2
    };

    // Apply degradation and tally destroyed ships.
    let is_npc1 = user1.is_npc();
    let is_npc2 = user2.is_npc();

    let ships_lost_by_user1 = combat1.iter().filter(|s| s.current_hp <= 0.0).count() as u32;
    let ships_lost_by_user2 = combat2.iter().filter(|s| s.current_hp <= 0.0).count() as u32;

    apply_degradation(&combat1, &mut fleet1, is_npc1);
    apply_degradation(&combat2, &mut fleet2, is_npc2);
    if is_npc1 {
        restore_destroyed_npc(&combat1, &mut fleet1);
    }
    if is_npc2 {
        restore_destroyed_npc(&combat2, &mut fleet2);
    }

    // Statistics.
    user1.damage_dealt += total_damage1;
    user1.damage_taken += total_damage2;
    user2.damage_dealt += total_damage2;
    user2.damage_taken += total_damage1;
    user1.ships_destroyed_by_user += ships_lost_by_user2 as i64;
    user1.ships_lost_by_user += ships_lost_by_user1 as i64;
    user2.ships_destroyed_by_user += ships_lost_by_user1 as i64;
    user2.ships_lost_by_user += ships_lost_by_user2 as i64;

    if winner_side == 1 {
        user1.victories += 1;
        user2.defeats += 1;
    } else {
        user2.victories += 1;
        user1.defeats += 1;
    }

    // Credits: the (human) winner earns 10% of the loser fleet's enhanced value.
    let mut credits_awarded = 0;
    let winner_is_npc = if winner_side == 1 { is_npc1 } else { is_npc2 };
    if !winner_is_npc {
        let loser_value: f64 = if winner_side == 1 {
            combat2.iter().map(|s| s.value).sum()
        } else {
            combat1.iter().map(|s| s.value).sum()
        };
        credits_awarded = (loser_value * CREDITS_AWARDED_MULTIPLIER) as i64;
        if winner_side == 1 {
            user1.currency_value += credits_awarded;
            log.push(format!("{} awarded {} credits!", user1.nickname, credits_awarded));
        } else {
            user2.currency_value += credits_awarded;
            log.push(format!("{} awarded {} credits!", user2.nickname, credits_awarded));
        }
    }

    // ELO.
    let (winner_level, loser_level) = if winner_side == 1 {
        (user1.level, user2.level)
    } else {
        (user2.level, user1.level)
    };
    let (winner_elo, loser_elo) = if winner_side == 1 {
        (user1.elo_rank, user2.elo_rank)
    } else {
        (user2.elo_rank, user1.elo_rank)
    };
    let (new_winner_elo, new_loser_elo) = elo_change(winner_elo, loser_elo);
    if winner_side == 1 {
        user1.elo_rank = new_winner_elo;
        user2.elo_rank = new_loser_elo;
    } else {
        user2.elo_rank = new_winner_elo;
        user1.elo_rank = new_loser_elo;
    }

    // XP (NPCs gain none).
    let (winner_xp, loser_xp) = xp_gain(winner_level, loser_level);
    let (winner, loser): (&mut User, &mut User) = if winner_side == 1 {
        (user1, user2)
    } else {
        (user2, user1)
    };
    if !winner.is_npc() {
        winner.add_experience(winner_xp);
        log.push(format!("{} gains {} XP!", winner.nickname, winner_xp));
    }
    if !loser.is_npc() {
        loser.add_experience(loser_xp);
        log.push(format!("{} gains {} XP!", loser.nickname, loser_xp));
    }

    // Boarding bonus XP for the attacker (user1), win or lose.
    if let Some(outcome) = &boarding {
        let attacker: &mut User = if winner_side == 1 { winner } else { loser };
        if !attacker.is_npc() {
            let bonus = BOARDING_XP_PER_SUBSYSTEM * outcome.destroyed.len() as i64;
            attacker.add_experience(bonus);
            log.push(format!("{} gains {} bonus XP for the boarding raid!", attacker.nickname, bonus));
        }
    }

    let (winner_nickname, loser_nickname) = (winner.nickname.clone(), loser.nickname.clone());
    let message = format!("{} wins the {} battle {}!", winner_nickname, battle_type.to_lowercase(), fleet_info);

    Ok(BattleReport {
        log,
        winner_nickname,
        loser_nickname,
        total_damage1,
        total_damage2,
        ships_lost_by_user1,
        ships_lost_by_user2,
        credits_awarded,
        message,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ship::{self, OwnedShip, ShipStatus};
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    fn active_ship(name: &str, num: u32) -> OwnedShip {
        let t = ship::template_by_name(name).unwrap();
        let mut s = OwnedShip::from_template(num, &t);
        s.status = ShipStatus::Active;
        s
    }

    #[test]
    fn one_v_one_resolves_and_mutates_stats() {
        let mut u1 = User::new(1, "Alice");
        let mut u2 = User::new(2, "Bob");
        let mut s1 = active_ship("Hawk", 1); // glass cannon
        let mut s2 = active_ship("Eagle", 2); // tank
        let mut rng = StdRng::seed_from_u64(7);

        let report = battle(
            Combatant { user: &mut u1, fleet: vec![&mut s1], formation: Formation::Aggressive },
            Combatant { user: &mut u2, fleet: vec![&mut s2], formation: Formation::Aggressive },
            &mut rng,
        )
        .unwrap();

        assert!(report.winner_nickname == "Alice" || report.winner_nickname == "Bob");
        // Exactly one win and one loss recorded.
        assert_eq!(u1.victories + u2.victories, 1);
        assert_eq!(u1.defeats + u2.defeats, 1);
        // The winner gained XP (left Recruit only if enough, but at least some).
        let winner_xp = if report.winner_nickname == "Alice" { u1.experience } else { u2.experience };
        assert!(winner_xp > 0);
    }

    #[test]
    fn npc_ships_restore_after_battle() {
        let mut human = User::new(1, "Alice");
        let mut npc = User::new(2, "NPC_Astro");
        let mut hs = active_ship("Phoenix", 1); // strong, should win
        let mut ns = active_ship("Falcon", 2); // weak NPC ship
        let base_hp = ns.base.hp;
        let mut rng = StdRng::seed_from_u64(1);

        battle(
            Combatant { user: &mut human, fleet: vec![&mut hs], formation: Formation::Aggressive },
            Combatant { user: &mut npc, fleet: vec![&mut ns], formation: Formation::Aggressive },
            &mut rng,
        )
        .unwrap();

        // NPC ship is restored to full and active regardless of outcome.
        assert_eq!(ns.actual.hp, base_hp);
        assert_eq!(ns.status, ShipStatus::Active);
        // NPC earns no currency even if it wins.
        assert_eq!(npc.currency_value, 2000);
    }

    #[test]
    fn multi_ship_fleet_battle_resolves_for_every_formation() {
        // Regression: target selection must index ships correctly with fleets
        // larger than one (a 1v1 masks an off-by-one in target indexing).
        let names = ["Falcon", "Hawk", "Eagle", "Swift", "Condor", "Sparrow", "Raven"];
        for &f1 in &[Formation::Aggressive, Formation::Defensive, Formation::Tactical] {
            for &f2 in &[Formation::Aggressive, Formation::Defensive, Formation::Tactical] {
                let mut a = User::new(1, "Alice");
                let mut b = User::new(2, "Bob");
                let mut a_ships: Vec<OwnedShip> = names.iter().enumerate().map(|(i, n)| active_ship(n, i as u32 + 1)).collect();
                let mut b_ships: Vec<OwnedShip> = names.iter().enumerate().map(|(i, n)| active_ship(n, i as u32 + 100)).collect();
                let mut rng = StdRng::seed_from_u64(99);
                let report = battle(
                    Combatant { user: &mut a, fleet: a_ships.iter_mut().collect(), formation: f1 },
                    Combatant { user: &mut b, fleet: b_ships.iter_mut().collect(), formation: f2 },
                    &mut rng,
                )
                .unwrap();
                assert!(report.winner_nickname == "Alice" || report.winner_nickname == "Bob");
            }
        }
    }

    #[test]
    fn boarding_modifiers_hit_exactly_the_intended_stats() {
        let mk = |value: f64| CombatShip {
            fleet_idx: 0,
            ship_name: "S".into(),
            attack: 100.0,
            shield: 80.0,
            evasion: 0.4,
            fire_rate: 2.0,
            enhanced_hp: 500.0,
            value,
            current_hp: 500.0,
        };
        let mut fleet = vec![mk(100.0), mk(300.0), mk(200.0)];
        apply_boarding(
            &BoardingOutcome {
                destroyed: vec![
                    Subsystem::Engines,
                    Subsystem::ShieldGenerator,
                    Subsystem::WeaponsBay,
                    Subsystem::ReactorCore,
                ],
                duration_secs: 60.0,
                extracted: true,
            },
            &mut fleet,
        );
        for s in &fleet {
            assert!((s.evasion - 0.4 * crate::BOARDING_ENGINES_EVASION_MULT).abs() < 1e-9);
            assert!((s.shield - 80.0 * crate::BOARDING_SHIELDS_MULT).abs() < 1e-9);
            assert!((s.attack - 100.0 * crate::BOARDING_WEAPONS_ATTACK_MULT).abs() < 1e-9);
            assert_eq!(s.enhanced_hp, 500.0, "enhanced_hp must never change");
        }
        // Only the flagship (highest value, index 1) lost HP to the core blast.
        assert!((fleet[1].current_hp - 500.0 * crate::BOARDING_CORE_HP_FRAC).abs() < 1e-9);
        assert_eq!(fleet[0].current_hp, 500.0);
        assert_eq!(fleet[2].current_hp, 500.0);
    }

    #[test]
    fn full_boarding_flips_an_otherwise_lost_battle() {
        let seed = 5;
        let run = |boarding: Option<&BoardingOutcome>| {
            let mut u1 = User::new(1, "Alice");
            let mut u2 = User::new(2, "Bob");
            let mut s1 = active_ship("Falcon", 1); // outgunned scout
            let mut s2 = active_ship("Hawk", 2); // same tier, but wins on stats
            let mut rng = StdRng::seed_from_u64(seed);
            battle_with_boarding(
                Combatant { user: &mut u1, fleet: vec![&mut s1], formation: Formation::Aggressive },
                Combatant { user: &mut u2, fleet: vec![&mut s2], formation: Formation::Aggressive },
                boarding,
                &mut rng,
            )
            .unwrap()
        };
        let without = run(None);
        assert_eq!(without.winner_nickname, "Bob", "baseline: the stronger fleet wins");
        let all_four = BoardingOutcome {
            destroyed: vec![
                Subsystem::Engines,
                Subsystem::ShieldGenerator,
                Subsystem::WeaponsBay,
                Subsystem::ReactorCore,
            ],
            duration_secs: 80.0,
            extracted: true,
        };
        let with = run(Some(&all_four));
        assert_eq!(with.winner_nickname, "Alice", "a perfect raid flips the fight");
        assert!(with.log.iter().any(|l| l.contains("Boarding raid")));
    }

    #[test]
    fn boarding_bonus_xp_is_awarded_to_the_attacker() {
        let mut u1 = User::new(1, "Alice");
        let mut u2 = User::new(2, "Bob");
        let mut s1 = active_ship("Falcon", 1);
        let mut s2 = active_ship("Hawk", 2);
        let mut rng = StdRng::seed_from_u64(3);
        let outcome = BoardingOutcome {
            destroyed: vec![Subsystem::Engines, Subsystem::ReactorCore],
            duration_secs: 45.0,
            extracted: true,
        };
        let report = battle_with_boarding(
            Combatant { user: &mut u1, fleet: vec![&mut s1], formation: Formation::Aggressive },
            Combatant { user: &mut u2, fleet: vec![&mut s2], formation: Formation::Aggressive },
            Some(&outcome),
            &mut rng,
        )
        .unwrap();
        let bonus = crate::BOARDING_XP_PER_SUBSYSTEM * 2;
        assert!(report.log.iter().any(|l| l.contains(&format!("{} bonus XP", bonus))));
    }

    #[test]
    fn noop_boarding_is_bit_identical_to_plain_battle() {
        let run = |boarding: Option<&BoardingOutcome>| {
            let mut u1 = User::new(1, "Alice");
            let mut u2 = User::new(2, "Bob");
            let mut s1 = active_ship("Hawk", 1);
            let mut s2 = active_ship("Eagle", 2);
            let mut rng = StdRng::seed_from_u64(11);
            battle_with_boarding(
                Combatant { user: &mut u1, fleet: vec![&mut s1], formation: Formation::Tactical },
                Combatant { user: &mut u2, fleet: vec![&mut s2], formation: Formation::Defensive },
                boarding,
                &mut rng,
            )
            .unwrap()
        };
        let plain = run(None);
        let noop = run(Some(&BoardingOutcome::default()));
        assert_eq!(plain.log, noop.log);
        assert_eq!(plain.winner_nickname, noop.winner_nickname);
        assert_eq!(plain.total_damage1, noop.total_damage1);
        assert_eq!(plain.total_damage2, noop.total_damage2);
    }

    #[test]
    fn rejects_empty_fleet() {
        let mut u1 = User::new(1, "Alice");
        let mut u2 = User::new(2, "Bob");
        let mut s2 = active_ship("Eagle", 2);
        let mut rng = StdRng::seed_from_u64(1);
        let res = battle(
            Combatant { user: &mut u1, fleet: vec![], formation: Formation::Aggressive },
            Combatant { user: &mut u2, fleet: vec![&mut s2], formation: Formation::Aggressive },
            &mut rng,
        );
        assert!(res.is_err());
    }
}

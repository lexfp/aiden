//! Ships: the static catalog of buildable hulls, and the per-instance owned-ship
//! records players keep in their hangar.

use serde::{Deserialize, Serialize};

/// The combat-relevant numbers shared by templates and owned-ship instances.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct ShipStats {
    pub attack: f64,
    pub shield: f64,
    /// Chance to dodge an incoming hit, 0.0–1.0.
    pub evasion: f64,
    pub fire_rate: f64,
    pub hp: f64,
    pub value: f64,
}

/// A ship type that can be purchased. The catalog below is the fixed roster.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ShipTemplate {
    pub ship_id: u32,
    pub name: String,
    pub tier: u8,
    pub series: String,
    pub stats: ShipStats,
}

/// Lifecycle of an individual owned ship.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShipStatus {
    Owned,
    Active,
    Destroyed,
    Sold,
}

impl ShipStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            ShipStatus::Owned => "owned",
            ShipStatus::Active => "active",
            ShipStatus::Destroyed => "destroyed",
            ShipStatus::Sold => "sold",
        }
    }
}

/// A specific hull a player owns. Keeps the original `base` stats from purchase
/// plus the `actual` stats, which degrade with battle damage and are restored by
/// the shipyard.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OwnedShip {
    pub ship_number: u32,
    pub ship_id: u32,
    pub ship_name: String,
    pub status: ShipStatus,
    pub base: ShipStats,
    pub actual: ShipStats,
}

impl OwnedShip {
    /// Build a freshly purchased ship from a catalog template.
    pub fn from_template(ship_number: u32, template: &ShipTemplate) -> Self {
        OwnedShip {
            ship_number,
            ship_id: template.ship_id,
            ship_name: template.name.clone(),
            status: ShipStatus::Owned,
            base: template.stats,
            actual: template.stats,
        }
    }

    /// True if any current stat has dropped below its original value.
    pub fn needs_repair(&self) -> bool {
        self.actual.attack < self.base.attack
            || self.actual.shield < self.base.shield
            || self.actual.hp < self.base.hp
            || self.actual.fire_rate < self.base.fire_rate
            || self.actual.evasion < self.base.evasion
    }

    /// Restore all current stats to their original values.
    pub fn repair(&mut self) {
        self.actual = self.base;
    }
}

/// `(name, attack, shield, evasion, fire_rate, hp, value, tier, series)` —
/// the fixed roster. Each tier has five hulls following the same five archetypes:
/// balanced, glass cannon, tank, hit-and-run, bruiser.
const CATALOG: &[(&str, f64, f64, f64, f64, f64, f64, u8, &str)] = &[
    // Tier 1 — Birds of Prey (starter ships)
    ("Falcon", 12.0, 8.0, 0.05, 1.8, 1000.0, 1500.0, 1, "Birds of Prey"),
    ("Hawk", 18.0, 5.0, 0.03, 2.2, 800.0, 1800.0, 1, "Birds of Prey"),
    ("Eagle", 10.0, 15.0, 0.02, 1.5, 900.0, 1700.0, 1, "Birds of Prey"),
    ("Swift", 14.0, 6.0, 0.15, 3.0, 700.0, 1650.0, 1, "Birds of Prey"),
    ("Condor", 11.0, 10.0, 0.04, 1.6, 1400.0, 1600.0, 1, "Birds of Prey"),
    // Tier 2 — Raptor (light fighters)
    ("Sparrow", 20.0, 12.0, 0.08, 2.0, 1300.0, 3500.0, 2, "Raptor"),
    ("Kestrel", 30.0, 8.0, 0.05, 2.5, 1100.0, 4000.0, 2, "Raptor"),
    ("Osprey", 16.0, 22.0, 0.03, 1.7, 1200.0, 3800.0, 2, "Raptor"),
    ("Harrier", 22.0, 10.0, 0.18, 3.2, 1000.0, 3700.0, 2, "Raptor"),
    ("Raven", 18.0, 15.0, 0.06, 1.8, 1700.0, 3600.0, 2, "Raptor"),
    // Tier 3 — Storm (medium fighters)
    ("Breeze", 32.0, 18.0, 0.10, 2.2, 1600.0, 8000.0, 3, "Storm"),
    ("Lightning", 48.0, 12.0, 0.07, 2.8, 1400.0, 9000.0, 3, "Storm"),
    ("Thunder", 26.0, 35.0, 0.04, 1.9, 1500.0, 8500.0, 3, "Storm"),
    ("Tempest", 35.0, 15.0, 0.20, 3.5, 1300.0, 8200.0, 3, "Storm"),
    ("Storm", 30.0, 22.0, 0.08, 2.0, 2100.0, 8800.0, 3, "Storm"),
    // Tier 4 — Cosmic (heavy fighters)
    ("Comet", 45.0, 25.0, 0.12, 2.4, 2000.0, 18000.0, 4, "Cosmic"),
    ("Nova", 68.0, 16.0, 0.08, 3.0, 1800.0, 20000.0, 4, "Cosmic"),
    ("Meteor", 38.0, 48.0, 0.05, 2.1, 1900.0, 19000.0, 4, "Cosmic"),
    ("Pulsar", 50.0, 20.0, 0.22, 3.8, 1700.0, 18500.0, 4, "Cosmic"),
    ("Asteroid", 42.0, 30.0, 0.10, 2.2, 2600.0, 19500.0, 4, "Cosmic"),
    // Tier 5 — Galactic (elite ships)
    ("Galaxy", 60.0, 35.0, 0.15, 2.6, 2400.0, 45000.0, 5, "Galactic"),
    ("Quasar", 90.0, 22.0, 0.10, 3.2, 2200.0, 50000.0, 5, "Galactic"),
    ("Nebula", 48.0, 65.0, 0.06, 2.3, 2300.0, 48000.0, 5, "Galactic"),
    ("Vortex", 65.0, 25.0, 0.25, 4.0, 2100.0, 47000.0, 5, "Galactic"),
    ("Supernova", 55.0, 40.0, 0.12, 2.4, 3200.0, 52000.0, 5, "Galactic"),
    // Tier 6 — Legendary (endgame)
    ("Orion", 80.0, 50.0, 0.18, 2.8, 3000.0, 120000.0, 6, "Legendary"),
    ("Phoenix", 125.0, 30.0, 0.12, 3.5, 2800.0, 135000.0, 6, "Legendary"),
    ("Titan", 65.0, 95.0, 0.08, 2.5, 2900.0, 130000.0, 6, "Legendary"),
    ("Seraph", 85.0, 35.0, 0.28, 4.2, 2700.0, 125000.0, 6, "Legendary"),
    ("Leviathan", 75.0, 55.0, 0.15, 2.6, 4200.0, 140000.0, 6, "Legendary"),
];

/// The full ship roster, `ship_id` assigned 1-based in catalog order.
pub fn catalog() -> Vec<ShipTemplate> {
    CATALOG
        .iter()
        .enumerate()
        .map(|(i, &(name, attack, shield, evasion, fire_rate, hp, value, tier, series))| {
            ShipTemplate {
                ship_id: (i + 1) as u32,
                name: name.to_string(),
                tier,
                series: series.to_string(),
                stats: ShipStats { attack, shield, evasion, fire_rate, hp, value },
            }
        })
        .collect()
}

/// Look up a template by its 1-based catalog id.
pub fn template_by_id(ship_id: u32) -> Option<ShipTemplate> {
    catalog().into_iter().find(|t| t.ship_id == ship_id)
}

/// Look up a template by ship name.
pub fn template_by_name(name: &str) -> Option<ShipTemplate> {
    catalog().into_iter().find(|t| t.name == name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_has_thirty_ships_over_six_tiers() {
        let cat = catalog();
        assert_eq!(cat.len(), 30);
        for tier in 1..=6 {
            assert_eq!(cat.iter().filter(|t| t.tier == tier).count(), 5);
        }
    }

    #[test]
    fn falcon_is_the_starter_with_known_stats() {
        let falcon = template_by_name("Falcon").unwrap();
        assert_eq!(falcon.ship_id, 1);
        assert_eq!(falcon.stats.attack, 12.0);
        assert_eq!(falcon.stats.hp, 1000.0);
        assert_eq!(falcon.stats.value, 1500.0);
    }
}

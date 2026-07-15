//! ELO rating updates for ranked battles.

use crate::{ELO_BASE_CHANGE, ELO_EXPECTED_SCORE_DIVISOR};

/// Compute the new ratings for the winner and loser of a match, using the
/// standard ELO expected-score formula with a fixed K-factor.
pub fn elo_change(winner_elo: f64, loser_elo: f64) -> (f64, f64) {
    let expected_winner = 1.0 / (1.0 + 10f64.powf((loser_elo - winner_elo) / ELO_EXPECTED_SCORE_DIVISOR));
    let expected_loser = 1.0 / (1.0 + 10f64.powf((winner_elo - loser_elo) / ELO_EXPECTED_SCORE_DIVISOR));

    let winner_delta = ELO_BASE_CHANGE * (1.0 - expected_winner);
    let loser_delta = ELO_BASE_CHANGE * (0.0 - expected_loser);

    (winner_elo + winner_delta, loser_elo + loser_delta)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn equal_ratings_split_the_k_factor() {
        let (w, l) = elo_change(1000.0, 1000.0);
        // Even match: winner +16, loser -16.
        assert!((w - 1016.0).abs() < 1e-9);
        assert!((l - 984.0).abs() < 1e-9);
    }

    #[test]
    fn upset_win_moves_more_points() {
        let (w_under, _) = elo_change(800.0, 1200.0); // underdog wins
        let (w_fav, _) = elo_change(1200.0, 800.0); // favorite wins
        assert!(w_under - 800.0 > w_fav - 1200.0);
    }
}

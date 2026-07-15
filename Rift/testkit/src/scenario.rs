//! Load and run scenario files: named `Replay` JSON scripts with end-state
//! expectations, stored under `testkit/scenarios/`.

use crate::replay::{run_replay, Replay, ReplayResult};
use std::fs;
use std::path::Path;

/// A scenario file's name paired with the result of running (or loading) it.
pub type ScenarioOutcome = (String, Result<ReplayResult, String>);

/// Load every `*.json` file in `dir` (relative to the crate root at test time)
/// as a [`Replay`] and run it. Returns `(file_name, run_result)` pairs sorted
/// by file name so output is stable.
pub fn run_all_scenarios(dir: &str) -> Result<Vec<ScenarioOutcome>, String> {
    let mut paths: Vec<_> = fs::read_dir(Path::new(dir))
        .map_err(|e| format!("read_dir {dir}: {e}"))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
        .collect();
    paths.sort();

    let mut out = Vec::new();
    for path in paths {
        let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("?").to_string();
        // Fold a read failure into this file's Err instead of aborting the run.
        let result = match fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<Replay>(&text) {
                Ok(replay) => run_replay(&replay),
                Err(e) => Err(format!("parse {name}: {e}")),
            },
            Err(e) => Err(format!("read {name}: {e}")),
        };
        out.push((name, result));
    }
    Ok(out)
}

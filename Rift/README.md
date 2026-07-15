# Rift

A spaceship fleet-battle game built in pure Rust. Buy and refit warships, build a
fleet, pick a tactical formation, climb 11 military ranks, and battle other pilots
across a shared galaxy with ELO ranking — or play solo offline. Runs native on
Windows, macOS, and Linux.

## Workspace layout

- **`sim/`** — pure game rules: the 30-ship catalog, 11 ranks, combat resolution,
  economy, ELO, and progression. No I/O; fully unit-tested.
- **`network/`** — the wire protocol, the SQLite-backed authoritative `World`, the
  dedicated server (with a background bot tick), the RPC client, and a unified
  `GameApi` the UI talks to.
- **`game/`** — the native client UI (egui/eframe): hangar, market, work, battle,
  leaderboard, and history screens.
- **`src/main.rs`** — the `rift` binary: launches the client or the server.

## Running locally

```bash
cargo run --release                      # play online (shared galaxy)
cargo run --release -- --offline         # single-player, saved locally
cargo run --release -- --name Maverick   # set your pilot name
cargo run --release -- --connect 127.0.0.1:7777   # connect to a specific server
cargo run --release -- server            # run a dedicated server on port 7777
```

The offline save lives in your platform data directory (`Rift/save.db`).

## Tests

```bash
cargo test -p sim         # game-rule unit tests (combat, economy, ELO, ranks)
cargo test -p network     # world + full client/server round-trip over TCP
```

## Deploying the multiplayer server

The server is headless — no GPU or windowing libraries required. It persists the
shared galaxy to `rift-server.db`.

```bash
scripts/deploy.sh                  # build (headless) on the server, restart service
scripts/deploy.sh --no-build       # skip build, just restart the service
```

This rsyncs the source, installs Rust + a C toolchain (for bundled SQLite),
builds with `--no-default-features` (no client/GL), and installs the
`rift-server` systemd service on port 7777.

To tail server logs:

```bash
ssh -i ~/.ssh/aiden_key ubuntu@34.226.69.235 'journalctl -u rift-server -f'
```

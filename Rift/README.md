# Rift

A spaceship fleet-battle game built in pure Rust — **a mobile game for Android
and iPhone**. Buy and refit warships, build a fleet, pick a tactical formation,
climb 11 military ranks, and battle NPC admirals for the top of the
leaderboard. Everything runs on the phone and saves on the phone; no account,
no connection required.

Play it at **https://rift.rivi.us/play/** and add it to your home screen
(Android: Chrome ⋮ → "Add to Home screen"; iPhone: Safari Share → "Add to Home
Screen") — it installs full screen with its own icon and works offline.

## Workspace layout

- **`sim/`** — pure game rules: the 30-ship catalog, 11 ranks, combat resolution,
  economy, ELO, and progression. No I/O; fully unit-tested.
- **`network/`** — the wire protocol, the authoritative `World` (SQLite-backed on
  native, in-memory + JSON export on the phone), and a unified `GameApi` the UI
  talks to. The dedicated server and RPC client still live here for development.
- **`game/`** — the client UI (egui/eframe): hangar, market, work, battle,
  boarding, leaderboard, and history screens. Compiles both native (for
  development) and to WebAssembly (what ships).
- **`web/`** — the mobile build: the wasm entry point, localStorage save
  persistence, and the installable-app packaging (manifest, service worker,
  icons). Built with [Trunk](https://trunkrs.dev).
- **`src/main.rs`** — the `rift` binary: a desktop dev shell and the dedicated
  server. Development tooling only — the game ships to phones.

## Building the mobile game

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk --locked

cd web
trunk serve            # dev server on 0.0.0.0:8080 — open it from your phone
trunk build --release  # production bundle in web/dist/
```

To publish: copy `web/dist/` to the web server as `/play/` (e.g. into the nginx
web root on rift.rivi.us), then bump `CACHE` in `web/assets/sw.js` whenever you
deploy a new build so installed apps pick it up.

## Playtesting the UI natively (development only)

```bash
cargo run --release -- --offline         # same game, desktop window
cargo run --release -- --agent-mode      # HTTP control server for agent playtests
```

The offline dev save lives in your platform data directory (`Rift/save.db`).

## Tests

```bash
cargo test -p sim         # game-rule unit tests (combat, economy, ELO, ranks)
cargo test -p network     # world tests (both storage backends) + client/server round-trip
```

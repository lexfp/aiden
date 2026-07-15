# Agent-mode playtest guide

## Overview

Agent mode lets a Claude Code session (or any HTTP client) play the **real,
windowed** Rift client for exploratory QA. When you launch with `--agent-mode`,
the game opens its normal window and *also* starts a small localhost HTTP control
surface. Every command you send runs on the UI thread through the **same code
paths the buttons use**, so agent play is visible in the window as it happens:
you can watch fleets travel and battles animate while you drive the game over
HTTP.

The session records the **core** actions it executes (register, work, buy,
battle, …) as a Phase-1 replay, so any bug you find while playing is downloadable
as a `run_replay`-able regression via `GET /replay`.

## Safety

- The server binds **`127.0.0.1` only** (never `0.0.0.0`). Nothing is exposed to
  the network.
- Default port is **`7878`**; override with `--agent-port N`.
- The server is **inert unless `--agent-mode` is passed** — a normal launch has
  no HTTP surface at all.

## Build & launch

On Windows, make sure cargo is on PATH first (fresh shells do not have it):

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
```

Then launch the windowed client with agent mode against a local offline save:

```
cargo run -- --agent-mode --offline --seed 42
```

- For a deterministic session, delete or rename the existing save first
  (`%LOCALAPPDATA%\Rift\save.db`) — registering on a reused world fails with
  name-taken and seed determinism doesn't hold.
- Use a **`--seed N`** so a saved `/replay` reproduces faithfully (see "Saving a
  bug report" below). Without a seed the replay carries `seed: 0` and replays
  against a *different* world.
- Add `--name Pilot` to prefill the login name.
- Override the port with `--agent-port 9000` if `7878` is taken.

## The loop

1. **Poll `GET /state`.** Read `ui.screen` (e.g. `"Login"`, `"Hangar"`,
   `"Galaxy"`) and `observation.status_is_error` to see whether the last action
   was rejected.
2. **List what you can do.** `GET /actions` returns the legal **core** actions
   (advisory). `ui.available_ui_verbs` in `/state` lists the **UI verbs**
   (e.g. `RefreshPlayer`, `RecallFleet`, `SkipBattleAnimation`,
   `ContinueAfterBattle`) — these are *not* core actions, so they never appear in
   `/actions`.
3. **Act.** `POST /act` a `UiCommand` (see the vocabulary in the curl examples).
   The response is the post-action `/state`.
4. **Wait after a launch.** After a `LaunchFleet`, call
   `GET /idle?timeout_ms=8000` to block until the travel + battle animation
   finishes before reading the result. It returns `{"idle": true}` when settled,
   `{"idle": false}` on timeout.
5. **Save a bug.** `GET /replay` whenever something looks wrong.

## Watching cooldowns decay

Time-based fields like `observation.player.work_cooldown_remaining` only refresh
when a snapshot is re-fetched. `POST /act '"RefreshPlayer"'` re-fetches the
player snapshot (backend `snapshot()` → `apply_snapshot`) **without a mutating
action**, so an agent can poll it until `work_cooldown_remaining == 0` before
retrying `Work`. `RefreshPlayer` is advertised in `ui.available_ui_verbs`
whenever you are logged in, and is **not** recorded (it is UI-only, so it never
appears in `/replay`).

## curl examples (bash)

```bash
BASE=http://127.0.0.1:7878
curl -s $BASE/state | jq '.ui.screen, .observation.status'
curl -s -X POST $BASE/act -d '{"Core":{"Register":{"nickname":"Ada","password":"pwd"}}}'
curl -s $BASE/actions | jq
curl -s -X POST $BASE/act -d '{"Core":"Work"}'
curl -s -X POST $BASE/act -d '{"Core":{"Buy":{"ship_id":1}}}'
curl -s -X POST $BASE/act -d '{"Core":{"Activate":{"ship_number":77}}}'
curl -s -X POST $BASE/act -d '{"Goto":"Galaxy"}'
curl -s -X POST $BASE/act -d '{"LaunchFleet":{"user_id":1,"instant":false}}'
curl -s "$BASE/idle?timeout_ms=8000" | jq
curl -s -X POST $BASE/act -d '"ContinueAfterBattle"'   # unit variant → bare JSON string
curl -s -X POST $BASE/act -d '"RefreshPlayer"'         # re-fetch snapshot (cooldowns decay)
curl -s $BASE/replay > bug.json
```

**Unit-variant JSON.** `RecallFleet` / `SkipBattleAnimation` /
`ContinueAfterBattle` / `RefreshPlayer` serialize as **bare JSON strings** — the
body is `'"ContinueAfterBattle"'` (a quoted string), *not*
`'{"ContinueAfterBattle"}'` (which is invalid JSON and returns `400`).

## curl examples (PowerShell)

```powershell
$base = "http://127.0.0.1:7878"
Invoke-RestMethod "$base/state" | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post "$base/act" -Body '{"Core":{"Register":{"nickname":"Ada","password":"pwd"}}}'
Invoke-RestMethod -Method Post "$base/act" -Body '{"Core":"Work"}'
Invoke-RestMethod -Method Post "$base/act" -Body '{"LaunchFleet":{"user_id":1,"instant":false}}'
Invoke-RestMethod "$base/idle?timeout_ms=8000"
Invoke-RestMethod "$base/replay" | ConvertTo-Json -Depth 6 | Set-Content bug.json
```

## Reading status / errors

- `observation.status_is_error == true` means the last action was rejected;
  `observation.status` holds the message.
- A `400` from `/act` is a rejected command — bad JSON, or a direct `Battle`
  (see the LaunchFleet nuance below). The response body is
  `{"error": "...", "kind": "..."}`.

## Reaching battle: LaunchFleet, not Battle

There is no direct `Battle` command over `/act`. The UI flow is **travel →
auto-battle**:

- `Core(Battle{..})` is **rejected** with
  `"Battle is not a direct command; use LaunchFleet"` (a `400`), and `Battle` is
  filtered out of `/actions` so it is never advertised.
- Instead: `SelectOpponent` (or just pass `user_id` to `LaunchFleet`), then
  `LaunchFleet { user_id, instant }`. With `instant: false` the fleet travels on
  the normal timed animation; `instant: true` completes travel on the next frame.
- When travel completes, the game fires `do_battle`, and **that** is when the
  session recorder appends a **core** `Battle { opponent_id, formation }` action.
  So the recorded core stream stays `run_replay`-able even though you never sent a
  `Battle` command directly. `SelectOpponent` / `LaunchFleet` / `RecallFleet` /
  `SkipBattleAnimation` / `ContinueAfterBattle` / `Goto` are **not** recorded
  (they are UI-only).

## Saving a bug report

Save `/replay` to `testkit/scenarios/<name>.json`. A session run with `--seed N`
reproduces faithfully; the saved replay becomes a CI regression via the existing
`testkit/tests/scenarios.rs` loader — re-run it with `cargo nextest run -p
testkit`.

**Seed caveat.** If you ran the session **unseeded**, the replay carries
`seed: 0` and the runner will replay against a *different* world than the live
session — the reproduction will diverge. Only save `/replay` from a `--seed N`
session for a faithful bug report.

## Do not mix human clicks with an agent session

Only actions issued through `/act` are recorded. Buttons clicked **by hand** in
the window during an agent session mutate the game but are **not** recorded, so
the saved `/replay` will diverge from what actually happened (a later
`run_replay` reaches a different state). For a faithful bug report, drive the
session **exclusively** through the HTTP API — do not touch the window's buttons
while recording.

## Screenshot (optional)

`GET /screenshot` returns a PNG (`image/png`) of the current frame, with
one-frame latency. Bridges that cannot render a frame (e.g. the headless CI test
bridge) return `501`.

## Endpoint reference

| Method | Path                    | Body →            | Returns                                   |
|--------|-------------------------|-------------------|-------------------------------------------|
| GET    | `/state`                | —                 | `StateReport` JSON                        |
| GET    | `/actions`              | —                 | `Vec<Action>` JSON (legal, advisory)      |
| POST   | `/act`                  | `UiCommand` JSON  | `StateReport` JSON (post-action)          |
| GET    | `/idle?timeout_ms=N`    | —                 | `{"idle": bool}` (long-poll; default 10s) |
| GET    | `/screenshot`           | —                 | `image/png` bytes, or `501`               |
| GET    | `/replay`               | —                 | Phase-1 `Replay` JSON (core actions only) |

Errors return `400` (bad request / parse), `404` (unknown route/method), `500`
(bridge error), or `501` (screenshot on a headless bridge) with body
`{"error": "...", "kind": "..."}`.

# Agent-Testing Framework Phase 3 (egui upgrade + kittest UI harness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Exception:** Task Group A (the egui upgrade) does NOT follow strict red-green-per-step. A 0.27 → 0.35 bump spans seven minor releases and will not compile until every breaking change is fixed, so each upgrade step's "test" is a *compile-progress checkpoint* — `cargo build` must get PAST the previous error and reach the next expected one. Each such step lists its **expected next compile error**. Only after the whole group compiles do the normal `cargo build`/`cargo nextest` gates apply.

**Goal:** Upgrade the `game` client from eframe/egui 0.27 to 0.35 (a compiling, all-green client with agent mode intact), then add an `egui_kittest` UI harness in `game/tests/ui.rs` that drives the real egui app over an in-memory `LocalApi` — login/buy/activate/error flows queried by AccessKit label, plus a parity test asserting the app's cached snapshot matches `ApiEnv::observe()` on the same backend, plus a small optional set of wgpu snapshot regressions gated to the Linux CI leg — so UI-layer bugs (stale cache, forgotten refresh, mis-wired button) become deterministic CI failures.

**Architecture:** The upgrade is confined to the `game` crate (`app.rs`, `theme.rs`, `ship_art.rs`, `battle_scene.rs` uses no changed APIs, and `lib.rs`'s `run_native` closure). The kittest harness is a new dev-dependency (`egui_kittest = "0.35"`) driving `RiftApp` through `Harness::builder().build_eframe(...)`; tests never touch agent mode — they use a plain `LocalApi::open_seeded(":memory:", 42)` backend and query the AccessKit tree the app already exposes (labels are the query keys, and every button label in `app.rs` is stable text). The parity test builds a *second* `LocalApi` with the same seed under `ApiEnv`, drives identical actions through both, and compares snapshots. AccessKit-query tests are GPU-free **at runtime** (they drive the AccessKit tree with synthetic input and never render) and run on both CI OSes; wgpu snapshot tests are feature-gated behind `ui-snapshots` and run only on the Linux leg with lavapipe. Note: because the `egui_kittest` dev-dep carries the `wgpu` + `snapshot` features (Task B1), wgpu is still *linked at compile time* into every `game` test build (incl. Windows CI) even though the query tests never invoke it — a build-time cost, not a runtime one (see Task B1 / N5).

**Tech Stack:** `eframe`/`egui` 0.35 (upgraded from 0.27.2), `egui_kittest` 0.35 (dev-dep, with the `wgpu` + `snapshot` features for the gated snapshot leg), `wgpu` (transitive, software-rasterized via mesa/lavapipe on Linux CI), `network::LocalApi::open_seeded` (in-memory deterministic backend), `testkit::env::{ApiEnv, AgentEnv, Observation}` (parity oracle), `cargo-nextest` (runner). Rust toolchain 1.96.1 (clears every MSRV bump across 0.28–0.35).

---

## File Structure

Files created or modified, with one-line responsibility.

| File | C/M | Responsibility |
|------|-----|----------------|
| `game/Cargo.toml` | Modify | Bump `eframe = "0.35"` (keep `image` bump to `"0.25"` — see Task A1); add `egui_kittest = { version = "0.35", features = ["wgpu", "snapshot"] }` dev-dep (or, per N5, a bare `egui_kittest = "0.35"` with the wgpu/snapshot features moved under the `ui-snapshots` feature); add `ui-snapshots` feature. |
| `game/src/lib.rs` | Modify | `run_native` closure must return `Result<Box<dyn App>, ...>` (0.28 breaking change): wrap both branches in `Ok(...)`. |
| `game/src/theme.rs` | Modify | `Rounding` → `CornerRadius` (import + `::same` f32→u8 + struct literal f32→u8); `rect_stroke` gains a `StrokeKind` arg. |
| `game/src/ship_art.rs` | Modify | `Rounding` → `CornerRadius`; `rect_stroke` gains a `StrokeKind` arg. |
| `game/src/app.rs` | Modify | `Frame::none()` respelling (14 sites); `Margin::symmetric` f32→i8 (3 sites); `.rounding(..)` builder → `.corner_radius(..)` where the setter was renamed (verify); `rect_stroke` `StrokeKind` (1 site); `ViewportCommand::Screenshot` gains `UserData` payload (1 site); `map_or` → `is_some_and` nit (1 site). Plus (for kittest): add `.hint_text("Pilot name")` / `.hint_text("Password")` to the two login `TextEdit::singleline`s (~440–444) so the fields are queryable by AccessKit name (Task B — S2); add a `#[doc(hidden)] pub fn cached_snapshot_for_test(&self)` accessor for the private `snapshot` field (app.rs:121) for the parity test (Task B5). |
| `game/tests/ui.rs` | Create | egui_kittest harness: login/buy-activate/error flow tests (AccessKit queries) + parity test; snapshot tests gated behind `ui-snapshots`. |
| `game/tests/snapshots/` | Create | Committed baseline PNGs (login screen, hangar), generated on the Linux CI leg. Only populated if the snapshot task lands (see Task C). |
| `.github/workflows/ci.yml` | Modify | The existing `nextest (game — agent mode)` steps already cover the runtime-GPU-free kittest tests on both OSes; add a Linux-only `ui-snapshots` job with mesa/lavapipe. |
| `Cargo.lock` | Modify (auto) | Regenerated by cargo when deps bump; commit it. |

---

## Conventions used throughout

- **Cargo is not on PATH** in fresh Windows shells. Every task's commands assume you first run, once per shell:
  ```powershell
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  ```
  `cargo-nextest` is already installed. All `cargo` commands run from the repo root.
- Commit after every green step (and after every compile-progress checkpoint in Group A). Every commit message ends with the trailer:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- **Version pin:** every egui-family crate is `0.35` — `eframe = "0.35"`, `egui_kittest = "0.35"`. Do not mix minor versions; egui, eframe, egui_kittest, and egui-wgpu move in lockstep and a mismatch will fail to resolve or produce two incompatible `egui` types.
- **World facts (unchanged from Phase 1):** `NPC_Astro` is `user_id == 1`; the human registered after the 11 NPCs is `user_id == 12` and `opponent_id`s reference NPC rowids (`NPC_Astro` = `opponent_id: 1`); the human's **first** purchased ship is `ship_number == 77` (76 NPC ships precede it in the shared AUTOINCREMENT); passwords must be **≥ 3 chars** (use `"pwd"`).
- The starting human has `currency_value == 2000`, `max_active_ships == 1` (Recruit), 0 ships. `Falcon` is `ship_id == 1`, value 1500 (affordable at start).
- **Compile-progress-checkpoint exception (Group A only):** for the upgrade steps, "done" means `cargo build -p game` fails at the *next* documented error (or, for the final step, succeeds). Do not expect a clean build mid-group. Commit each checkpoint anyway so the sequence is bisectable.
- **Verify-at-implementation-time markers:** several 0.35 API spellings could not be confirmed against the vendored registry (only 0.27.2 is present locally). Each such step carries a **⚠ VERIFY** block with the exact `grep`/doc command to run once `eframe = "0.35"` is fetched into `%USERPROFILE%\.cargo\registry\src\`. The plan states the *expected* spelling and the fallback.

---

## Task Group A — egui/eframe 0.27 → 0.35 upgrade (compile-progress checkpoints)

**Goal of the group:** land a compiling, all-green `game` crate on eframe 0.35 with agent mode intact, BEFORE any kittest work. Green criterion for the *group* (not each step): `cargo build --workspace`, `cargo nextest run --workspace` (all Phase 1/2 tests — 66 — still pass), and `cargo build -p game --features agent` (default) all succeed.

Recommended order below is chosen so each fix unblocks the next compiler error. Because the compiler reports errors module-by-module and often many at once, the "expected next error" is the *class* of error you should be reducing toward; if the compiler surfaces a later-listed error first, jump to that step, fix it, and return.

### Task A1 — Bump eframe to 0.35 (and image to 0.25)

- [ ] In `game/Cargo.toml`, change `eframe = "0.27"` to `eframe = "0.35"`.
- [ ] Bump `image = { version = "0.24", ... }` to `image = { version = "0.25", ... }`. Rationale: egui 0.35 pulls `image` 0.25 transitively; keeping the game's own `image` dep at 0.24 risks two `image` majors and the `image::ColorType`/`ImageEncoder` calls in `app.rs::color_image_to_png` (app.rs:1408–1421) resolving against the wrong one. Keep `default-features = false, features = ["png"]`.
- [ ] Regenerate the lockfile and confirm the resolved versions:
  ```powershell
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  cargo update -p eframe --precise 0.35.0
  cargo tree -p game -i egui
  ```

**⚠ VERIFY (do this now, it informs later steps):** confirm the exact patch version resolved and that egui_kittest 0.35 exists:
```powershell
cargo search egui_kittest --limit 3
cargo tree -p game | Select-String -Pattern "egui|eframe|image|wgpu" | Sort-Object -Unique
```
If `image` 0.25 renamed `ColorType::Rgba8` (it moved to `ExtendedColorType::Rgba8` for `write_image` in 0.25), note it — that is fixed in Task A7.

**Compile-progress checkpoint:** run
```powershell
cargo build -p game 2>&1 | Select-String -Pattern "error\[" | Select-Object -First 5
```
**Expected next compile error:** `run_native` closure type mismatch — the app-creator closure now returns `Result<Box<dyn eframe::App>, Box<dyn Error + Send + Sync>>` but `game/src/lib.rs` returns a bare `Box::new(app)`. Error text resembles `expected enum Result, found struct Box` at `game/src/lib.rs:92` / `:97`.

Commit: `Bump eframe to 0.35 (upgrade WIP: run_native next)`.

### Task A2 — Fix the `run_native` closure return type (0.28 breaking change)

Both arms of the `#[cfg(feature = "agent")]` split in the `run_native` closure return a bare `Box`. In 0.28+ the closure returns `Result<Box<dyn App>, Box<dyn std::error::Error + Send + Sync>>`.

- [ ] `game/src/lib.rs:92` — change `Box::new(app)` to `Ok(Box::new(app))`.
- [ ] `game/src/lib.rs:97` — change `Box::new(app::RiftApp::new(backend, online, player_name, notice))` to `Ok(Box::new(app::RiftApp::new(backend, online, player_name, notice)))`.

The closure is `Box::new(move |cc| { ... })` at `game/src/lib.rs:76`; the two returns are the last expression of each `cfg` block.

**Compile-progress checkpoint:**
```powershell
cargo build -p game 2>&1 | Select-String -Pattern "error\[" | Select-Object -First 5
```
**Expected next compile error:** unresolved import / unknown type `Rounding` — `game/src/theme.rs:5` and `game/src/ship_art.rs:6` import `Rounding`, which was renamed to `CornerRadius` in egui 0.31. Error resembles `unresolved import egui::Rounding` or `cannot find type Rounding in this scope`.

Commit: `Fix run_native closure to return Ok(Box::new(app)) (upgrade WIP)`.

### Task A3 — `Rounding` → `CornerRadius` (0.31 breaking change; f32 → u8)

In 0.31 `egui::Rounding` became `egui::CornerRadius` and its fields/`::same` argument changed from `f32` to `u8`. Sites (verified by grep):

**`game/src/theme.rs`:**
- [ ] Line 5 import: `use eframe::egui::{self, Color32, Pos2, Rect, Rounding, Sense, Stroke, Vec2};` → replace `Rounding` with `CornerRadius`.
- [ ] Line 44: `v.window_rounding = Rounding::same(12.0);` → `v.window_rounding = CornerRadius::same(12);`
- [ ] Line 46: `let rounding = Rounding::same(10.0);` → `let rounding = CornerRadius::same(10);`
- [ ] Line 125: `let rounding = Rounding::same(12.0);` → `let rounding = CornerRadius::same(12);`
- [ ] Line 139 (struct literal, f32→u8): `Rounding { nw: 12.0, ne: 12.0, sw: 0.0, se: 0.0 }` → `CornerRadius { nw: 12, ne: 12, sw: 0, se: 0 }`

**`game/src/ship_art.rs`:**
- [ ] Line 6 import: replace `Rounding` with `CornerRadius`.
- [ ] Line 115: `let rounding = Rounding::same(10.0);` → `let rounding = CornerRadius::same(10);`

**⚠ VERIFY:** the field names on `CornerRadius`. They are `nw/ne/sw/se` (`u8`) as of 0.31, unchanged through 0.35, but confirm:
```powershell
$src = (cargo metadata --format-version 1 | ConvertFrom-Json).packages | Where-Object { $_.name -eq 'egui' } | Select-Object -First 1 -ExpandProperty manifest_path
$dir = Split-Path $src
Get-ChildItem -Recurse $dir -Filter *.rs | Select-String -Pattern "pub struct CornerRadius" -Context 0,8
```
If the fields differ, adjust the line-139 struct literal accordingly.

Note: `window_rounding` on `Visuals` is itself named `window_corner_radius` in some 0.31+ snapshots. **⚠ VERIFY** with the same registry grep:
```powershell
Get-ChildItem -Recurse $dir -Filter *.rs | Select-String -Pattern "window_rounding|window_corner_radius"
```
Expected: the field was renamed `window_corner_radius`. If so, also rename `v.window_rounding` (theme.rs:44) to `v.window_corner_radius`. Likewise the per-`WidgetVisuals` field `rounding` (theme.rs:49,55,61,67) may be `corner_radius` — grep and rename the assignments `v.widgets.*.rounding = rounding;` to `.corner_radius` if so. These are covered here because they are part of the same 0.31 rename; the grep result is authoritative.

**Compile-progress checkpoint:**
```powershell
cargo build -p game 2>&1 | Select-String -Pattern "error\[" | Select-Object -First 8
```
**Expected next compile error:** `no function or associated item named none found for struct Frame` — `Frame::none()` was removed/renamed in 0.31 (14 sites in `app.rs`). Or `no method named rounding found for ... Frame` (the Frame builder setter rename). Both are fixed in Task A4.

Commit: `Rename Rounding to CornerRadius, f32 to u8 (upgrade WIP)`.

### Task A4 — `Frame::none()` respelling + Frame `.rounding()` setter (0.31)

In 0.31 `egui::Frame::none()` was removed. The replacement is **`egui::Frame::new()`** (a zero-initialized frame; `Frame::NONE` is the `const` equivalent). Also in 0.31 the Frame builder setter `.rounding(..)` was renamed `.corner_radius(..)` and takes `impl Into<CornerRadius>` (so integer literals, not f32).

**⚠ VERIFY (blocking — pick the real constructor before editing):**
```powershell
$src = (cargo metadata --format-version 1 | ConvertFrom-Json).packages | Where-Object { $_.name -eq 'egui' } | Select-Object -First 1 -ExpandProperty manifest_path
$dir = Split-Path $src
Get-ChildItem -Recurse $dir -Filter *.rs | Select-String -Pattern "impl Frame" -Context 0,2
Get-ChildItem -Recurse $dir -Filter *.rs | Select-String -Pattern "pub fn new\(\) -> Self|pub const NONE|pub fn none\(|pub fn corner_radius|pub fn rounding"
```
Expected result: `Frame::new()` exists and `Frame::none()` does not; the setter is `corner_radius`. If instead `Frame::NONE` is the only zero constructor, use `egui::Frame::NONE` (it is a `const`, callable as `egui::Frame::NONE.fill(...)`). Use whichever the grep confirms; the plan assumes `Frame::new()`.

- [ ] Replace all 14 `egui::Frame::none()` occurrences in `game/src/app.rs` with `egui::Frame::new()`. The sites (verified): lines 224, 233, 251, 277, 334, 405, 427, 518, 575, 643, 680, 880, 908, 1081. A single find-replace of the exact string `egui::Frame::none()` → `egui::Frame::new()` covers all of them (there are no other `::none()` calls on other types in these lines).
- [ ] Rename the Frame builder `.rounding(N.0)` calls to `.corner_radius(N)` (f32→u8 integer literal) at the 5 Frame sites: app.rs:277 (`.rounding(12.0)`→`.corner_radius(12)`), 336 (`.rounding(10.0)`→`.corner_radius(10)`), 430 (`.rounding(16.0)`→`.corner_radius(16)`), 883 (`.rounding(12.0)`→`.corner_radius(12)`), 911 (`.rounding(12.0)`→`.corner_radius(12)`).

Note: theme.rs:141 and ship_art.rs:117 also call `.rounding(...)` — but those are `Painter::rect_stroke`/`rect_filled` positional args, handled in Task A5/A6, not Frame setters.

**Compile-progress checkpoint:**
```powershell
cargo build -p game 2>&1 | Select-String -Pattern "error\[" | Select-Object -First 8
```
**Expected next compile error:** `Margin::symmetric` argument type mismatch — 0.31 changed `Margin` fields and `Margin::symmetric` from `f32` to `i8`. Error resembles `mismatched types: expected i8, found floating-point number` at app.rs:227/233/337. (You may also now see the `rect_stroke` arity error from Task A5 — fix whichever surfaces.)

Commit: `Replace Frame::none() with Frame::new(), rename .rounding to .corner_radius (upgrade WIP)`.

### Task A5 — `Margin::symmetric` f32 → i8 (0.31)

`egui::Margin::symmetric(x, y)` takes `i8` args in 0.31+ (Margin fields are `i8`). Three sites in `app.rs`:

- [ ] Line 227: `egui::Margin::symmetric(12.0, 16.0)` → `egui::Margin::symmetric(12, 16)`
- [ ] Line 233: `egui::Margin::symmetric(14.0, 8.0)` → `egui::Margin::symmetric(14, 8)`
- [ ] Line 337: `egui::Margin::symmetric(10.0, 8.0)` → `egui::Margin::symmetric(10, 8)`

Note: `.inner_margin(20.0)` (app.rs:251), `.inner_margin(24.0)` (431), `.inner_margin(12.0)` (277,518), `.inner_margin(10.0)` (578,646), `.inner_margin(16.0)` (680), `.inner_margin(8.0)` (1081), `.inner_margin(14.0)` (884,912) pass a scalar to `impl Into<Margin>`. In 0.31 `Margin: From<i8>` (not `f32`). **⚠ VERIFY** whether bare `.inner_margin(20.0)` still compiles or needs `20`:
```powershell
Get-ChildItem -Recurse $dir -Filter *.rs | Select-String -Pattern "impl From<i8> for Margin|impl From<f32> for Margin|impl From<i8> for CornerRadius"
```
Expected: `From<i8>` exists, `From<f32>` does not — so change every scalar `.inner_margin(N.0)` to `.inner_margin(N)` (integer). Sites: app.rs 251, 277, 431, 518, 578, 646, 680, 884, 912, 1081. If `From<f32>` still exists, leave them. Do this in the same edit as the `symmetric` fixes to avoid a second compile round-trip.

**Compile-progress checkpoint:**
```powershell
cargo build -p game 2>&1 | Select-String -Pattern "error\[" | Select-Object -First 8
```
**Expected next compile error:** `rect_stroke` takes 4 arguments but 3 were supplied — 0.31 added a `StrokeKind` parameter to `Painter::rect_stroke`. Sites: theme.rs:141, ship_art.rs:117, app.rs:350.

Commit: `Margin f32 to i8 (upgrade WIP)`.

### Task A6 — `Painter::rect_stroke` gains a `StrokeKind` arg (0.31)

0.31 changed `rect_stroke(rect, corner_radius, stroke)` to `rect_stroke(rect, corner_radius, stroke, stroke_kind)`. Use `egui::StrokeKind::Inside` to keep the stroke inside the rect (closest to the old behavior; `Middle` centers on the edge). Three sites:

- [ ] `game/src/theme.rs:141`: `painter.rect_stroke(rect, rounding, Stroke::new(1.5, ring));` → `painter.rect_stroke(rect, rounding, Stroke::new(1.5, ring), egui::StrokeKind::Inside);`
- [ ] `game/src/ship_art.rs:117`: `painter.rect_stroke(rect, rounding, Stroke::new(1.0, accent));` → `painter.rect_stroke(rect, rounding, Stroke::new(1.0, accent), egui::StrokeKind::Inside);`
- [ ] `game/src/app.rs:350`: `ui.painter().rect_stroke(inner.response.rect, 10.0, egui::Stroke::new(1.0, theme::BLUE));` → `ui.painter().rect_stroke(inner.response.rect, 10, egui::Stroke::new(1.0, theme::BLUE), egui::StrokeKind::Inside);` (note the `10.0` → `10`: the corner-radius arg is now `impl Into<CornerRadius>`, which is `u8`).

**⚠ VERIFY** the `StrokeKind` variant names and `rect_stroke` signature:
```powershell
Get-ChildItem -Recurse $dir -Filter *.rs | Select-String -Pattern "pub enum StrokeKind|pub fn rect_stroke"
```
Expected variants: `Inside`, `Middle`, `Outside`. If the enum path differs (e.g. `egui::epaint::StrokeKind`), adjust the qualifier — `egui::StrokeKind` should re-export it.

**Compile-progress checkpoint:**
```powershell
cargo build -p game 2>&1 | Select-String -Pattern "error\[" | Select-Object -First 8
```
**Expected next compile error:** `ViewportCommand::Screenshot` — 0.30 gave the `Screenshot` variant a `UserData` payload, so the unit-variant construction at app.rs:1394 no longer typechecks: `this enum variant takes 1 argument but 0 were supplied`. (The `Event::Screenshot { image, .. }` match at app.rs:1349 already uses `..` and is unaffected.) You may also see the `image` 0.25 `ColorType`/`write_image` error (Task A7) around here.

Commit: `Add StrokeKind::Inside to rect_stroke calls (upgrade WIP)`.

### Task A7 — `ViewportCommand::Screenshot` UserData (0.30) + image 0.25 encoder + map_or nit

Three small fixes that surface together under `--features agent` (the default). All in `app.rs`.

- [ ] **Screenshot payload (app.rs:1392–1394).** The send site is:
  ```rust
  // egui 0.27: Screenshot is a unit variant (no argument).
  ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot);
  ```
  Change to pass a `UserData`:
  ```rust
  // egui 0.30+: Screenshot carries a UserData payload (echoed back on the
  // Event::Screenshot). We don't need to correlate requests, so send default.
  ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(egui::UserData::default()));
  ```
  Also update the stale comment. The receive side at app.rs:1349 (`egui::Event::Screenshot { image, .. }`) already destructures with `..`, so it keeps compiling.

  **⚠ VERIFY** the `UserData` path and that `Default` is derived:
  ```powershell
  Get-ChildItem -Recurse $dir -Filter *.rs | Select-String -Pattern "pub struct UserData|ViewportCommand::Screenshot|Screenshot\("
  ```
  Expected: `egui::UserData` with `#[derive(Default)]`. If `UserData::default()` is not available, use `egui::UserData::new(None)` or the constructor the grep reveals.

- [ ] **image 0.25 encoder (app.rs:1408–1421, `color_image_to_png`).** If Task A1's verify showed `image` 0.25 renamed the `write_image` color-type arg, change:
  ```rust
  .write_image(&rgba, w as u32, h as u32, image::ColorType::Rgba8)
  ```
  to:
  ```rust
  .write_image(&rgba, w as u32, h as u32, image::ExtendedColorType::Rgba8)
  ```
  **⚠ VERIFY** against image 0.25:
  ```powershell
  $img = (cargo metadata --format-version 1 | ConvertFrom-Json).packages | Where-Object { $_.name -eq 'image' } | Select-Object -First 1 -ExpandProperty manifest_path
  Get-ChildItem -Recurse (Split-Path $img) -Filter *.rs | Select-String -Pattern "fn write_image" -Context 0,3
  ```
  Expected: `write_image(..., ExtendedColorType)`. Keep `use image::ImageEncoder;`.

- [ ] **map_or nit (app.rs:1452).** Punch-list item E. Change:
  ```rust
  || self.battle_scene.as_ref().map_or(false, |s| !s.finished);
  ```
  to:
  ```rust
  || self.battle_scene.as_ref().is_some_and(|s| !s.finished);
  ```
  (This is a clippy `unnecessary_map_or` nit surfaced under `--features agent`; functionally identical.)

**Group-A green gate (now the normal gates apply):**
```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
cargo build --workspace
cargo build -p game            # default features include agent
cargo nextest run --workspace
```
**Expected output:** clean build; `cargo nextest run --workspace` reports **66 tests run: 66 passed** (the Phase 1/2 suite — sim/network/testkit/game — unchanged). If the count differs from 66, reconcile before proceeding (a dropped test means a regression, not a pass). Also confirm agent mode specifically compiled:
```powershell
cargo build -p game --features agent 2>&1 | Select-String -Pattern "error" ; echo "exit=$LASTEXITCODE"
```
Expected: no `error` lines.

Commit: `Screenshot UserData + image 0.25 encoder + is_some_and nit; egui 0.35 upgrade complete`.

### Task A8 — Sanity-run the upgraded client (manual, optional but recommended)

- [ ] Confirm the window still launches and login works (visual smoke; no automation):
  ```powershell
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  cargo run -p rift -- --seed 42
  ```
  Expected: the Rift window opens on the Login screen with the starfield; entering a nickname + `pwd` and clicking Enlist advances to Hangar. Close the window. (No commit — this is a checkpoint.)

---

## Task Group B — egui_kittest UI harness (AccessKit queries, GPU-free at runtime)

These tests invoke **no** wgpu backend at runtime (AccessKit tree queries + synthetic input only), so they run in the default `cargo nextest run -p game` on both Windows and Linux. (wgpu is still *linked at compile time* — the dev-dep carries the `wgpu` feature — but never called by these tests; see N5 in Task B1.) They use a real `LocalApi` backend, not agent mode.

### Task B1 — Add the egui_kittest dev-dependency and a smoke test

- [ ] In `game/Cargo.toml` `[dev-dependencies]`, add:
  ```toml
  egui_kittest = { version = "0.35", features = ["wgpu", "snapshot"] }
  ```
  Rationale for features: `wgpu` + `snapshot` are needed by the gated snapshot tests in Task C; the AccessKit-query tests in this group don't invoke them at runtime but the features are additive and harmless to the query tests' behavior.

  **N5 — compile-time cost, corrected claim:** enabling `["wgpu","snapshot"]` on the dev-dep pulls **wgpu into every `game` test build**, including Windows CI, even though the snapshot tests are gated out by the `ui-snapshots` feature. This is a *compile-time* (link) cost only — the Group-B tests are "GPU-free at runtime," not "GPU-free" outright. It is acceptable. **If trivial**, gate the wgpu/snapshot features of the dev-dep behind the `ui-snapshots` feature so non-snapshot builds skip wgpu entirely, e.g.:
  ```toml
  [dev-dependencies]
  egui_kittest = "0.35"                    # base: no wgpu, no snapshot

  [features]
  ui-snapshots = ["egui_kittest/wgpu", "egui_kittest/snapshot"]
  ```
  Only do this if the dev-dep feature plumbing resolves cleanly (a dev-dep's features *can* be enabled by a crate feature this way); otherwise leave the single `features = ["wgpu","snapshot"]` dev-dep as-is with the corrected note. If you take the gated route, Task C1's note about the features "already carried by the dev-dep" no longer applies — `ui-snapshots` then both gates the test code and enables the deps.

- [ ] **⚠ VERIFY the 0.35 Harness builder API before writing tests.** The plan uses `Harness::builder().build_eframe(closure)`. Confirm the exact constructor and the closure signature:
  ```powershell
  $kit = (cargo metadata --format-version 1 | ConvertFrom-Json).packages | Where-Object { $_.name -eq 'egui_kittest' } | Select-Object -First 1 -ExpandProperty manifest_path
  $kd = Split-Path $kit
  Get-ChildItem -Recurse $kd -Filter *.rs | Select-String -Pattern "pub fn build_eframe|pub fn new_eframe|pub fn builder|impl.*HarnessBuilder|fn build\("
  Get-ChildItem -Recurse $kd -Filter *.rs | Select-String -Pattern "CreationContext|fn get_by_label|fn get_by_role|type_text|fn snapshot|fn run\b" | Select-Object -First 40
  ```
  Expected (from egui_kittest 0.35 docs): `Harness::builder()` returns a builder with `.build_eframe(|cc: &eframe::CreationContext| -> App { ... })`; the closure receives the eframe `CreationContext` (same `cc` your `run_native` closure gets) and returns the `App`. Query methods: `harness.get_by_label("...")` / `get_by_label_contains`, `.type_text("...")`, `.click()`, and `harness.run()` to pump a frame. If the real method is `Harness::new_eframe(builder, closure)` instead of `builder().build_eframe(...)`, or the query is `get_by_name`/`get_by_role_and_label`, adapt every test below to the confirmed spelling. **This grep is the source of truth; the code below is the expected shape.**

- [ ] Create `game/tests/ui.rs` with a smoke test that builds the harness and reaches the login screen:
  ```rust
  //! egui_kittest UI harness over an in-memory LocalApi backend. Runtime-GPU-free
  //! AccessKit-query tests (login/buy/activate/error + parity) run everywhere;
  //! wgpu snapshot tests are gated behind the `ui-snapshots` feature.

  use egui_kittest::Harness;
  use game::app::RiftApp;            // ⚠ VERIFY app module visibility — see note
  use network::LocalApi;

  /// Build a Harness driving a real RiftApp over a seeded in-memory world.
  ///
  /// NOTE (B1): the harness MUST be typed with the concrete `RiftApp`
  /// (`Harness<'static, RiftApp>`), NOT the bare `Harness<'static>` — the bare
  /// form defaults the state param to `()`, so `h.state()` would return `&()`
  /// and the parity test (B5) would not compile. `state()`/`state_mut()` only
  /// return `&RiftApp`/`&mut RiftApp` when the harness carries the concrete type.
  ///
  /// NOTE (B2): the `build_eframe` closure returns the concrete `State`
  /// **UNBOXED and NOT wrapped in `Ok(...)`** — i.e. `-> RiftApp`, plain value.
  /// This is DIFFERENT from the A2 `run_native` closure, which returns
  /// `Ok(Box::new(app))` (`Result<Box<dyn App>, _>`). Do not copy the run_native
  /// return shape here. Signature per egui_kittest 0.35:
  /// `build_eframe(FnOnce(&mut eframe::CreationContext) -> State)`.
  ///
  /// NOTE (B2): the closure MUST call `theme::install(&cc.egui_ctx)` — the real
  /// app does this in `lib.rs` (game/src/lib.rs:77), and without it the snapshot
  /// baselines (Group C) render unthemed. Every harness-building closure below
  /// (this helper) installs the theme.
  fn harness() -> Harness<'static, RiftApp> {  // ⚠ VERIFY builder/method spelling
      Harness::builder().build_eframe(|cc| {
          game::theme::install(&cc.egui_ctx);   // match the real app's theme
          let backend = Box::new(
              LocalApi::open_seeded(":memory:", 42).expect("open in-memory world"),
          );
          RiftApp::new(backend, false, "Tester".into(), None)   // plain value, no Ok/Box
      })
  }

  #[test]
  fn login_screen_renders() {
      let mut h = harness();
      h.run();
      // The login card shows a pilot-name field (queried by its hint_text, S2).
      let _ = h.get_by_label("Pilot name");
  }
  ```

- [ ] **⚠ VERIFY `RiftApp`, `app`, and `theme` are reachable from an integration test.** Currently `game/src/lib.rs` declares `mod app;` and `mod theme;` (both private, lib.rs:5,10) and does not re-export `RiftApp`. Integration tests (`game/tests/*.rs`) compile against the crate's **public** API only. **Required source change:** in `game/src/lib.rs`, change `mod app;` → `pub mod app;` **and** `mod theme;` → `pub mod theme;` (the harness closure calls `game::theme::install(&cc.egui_ctx)`; `theme::install` is already `pub` at theme.rs:33). `RiftApp` and its `new` are already `pub`. Verify no other module needs opening: `LocalApi` is already `pub` from `network`. Make these the first edits in Task B1.
  - Alternative if you prefer not to widen the public surface: gate both — `#[cfg(any(test, feature = "ui-testing"))] pub mod app;` / `... pub mod theme;` behind a new `ui-testing` dev-feature. The simpler `pub mod app;` / `pub mod theme;` is acceptable here (the orphaned old modules are already not compiled; `app`/`theme` are the live client). Pick the plain `pub mod` route and note it in the commit.

- [ ] **(S2 — commit UP FRONT, do NOT defer) Make the two login `TextEdit`s queryable by giving them hint text.** An empty `TextEdit` has no accessible name of its own; the adjacent `ui.label("PILOT NAME")` is a *separate* AccessKit node, so `get_by_label("PILOT NAME")` would target the label, not the edit, and typed text would not land. Fix at the source now (app.rs ~440–444): add `.hint_text("Pilot name")` and `.hint_text("Password")` to the two `TextEdit::singleline` builders. `hint_text` becomes the AccessKit **name** for an empty `TextEdit`, so `get_by_label("Pilot name")` / `get_by_label("Password")` then resolve to the fields directly.
  ```rust
  // app.rs ~441
  ui.add_sized([340.0, 28.0],
      egui::TextEdit::singleline(&mut self.login_nick).hint_text("Pilot name"));
  // app.rs ~444
  ui.add_sized([340.0, 28.0],
      egui::TextEdit::singleline(&mut self.login_pass).password(true).hint_text("Password"));
  ```
  Keep the visible `ui.label("PILOT NAME")` / `"PASSWORD"` captions above the fields unchanged (they still render). All Group-B tests below query the fields by the **hint strings** `"Pilot name"` / `"Password"`, not the caption labels. Note this app.rs change in the Task B1 commit.

- [ ] Run the smoke test:
  ```powershell
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  cargo nextest run -p game ui::login_screen_renders
  ```
  Expected: **1 test passed**. If `get_by_label("Pilot name")` panics with "not found", inspect the tree with `h.node().debug_tree()` (or the 0.35 equivalent from the verify grep) and adjust the query to a label that is present. The queryable login strings after the S2 hint_text change are: `"Pilot name"` / `"Password"` (the two TextEdits, via hint_text), and the buttons/links `"Sign in"`, `"Enlist"`, `"New pilot? Enlist here"`. (The visible captions `"PILOT NAME"` / `"PASSWORD"` are separate label nodes — do not query the fields through them.)

Commit: `Add egui_kittest harness + login-screen smoke test; make app module public`.

### Task B2 — Login flow test (type_text + click, assert screen advances)

- [ ] Add to `game/tests/ui.rs`:
  ```rust
  #[test]
  fn login_flow_advances_to_hangar() {
      let mut h = harness();
      h.run();

      // Fill the two TextEdits, queried by their hint_text (S2). press_key does
      // NOT fill a TextEdit — use type_text after focusing/clicking the field.
      h.get_by_label("Pilot name").type_text("Ada");   // hint_text of login_nick
      h.get_by_label("Password").type_text("pwd");     // password >= 3 chars
      h.run();

      // Default mode is Sign in; but "Ada" is unregistered, so switch to Enlist.
      h.get_by_label("New pilot? Enlist here").click();
      h.run();
      h.get_by_label("Enlist").click();
      h.run();

      // Hangar-only proof: the "Battle formation:" label and the Hangar heading
      // exist only after login. Query a Hangar-exclusive string.
      let _ = h.get_by_label("Battle formation:");
  }
  ```
- [ ] **Field query is settled by S2:** the two login `TextEdit`s now carry `hint_text("Pilot name")` / `hint_text("Password")` (added up front in Task B1), and hint_text is the AccessKit name of an empty `TextEdit`, so `get_by_label("Pilot name")` / `get_by_label("Password")` target the fields directly — no role-index gymnastics needed. Fallback (only if the tree dump shows the hint isn't surfacing as the name): query by role `h.get_by_role(egui_kittest::kittest::Role::TextInput)` and index [0]/[1] (⚠ verify the Role enum path/name). Optional sanity tree dump:
  ```powershell
  cargo nextest run -p game ui::login_flow_advances_to_hangar --no-capture 2>&1 | Select-String -Pattern "TextInput|TextEdit|Pilot name|Password"
  ```
- [ ] Run:
  ```powershell
  cargo nextest run -p game ui::login_flow_advances_to_hangar
  ```
  Expected: **1 test passed** (screen advanced to Hangar; the Hangar-only query resolved).

Commit: `UI test: login flow types nickname/password and reaches Hangar`.

### Task B3 — Buy → activate flow test

Starting credits are 2000; `Falcon` (ship_id 1, value 1500) is affordable. After buy, the first owned ship is `ship_number 77`.

- [ ] Add:
  ```rust
  #[test]
  fn buy_then_activate_flow() {
      let mut h = harness();
      h.run();
      // Register a fresh pilot (fresh in-memory world, seed 42).
      h.get_by_label("Pilot name").type_text("Nyx");     // hint_text (S2)
      h.get_by_label("Password").type_text("pwd");
      h.run();
      h.get_by_label("New pilot? Enlist here").click();
      h.run();
      h.get_by_label("Enlist").click();
      h.run();

      // Go to Market (sidebar nav label is "Market").
      h.get_by_label("Market").click();
      h.run();
      // Buy the first affordable ship. There are multiple "Buy" buttons; the
      // Falcon (Tier 1) is the first. ⚠ VERIFY get_by_label returns the first
      // match or errors on ambiguity — if it errors, use get_all_by_label(...)
      // [0] or scope by the tier label.
      h.get_by_label("Buy").click();
      h.run();

      // Back to Hangar, activate the ship.
      h.get_by_label("Hangar").click();
      h.run();
      h.get_by_label("Activate").click();
      h.run();

      // Proof: the ship now shows "Stand down" (only rendered for Active ships).
      let _ = h.get_by_label("Stand down");
  }
  ```
- [ ] **⚠ VERIFY ambiguous-label behavior.** The Market has many "Buy" buttons; the Hangar may show several ships. Confirm whether `get_by_label` panics on multiple matches (kittest historically does) and use `get_all_by_label("Buy")[0]` or a nth-match helper. The grep from B1 should reveal `get_all_by_label`/`get_by_label_contains`. Adjust all multi-match queries accordingly.
- [ ] Run:
  ```powershell
  cargo nextest run -p game ui::buy_then_activate_flow
  ```
  Expected: **1 test passed**.

Commit: `UI test: buy a ship in Market then activate it in Hangar`.

### Task B4 — Error-rendering test

A rejected action must surface its error text in the status line (red path). Simplest deterministic rejection at login: sign in (not register) with an unregistered nickname, which the backend rejects.

- [ ] Add:
  ```rust
  #[test]
  fn rejected_login_shows_error_status() {
      let mut h = harness();
      h.run();
      h.get_by_label("Pilot name").type_text("Ghost"); // never registered (hint_text, S2)
      h.get_by_label("Password").type_text("pwd");
      h.run();
      // Stay in Sign in mode (default) and submit — backend rejects unknown user.
      h.get_by_label("Sign in").click();
      h.run();
      // The login screen renders self.status below the card when non-empty; the
      // rejection message is shown. The backend returns "No such pilot" for an
      // unknown nickname (network/src/world.rs:292). Assert on a stable substring.
      let _ = h.get_by_label_contains("pilot");  // matches "No such pilot"
  }
  ```
- [ ] **Backend rejection strings (confirmed, network/src/world.rs:291–292):** unknown nickname → `"No such pilot"`; correct nickname + wrong password → `"Incorrect password"`. This test signs in with a never-registered `"Ghost"`, so the message is `"No such pilot"` — assert on substring `"pilot"` (as above). If you change the flow to test a wrong-password rejection instead, assert on `"password"` / `"Incorrect password"`. Re-confirm with a quick grep before running:
  ```powershell
  Get-ChildItem -Recurse network/src -Filter *.rs | Select-String -Pattern "No such pilot|Incorrect password"
  ```
- [ ] Run:
  ```powershell
  cargo nextest run -p game ui::rejected_login_shows_error_status
  ```
  Expected: **1 test passed**.

Commit: `UI test: rejected login renders the error status text`.

### Task B5 — Parity test (UI cache == ApiEnv::observe)

Drive the same actions through the live `RiftApp` (via the harness) and through an `ApiEnv` over a *second* `LocalApi::open_seeded(":memory:", 42)`, then assert the app's cached player snapshot equals `ApiEnv::observe()`'s player snapshot after each step. This catches "UI forgot to refresh its cache" bugs.

- [ ] **ADD a test accessor for RiftApp's cached snapshot (REQUIRED — both this AND the B1 harness type param are needed).** `RiftApp::snapshot` is a private field (`app.rs:121`), so even a `Harness<'static, RiftApp>` whose `h.state()` yields `&RiftApp` still can't read `snapshot` directly from the test crate — the field is private. `pub(crate)` is insufficient (integration tests are a separate crate). So add an unconditionally-`pub`, `#[doc(hidden)]` accessor. Do NOT drop the type param in favor of the accessor or vice-versa: the type param is what makes `h.state()` return `&RiftApp` at all, and the accessor is what exposes the private field on that `&RiftApp`. Minimal, non-invasive addition to `app.rs`:
  ```rust
  impl RiftApp {
      /// Test-only read of the app's cached player snapshot, for parity checks.
      #[doc(hidden)]
      pub fn cached_snapshot_for_test(&self) -> Option<&network::PlayerSnapshot> {
          self.snapshot.as_ref()
      }
  }
  ```
  Place it near the other `impl RiftApp` block. `#[doc(hidden)]` keeps it out of docs; it is unconditionally `pub` (a `#[cfg(test)]` on a lib item is NOT visible to an integration-test crate, so do not gate it on `#[cfg(test)]`). `PlayerSnapshot` is already re-exported by `network` (used in `app.rs:5`). Confirm the type path used in the accessor matches (`network::PlayerSnapshot`).

- [ ] Add the parity test:
  ```rust
  use testkit::env::{ApiEnv, AgentEnv, Action};
  use network::LocalApi;

  #[test]
  fn ui_cache_matches_apienv_after_each_action() {
      // Oracle: a second world with the SAME seed, driven action-for-action.
      let mut oracle = ApiEnv::new(Box::new(
          LocalApi::open_seeded(":memory:", 42).unwrap(),
      ));

      let mut h = harness(); // its RiftApp uses its own seed-42 in-memory world
      h.run();

      // Helper: assert the app's cached snapshot equals the oracle's observation.
      //
      // S4 — SOUNDNESS: compare ONLY seed-deterministic fields. currency_value,
      // rank, active_count, and ships.len() are fully determined by the seed +
      // the identical action sequence, so they match exactly across the two
      // worlds. Do NOT add wall-clock-derived fields here — e.g.
      // `work_cooldown_remaining` is computed from `now_unix() - last_work_at`
      // and will differ by ~1s between the two worlds (they call `now_unix()` at
      // slightly different instants), which would flake. Every field asserted
      // below is also one the UI refreshes via `apply_snapshot`, so a
      // backend-changed-but-UI-didn't-refresh bug is caught here, not elsewhere.
      fn assert_parity(app: &game::app::RiftApp, oracle: &mut ApiEnv) {
          let obs = oracle.observe().expect("oracle observe");
          let cached = app.cached_snapshot_for_test();
          match (cached, &obs.player) {
              (Some(c), Some(o)) => {
                  // Seed-deterministic fields ONLY (see S4 note above):
                  assert_eq!(c.user.currency_value, o.user.currency_value, "credits parity");
                  assert_eq!(c.user.rank.title(), o.user.rank.title(), "rank parity");
                  assert_eq!(c.active_count, o.active_count, "active-count parity");
                  assert_eq!(c.ships.len(), o.ships.len(), "ship-count parity");
                  // Deliberately NOT compared: work_cooldown_remaining or any
                  // now_unix()-derived field — wall-clock, will flake.
              }
              (None, None) => {}
              _ => panic!("one side logged in, the other not"),
          }
      }
      // Reading the RiftApp back out of the Harness: because `harness()` is typed
      // `Harness<'static, RiftApp>` (B1), `h.state()` returns `&RiftApp` (and
      // `h.state_mut()` returns `&mut RiftApp`). If the harness were the bare
      // `Harness<'static>` (= `Harness<'static, ()>`), `h.state()` would return
      // `&()` and this test would NOT compile. (⚠ VERIFY the method is spelled
      // `state()` in 0.35: grep
      //   Get-ChildItem -Recurse $kd -Filter *.rs | Select-String "pub fn state|pub fn state_mut")

      // Register on BOTH sides (same nickname/password/seed).
      oracle.act(&Action::Register { nickname: "Rhea".into(), password: "pwd".into() }).unwrap();
      h.get_by_label("Pilot name").type_text("Rhea");   // hint_text (S2)
      h.get_by_label("Password").type_text("pwd");
      h.run();
      h.get_by_label("New pilot? Enlist here").click();
      h.run();
      h.get_by_label("Enlist").click();
      h.run();
      assert_parity(h.state(), &mut oracle);   // &RiftApp via typed harness (B1)

      // Work on both.
      oracle.act(&Action::Work).unwrap();
      h.get_by_label("Work").click();
      h.run();
      h.get_by_label_contains("Report for duty").click(); // ⚠ verify label
      h.run();
      assert_parity(h.state(), &mut oracle);
  }
  ```
- [ ] **⚠ VERIFY the harness→app accessor.** In egui_kittest 0.35 the driven app is retrievable from a **typed** `Harness<'static, RiftApp>` via `harness.state()` / `harness.state_mut()` returning `&RiftApp` / `&mut RiftApp`. This is why the `harness()` helper (B1) MUST carry the concrete type param — with the default `()` state, `state()` returns `&()` and this test won't compile. Run the grep in the comment above to confirm the method is spelled `state()` in 0.35; it exists in kittest's eframe support. This is the one hard dependency of the parity test on the 0.35 API; confirm it before writing.
- [ ] **Determinism note (S4):** both worlds are seeded 42 and driven with identical actions, so `Work` income and any RNG-affected values match. Register assigns the human `user_id 12` on both. The parity comparison is on the cached snapshot, which the app refreshes via `apply_snapshot` after each action — exactly the code path under test. **The comparison is sound ONLY for seed-deterministic fields** (currency_value, rank, active_count, ships.len()); it MUST NOT compare wall-clock fields like `work_cooldown_remaining` (derived from `now_unix() - last_work_at`, which differs by ~1s between the two worlds and would flake). Invariant to preserve: **every asserted field must be one the UI refreshes via `apply_snapshot`**, so that a future "backend changed but UI forgot to refresh" bug fails this test loudly instead of being mis-debugged elsewhere.
- [ ] Run:
  ```powershell
  cargo nextest run -p game ui::ui_cache_matches_apienv_after_each_action
  ```
  Expected: **1 test passed**. A mismatch means the UI cache diverged from the backend — a real finding; do not "fix" the test by loosening the assertion without understanding why.

- [ ] Full group-B gate:
  ```powershell
  cargo nextest run -p game
  ```
  Expected: all game tests pass (the pre-existing agent-mode tests + the 5 new `ui::*` tests). Note the total for the CI-count check.

Commit: `UI parity test: app cache matches ApiEnv::observe after each action; add test accessor`.

---

## Task Group C — wgpu snapshot regressions (gated to Linux CI leg)

**Design decision (justified):** snapshot tests are gated behind a **cargo feature `ui-snapshots`**, NOT an env var. Rationale: a feature makes the wgpu/GPU requirement explicit at the build boundary, keeps the default `cargo nextest run -p game` (Windows dev + both CI legs' logic step) from even compiling the snapshot code path, and lets the Linux CI leg opt in with `--features ui-snapshots` alongside lavapipe. An env-var guard would still compile and link wgpu into every `game` test build (slower Windows CI) and could be tripped accidentally. Baselines are committed under `game/tests/snapshots/` (small count — 2 PNGs — no git-lfs).

**If wiring wgpu snapshots against 0.35 proves too deep to specify concretely at implementation time, this whole group is OPTIONAL/deferred.** The AccessKit-query + parity tests in Group B are the core deliverable and need no GPU. Mark the group deferred in the commit log and skip to Group D (CI) without the snapshot job.

### Task C1 — Add the `ui-snapshots` feature and one snapshot test

> **STATUS: DEFERRED (not implemented in the Phase 3 branch).** Groups A + B
> (egui 0.35 upgrade + the AccessKit-driven kittest flow/parity suite) deliver
> the spec's "UI harness that exercises the real egui client." Group C (wgpu
> pixel-snapshot regression) was deferred because: (1) baseline PNGs generated
> on the Windows dev machine must byte-match a headless lavapipe render on the
> Linux CI leg — a real cross-machine flake risk that could not be validated
> autonomously; (2) it needs lavapipe CI plumbing (Task D2) that only pays off
> once baselines are stable; (3) it is the lowest-ROI, highest-flake part of the
> phase, and the AccessKit label/parity tests already catch UI regressions
> portably. Carry-forward: implement C1/D2 later on a machine where the CI
> renderer can be reproduced locally to bootstrap stable baselines. The Group-B
> tests already snapshot after a FIXED `run_steps` count, so the S5 anti-flake
> approach is proven and ready to reuse here.

- [ ] In `game/Cargo.toml` `[features]`, add:
  ```toml
  ui-snapshots = []
  ```
  (If you kept the single `egui_kittest = { features = ["wgpu","snapshot"] }` dev-dep from Task B1, the feature only needs to gate the test code — `ui-snapshots = []` — not pull deps. If you took the N5 gated route in B1, then instead of an empty feature use `ui-snapshots = ["egui_kittest/wgpu", "egui_kittest/snapshot"]` so the feature both gates the test code AND enables the deps.)

- [ ] **⚠ VERIFY the 0.35 snapshot API.** Confirm the method name and renderer setup:
  ```powershell
  $kd = Split-Path ((cargo metadata --format-version 1 | ConvertFrom-Json).packages | Where-Object { $_.name -eq 'egui_kittest' } | Select-Object -First 1 -ExpandProperty manifest_path)
  Get-ChildItem -Recurse $kd -Filter *.rs | Select-String -Pattern "fn snapshot|wgpu|SnapshotOptions|fn render|WgpuTestRenderer|with_wgpu|fn step\b|fn threshold"
  ```
  Expected: `harness.snapshot("name")` renders via a wgpu backend and compares against `game/tests/snapshots/name.png` (writing the baseline on first run when `UPDATE_SNAPSHOTS` is set). The builder may need `.renderer(...)` or `.wgpu()` — use whatever the grep shows. Snapshot output/threshold config lives in a `kittest.toml` or `SnapshotOptions`; confirm the file name (0.35 may use `kittest.toml` at the crate root or per-test `SnapshotOptions`). Also confirm the single-frame pump method (`step()` vs `run_once()` etc.) and the threshold setter — both are needed for the S5 anti-flake mitigation below.

- [ ] Add to `game/tests/ui.rs`, gated. **Note the deliberate use of a FIXED number of `h.step()` calls instead of `h.run()` — see the required anti-flake note below.**
  ```rust
  #[cfg(feature = "ui-snapshots")]
  #[test]
  fn snapshot_login_screen() {
      let mut h = harness();
      // FIXED frame count (S5): step a deterministic number of frames rather than
      // h.run() (which pumps a variable count because the app unconditionally
      // request_repaint_after(50ms) to animate the starfield). 3 steps settles
      // layout while keeping the virtual clock at a fixed, reproducible value.
      for _ in 0..3 { h.step(); }         // ⚠ VERIFY step() spelling
      h.snapshot("login_screen");         // ⚠ VERIFY method + baseline path
  }

  #[cfg(feature = "ui-snapshots")]
  #[test]
  fn snapshot_hangar() {
      let mut h = harness();
      for _ in 0..3 { h.step(); }
      h.get_by_label("Pilot name").type_text("Vega");   // hint_text (S2)
      h.get_by_label("Password").type_text("pwd");
      for _ in 0..2 { h.step(); }
      h.get_by_label("New pilot? Enlist here").click();
      for _ in 0..2 { h.step(); }
      h.get_by_label("Enlist").click();
      for _ in 0..3 { h.step(); }
      h.snapshot("hangar");
  }
  ```
  **Anti-flake mitigation is REQUIRED (S5), not optional, for any screen containing the time-based starfield.** Both the login and hangar screens draw `theme::draw_starfield`, which is keyed on `ctx.input(|i| i.time)`, and `app.rs` unconditionally calls `request_repaint_after(50ms)` — so `h.run()` (run-until-no-more-repaints) pumps a *variable* number of frames and lands the virtual clock at a non-reproducible `time`, flaking the starfield. Two required mitigations, apply BOTH:
  1. Snapshot after a **fixed number of `h.step()` calls** (as above), never after `h.run()`, so the virtual `time` and thus the starfield positions are reproducible run-to-run. (⚠ VERIFY the exact single-frame method name in 0.35 — likely `step()`; grep alongside `run`.)
  2. Set a **per-OS pixel threshold via `SnapshotOptions`** (or `kittest.toml`) generous enough to absorb sub-pixel star twinkle and cross-runner rasterizer differences. Configure it per the API confirmed in C1's verify grep (e.g. `h.snapshot_options("hangar", &SnapshotOptions::new().threshold(..))` or a `kittest.toml`).

  Do NOT snapshot the Battle screen — `battle_scene.rs` animates over 4.5s and is inherently unstable; battle snapshots are out of scope. **Group C as a whole remains optional/deferrable** (per the group header); the S5 mitigations are mandatory only *if* you implement the snapshot tests.

- [ ] Generate baselines locally is NOT possible on Windows without a Vulkan/wgpu backend guaranteed to match Linux; **baselines must be generated on the Linux CI leg** (per spec: pinned-OS baselines). First CI run with `UPDATE_SNAPSHOTS` (or the 0.35 equivalent) set produces the PNGs; download them from the job artifacts and commit them under `game/tests/snapshots/`. Document this bootstrap in the commit. (⚠ VERIFY the env var / flag that writes baselines — grep for `UPDATE_SNAPSHOTS` in the kittest source.)

Commit: `Add ui-snapshots feature + login/hangar snapshot tests (baselines pending Linux CI)`.

---

## Task Group D — CI

### Task D1 — Confirm runtime-GPU-free kittest tests run on both OSes (no change needed, verify)

The existing `nextest (game — agent mode)` steps (`.github/workflows/ci.yml:28-29` Ubuntu, `:47-48` Windows) run `cargo nextest run -p game`, which now includes the Group-B `ui::*` tests (they are not gated). No workflow edit is required for the AccessKit tests.

- [ ] Verify by reading the two steps; confirm they call `cargo nextest run -p game` with default features (which do NOT include `ui-snapshots`, so the snapshot tests stay out of these legs). Rename the step label to `nextest (game — agent mode + UI harness)` for clarity (cosmetic).

### Task D2 — Add a Linux-only snapshot job with lavapipe (only if Group C landed)

- [ ] Add a new job to `.github/workflows/ci.yml` (mirroring `test-ubuntu`'s setup), running only on non-schedule events:
  ```yaml
  # ── PR: Linux UI snapshot tests (wgpu via lavapipe) ──────────────────────
  ui-snapshots:
    name: UI snapshots — Ubuntu (lavapipe)
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - uses: taiki-e/install-action@nextest
      - name: Install Mesa/lavapipe (software Vulkan)
        run: sudo apt-get update && sudo apt-get install -y mesa-vulkan-drivers
      - name: UI snapshot tests
        env:
          # Force lavapipe so rendering is deterministic across runners.
          WGPU_BACKEND: vulkan
          # ⚠ VERIFY lavapipe selection env (LIBGL_ALWAYS_SOFTWARE / VK_ICD_FILENAMES)
          LIBGL_ALWAYS_SOFTWARE: "1"
        run: cargo nextest run -p game --features ui-snapshots ui::snapshot_
      - name: Upload snapshot diffs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: ui-snapshot-diffs
          path: game/tests/snapshots/
          if-no-files-found: warn
  ```
- [ ] **⚠ VERIFY the lavapipe/wgpu env vars.** wgpu picks the adapter via `WGPU_BACKEND`; lavapipe is a software Vulkan ICD provided by `mesa-vulkan-drivers`. Confirm on the runner that `vulkaninfo` (from `vulkan-tools`) lists `llvmpipe`/`lavapipe`; add `sudo apt-get install -y vulkan-tools` and a `vulkaninfo | head` diagnostic step if the snapshot job can't find an adapter. The exact env var kittest/wgpu 0.35 honors may be `WGPU_BACKEND=vulkan` alone; adjust once the first run's logs show adapter selection.
- [ ] **Bootstrap baselines:** the first run of this job will FAIL (no committed PNGs). Run it once with the baseline-write flag (a `workflow_dispatch` variant or a temporary `env: UPDATE_SNAPSHOTS: "1"` step — ⚠ verify the flag name), download the `ui-snapshot-diffs` artifact, commit the PNGs under `game/tests/snapshots/`, then remove the write flag so the job asserts thereafter.

### Task D3 — Leave the soak job untouched; final CI sanity

- [ ] Confirm the `soak` job (ci.yml:50-68) is unchanged.
- [ ] Push the branch and confirm all non-snapshot legs are green; confirm the snapshot leg is green after baselines are committed (or that the job is absent if Group C was deferred).

Commit: `CI: add Linux lavapipe snapshot job; label game step as UI harness`.

---

## Self-review checklist (run before the final commit of this plan doc)

- Coverage: A (upgrade as its own first group, split into compile-checkpoint steps, agent mode re-verified) ✓; B (kittest harness: login, buy→activate, error, parity, with the app-accessor + snapshot-read accessors specified) ✓; C (snapshots behind the `ui-snapshots` feature, Linux-only, optional/deferrable) ✓; D (both-OS AccessKit tests need no CI change; Linux lavapipe snapshot job added; soak untouched) ✓; E (map_or→is_some_and folded into Task A7) ✓.
- Version consistency: every egui-family pin is `0.35`. ✓
- Feature-gate coherence: `ui-snapshots` gates the snapshot tests only; default `cargo nextest run -p game` excludes them; Linux leg opts in. ✓
- Upgrade sequence reaches a compiling state: A1(deps)→A2(run_native)→A3(Rounding)→A4(Frame)→A5(Margin)→A6(rect_stroke)→A7(Screenshot+image+nit)→green gate. ✓
- No placeholders in commands; every step has a concrete command + expected output or expected-next-compile-error. ✓
- Verify-at-implementation-time markers present on: Frame constructor (A4), CornerRadius/window field renames (A3), Margin From impls (A5), StrokeKind path (A6), UserData path + image ExtendedColorType (A7), Harness builder + query API (B1), TextEdit querying fallback (B2), ambiguous-label behavior (B3), backend rejection string re-check (B4), harness→app accessor + test snapshot accessor (B5), snapshot API + step/threshold + baseline-write flag (C1), lavapipe env vars (D2). ✓
- Adversarial-review fixes applied: **B1** harness typed `Harness<'static, RiftApp>` everywhere (helper + `h.state()` sites) so `state()` returns `&RiftApp`; test accessor for the private `snapshot` field KEPT alongside the type param (both required). **B2** `build_eframe` closure returns the concrete `RiftApp` UNBOXED/no-`Ok` (unlike run_native's `Ok(Box::new(app))`), and every harness closure calls `theme::install(&cc.egui_ctx)`. **S1** login-rejection assertion uses the real string `"No such pilot"` (substring `"pilot"`). **S2** login TextEdits get `.hint_text("Pilot name")`/`("Password")` committed up front (Task B1); all field queries use the hint strings; role-index is a one-line fallback only. **S3** Screenshot-UserData attributed to egui **0.30** (three prose sites); code fix unchanged. **S4** parity compares seed-deterministic fields only, forbids wall-clock fields (`work_cooldown_remaining`), with the apply_snapshot invariant stated. **S5** starfield-screen snapshots use fixed `h.step()` counts + per-OS `SnapshotOptions` threshold (REQUIRED when snapshots are implemented; Group C still deferrable overall). **N5** corrected to "GPU-free at runtime" (wgpu links at compile time) with an optional feature-gating suggestion. **N3** ⚠ VERIFY posture retained on `get_by_label_contains`/`get_all_by_label`. ✓
- Confirmed-correct, unchanged: run_native `Ok(Box::new(app))`; Rounding→CornerRadius + `.rounding()`→`.corner_radius()` / `window_rounding`→`window_corner_radius` / WidgetVisuals rounding→corner_radius; Frame::none()→Frame::new(); Margin f32→i8; rect_stroke + `StrokeKind::Inside`; image 0.25 `ExtendedColorType::Rgba8`; A1–A7 order + compile-progress-checkpoint approach. ✓

//! egui_kittest UI harness over an in-memory LocalApi backend. Runtime-GPU-free
//! AccessKit-query tests (login/buy/activate/error + parity) run everywhere;
//! wgpu snapshot tests are gated behind the `ui-snapshots` feature.

use egui::accesskit::Role;
use egui_kittest::kittest::Queryable;
use egui_kittest::Harness;
use game::app::RiftApp;
use network::LocalApi;
use testkit::env::{Action, AgentEnv, ApiEnv};

/// Build a Harness driving a real RiftApp over a seeded in-memory world.
///
/// NOTE (B1): the harness is typed with the concrete `RiftApp`
/// (`Harness<'static, RiftApp>`) so `h.state()` returns `&RiftApp` — needed by
/// the parity test (B5). With the bare `Harness<'static>` (= `Harness<'static,
/// ()>`), `state()` would return `&()` and B5 would not compile.
///
/// NOTE (B2): the `build_eframe` closure returns the concrete `State` UNBOXED
/// and NOT wrapped in `Ok(...)` — i.e. `-> RiftApp`, plain value. This differs
/// from the `run_native` closure in lib.rs, which returns `Ok(Box::new(app))`.
/// Signature per egui_kittest 0.35:
/// `build_eframe(FnOnce(&mut eframe::CreationContext) -> State)`.
///
/// The closure installs the theme (matching the real app in lib.rs) so snapshot
/// baselines render themed.
fn harness() -> Harness<'static, RiftApp> {
    Harness::builder().build_eframe(|cc| {
        game::theme::install(&cc.egui_ctx);
        let backend = Box::new(
            LocalApi::open_seeded(":memory:", 42).expect("open in-memory world"),
        );
        // Start with an EMPTY pilot-name field (not prefilled) so typed input in
        // the flow tests is deterministic — otherwise type_text would append to
        // the default nick.
        RiftApp::new(backend, false, String::new(), None)
    })
}

/// Pump a FIXED number of frames instead of `h.run()`.
///
/// API CORRECTION vs plan: the app unconditionally `request_repaint_after(50ms)`
/// to animate the starfield (app.rs:1468), so `h.run()` never reaches a steady
/// state and panics with "exceeded max_steps". `run_steps(n)` pumps a
/// deterministic frame count (processing queued input each step) without the
/// convergence check. Two frames settle layout and flush any queued events.
fn pump(h: &mut Harness<'static, RiftApp>) {
    h.run_steps(2);
}

/// Type into a login field, addressed by AccessKit role.
///
/// API CORRECTION vs plan (S2): `hint_text` does NOT surface as the AccessKit
/// name of a `TextEdit` in egui 0.35, so `get_by_label("Pilot name")` finds
/// nothing. The two login fields are instead uniquely addressable by role —
/// the pilot-name field is `Role::TextInput` and the password field (built with
/// `.password(true)`) is `Role::PasswordInput` — so there is exactly one of
/// each on the login screen and no index gymnastics are needed. `type_text`
/// only delivers text to the focused widget, so we `focus()` first.
fn type_into_role(h: &mut Harness<'static, RiftApp>, role: Role, text: &str) {
    let field = h.get_by_role(role);
    field.focus();
    field.type_text(text);
    pump(h);
}

#[test]
fn login_screen_renders() {
    let mut h = harness();
    pump(&mut h);
    // The login card shows the two credential fields (by role) and the submit
    // button (a Label node whose value matches). See type_into_role for why the
    // fields are queried by role rather than by hint_text label.
    let _ = h.get_by_role(Role::TextInput); // pilot-name field
    let _ = h.get_by_role(Role::PasswordInput); // password field
    // Submit button. "Sign in" is ambiguous by label alone (it is also the card
    // heading), so pin the button by role + label.
    let _ = h.get_by_role_and_label(Role::Button, "Sign in");
}

#[test]
fn login_flow_advances_to_hangar() {
    let mut h = harness();
    pump(&mut h);

    // Fill the two credential fields (by role — see type_into_role).
    type_into_role(&mut h, Role::TextInput, "Ada");
    type_into_role(&mut h, Role::PasswordInput, "pwd");

    // Default mode is Sign in; "Ada" is unregistered, so switch to Enlist.
    h.get_by_label("New pilot? Enlist here").click();
    pump(&mut h);
    h.get_by_label("Enlist").click();
    pump(&mut h);

    // Hangar-only proof: "Battle formation:" (app.rs:542) renders only in the
    // Hangar, after login.
    let _ = h.get_by_label("Battle formation:");
}

/// Register a fresh pilot and land on the Hangar. Shared by the flow tests.
fn register_and_enter(h: &mut Harness<'static, RiftApp>, nick: &str) {
    pump(h);
    type_into_role(h, Role::TextInput, nick);
    type_into_role(h, Role::PasswordInput, "pwd");
    h.get_by_label("New pilot? Enlist here").click();
    pump(h);
    h.get_by_label("Enlist").click();
    pump(h);
}

#[test]
fn buy_then_activate_flow() {
    let mut h = harness();
    register_and_enter(&mut h, "Nyx");

    // Go to Market via the sidebar nav row.
    h.get_by_label("Market").click();
    pump(&mut h);

    // Buy the first affordable ship. The Market shows several "Buy" buttons, so
    // query all and click the first (Falcon, Tier 1, value 1500 <= 2000 credits).
    h.get_all_by_label("Buy")
        .next()
        .expect("at least one Buy button in Market")
        .click();
    pump(&mut h);

    // Back to the Hangar and activate the newly-owned ship.
    h.get_by_label("Hangar").click();
    pump(&mut h);
    h.get_by_label("Activate").click();
    pump(&mut h);

    // Proof: the active ship now offers "Stand down" (rendered only when Active).
    let _ = h.get_by_label("Stand down");
}

#[test]
fn rejected_login_shows_error_status() {
    let mut h = harness();
    pump(&mut h);
    type_into_role(&mut h, Role::TextInput, "Ghost"); // never registered
    type_into_role(&mut h, Role::PasswordInput, "pwd");

    // Stay in Sign in mode (default) and submit — backend rejects the unknown
    // pilot. "Sign in" is ambiguous by label (also the card heading), so pin the
    // button by role + label.
    h.get_by_role_and_label(Role::Button, "Sign in").click();
    pump(&mut h);

    // The login screen renders self.status below the card when non-empty. The
    // backend returns "No such pilot" for an unknown nickname
    // (network/src/world.rs:292). NOTE: the bare substring "pilot" is ambiguous
    // — the "New pilot? Enlist here" link also contains it — so assert on the
    // error-specific substring "such pilot".
    let _ = h.get_by_label_contains("such pilot");
}

/// Assert the app's cached snapshot equals the oracle's observation.
///
/// S4 — SOUNDNESS: compare ONLY seed-deterministic fields. currency_value,
/// rank, active_count, and ships.len() are fully determined by the seed + the
/// identical action sequence, so they match exactly across the two worlds. Do
/// NOT compare wall-clock-derived fields (e.g. `work_cooldown_remaining`, from
/// `now_unix() - last_work_at`), which differ by ~1s between the worlds and
/// would flake. Every field asserted below is one the UI refreshes via
/// `apply_snapshot`, so a "backend changed but UI didn't refresh" bug is caught
/// here.
fn assert_parity(app: &RiftApp, oracle: &mut ApiEnv) {
    let obs = oracle.observe().expect("oracle observe");
    let cached = app.cached_snapshot_for_test();
    match (cached, &obs.player) {
        (Some(c), Some(o)) => {
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

/// Harness with the agent channel attached, so tests can drive the app through
/// `UiCommand`s exactly like the HTTP control server does.
fn harness_with_agent() -> (
    Harness<'static, RiftApp>,
    std::sync::mpsc::Sender<game::agent_mode::AgentCall>,
) {
    let (tx, rx) = std::sync::mpsc::channel();
    let h = Harness::builder().build_eframe(move |cc| {
        game::theme::install(&cc.egui_ctx);
        let backend = Box::new(LocalApi::open_seeded(":memory:", 42).expect("open in-memory world"));
        let mut app = RiftApp::new(backend, false, String::new(), None);
        app.attach_agent(rx, Some(42));
        app
    });
    (h, tx)
}

/// Send one UiCommand through the agent channel and pump frames to drain it.
fn agent_act(
    h: &mut Harness<'static, RiftApp>,
    tx: &std::sync::mpsc::Sender<game::agent_mode::AgentCall>,
    cmd: game::agent_mode::UiCommand,
) -> game::agent_mode::AgentResponse {
    let (rtx, rrx) = std::sync::mpsc::channel();
    tx.send((game::agent_mode::AgentRequest::Act(cmd), rtx)).expect("send agent cmd");
    h.run_steps(3);
    rrx.try_recv().expect("agent reply within pumped frames")
}

/// Under kittest there is no glow context (`gl: None`), so LaunchFleet with
/// `board: true` must degrade gracefully into a plain battle — the raid is a
/// bonus, never a wall. ResolveBoarding without a raid must be a clean error.
#[test]
fn boarding_without_gl_falls_back_to_plain_battle() {
    use game::agent_mode::{AgentResponse, UiCommand};

    let (mut h, tx) = harness_with_agent();
    pump(&mut h);
    for cmd in [
        UiCommand::Core(Action::Register { nickname: "Zed".into(), password: "pwd".into() }),
        UiCommand::Core(Action::Buy { ship_id: 1 }),
        UiCommand::Core(Action::Activate { ship_number: 77 }), // first ship on a seed-42 world
    ] {
        let resp = agent_act(&mut h, &tx, cmd);
        assert!(matches!(resp, AgentResponse::State(_)), "setup command rejected: {resp:?}");
    }

    let resp = agent_act(
        &mut h,
        &tx,
        UiCommand::LaunchFleet { user_id: 1, instant: true, board: true },
    );
    assert!(matches!(resp, AgentResponse::State(_)), "launch rejected: {resp:?}");
    h.run_steps(3);

    // No GL → no Screen::Boarding; the battle resolved directly.
    let _ = h.get_by_label("Back to Galaxy"); // battle screen header button

    // With no raid in progress, ResolveBoarding is a clean rejection.
    let resp = agent_act(
        &mut h,
        &tx,
        UiCommand::ResolveBoarding { destroyed: vec![sim::Subsystem::ReactorCore], extracted: true },
    );
    assert!(matches!(resp, AgentResponse::Err(_)), "expected error, got {resp:?}");
}

#[test]
fn ui_cache_matches_apienv_after_each_action() {
    // Oracle: a second world with the SAME seed, driven action-for-action.
    let mut oracle = ApiEnv::new(Box::new(
        LocalApi::open_seeded(":memory:", 42).unwrap(),
    ));

    let mut h = harness(); // its RiftApp uses its own seed-42 in-memory world
    pump(&mut h);

    // Register on BOTH sides (same nickname/password/seed).
    oracle
        .act(&Action::Register { nickname: "Rhea".into(), password: "pwd".into() })
        .unwrap();
    type_into_role(&mut h, Role::TextInput, "Rhea");
    type_into_role(&mut h, Role::PasswordInput, "pwd");
    h.get_by_label("New pilot? Enlist here").click();
    pump(&mut h);
    h.get_by_label("Enlist").click();
    pump(&mut h);
    assert_parity(h.state(), &mut oracle); // &RiftApp via typed harness (B1)

    // Work on both.
    oracle.act(&Action::Work).unwrap();
    h.get_by_label("Work").click();
    pump(&mut h);
    h.get_by_label_contains("Report for duty").click();
    pump(&mut h);
    assert_parity(h.state(), &mut oracle);
}

use super::net_state::NetState;
use super::title::TitleState;
use super::wad_system::WadSystem;
use engine::{
    ControlFlow, DependenciesFrom, Gesture, InfallibleSystem, Input, Scancode, TextId,
    TextRenderer, Window,
};
use math::prelude::*;
use math::Pnt2f;

pub struct Bindings {
    pub quit: Gesture,
    pub next_level: Gesture,
    pub previous_level: Gesture,
    pub toggle_mouse: Gesture,
    pub toggle_help: Gesture,
}

impl Default for Bindings {
    fn default() -> Self {
        Bindings {
            quit: Gesture::AnyOf(vec![
                Gesture::QuitTrigger,
                Gesture::KeyTrigger(Scancode::Escape),
            ]),
            next_level: Gesture::AllOf(vec![
                Gesture::KeyHold(Scancode::LControl),
                Gesture::KeyTrigger(Scancode::N),
            ]),
            previous_level: Gesture::AllOf(vec![
                Gesture::KeyHold(Scancode::LControl),
                Gesture::KeyTrigger(Scancode::P),
            ]),
            toggle_mouse: Gesture::KeyTrigger(Scancode::Grave),
            toggle_help: Gesture::KeyTrigger(Scancode::H),
        }
    }
}

#[derive(DependenciesFrom)]
pub struct Dependencies<'context> {
    bindings: &'context Bindings,
    window: &'context Window,
    input: &'context mut Input,
    text: &'context mut TextRenderer,
    control_flow: &'context mut ControlFlow,
    title: &'context TitleState,

    wad: &'context mut WadSystem,
    net: &'context NetState,
}

pub struct Hud {
    mouse_grabbed: bool,
    current_help: HelpState,
    prompt_text: TextId,
    help_text: TextId,
    players_text: Option<TextId>,
    last_player_names: Vec<String>,
    title_dismissed: bool,
}

impl<'context> InfallibleSystem<'context> for Hud {
    type Dependencies = Dependencies<'context>;

    fn debug_name() -> &'static str {
        "hud"
    }

    fn create(deps: Dependencies) -> Self {
        deps.input.set_mouse_enabled(true);
        deps.input.set_cursor_grabbed(true);

        let prompt_text = deps
            .text
            .insert(deps.window, PROMPT_TEXT, Pnt2f::origin(), HELP_PADDING);
        let help_text = deps
            .text
            .insert(deps.window, HELP_TEXT, Pnt2f::origin(), HELP_PADDING);
        deps.text[help_text].set_visible(false);

        Hud {
            prompt_text,
            help_text,
            mouse_grabbed: true,
            current_help: HelpState::Prompt,
            players_text: None,
            last_player_names: Vec::new(),
            title_dismissed: false,
        }
    }

    fn update(&mut self, deps: Dependencies) {
        // Quit / window-close must work even while the title screen is up.
        if deps.input.poll_gesture(&deps.bindings.quit) {
            deps.control_flow.quit_requested = true;
        }

        // While the title screen is up, keep our overlays hidden. Once it's
        // dismissed, reveal the prompt (the first time only, so the help toggle
        // still works afterwards).
        if deps.title.active {
            deps.text[self.prompt_text].set_visible(false);
            deps.text[self.help_text].set_visible(false);
            return;
        }
        if !self.title_dismissed {
            self.title_dismissed = true;
            if let HelpState::Prompt = self.current_help {
                deps.text[self.prompt_text].set_visible(true);
            }
        }

        let Dependencies {
            input,
            text,
            bindings,
            ..
        } = deps;

        if input.poll_gesture(&bindings.toggle_mouse) {
            self.mouse_grabbed = !self.mouse_grabbed;
            input.set_mouse_enabled(self.mouse_grabbed);
            input.set_cursor_grabbed(self.mouse_grabbed);
        }

        if input.poll_gesture(&bindings.toggle_help) {
            self.current_help = match self.current_help {
                HelpState::Prompt => {
                    text[self.prompt_text].set_visible(false);
                    text[self.help_text].set_visible(true);
                    HelpState::Shown
                }
                HelpState::Shown => {
                    text[self.help_text].set_visible(false);
                    HelpState::Hidden
                }
                HelpState::Hidden => {
                    text[self.help_text].set_visible(true);
                    HelpState::Shown
                }
            };
        }

        if input.poll_gesture(&bindings.next_level) {
            let index = deps.wad.level_index();
            deps.wad.change_level(index + 1);
        } else if input.poll_gesture(&bindings.previous_level) {
            let index = deps.wad.level_index();
            if index > 0 {
                deps.wad.change_level(index - 1);
            }
        }

        // Update the player list overlay when remote players change.
        if deps.net.is_connected() {
            let current_names: Vec<String> =
                deps.net.remote_players.iter().map(|p| p.name.clone()).collect();
            if current_names != self.last_player_names {
                if let Some(old_id) = self.players_text.take() {
                    text.remove(old_id);
                }
                let mut label = format!(
                    "Players online: {}\n",
                    deps.net.remote_players.len() + 1
                );
                for p in &deps.net.remote_players {
                    label.push_str(&format!("  {}\n", p.name));
                }
                self.players_text =
                    Some(text.insert(deps.window, &label, Pnt2f::new(0.75, 0.0), HELP_PADDING));
                self.last_player_names = current_names;
            }
        }
    }

    fn teardown(&mut self, deps: Dependencies) {
        if let Some(id) = self.players_text.take() {
            deps.text.remove(id);
        }
        deps.text.remove(self.help_text);
        deps.text.remove(self.prompt_text);
    }
}

enum HelpState {
    Prompt,
    Shown,
    Hidden,
}

const HELP_PADDING: u32 = 6;
const PROMPT_TEXT: &str = "WASD and mouse, 'E' to push/use, LB to shoot or 'h' for help.";
const HELP_TEXT: &str = r"Use WASD to move and the mouse or arrow keys to aim.
Other keys:
    ESC - to quit
    SPACEBAR - jump
    E - push/interact/use
    Left Click - shoot (only effect is to trigger gun-activated things)
    ` - to toggle mouse grab (backtick)
    f - to toggle fly mode
    c - to toggle clipping (wall collisions)
    Ctrl-N - to change to next level (though using the exit will also do this!)
    Ctrl-P - to change to previous level
    h - toggle this help message";

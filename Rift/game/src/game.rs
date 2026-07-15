use super::errors::{ErrorKind, Result};
use super::game_shaders::GameShaders;
use super::hud::{Bindings as HudBindings, Hud};
use super::level::Level;
use super::net_state::NetState;
use super::player::{Bindings as PlayerBindings, Config as PlayerConfig, Player};
use super::title::{TitleScreen, TitleState};
use super::wad_system::{Config as WadConfig, WadSystem};
use super::SHADER_ROOT;
use engine::type_list::Peek;
use engine::{
    Context, ContextBuilder, Entities, FrameTimers, Input, Materials, Meshes, Projections,
    RenderPipeline, Renderer, Scancode, ShaderConfig, Shaders, System, TextRenderer, Tick,
    TickConfig, Transforms, Uniforms, Window, WindowConfig,
};
use failchain::ResultExt;
use std::marker::PhantomData;
use std::path::PathBuf;

pub trait Game {
    fn run(self) -> !;
    fn destroy(&mut self) -> Result<()>;
    fn num_levels(&self) -> usize;
    fn load_level(&mut self, level_index: usize) -> Result<()>;

    // --- Headless / scripted-input API (used by the demo test harness) ---

    /// Put the game into headless stepping mode: stop trying to grab/hide the
    /// OS cursor so the simulation can be driven by `step_once` + `set_key`
    /// without a live event loop.
    fn begin_headless(&mut self);

    /// Set a key's held state for the next `step_once` (scripted input).
    fn set_key(&mut self, code: Scancode, pressed: bool);

    /// Advance the simulation by exactly one fixed tick, outside the windowing
    /// event loop. Mirrors what one iteration of `run` would do, minus the
    /// real input/sleep handling.
    fn step_once(&mut self) -> Result<()>;

    /// Current world-space player position as `[x, y, z]`.
    fn player_position(&self) -> [f32; 3];

    /// Write the currently rendered frame to `path` as a binary PPM (P6) image.
    /// Used by the headless harness to visually verify rendering without a
    /// display. Captures the GL front buffer, so it reflects exactly what was
    /// drawn on the last frame-producing step.
    fn screenshot_ppm(&self, path: &std::path::Path) -> Result<()>;
}

#[derive(Clone)]
pub struct GameConfig {
    pub wad_file: PathBuf,
    pub metadata_file: PathBuf,
    pub fov: f32,
    /// Target frames-per-second / simulation rate. Drives the fixed tick timestep.
    pub fps: f32,
    pub width: u32,
    pub height: u32,
    pub version: &'static str,
    pub initial_level_index: usize,
    /// If Some, connect to this address (e.g. "192.168.1.5:7777") for multiplayer.
    pub server_addr: Option<String>,
    pub player_name: String,
}

pub fn create(config: &GameConfig) -> Result<impl Game> {
    let net_state = match config.server_addr.as_deref() {
        Some(addr) => NetState::connect(addr, &config.player_name),
        None => NetState::offline(),
    };

    let context = (|| {
        ContextBuilder::new()
            // Engine configs and systems.
            .inject(TickConfig {
                timestep: 1.0 / config.fps,
            })
            .inject(WindowConfig {
                width: config.width,
                height: config.height,
                title: format!("Rift v{}", config.version),
            })
            .inject(ShaderConfig {
                root_path: SHADER_ROOT.into(),
            })
            .system(Tick::bind())?
            .system(FrameTimers::bind())?
            .system(Window::bind())?
            .system(Input::bind())?
            .system(Entities::bind())?
            .system(Transforms::bind())?
            .system(Projections::bind())?
            .system(Shaders::bind())?
            .system(Uniforms::bind())?
            .system(Meshes::bind())?
            .system(Materials::bind())?
            .system(RenderPipeline::bind())?
            .system(TextRenderer::bind())?
            // Game configs and systems.
            .inject(WadConfig {
                wad_path: config.wad_file.clone(),
                metadata_path: config.metadata_file.clone(),
                initial_level_index: config.initial_level_index,
            })
            .inject(HudBindings::default())
            .inject(PlayerBindings::default())
            .inject(PlayerConfig::default())
            .inject_mut(net_state)
            .inject_mut(TitleState::default())
            .system(WadSystem::bind())?
            .system(GameShaders::bind())?
            .system(Level::bind())?
            .system(Hud::bind())?
            .system(Player::bind())?
            .system(Renderer::bind())?
            // Added last so it updates after the renderer: while the title is up
            // the renderer is a no-op (no camera) and this draws the frame.
            .system(TitleScreen::bind())?
            .build()
    })()
    .chain_err(|| ErrorKind("during setup".to_owned()))?;

    Ok(GameImpl::new(context))
}

// The index type params (`*IndexT`) let the type-list locate each system inside
// the heterogeneous context; they're all inferred at the `create` call site.
struct GameImpl<WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT, ContextT>
where
    ContextT: Context
        + Peek<WadSystem, WadIndexT>
        + Peek<Player, PlayerIndexT>
        + Peek<Transforms, TransformsIndexT>
        + Peek<Input, InputIndexT>
        + Peek<Window, WindowIndexT>,
{
    context: Option<ContextT>,
    phantom: PhantomData<(WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT)>,
}

impl<WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT, ContextT>
    GameImpl<WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT, ContextT>
where
    ContextT: Context
        + Peek<WadSystem, WadIndexT>
        + Peek<Player, PlayerIndexT>
        + Peek<Transforms, TransformsIndexT>
        + Peek<Input, InputIndexT>
        + Peek<Window, WindowIndexT>,
{
    fn new(context: ContextT) -> Self {
        Self {
            context: Some(context),
            phantom: PhantomData,
        }
    }
}

impl<WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT, ContextT> Game
    for GameImpl<WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT, ContextT>
where
    ContextT: Context
        + Peek<WadSystem, WadIndexT>
        + Peek<Player, PlayerIndexT>
        + Peek<Transforms, TransformsIndexT>
        + Peek<Input, InputIndexT>
        + Peek<Window, WindowIndexT>,
{
    fn run(mut self) -> ! {
        self.context.take().unwrap().run()
    }

    fn num_levels(&self) -> usize {
        let wad: &WadSystem = self.context.as_ref().unwrap().peek();
        wad.archive.num_levels()
    }

    fn load_level(&mut self, level_index: usize) -> Result<()> {
        let context = self.context.as_mut().unwrap();
        let wad: &mut WadSystem = context.peek_mut();
        wad.change_level(level_index);
        context
            .step()
            .chain_err(|| ErrorKind("during load_level first step".to_owned()))?;
        context
            .step()
            .chain_err(|| ErrorKind("during load_level second step".to_owned()))?;
        Ok(())
    }

    fn begin_headless(&mut self) {
        let input: &mut Input = self.context.as_mut().unwrap().peek_mut();
        input.set_cursor_grabbed(false);
        input.set_mouse_enabled(false);
    }

    fn set_key(&mut self, code: Scancode, pressed: bool) {
        let input: &mut Input = self.context.as_mut().unwrap().peek_mut();
        input.set_key(code, pressed);
    }

    fn step_once(&mut self) -> Result<()> {
        self.context
            .as_mut()
            .unwrap()
            .step()
            .chain_err(|| ErrorKind("during demo step".to_owned()))
    }

    fn player_position(&self) -> [f32; 3] {
        let context = self.context.as_ref().unwrap();
        let player: &Player = context.peek();
        let transforms: &Transforms = context.peek();
        let position = player.position(transforms);
        [position.x, position.y, position.z]
    }

    fn screenshot_ppm(&self, path: &std::path::Path) -> Result<()> {
        use std::io::Write;
        let window: &Window = self.context.as_ref().unwrap().peek();
        let (width, height, rgb) = window.read_front_buffer_rgb();
        let mut file = std::fs::File::create(path)
            .chain_err(|| ErrorKind("creating screenshot file".to_owned()))?;
        write!(file, "P6\n{} {}\n255\n", width, height)
            .chain_err(|| ErrorKind("writing screenshot header".to_owned()))?;
        file.write_all(&rgb)
            .chain_err(|| ErrorKind("writing screenshot pixels".to_owned()))?;
        Ok(())
    }

    fn destroy(&mut self) -> Result<()> {
        if let Some(context) = self.context.as_mut() {
            context
                .destroy()
                .chain_err(|| ErrorKind("during explicit destroy".to_owned()))?;
        }
        Ok(())
    }
}

impl<WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT, ContextT> Drop
    for GameImpl<WadIndexT, PlayerIndexT, TransformsIndexT, InputIndexT, WindowIndexT, ContextT>
where
    ContextT: Context
        + Peek<WadSystem, WadIndexT>
        + Peek<Player, PlayerIndexT>
        + Peek<Transforms, TransformsIndexT>
        + Peek<Input, InputIndexT>
        + Peek<Window, WindowIndexT>,
{
    fn drop(&mut self) {
        if let Some(mut context) = self.context.take() {
            let _ = context.destroy();
        }
    }
}

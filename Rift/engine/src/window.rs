use super::errors::{Error, ErrorKind, Result};
use super::platform;
use super::system::System;
use glium::{
    framebuffer::{DepthRenderBuffer, SimpleFrameBuffer},
    glutin::{
        dpi::PhysicalSize, event_loop::EventLoop, window::WindowBuilder, Api, ContextBuilder,
        GlProfile, GlRequest,
    },
    texture::{DepthFormat, RawImage2d, Texture2d, UncompressedFloatFormat},
    Display, Frame, Surface,
};

const OPENGL_DEPTH_SIZE: u8 = 24;

pub struct WindowConfig {
    pub width: u32,
    pub height: u32,
    pub title: String,
}

pub struct Window {
    display: Display,
    event_loop: Option<EventLoop<()>>,
    width: u32,
    height: u32,

    // Offscreen render target for headless screenshots. When present, the
    // renderer draws the scene into `capture_color` (an application-owned
    // texture) and `read_front_buffer_rgb` reads it back — capture that's
    // independent of the windowing system's presentation/swapchain, so it
    // doesn't depend on a readable front buffer. Created only in capture mode.
    capture_color: Option<Texture2d>,
    capture_depth: Option<DepthRenderBuffer>,
}

impl Window {
    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn aspect_ratio(&self) -> f32 {
        self.width as f32 / self.height as f32
    }

    pub fn draw(&self) -> Frame {
        let mut frame = self.display.draw();
        frame.clear_all_srgb((0.06, 0.07, 0.09, 1.0), 1.0, 0);
        frame
    }

    pub fn facade(&self) -> &Display {
        &self.display
    }

    /// If running in headless capture mode, the offscreen color+depth target the
    /// renderer should draw the scene into (so it can be read back reliably).
    /// Returns `None` for normal on-screen rendering.
    pub fn capture_target(&self) -> Option<(&Texture2d, &DepthRenderBuffer)> {
        match (&self.capture_color, &self.capture_depth) {
            (Some(color), Some(depth)) => Some((color, depth)),
            _ => None,
        }
    }

    /// A `Surface` over the offscreen capture target, ready to draw into.
    pub fn capture_surface(&self) -> Option<SimpleFrameBuffer<'_>> {
        let (color, depth) = self.capture_target()?;
        SimpleFrameBuffer::with_depth_buffer(&self.display, color, depth).ok()
    }

    /// Read the currently displayed front buffer back from the GPU as RGB8,
    /// ordered top-to-bottom (the GL front buffer is bottom-up, so we flip it).
    /// Used by the headless `--screenshot` path to capture what was rendered.
    ///
    /// Caveat: this needs a GL stack that can read the presented window buffer.
    /// Real GPUs and classic Mesa swrast can; some software stacks under Xvfb
    /// (Zink-on-lavapipe) cannot and return all-black here — on those, rely on
    /// the demo's functional assertions rather than the screenshot.
    pub fn read_front_buffer_rgb(&self) -> (u32, u32, Vec<u8>) {
        // In capture mode read back the offscreen texture the renderer drew into
        // (reliable wherever texture readback works); otherwise fall back to the
        // presented front buffer.
        let image: RawImage2d<u8> = match &self.capture_color {
            Some(color) => color.read(),
            None => self
                .display
                .read_front_buffer()
                .expect("failed to read front buffer"),
        };
        let (w, h) = (image.width as usize, image.height as usize);
        let src = image.data;
        let mut rgb = vec![0u8; w * h * 3];
        for y in 0..h {
            let src_row = (h - 1 - y) * w * 4; // GL images are bottom-up; flip.
            let dst_row = y * w * 3;
            for x in 0..w {
                rgb[dst_row + x * 3] = src[src_row + x * 4];
                rgb[dst_row + x * 3 + 1] = src[src_row + x * 4 + 1];
                rgb[dst_row + x * 3 + 2] = src[src_row + x * 4 + 2];
            }
        }
        (image.width, image.height, rgb)
    }

    pub(crate) fn take_event_loop(&mut self) -> Option<EventLoop<()>> {
        self.event_loop.take()
    }
}

impl<'context> System<'context> for Window {
    type Dependencies = &'context WindowConfig;
    type Error = Error;

    fn create(config: &'context WindowConfig) -> Result<Self> {
        let events = EventLoop::new();

        let window = WindowBuilder::new()
            .with_inner_size(PhysicalSize {
                width: config.width,
                height: config.height,
            })
            .with_title(config.title.clone());

        let mut context = ContextBuilder::new()
            .with_gl_profile(GlProfile::Core)
            .with_gl(GlRequest::Specific(
                Api::OpenGl,
                (platform::GL_MAJOR_VERSION, platform::GL_MINOR_VERSION),
            ))
            .with_depth_buffer(OPENGL_DEPTH_SIZE);

        // Headless capture: with double buffering the rendered image lives in a
        // back/scanout buffer that some software-GL stacks under Xvfb never make
        // readable, so `read_front_buffer` returns black. A single-buffered
        // context draws straight into the buffer we read back, which makes
        // `--screenshot` capture real pixels on stacks that honor it. Opt in via
        // RIFT_SINGLE_BUFFERED=1; normal on-screen runs keep double buffering to
        // avoid flicker.
        if std::env::var_os("RIFT_SINGLE_BUFFERED").is_some() {
            context = context.with_double_buffer(Some(false));
        }

        let display = Display::new(window, context, &events)
            .map_err(ErrorKind::create_window(config.width, config.height))?;

        // In capture mode, allocate an offscreen color texture + depth buffer the
        // renderer draws into, so screenshots read back the rendered image
        // directly rather than relying on a presented front buffer.
        let (capture_color, capture_depth) = if std::env::var_os("RIFT_SINGLE_BUFFERED").is_some() {
            let color = Texture2d::empty_with_format(
                &display,
                UncompressedFloatFormat::U8U8U8U8,
                glium::texture::MipmapsOption::NoMipmap,
                config.width,
                config.height,
            )
            .map_err(ErrorKind::glium("capture color texture"))?;
            let depth =
                DepthRenderBuffer::new(&display, DepthFormat::F32, config.width, config.height)
                    .map_err(|error| -> Error {
                        ErrorKind::CreateWindow(format!("capture depth buffer: {:?}", error)).into()
                    })?;
            (Some(color), Some(depth))
        } else {
            (None, None)
        };

        Ok(Window {
            display,
            event_loop: Some(events),
            width: config.width,
            height: config.height,
            capture_color,
            capture_depth,
        })
    }

    fn debug_name() -> &'static str {
        "window"
    }
}

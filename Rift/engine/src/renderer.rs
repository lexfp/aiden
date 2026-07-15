use super::errors::{Error, ErrorKind, Result};
use super::materials::Materials;
use super::meshes::Meshes;
use super::pipeline::{Model, RenderPipeline};
use super::projections::Projections;
use super::shaders::Shaders;
use super::system::System;
use super::text::TextRenderer;
use super::tick::Tick;
use super::transforms::Transforms;
use super::uniforms::Uniforms;
use super::window::Window;
use crate::internal_derive::DependenciesFrom;
use failchain::ResultExt;
use glium::{BackfaceCullingMode, Depth, DepthTest, DrawParameters, Surface};
use log::{error, info};
use math::prelude::*;
use math::{Mat4, Trans3};

#[derive(DependenciesFrom)]
pub struct Dependencies<'context> {
    pipe: &'context mut RenderPipeline,
    meshes: &'context Meshes,
    materials: &'context Materials,
    shaders: &'context Shaders,
    text: &'context TextRenderer,
    window: &'context Window,
    transforms: &'context Transforms,
    projections: &'context Projections,
    uniforms: &'context mut Uniforms,
    tick: &'context Tick,
}

pub struct Renderer {
    draw_parameters: DrawParameters<'static>,
    removed: Vec<usize>,
}

impl<'context> System<'context> for Renderer {
    type Dependencies = Dependencies<'context>;
    type Error = Error;

    fn debug_name() -> &'static str {
        "renderer"
    }

    fn create(_deps: Dependencies) -> Result<Self> {
        Ok(Renderer {
            draw_parameters: DrawParameters {
                depth: Depth {
                    test: DepthTest::IfLess,
                    write: true,
                    ..Depth::default()
                },
                backface_culling: BackfaceCullingMode::CullClockwise,
                ..DrawParameters::default()
            },
            removed: Vec::with_capacity(32),
        })
    }

    fn update(&mut self, deps: Dependencies) -> Result<()> {
        // If the current tick isn't a frame, skip all rendering.
        if !deps.tick.is_frame() {
            return Ok(());
        }

        let pipe = deps.pipe;

        // If no camera is given, skip rendering.
        let camera_id = if let Some(camera_id) = pipe.camera {
            camera_id
        } else {
            return Ok(());
        };

        // Compute view transform by inverting the camera entity transform.
        let view_transform = if let Some(transform) = deps.transforms.get_absolute(camera_id) {
            transform
                .inverse_transform()
                .expect("singular view transform")
        } else {
            info!("Camera transform missing, disabling renderer.");
            pipe.camera = None;
            return Ok(());
        };
        let view_matrix = view_transform.into();

        // Set projection.
        *deps
            .uniforms
            .get_mat4_mut(pipe.projection)
            .expect("projection uniform missing") = *deps
            .projections
            .get_matrix(camera_id)
            .expect("camera projection missing");

        // Draw the scene into the offscreen capture target if one exists (used by
        // headless `--screenshot` so readback doesn't depend on a presented front
        // buffer); otherwise draw into the window's framebuffer and present it.
        if let Some(mut surface) = deps.window.capture_surface() {
            surface.clear_color_and_depth((0.06, 0.07, 0.09, 1.0), 1.0);
            Self::draw_scene(
                &mut self.removed,
                &self.draw_parameters,
                &mut surface,
                pipe,
                deps.meshes,
                deps.materials,
                deps.shaders,
                deps.transforms,
                deps.uniforms,
                deps.text,
                &view_transform,
                view_matrix,
            )?;
        } else {
            let mut frame = deps.window.draw();
            Self::draw_scene(
                &mut self.removed,
                &self.draw_parameters,
                &mut frame,
                pipe,
                deps.meshes,
                deps.materials,
                deps.shaders,
                deps.transforms,
                deps.uniforms,
                deps.text,
                &view_transform,
                view_matrix,
            )?;
            // TODO(cristicbz): Re-architect a little bit to support rebuilding the context.
            frame
                .finish()
                .expect("Cannot handle context loss currently :(");
        }

        // Remove any missing models.
        for &index in self.removed.iter().rev() {
            pipe.models.remove_by_index(index);
        }
        self.removed.clear();
        Ok(())
    }
}

impl Renderer {
    // Draw all models (and overlaid text) for one frame into `target`. Generic
    // over the surface so it serves both the on-screen frame and the offscreen
    // capture texture used by headless screenshots.
    #[allow(clippy::too_many_arguments)]
    fn draw_scene<S: Surface>(
        removed: &mut Vec<usize>,
        draw_parameters: &DrawParameters<'_>,
        target: &mut S,
        pipe: &RenderPipeline,
        meshes: &Meshes,
        materials: &Materials,
        shaders: &Shaders,
        transforms: &Transforms,
        uniforms: &mut Uniforms,
        text: &TextRenderer,
        view_transform: &Trans3,
        view_matrix: Mat4,
    ) -> Result<()> {
        for (index, &Model { mesh, material }) in pipe.models.access().iter().enumerate() {
            // For each model we need to assemble three things to render it: transform, mesh and
            // material. We get the entity id and query the corresponding systems for it.
            let entity = pipe
                .models
                .index_to_id(index)
                .expect("bad index enumerating models: mesh");

            // If the mesh is missing, the entity was (probably) removed. So we add it to the
            // removed stack and continue.
            let mesh = if let Some(mesh) = meshes.get(mesh) {
                mesh
            } else {
                info!(
                    "Mesh missing {:?} in model for entity {:?}, removing.",
                    mesh, entity
                );
                removed.push(index);
                continue;
            };

            // If the model has a transform, then multiply it with the view transform to get the
            // modelview matrix. If there is no transform, model is assumed to be in world space, so
            // modelview = view.
            *uniforms
                .get_mat4_mut(pipe.modelview)
                .expect("modelview uniform missing") =
                if let Some(model_transform) = transforms.get_absolute(entity) {
                    Mat4::from(view_transform.concat(model_transform))
                } else {
                    view_matrix
                };

            let material = if let Some(material) = materials.get(shaders, uniforms, material) {
                material
            } else {
                // If there is a mesh but no material, the model is badly set up. This is an error.
                error!(
                    "Material missing {:?} in model for entity {:?}, removing.",
                    material, entity
                );
                removed.push(index);
                continue;
            };

            target
                .draw(&mesh, &mesh, material.shader(), &material, draw_parameters)
                .map_err(ErrorKind::glium("renderer"))?;
        }

        // Render text. TODO(cristicbz): text should render itself :(
        text.render(target)
            .chain_err(|| ErrorKind::System("render bypass", TextRenderer::debug_name()))?;
        Ok(())
    }
}

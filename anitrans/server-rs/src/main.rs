//! AniTrans web server in Rust: serves the upload page and a /predict endpoint
//! backed by the ONNX-exported breed classifier (CPU inference via tract).
//!
//! Run from anywhere:
//!     cargo run --release --manifest-path server-rs/Cargo.toml
//! Expects model/anitrans.onnx and model/labels.json (created by train/export_onnx.py).

use std::path::Path;
use std::sync::Arc;

use axum::{
    extract::{DefaultBodyLimit, Multipart, State},
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use image::imageops::FilterType;
use serde::Serialize;
use tower_http::services::{ServeDir, ServeFile};
use tract_onnx::prelude::*;

type Model = SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

/// The 12 cat breeds in the Oxford-IIIT Pet dataset; the other 25 are dogs.
const CAT_BREEDS: [&str; 12] = [
    "Abyssinian", "Bengal", "Birman", "Bombay", "British Shorthair",
    "Egyptian Mau", "Maine Coon", "Persian", "Ragdoll", "Russian Blue",
    "Siamese", "Sphynx",
];

struct AppState {
    model: Model,
    labels: Vec<String>,
}

#[derive(Serialize)]
struct Prediction {
    breed: String,
    species: &'static str,
    confidence: f32,
}

#[derive(Serialize)]
struct PredictResponse {
    predictions: Vec<Prediction>,
}

#[derive(Serialize)]
struct ErrorResponse {
    detail: String,
}

fn project_root() -> &'static Path {
    // server-rs/ lives directly under the project root.
    Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap()
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let root = project_root();
    let labels: Vec<String> =
        serde_json::from_str(&std::fs::read_to_string(root.join("model/labels.json"))?)?;
    let model = tract_onnx::onnx()
        .model_for_path(root.join("model/anitrans.onnx"))?
        .with_input_fact(0, f32::fact([1, 3, 224, 224]).into())?
        .into_optimized()?
        .into_runnable()?;
    println!("Model loaded ({} breeds)", labels.len());

    let state = Arc::new(AppState { model, labels });

    let app = Router::new()
        .route_service("/", ServeFile::new(root.join("web/index.html")))
        .nest_service("/static", ServeDir::new(root.join("web")))
        .route("/predict", post(predict))
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8000").await?;
    println!("AniTrans (Rust) running on http://127.0.0.1:8000");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn predict(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<PredictResponse>, (StatusCode, Json<ErrorResponse>)> {
    let mut file_bytes: Option<Vec<u8>> = None;
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("file") {
            file_bytes = field.bytes().await.ok().map(|b| b.to_vec());
            break;
        }
    }
    let bytes = file_bytes.ok_or_else(|| err(StatusCode::BAD_REQUEST, "No 'file' field in upload."))?;

    // Image decode + inference are CPU-heavy: run off the async threads.
    let result = tokio::task::spawn_blocking(move || classify(&state, &bytes))
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Inference task failed."))?;

    match result {
        Ok(predictions) => Ok(Json(PredictResponse { predictions })),
        Err(e) => Err(err(StatusCode::BAD_REQUEST, &format!("Couldn't process that image: {e}"))),
    }
}

fn classify(state: &AppState, bytes: &[u8]) -> anyhow::Result<Vec<Prediction>> {
    let img = image::load_from_memory(bytes)?;

    // Match the Python preprocessing: resize shorter side to 256, center-crop 224.
    let (w, h) = (img.width(), img.height());
    let (nw, nh) = if w < h {
        (256, (256.0 * h as f32 / w as f32).round() as u32)
    } else {
        ((256.0 * w as f32 / h as f32).round() as u32, 256)
    };
    let img = img.resize_exact(nw, nh, FilterType::Triangle);
    let img = img.crop_imm((nw - 224) / 2, (nh - 224) / 2, 224, 224).to_rgb8();

    let input = tract_ndarray::Array4::from_shape_fn((1, 3, 224, 224), |(_, c, y, x)| {
        let v = img.get_pixel(x as u32, y as u32)[c] as f32 / 255.0;
        (v - MEAN[c]) / STD[c]
    });

    let outputs = state.model.run(tvec!(Tensor::from(input).into()))?;
    let logits = outputs[0].to_array_view::<f32>()?;
    let logits: Vec<f32> = logits.iter().copied().collect();

    // Softmax
    let max = logits.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    let exps: Vec<f32> = logits.iter().map(|&l| (l - max).exp()).collect();
    let sum: f32 = exps.iter().sum();

    let mut probs: Vec<(usize, f32)> = exps.iter().map(|&e| e / sum).enumerate().collect();
    probs.sort_by(|a, b| b.1.total_cmp(&a.1));

    Ok(probs
        .into_iter()
        .take(5)
        .map(|(i, p)| Prediction {
            breed: state.labels[i].clone(),
            species: if CAT_BREEDS.contains(&state.labels[i].as_str()) { "cat" } else { "dog" },
            confidence: (p * 10000.0).round() / 10000.0,
        })
        .collect())
}

fn err(code: StatusCode, msg: &str) -> (StatusCode, Json<ErrorResponse>) {
    (code, Json(ErrorResponse { detail: msg.to_string() }))
}

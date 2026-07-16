"""FastAPI server: serves the web page and a /predict endpoint backed by the trained model.

Run from the project root:
    uvicorn server.app:app --reload
"""

import io
from pathlib import Path

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from torch import nn
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent  # the portfolio site lives at the repo root (deployed via GitHub Pages)
MODEL_PATH = ROOT / "model" / "anitrans.pt"
MOOD_MODEL_PATH = ROOT / "model" / "anitrans_mood.pt"

# What each detected mood means the pet probably wants.
MOOD_WANTS = {
    "happy": "Playtime! They're in a great mood — grab a toy or keep doing what you're doing.",
    "relaxed": "Nothing much — they're content and just want to chill, ideally near you.",
    "sad": "Comfort. Some attention, gentle pets, or a treat would go a long way right now.",
    "angry": "Space. Something's bugging them — back off a little and check what's bothering them.",
}

# The 12 cat breeds in the Oxford-IIIT Pet dataset; the other 25 are dogs.
CAT_BREEDS = {
    "Abyssinian", "Bengal", "Birman", "Bombay", "British Shorthair",
    "Egyptian Mau", "Maine Coon", "Persian", "Ragdoll", "Russian Blue",
    "Siamese", "Sphynx",
}

PREPROCESS = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

app = FastAPI(title="AniTrans")

model: nn.Module | None = None
classes: list[str] = []
mood_model: nn.Module | None = None
mood_classes: list[str] = []
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_resnet(path: Path) -> tuple[nn.Module, list[str]]:
    checkpoint = torch.load(path, map_location=device, weights_only=True)
    net = models.resnet50(weights=None)
    net.fc = nn.Linear(net.fc.in_features, len(checkpoint["classes"]))
    net.load_state_dict(checkpoint["state_dict"])
    net.eval().to(device)
    return net, checkpoint["classes"]


@app.on_event("startup")
def load_model():
    global model, classes, mood_model, mood_classes
    import sys
    if sys.platform == "win32":
        # Keep the machine awake while serving — Modern Standby's idle timeout
        # otherwise kills the server (and breaks phones using it over the LAN).
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)
    if MODEL_PATH.exists():
        model, classes = load_resnet(MODEL_PATH)
        print(f"Breed model loaded ({len(classes)} breeds) on {device}")
    else:
        print(f"WARNING: no trained model at {MODEL_PATH} — run train/train.py first. "
              "/predict will return 503 until then.")
    if MOOD_MODEL_PATH.exists():
        mood_model, mood_classes = load_resnet(MOOD_MODEL_PATH)
        print(f"Mood model loaded ({len(mood_classes)} moods) on {device}")
    else:
        print(f"WARNING: no mood model at {MOOD_MODEL_PATH} — run train/train_mood.py first. "
              "/predict-mood will return 503 until then.")


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(503, "Model not trained yet — run train/train.py first.")
    try:
        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    except Exception:
        raise HTTPException(400, "Couldn't read that file as an image.")

    batch = PREPROCESS(image).unsqueeze(0).to(device)
    with torch.no_grad():
        probs = torch.softmax(model(batch)[0], dim=0)

    top = torch.topk(probs, k=5)
    results = [
        {
            "breed": classes[i],
            "species": "cat" if classes[i] in CAT_BREEDS else "dog",
            "confidence": round(p.item(), 4),
        }
        for p, i in zip(top.values, top.indices)
    ]
    return {"predictions": results}


@app.post("/predict-mood")
async def predict_mood(file: UploadFile = File(...)):
    if mood_model is None:
        raise HTTPException(503, "Mood model not trained yet — run train/train_mood.py first.")
    try:
        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    except Exception:
        raise HTTPException(400, "Couldn't read that file as an image.")

    batch = PREPROCESS(image).unsqueeze(0).to(device)
    with torch.no_grad():
        probs = torch.softmax(mood_model(batch)[0], dim=0)

    order = torch.argsort(probs, descending=True)
    moods = [
        {"mood": mood_classes[i], "confidence": round(probs[i].item(), 4)}
        for i in order
    ]
    top = moods[0]["mood"]
    return {"moods": moods, "wants": MOOD_WANTS.get(top, "")}


# The portfolio site shares this server locally so /predict works from the
# same origin. In production the same files are served by GitHub Pages.
PAGES = ["index", "breed-detector", "rift", "animal-translator", "about"]


def make_handler(path: Path):
    def handler():
        return FileResponse(path)
    return handler


app.get("/", include_in_schema=False)(make_handler(SITE / "index.html"))
for page in PAGES:
    handler = make_handler(SITE / f"{page}.html")
    app.get(f"/{page}", include_in_schema=False)(handler)
    app.get(f"/{page}.html", include_in_schema=False)(handler)

app.mount("/assets", StaticFiles(directory=SITE / "assets"), name="assets")

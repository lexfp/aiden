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
SITE = ROOT.parent / "site"
MODEL_PATH = ROOT / "model" / "anitrans.pt"

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
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


@app.on_event("startup")
def load_model():
    global model, classes
    if not MODEL_PATH.exists():
        print(f"WARNING: no trained model at {MODEL_PATH} — run train/train.py first. "
              "/predict will return 503 until then.")
        return
    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=True)
    classes = checkpoint["classes"]
    net = models.resnet50(weights=None)
    net.fc = nn.Linear(net.fc.in_features, len(classes))
    net.load_state_dict(checkpoint["state_dict"])
    net.eval().to(device)
    model = net
    print(f"Model loaded ({len(classes)} breeds) on {device}")


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


# The portfolio site lives in ../site and shares this server so /predict works
# from the same origin.
PAGES = {
    "/": "index.html",
    "/breed-detector": "breed-detector.html",
    "/rift": "rift.html",
    "/animal-translator": "animal-translator.html",
    "/about": "about.html",
}

for route, filename in PAGES.items():
    def make_handler(path: Path):
        def handler():
            return FileResponse(path)
        return handler

    app.get(route, include_in_schema=False)(make_handler(SITE / filename))


app.mount("/assets", StaticFiles(directory=SITE / "assets"), name="assets")

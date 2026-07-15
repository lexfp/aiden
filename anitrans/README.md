# AniTrans 🐾

Upload a photo of your cat or dog and a model **you trained yourself** tells you the breed.

Covers the 37 breeds (25 dog, 12 cat) in the [Oxford-IIIT Pet dataset](https://www.robots.ox.ac.uk/~vgg/data/pets/).

## How it works

- `train/train.py` — fine-tunes a pretrained ResNet-50 (transfer learning): the ImageNet
  backbone is mostly frozen, and the last stage + a new 37-class head are trained on pet photos.
- `server/app.py` — FastAPI server. Loads `model/anitrans.pt` and exposes `POST /predict`.
- `web/index.html` — drag-and-drop upload page, served by the same server at `/`.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
pip install -r requirements.txt
```

## Train

```powershell
python train\train.py
```

First run downloads the dataset (~800 MB) into `data/`. Training saves the best
checkpoint to `model/anitrans.pt`. Expect roughly 85–92% test accuracy after 8 epochs.

## Run the website

```powershell
uvicorn server.app:app --reload
```

Then open http://127.0.0.1:8000

## Next ideas

- Mood / "what they want" prediction (needs a labeled dataset — much harder to find)
- Reject photos that aren't cats or dogs (confidence threshold or an "other" class)
- More breeds via the Stanford Dogs dataset (120 dog breeds)

# AniTrans 🐾

Snap a photo of your cat or dog and models **you trained yourself** tell you the breed,
the mood, and what your pet probably wants.

- **Breed**: the 37 breeds (25 dog, 12 cat) in the [Oxford-IIIT Pet dataset](https://www.robots.ox.ac.uk/~vgg/data/pets/).
- **Mood**: angry / happy / relaxed / sad, trained on ~5,600 photos merged from
  [Dog Emotion v2](https://huggingface.co/datasets/Dewa/Dog_Emotion_Dataset_v2) (Hugging Face) and the
  [Pet's Facial Expression dataset](https://www.kaggle.com/datasets/anshtanwar/pets-facial-expression-dataset) (Kaggle).
- **Video (experimental)**: 5 emotions from video clips
  ([DogEmo, Harvard Dataverse](https://doi.org/10.7910/DVN/B6VROP)) — ResNet-50 frame features + a GRU
  temporal head. Only 62 training videos, so accuracy is modest (~40%).

## How it works

- `train/train.py` — fine-tunes a pretrained ResNet-50 (transfer learning): the ImageNet
  backbone is mostly frozen, and the last stage + a new 37-class head are trained on pet photos.
- `train/fetch_mood_data.py` + `train/train_mood.py` — download/merge the mood datasets and
  fine-tune the mood model the same way (85.7% val accuracy).
- `train/fetch_video_data.py` + `train/extract_video_features.py` + `train/train_video.py` —
  the video pipeline: extract DogEmo, precompute per-frame features, train the GRU head.
- `server/app.py` — FastAPI server. Loads `model/anitrans.pt` + `model/anitrans_mood.pt` and
  exposes `POST /predict` (breed) and `POST /predict-mood` (mood + "what they want").
- The portfolio site's `breed-detector.html` and `animal-translator.html` (repo root) are the
  upload/camera pages, served by the same server.

Long-running scripts and the server hold a Windows keep-awake request
(`train/keep_awake.py`) — Modern Standby otherwise kills them on idle.

To use from a phone: run `uvicorn server.app:app --host 0.0.0.0` and open
`http://<pc-lan-ip>:8000/animal-translator.html` on the same Wi-Fi (allow TCP 8000
through Windows Firewall once).

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

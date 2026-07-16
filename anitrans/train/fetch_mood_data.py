"""Download and merge pet-mood datasets found on the web into data/mood/.

Sources:
  1. Hugging Face: Dewa/Dog_Emotion_Dataset_v2 (~4000 dog photos,
     labels: sad / angry / relaxed / happy, parquet format, public).
  2. Kaggle: anshtanwar/pets-facial-expression-dataset (~1000 photos of
     dogs, cats, rabbits, etc., labels: Angry / happy / Sad / Other).
     Downloaded anonymously via kagglehub; the "Other" class is dropped.

Output layout (torchvision ImageFolder compatible):
  data/mood/train/<angry|happy|relaxed|sad>/*.jpg
  data/mood/val/<angry|happy|relaxed|sad>/*.jpg
"""

import io
import shutil
from pathlib import Path

import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MOOD_DIR = ROOT / "data" / "mood"
CLASSES = ["angry", "happy", "relaxed", "sad"]

HF_LABELS = {0: "sad", 1: "angry", 2: "relaxed", 3: "happy"}


def save_image(data: bytes, dest: Path) -> bool:
    try:
        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, "JPEG", quality=92)
        return True
    except Exception as e:
        print(f"  skipped one image ({e})")
        return False


def fetch_hf_dog_emotion():
    from huggingface_hub import snapshot_download

    print("Downloading Dewa/Dog_Emotion_Dataset_v2 from Hugging Face...")
    local = snapshot_download(repo_id="Dewa/Dog_Emotion_Dataset_v2",
                              repo_type="dataset", allow_patterns=["*.parquet"])
    counts = {}
    for pq in sorted(Path(local).rglob("*.parquet")):
        split = "val" if "test" in pq.name.lower() else "train"
        df = pd.read_parquet(pq)
        print(f"  {pq.name}: {len(df)} rows -> {split}")
        for i, row in df.iterrows():
            label = HF_LABELS[int(row["label"])]
            img_bytes = row["image"]["bytes"] if isinstance(row["image"], dict) else row["image"]
            dest = MOOD_DIR / split / label / f"hf_{pq.stem}_{i}.jpg"
            if save_image(img_bytes, dest):
                counts[(split, label)] = counts.get((split, label), 0) + 1
    return counts


def fetch_kaggle_pet_expressions():
    import kagglehub

    print("Downloading anshtanwar/pets-facial-expression-dataset from Kaggle...")
    local = Path(kagglehub.dataset_download("anshtanwar/pets-facial-expression-dataset"))
    counts = {}
    for img_path in local.rglob("*"):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        label = img_path.parent.name.strip().lower()
        if label not in CLASSES:  # drops "Other" and any stray folders
            continue
        split_name = img_path.parent.parent.name.strip().lower()
        split = "val" if split_name in {"valid", "test", "val"} else "train"
        dest = MOOD_DIR / split / label / f"kg_{split_name}_{img_path.stem}.jpg"
        if save_image(img_path.read_bytes(), dest):
            counts[(split, label)] = counts.get((split, label), 0) + 1
    return counts


def main():
    if MOOD_DIR.exists():
        shutil.rmtree(MOOD_DIR)
    for split in ("train", "val"):
        for c in CLASSES:
            (MOOD_DIR / split / c).mkdir(parents=True, exist_ok=True)

    hf = fetch_hf_dog_emotion()
    try:
        kg = fetch_kaggle_pet_expressions()
    except Exception as e:
        print(f"Kaggle download failed ({e}); continuing with Hugging Face data only.")
        kg = {}

    print("\nFinal dataset:")
    for split in ("train", "val"):
        for c in CLASSES:
            n = len(list((MOOD_DIR / split / c).glob("*.jpg")))
            print(f"  {split}/{c}: {n}")
    print(f"\nHF images: {sum(hf.values())}, Kaggle images: {sum(kg.values())}")


if __name__ == "__main__":
    main()

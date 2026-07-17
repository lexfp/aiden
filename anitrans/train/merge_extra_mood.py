"""Additively merge extra Kaggle pet-emotion datasets into data/mood/.

Run after fetch_mood_data.py. Unlike that script this one does NOT wipe
data/mood — it only (re)writes files carrying its own source prefixes, so
re-runs are idempotent and the original HF/Kaggle images are untouched.

Sources (surveyed via survey_mood_candidates.py) and label mappings:
  nguyenvunhuhuynh/cat-emotion-2      Aggressive->angry, Distressed->sad,
                                      Relaxed->relaxed (Alert dropped: no match)
  trendcart/cat-emotions-dataset      Angry/Happy/Sad direct, Normal->relaxed
                                      (Disgusted/Scared/Surprised dropped)
  rafsunahmad/dog-sentiment-...       behavior folders; only unambiguous ones:
                                      Growling->angry, Whining->sad,
                                      tail wags->happy, relaxed stance +
                                      Soft open eyes->relaxed (rest dropped)
  vovusik7/dogs-emotions              happy/sad direct, capped per class so
                                      ~6800 images don't swamp the 4-class balance
"""

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MOOD_DIR = ROOT / "data" / "mood"
CLASSES = ["angry", "happy", "relaxed", "sad"]
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VAL_SPLITS = {"val", "valid", "test"}

# (kaggle_id, file_prefix, {source_folder_name: mood_class}, train_cap_per_class)
SOURCES = [
    ("nguyenvunhuhuynh/cat-emotion-2", "cat2",
     {"Aggressive": "angry", "Distressed": "sad", "Relaxed": "relaxed"}, None),
    ("trendcart/cat-emotions-dataset", "tcart",
     {"Angry": "angry", "Happy": "happy", "Normal": "relaxed", "Sad": "sad"}, None),
    ("rafsunahmad/dog-sentiment-image-classification", "dsent",
     {"dog Growling": "angry", "dog Whining": "sad", "dog tail wags": "happy",
      "dog A relaxed dog stands tall with its tail held high": "relaxed",
      "dog Soft open eyes": "relaxed"}, None),
    ("vovusik7/dogs-emotions", "vovu",
     {"happy": "happy", "sad": "sad"}, 500),
]
VAL_CAP_PER_CLASS = 120  # per source, keeps val from being dominated by one set


def split_of(path: Path, root: Path) -> str:
    parts = {p.lower() for p in path.relative_to(root).parts}
    return "val" if parts & VAL_SPLITS else "train"


def main():
    import kagglehub

    for kaggle_id, prefix, mapping, train_cap in SOURCES:
        print(f"\n=== {kaggle_id} ===", flush=True)
        # idempotent: clear this source's previous contribution
        for old in MOOD_DIR.rglob(f"{prefix}_*.jpg"):
            old.unlink()
        root = Path(kagglehub.dataset_download(kaggle_id))
        added = {}
        counters = {}
        for f in sorted(root.rglob("*")):
            if f.suffix.lower() not in IMG_EXTS:
                continue
            label = mapping.get(f.parent.name.strip())
            if label is None:
                continue
            split = split_of(f.parent, root)
            cap = VAL_CAP_PER_CLASS if split == "val" else train_cap
            key = (split, label)
            if cap is not None and counters.get(key, 0) >= cap:
                continue
            n = counters.get(key, 0)
            dest = MOOD_DIR / split / label / f"{prefix}_{split}_{label}_{n}.jpg"
            try:
                img = Image.open(f).convert("RGB")
                dest.parent.mkdir(parents=True, exist_ok=True)
                img.save(dest, "JPEG", quality=92)
            except Exception as e:
                print(f"  skipped one image ({e})", flush=True)
                continue
            counters[key] = n + 1
            added[key] = added.get(key, 0) + 1
        for (split, label), n in sorted(added.items()):
            print(f"  {split}/{label}: +{n}", flush=True)

    print("\nFinal dataset:", flush=True)
    for split in ("train", "val"):
        for c in CLASSES:
            n = len(list((MOOD_DIR / split / c).glob("*.jpg")))
            print(f"  {split}/{c}: {n}", flush=True)
    print("MERGE_DONE", flush=True)


if __name__ == "__main__":
    main()

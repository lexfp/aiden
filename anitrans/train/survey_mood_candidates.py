"""Download candidate pet-emotion datasets from Kaggle (anonymously via
kagglehub) and print each one's folder structure so we can decide what to
merge into the mood training set."""

from collections import Counter
from pathlib import Path

import kagglehub

CANDIDATES = [
    "nguyenvunhuhuynh/cat-emotion-2",
    "trendcart/cat-emotions-dataset",
    "rafsunahmad/dog-sentiment-image-classification",
    "vovusik7/dogs-emotions",
    "dougandrade/dog-emotions-5-classes",
    "devzohaib/dog-emotions-prediction",
]

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

for ds in CANDIDATES:
    print(f"\n=== {ds} ===", flush=True)
    try:
        root = Path(kagglehub.dataset_download(ds))
    except Exception as e:
        print(f"  DOWNLOAD FAILED: {e}", flush=True)
        continue
    counts = Counter()
    for f in root.rglob("*"):
        if f.suffix.lower() in IMG_EXTS:
            counts[str(f.parent.relative_to(root))] += 1
    print(f"  path: {root}", flush=True)
    for folder, n in sorted(counts.items()):
        print(f"  {folder}: {n} images", flush=True)
print("\nSURVEY_DONE", flush=True)

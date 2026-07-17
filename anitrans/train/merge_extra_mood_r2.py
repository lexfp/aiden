"""Round-2 additive merge into data/mood/: three big dog-emotion datasets.

Two of these almost certainly share images with the HF Dewa set already in
data/mood (devzohaib is its likely upstream), so every candidate image is
deduped against everything already in data/mood — and against the other new
sources — via a 64-bit difference hash of the pixels (survives JPEG
re-encoding, unlike a byte hash).

Class balancing: instead of per-source caps, each (split, class) fills toward
a target count, drawing from sources in order. Sources have no split folders,
so every 10th image (sorted order, deterministic) goes to val.

Idempotent like merge_extra_mood.py: re-runs first delete this script's own
prefixed files.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MOOD_DIR = ROOT / "data" / "mood"
CLASSES = ["angry", "happy", "relaxed", "sad"]
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

TRAIN_TARGET = 3200  # per class
VAL_TARGET = 550     # per class

# (kaggle_id, file_prefix, {source_folder: mood_class})
SOURCES = [
    ("devzohaib/dog-emotions-prediction", "dzoh",
     {"angry": "angry", "happy": "happy", "relaxed": "relaxed", "sad": "sad"}),
    ("danielshanbalico/dog-emotion", "dshan",
     {"angry": "angry", "happy": "happy", "relaxed": "relaxed", "sad": "sad"}),
    ("dougandrade/dog-emotions-5-classes", "doug",
     {"angry": "angry", "happy": "happy", "relax": "relaxed", "frown": "sad"}),
]


def dhash(img: Image.Image) -> int:
    g = img.convert("L").resize((9, 8), Image.LANCZOS)
    px = list(g.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return bits


def main():
    import kagglehub

    for _, prefix, _ in SOURCES:
        for old in MOOD_DIR.rglob(f"{prefix}_*.jpg"):
            old.unlink()

    print("Hashing existing data/mood images...", flush=True)
    seen = set()
    counts = {}  # (split, class) -> current count
    for f in MOOD_DIR.rglob("*.jpg"):
        split, label = f.parent.parent.name, f.parent.name
        counts[(split, label)] = counts.get((split, label), 0) + 1
        try:
            seen.add(dhash(Image.open(f)))
        except Exception:
            pass
    print(f"  {len(seen)} unique hashes, counts: {sorted(counts.items())}", flush=True)

    for kaggle_id, prefix, mapping in SOURCES:
        print(f"\n=== {kaggle_id} ===", flush=True)
        root = Path(kagglehub.dataset_download(kaggle_id))
        added, dupes = {}, 0
        files = sorted(f for f in root.rglob("*") if f.suffix.lower() in IMG_EXTS)
        for i, f in enumerate(files):
            label = mapping.get(f.parent.name.strip().lower())
            if label is None:
                continue
            split = "val" if i % 10 == 0 else "train"
            target = VAL_TARGET if split == "val" else TRAIN_TARGET
            key = (split, label)
            if counts.get(key, 0) >= target:
                continue
            try:
                img = Image.open(f).convert("RGB")
            except Exception:
                continue
            h = dhash(img)
            if h in seen:
                dupes += 1
                continue
            seen.add(h)
            n = counts.get(key, 0)
            dest = MOOD_DIR / split / label / f"{prefix}_{split}_{label}_{n}.jpg"
            dest.parent.mkdir(parents=True, exist_ok=True)
            img.save(dest, "JPEG", quality=92)
            counts[key] = n + 1
            added[key] = added.get(key, 0) + 1
        for key, n in sorted(added.items()):
            print(f"  {key[0]}/{key[1]}: +{n}", flush=True)
        print(f"  duplicates skipped: {dupes}", flush=True)

    print("\nFinal dataset:", flush=True)
    for split in ("train", "val"):
        for c in CLASSES:
            n = len(list((MOOD_DIR / split / c).glob("*.jpg")))
            print(f"  {split}/{c}: {n}", flush=True)
    print("MERGE_R2_DONE", flush=True)


if __name__ == "__main__":
    main()

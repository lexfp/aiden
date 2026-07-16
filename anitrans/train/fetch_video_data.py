"""Extract the DogEmo video-frame dataset (Harvard Dataverse) into data/dogemo/.

Source: "VP Face Bounding Box" — doi:10.7910/DVN/B6VROP, from Franzoni et al.,
"Advanced techniques for automated emotion recognition in dogs from video data
through deep learning" (Neural Computing & Applications, 2024).

The zips (downloaded separately via the Dataverse API) contain dog-face crops
extracted frame-by-frame from videos, named <Emotion>_<videoId>_<frame>_0.jpg,
so consecutive frames of one video form a clip.

Output:
  data/dogemo/train/<emotion>/*.jpg   (from the per-emotion zips)
  data/dogemo/test/<emotion>/*.jpg    (from test.zip)
"""

import shutil
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOGEMO = ROOT / "data" / "dogemo"

# Folder names inside the zips -> our class names.
CLASS_MAP = {
    "Positive anticipation": "anticipation",
    "Anticipation": "anticipation",
    "Fear": "fear",
    "Frustration": "frustration",
    "Happiness": "happiness",
    "Relaxed": "relaxed",
}


def extract(zip_path: Path, out_root: Path):
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            p = Path(name)
            if p.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            cls = CLASS_MAP.get(p.parent.name)
            if cls is None:
                continue
            dest = out_root / cls / p.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(name) as src, open(dest, "wb") as dst:
                shutil.copyfileobj(src, dst)


def video_stats(split_dir: Path):
    for cls_dir in sorted(split_dir.iterdir()):
        videos = defaultdict(int)
        for f in cls_dir.glob("*.jpg"):
            vid = f.stem.rsplit("_", 2)[0]  # "Fear_62_00115_0" -> "Fear_62"
            videos[vid] += 1
        n_frames = sum(videos.values())
        print(f"  {split_dir.name}/{cls_dir.name}: {len(videos)} videos, {n_frames} frames")


def main():
    for split in ("train", "test"):
        d = DOGEMO / split
        if d.exists():
            shutil.rmtree(d)

    for z in sorted(DOGEMO.glob("*.zip")):
        out = DOGEMO / ("test" if z.stem == "test" else "train")
        print(f"extracting {z.name} -> {out.name}/")
        extract(z, out)

    print("\nDataset:")
    for split in ("train", "test"):
        video_stats(DOGEMO / split)


if __name__ == "__main__":
    main()

"""Precompute per-frame ResNet-50 features for the DogEmo video dataset.

The R(2+1)D 3D-conv model faults this machine's NVIDIA driver (nvlddmkm
error 153), so the video model is split in two: frozen ResNet-50 features
per frame (this script, plain inference — the same workload the image
training already ran safely), then a small temporal head over the feature
sequences (train/train_video.py).

Output: data/dogemo/features_<split>.pt
  {"videos": [{"vid": str, "label": int, "features": float16 (N, 2048)}],
   "classes": [...]}
"""

import argparse
import time
from collections import defaultdict
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "dogemo"

PREPROCESS = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

BATCH = 32


def main():
    from keep_awake import keep_awake
    keep_awake()
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=None,
                        help="ResNet-50 checkpoint to use as backbone (e.g. model/anitrans_mood.pt); "
                             "default is ImageNet weights")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Extracting on: {device}", flush=True)

    if args.checkpoint:
        ckpt = torch.load(args.checkpoint, map_location=device, weights_only=True)
        backbone = models.resnet50(weights=None)
        backbone.fc = nn.Linear(backbone.fc.in_features, len(ckpt["classes"]))
        backbone.load_state_dict(ckpt["state_dict"])
        print(f"Backbone: {args.checkpoint}", flush=True)
    else:
        backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
        print("Backbone: ImageNet ResNet-50", flush=True)
    backbone.fc = nn.Identity()
    backbone.eval().to(device)

    for split in ("train", "test"):
        split_dir = DATA_DIR / split
        classes = sorted(d.name for d in split_dir.iterdir() if d.is_dir())
        out = {"videos": [], "classes": classes}
        for label, cls in enumerate(classes):
            videos = defaultdict(list)
            for f in (split_dir / cls).glob("*.jpg"):
                parts = f.stem.rsplit("_", 2)
                videos[parts[0]].append((int(parts[1]), f))
            for vid, frames in sorted(videos.items()):
                frames = [f for _, f in sorted(frames)]
                feats = []
                start = time.time()
                with torch.no_grad():
                    for i in range(0, len(frames), BATCH):
                        batch = torch.stack([
                            PREPROCESS(Image.open(p).convert("RGB"))
                            for p in frames[i:i + BATCH]
                        ]).to(device)
                        feats.append(backbone(batch).half().cpu())
                feats = torch.cat(feats)
                out["videos"].append({"vid": vid, "label": label, "features": feats})
                print(f"  {split}/{cls}/{vid}: {tuple(feats.shape)} in {time.time() - start:.0f}s", flush=True)
        dest = DATA_DIR / f"features_{split}.pt"
        torch.save(out, dest)
        print(f"saved {dest} ({len(out['videos'])} videos)", flush=True)
    print("Done.", flush=True)


if __name__ == "__main__":
    main()

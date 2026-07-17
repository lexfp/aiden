"""Evaluate a mood checkpoint on data/mood/val (overall + per-class accuracy).

Usage:
    python train/eval_mood.py [path/to/checkpoint.pt]
"""

import sys
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

ROOT = Path(__file__).resolve().parent.parent
CKPT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "model" / "anitrans_mood.pt"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ckpt = torch.load(CKPT, map_location=device, weights_only=True)
    classes = ckpt["classes"]

    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(classes))
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()

    tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    ds = datasets.ImageFolder(ROOT / "data" / "mood" / "val", transform=tf)
    assert ds.classes == classes, f"class mismatch: {ds.classes} vs {classes}"
    dl = DataLoader(ds, batch_size=32, num_workers=2, pin_memory=True)

    correct = total = 0
    per_class = {c: [0, 0] for c in classes}
    with torch.no_grad():
        for images, labels in dl:
            images, labels = images.to(device), labels.to(device)
            preds = model(images).argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.numel()
            for p, l in zip(preds.cpu(), labels.cpu()):
                per_class[classes[l]][1] += 1
                if p == l:
                    per_class[classes[l]][0] += 1

    print(f"checkpoint: {CKPT.name}", flush=True)
    print(f"overall: {correct / total:.1%} ({correct}/{total})", flush=True)
    for c, (ok, n) in per_class.items():
        print(f"  {c}: {ok / n:.1%} ({ok}/{n})", flush=True)


if __name__ == "__main__":
    main()

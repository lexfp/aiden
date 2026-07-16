"""Train a temporal (GRU) head over per-frame ResNet-50 features to read dog
emotion from video clips.

Two-stage video model (the end-to-end R(2+1)D 3D-conv model faults this
machine's NVIDIA driver — nvlddmkm error 153 — so heavy GPU training is out):
  1. train/extract_video_features.py — frozen ResNet-50 features per frame.
  2. this script — a small GRU over 16-frame feature windows learns the
     temporal patterns (motion, posture changes) that stills can't capture.

Data: DogEmo (Harvard Dataverse, doi:10.7910/DVN/B6VROP) via fetch_video_data.py.
Classes: anticipation, fear, frustration, happiness, relaxed.

Usage:
    python train/train_video.py

Saves the best checkpoint to model/anitrans_video.pt.
"""

import argparse
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "dogemo"
MODEL_PATH = ROOT / "model" / "anitrans_video.pt"

CLIP_LEN = 16


class WindowDataset(Dataset):
    """16-frame windows of precomputed features, cut from each video."""

    def __init__(self, features_path: Path, stride: int):
        blob = torch.load(features_path, weights_only=True)
        self.classes = blob["classes"]
        self.windows = []
        self.vids = []  # source video of each window, for video-level voting
        for v in blob["videos"]:
            feats, label = v["features"].float(), v["label"]
            if len(feats) < CLIP_LEN:
                continue
            for s in range(0, len(feats) - CLIP_LEN + 1, stride):
                self.windows.append((feats[s:s + CLIP_LEN], label))
                self.vids.append(v["vid"])

    def __len__(self):
        return len(self.windows)

    def __getitem__(self, idx):
        return self.windows[idx]


class TemporalHead(nn.Module):
    def __init__(self, num_classes: int, feat_dim: int = 2048, hidden: int = 256):
        super().__init__()
        self.gru = nn.GRU(feat_dim, hidden, num_layers=1, batch_first=True, bidirectional=True)
        self.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(2 * hidden, num_classes))

    def forward(self, x):  # x: (B, T, feat_dim)
        out, _ = self.gru(x)
        return self.fc(out.mean(dim=1))


@torch.no_grad()
def evaluate(model, loader, device) -> float:
    model.eval()
    correct = total = 0
    for feats, labels in loader:
        feats, labels = feats.to(device), labels.to(device)
        preds = model(feats).argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += labels.numel()
    return correct / total


@torch.no_grad()
def evaluate_video_level(model, dataset, device, batch_size: int) -> float:
    """Average the model's probabilities over all windows of each video."""
    model.eval()
    probs_by_vid, label_by_vid = {}, {}
    dl = DataLoader(dataset, batch_size=batch_size, shuffle=False)
    i = 0
    for feats, labels in dl:
        p = torch.softmax(model(feats.to(device)), dim=1).cpu()
        for j in range(len(labels)):
            vid = dataset.vids[i + j]
            probs_by_vid[vid] = probs_by_vid.get(vid, 0) + p[j]
            label_by_vid[vid] = labels[j].item()
        i += len(labels)
    correct = sum(int(probs_by_vid[v].argmax().item() == label_by_vid[v]) for v in probs_by_vid)
    return correct / len(probs_by_vid)


def main():
    from keep_awake import keep_awake
    keep_awake()
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--cpu", action="store_true", help="train on CPU (it's cheap enough)")
    args = parser.parse_args()

    device = torch.device("cpu" if args.cpu or not torch.cuda.is_available() else "cuda")
    print(f"Training on: {device}", flush=True)

    train_ds = WindowDataset(DATA_DIR / "features_train.pt", stride=CLIP_LEN // 2)
    test_ds = WindowDataset(DATA_DIR / "features_test.pt", stride=CLIP_LEN)
    classes = train_ds.classes
    counts = torch.bincount(torch.tensor([l for _, l in train_ds.windows]), minlength=len(classes))
    print(f"{len(classes)} emotions {classes}", flush=True)
    print(f"{len(train_ds)} train windows / {len(test_ds)} test windows", flush=True)
    print("train windows per class:", dict(zip(classes, counts.tolist())), flush=True)

    train_dl = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    test_dl = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False)

    model = TemporalHead(len(classes)).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    weights = (counts.sum() / (len(classes) * counts.clamp(min=1))).float().to(device)
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.1)

    MODEL_PATH.parent.mkdir(exist_ok=True)
    best_acc = 0.0

    for epoch in range(1, args.epochs + 1):
        model.train()
        start = time.time()
        running_loss = 0.0
        for feats, labels in train_dl:
            feats, labels = feats.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(feats), labels)
            if not torch.isfinite(loss):
                continue
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
        scheduler.step()

        acc = evaluate(model, test_dl, device)
        print(f"epoch {epoch}/{args.epochs}: loss {running_loss / len(train_dl):.3f}, "
              f"test accuracy {acc:.1%}, {time.time() - start:.0f}s", flush=True)

        if acc > best_acc:
            best_acc = acc
            torch.save({"arch": "resnet50-gru", "classes": classes,
                        "clip_len": CLIP_LEN,
                        "state_dict": model.state_dict()}, MODEL_PATH)
            print(f"  saved new best model to {MODEL_PATH}", flush=True)

    # Reload the best checkpoint for the final video-level score.
    model.load_state_dict(torch.load(MODEL_PATH, weights_only=True)["state_dict"])
    vid_acc = evaluate_video_level(model, test_ds, device, args.batch_size)
    print(f"Done. Best test accuracy: {best_acc:.1%} (windows), {vid_acc:.1%} (whole videos)", flush=True)


if __name__ == "__main__":
    main()

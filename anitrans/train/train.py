"""Fine-tune a pretrained ResNet-50 on the Oxford-IIIT Pet dataset (37 cat/dog breeds).

Usage:
    python train/train.py                          # fresh run: train layer4 + head
    python train/train.py --full --warm-start model/anitrans.pt --epochs 10
        # improvement run: start from an existing checkpoint and fine-tune
        # the ENTIRE network at low learning rates with stronger augmentation

Saves the best checkpoint to model/anitrans.pt (weights + class names in one file).
When warm-starting, the starting model's accuracy is the baseline — the checkpoint
is only overwritten if a new epoch beats it.
"""

import argparse
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
MODEL_PATH = ROOT / "model" / "anitrans.pt"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def build_model(num_classes: int, full: bool) -> nn.Module:
    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    if not full:
        # Freeze everything except the last residual stage and the classifier head.
        for param in model.parameters():
            param.requires_grad = False
        for param in model.layer4.parameters():
            param.requires_grad = True
        for param in model.fc.parameters():
            param.requires_grad = True
    return model


def make_loaders(batch_size: int, strong_aug: bool):
    aug = [transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
           transforms.RandomHorizontalFlip()]
    if strong_aug:
        aug.append(transforms.TrivialAugmentWide())
    else:
        aug.append(transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2))
    aug += [transforms.ToTensor(), transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD)]
    if strong_aug:
        aug.append(transforms.RandomErasing(p=0.25))
    train_tf = transforms.Compose(aug)

    test_tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    train_ds = datasets.OxfordIIITPet(DATA_DIR, split="trainval", transform=train_tf, download=True)
    test_ds = datasets.OxfordIIITPet(DATA_DIR, split="test", transform=test_tf, download=True)

    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=2, pin_memory=True)
    test_dl = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=2, pin_memory=True)
    return train_dl, test_dl, train_ds.classes


@torch.no_grad()
def evaluate(model, loader, device) -> float:
    model.eval()
    correct = total = 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        preds = model(images).argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += labels.numel()
    return correct / total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=16)  # small to fit a 4GB GPU
    parser.add_argument("--lr", type=float, default=3e-4, help="head/layer4 lr for fresh runs")
    parser.add_argument("--full", action="store_true", help="fine-tune the whole network")
    parser.add_argument("--warm-start", type=Path, default=None,
                        help="checkpoint to start from (e.g. model/anitrans.pt)")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}", flush=True)

    train_dl, test_dl, classes = make_loaders(args.batch_size, strong_aug=args.full)
    print(f"{len(classes)} breeds, {len(train_dl.dataset)} train / {len(test_dl.dataset)} test images", flush=True)

    model = build_model(len(classes), full=args.full).to(device)

    if args.warm_start:
        checkpoint = torch.load(args.warm_start, map_location=device, weights_only=True)
        model.load_state_dict(checkpoint["state_dict"])
        print(f"Warm-started from {args.warm_start}", flush=True)

    if args.full:
        # Whole network trains, but the pretrained backbone moves slowly
        # (low lr) while the head moves faster — protects what already works.
        head_params = list(model.fc.parameters())
        head_ids = {id(p) for p in head_params}
        backbone_params = [p for p in model.parameters() if id(p) not in head_ids]
        optimizer = torch.optim.AdamW([
            {"params": backbone_params, "lr": 5e-5},
            {"params": head_params, "lr": 5e-4},
        ], weight_decay=1e-4)
    else:
        trainable = [p for p in model.parameters() if p.requires_grad]
        optimizer = torch.optim.AdamW(trainable, lr=args.lr, weight_decay=1e-4)

    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler = torch.amp.GradScaler(enabled=device.type == "cuda")

    MODEL_PATH.parent.mkdir(exist_ok=True)

    # When warm-starting, don't overwrite the checkpoint unless we beat it.
    best_acc = evaluate(model, test_dl, device) if args.warm_start else 0.0
    if args.warm_start:
        print(f"Baseline accuracy to beat: {best_acc:.1%}", flush=True)

    for epoch in range(1, args.epochs + 1):
        model.train()
        start = time.time()
        running_loss = 0.0
        for i, (images, labels) in enumerate(train_dl):
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device.type, enabled=device.type == "cuda"):
                loss = criterion(model(images), labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running_loss += loss.item()
            if (i + 1) % 50 == 0:
                print(f"  epoch {epoch} batch {i + 1}/{len(train_dl)} loss {running_loss / (i + 1):.3f}", flush=True)
        scheduler.step()

        acc = evaluate(model, test_dl, device)
        print(f"epoch {epoch}/{args.epochs}: loss {running_loss / len(train_dl):.3f}, "
              f"test accuracy {acc:.1%}, {time.time() - start:.0f}s", flush=True)

        if acc > best_acc:
            best_acc = acc
            torch.save({"arch": "resnet50", "classes": classes,
                        "state_dict": model.state_dict()}, MODEL_PATH)
            print(f"  saved new best model to {MODEL_PATH}", flush=True)

    print(f"Done. Best test accuracy: {best_acc:.1%}", flush=True)


if __name__ == "__main__":
    main()

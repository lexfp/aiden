"""Fine-tune a pretrained ResNet-50 to read pet mood (angry/happy/relaxed/sad).

Data comes from train/fetch_mood_data.py (run it first), which merges:
  - Dewa/Dog_Emotion_Dataset_v2 (Hugging Face)
  - anshtanwar/pets-facial-expression-dataset (Kaggle)
into data/mood/{train,val}/<class>/.

Usage:
    python train/train_mood.py

Saves the best checkpoint to model/anitrans_mood.pt (weights + class names).
"""

import argparse
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "mood"
MODEL_PATH = ROOT / "model" / "anitrans_mood.pt"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def build_model(num_classes: int) -> nn.Module:
    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    # Freeze everything except the last residual stage and the classifier head.
    for param in model.parameters():
        param.requires_grad = False
    for param in model.layer4.parameters():
        param.requires_grad = True
    for param in model.fc.parameters():
        param.requires_grad = True
    return model


def freeze_bn(model: nn.Module):
    """Put all BatchNorm layers in eval mode so their running stats don't update.

    Under fp16 autocast one overflowing activation writes inf/nan into the
    running statistics — GradScaler protects weights but not these buffers —
    which permanently breaks the model. The pretrained ImageNet stats are
    exactly what we want anyway since the backbone is (mostly) frozen.
    """
    for m in model.modules():
        if isinstance(m, nn.modules.batchnorm._BatchNorm):
            m.eval()


def make_loaders(batch_size: int):
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    val_tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    train_ds = datasets.ImageFolder(DATA_DIR / "train", transform=train_tf)
    val_ds = datasets.ImageFolder(DATA_DIR / "val", transform=val_tf)
    assert train_ds.classes == val_ds.classes

    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=2, pin_memory=True)
    val_dl = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=2, pin_memory=True)
    return train_dl, val_dl, train_ds.classes


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
    from keep_awake import keep_awake
    keep_awake()
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=16)  # small to fit a 4GB GPU
    parser.add_argument("--lr", type=float, default=3e-4)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}", flush=True)

    train_dl, val_dl, classes = make_loaders(args.batch_size)
    print(f"{len(classes)} moods {classes}, "
          f"{len(train_dl.dataset)} train / {len(val_dl.dataset)} val images", flush=True)

    model = build_model(len(classes)).to(device)

    trainable = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(trainable, lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler = torch.amp.GradScaler(enabled=device.type == "cuda")

    MODEL_PATH.parent.mkdir(exist_ok=True)
    best_acc = 0.0

    for epoch in range(1, args.epochs + 1):
        model.train()
        freeze_bn(model)
        start = time.time()
        running_loss = 0.0
        for i, (images, labels) in enumerate(train_dl):
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device.type, enabled=device.type == "cuda"):
                loss = criterion(model(images), labels)
            if not torch.isfinite(loss):
                print(f"  epoch {epoch} batch {i + 1}: non-finite loss, batch skipped", flush=True)
                continue
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running_loss += loss.item()
            if (i + 1) % 50 == 0:
                print(f"  epoch {epoch} batch {i + 1}/{len(train_dl)} loss {running_loss / (i + 1):.3f}", flush=True)
        scheduler.step()

        acc = evaluate(model, val_dl, device)
        print(f"epoch {epoch}/{args.epochs}: loss {running_loss / len(train_dl):.3f}, "
              f"val accuracy {acc:.1%}, {time.time() - start:.0f}s", flush=True)

        if acc > best_acc:
            best_acc = acc
            torch.save({"arch": "resnet50", "classes": classes,
                        "state_dict": model.state_dict()}, MODEL_PATH)
            print(f"  saved new best model to {MODEL_PATH}", flush=True)

    print(f"Done. Best val accuracy: {best_acc:.1%}", flush=True)


if __name__ == "__main__":
    main()

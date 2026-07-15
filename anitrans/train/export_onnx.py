"""Export the trained checkpoint to ONNX for the Rust server.

Usage (from project root):
    python train/export_onnx.py

Reads  model/anitrans.pt
Writes model/anitrans.onnx  (the network, portable, no Python needed to run it)
       model/labels.json    (the 37 breed names, in output order)

Re-run this after every retraining so the Rust server picks up the new weights.
"""

import json
from pathlib import Path

import torch
from torch import nn
from torchvision import models

ROOT = Path(__file__).resolve().parent.parent
CHECKPOINT = ROOT / "model" / "anitrans.pt"
ONNX_PATH = ROOT / "model" / "anitrans.onnx"
LABELS_PATH = ROOT / "model" / "labels.json"


def main():
    checkpoint = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
    classes = checkpoint["classes"]

    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(classes))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    torch.onnx.export(
        model,
        torch.randn(1, 3, 224, 224),
        str(ONNX_PATH),
        input_names=["input"],
        output_names=["logits"],
        opset_version=17,
        dynamo=False,
    )
    LABELS_PATH.write_text(json.dumps(classes, indent=2))
    print(f"Exported {ONNX_PATH} ({ONNX_PATH.stat().st_size / 1e6:.1f} MB)")
    print(f"Wrote {LABELS_PATH} ({len(classes)} breeds)")

    # Sanity check: ONNX output must match PyTorch output on the same input.
    try:
        import onnxruntime  # noqa: F401
    except ImportError:
        print("onnxruntime not installed - skipping output verification (the Rust server will be the real test)")
        return
    x = torch.randn(1, 3, 224, 224)
    with torch.no_grad():
        expected = model(x).numpy()
    session = onnxruntime.InferenceSession(str(ONNX_PATH))
    actual = session.run(None, {"input": x.numpy()})[0]
    import numpy as np
    assert np.allclose(expected, actual, atol=1e-3), "ONNX output diverges from PyTorch!"
    print("Verified: ONNX output matches PyTorch")


if __name__ == "__main__":
    main()

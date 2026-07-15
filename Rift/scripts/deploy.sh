#!/usr/bin/env bash
# Deploy the Rift multiplayer server to the "recurse" AWS instance.
#
# Usage:
#   scripts/deploy.sh              # build on server, restart service
#   scripts/deploy.sh --no-build   # skip build, just restart service
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/aiden_key}"
REMOTE_USER="ubuntu"
REMOTE_HOST="34.226.69.235"
REMOTE_DIR="/home/ubuntu/rift"
SERVICE="rift-server"

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

NO_BUILD=0
for arg in "$@"; do
  [[ "$arg" == "--no-build" ]] && NO_BUILD=1
done

echo "==> Syncing source to $REMOTE_HOST:$REMOTE_DIR"
rsync -az --delete \
  --exclude='target/' \
  --exclude='.git/' \
  --exclude='*.wad' \
  --exclude='*.WAD' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  /home/aiden/Rift/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

if [[ $NO_BUILD -eq 0 ]]; then
  echo "==> Installing build dependencies on server (first time may take a minute)"
  $SSH "${REMOTE_USER}@${REMOTE_HOST}" bash << 'REMOTE'
set -euo pipefail

# Rust toolchain
if ! command -v cargo &>/dev/null; then
  echo "  Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
fi
source "$HOME/.cargo/env"

# The server is headless (no GPU/GL). It only needs a C toolchain to compile the
# bundled SQLite used by the persistent game world.
if ! dpkg -s build-essential &>/dev/null 2>&1; then
  echo "  Installing system build dependencies..."
  sudo apt-get update -qq
  sudo apt-get install -y -q build-essential pkg-config
fi

echo "  Rust: $(cargo --version)"
REMOTE

  echo "==> Building rift (release) on server — this may take several minutes the first time"
  $SSH "${REMOTE_USER}@${REMOTE_HOST}" bash << 'REMOTE'
set -euo pipefail
source "$HOME/.cargo/env"
cd ~/rift

# Limit parallel codegen units to avoid OOM on 1.8 GB RAM
# --no-default-features drops the graphical client (eframe/GL) so the server
# builds headless with no windowing libraries.
RUSTFLAGS="-C codegen-units=1" \
  cargo build --release --no-default-features --jobs 1 2>&1
echo "  Build complete: $(ls -lh target/release/rift)"
REMOTE
fi

echo "==> Installing systemd service"
$SSH "${REMOTE_USER}@${REMOTE_HOST}" bash << 'REMOTE'
set -euo pipefail
source "$HOME/.cargo/env" 2>/dev/null || true

# Stop service before replacing the binary (avoids "Text file busy")
sudo systemctl stop rift-server 2>/dev/null || true

# Copy binary to a stable location
sudo cp ~/rift/target/release/rift /usr/local/bin/rift-server-bin
sudo chmod +x /usr/local/bin/rift-server-bin

# Write systemd unit
sudo tee /etc/systemd/system/rift-server.service > /dev/null << 'UNIT'
[Unit]
Description=Rift fleet-battle multiplayer server
After=network.target

[Service]
Type=simple
User=ubuntu
# Run from a writable dir so the persistent game world (rift-server.db) lands here.
WorkingDirectory=/home/ubuntu
ExecStart=/usr/local/bin/rift-server-bin server --port 7777
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable rift-server
sudo systemctl restart rift-server
sleep 2
echo "  Service status:"
sudo systemctl status rift-server --no-pager -l
REMOTE

echo ""
echo "==> Deploy complete!"
echo "    Server: ${REMOTE_HOST}:7777"
echo "    Logs:   ssh -i $SSH_KEY ${REMOTE_USER}@${REMOTE_HOST} 'journalctl -u rift-server -f'"

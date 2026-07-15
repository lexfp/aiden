#!/usr/bin/env bash
#
# Headless self-test runner for Rift.
#
# Builds the game and runs the scripted `demo` subcommand under a virtual X
# display (Xvfb) with software rendering, so it works on a machine with no GPU
# and no monitor — e.g. CI. The demo drives the player with a fixed input
# sequence and asserts on the resulting game state; it exits 0 on pass and
# non-zero on failure, so you can gate CI on it.
#
# This is the native-app equivalent of a browser end-to-end test. (Playwright
# can't drive Rift: it's a native OpenGL desktop app, not a web page.)
#
# It tries to "just work" with no setup:
#   1. Builds in release (an old `x11-dl` dep aborts in debug on recent rustc).
#   2. Runs under Xvfb forcing Mesa software GL.
#   3. If the GL context can't be created (newer Mesa dropped classic
#      swrast-over-GLX) it auto-provisions a software Vulkan driver (lavapipe)
#      plus the few X client libs winit needs — downloaded without root into a
#      cache dir — and retries via Zink.
#
# Usage:
#   scripts/demo-test.sh [--ticks N] [extra rift args...]

set -euo pipefail

cd "$(dirname "$0")/.."

CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/rift-headless-gl"
BIN=./target/release/rift
XVFB_ARGS="-screen 0 1280x720x24 +extension GLX +extension RANDR +render"

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "error: xvfb-run not found. Install it (Debian/Ubuntu: 'apt-get install xvfb')." >&2
  exit 2
fi

echo "==> Building release binary..."
cargo build --release

# Run the demo with the current environment, teeing output to $1 (a log path).
# Returns the game's exit code.
run_demo() {
  local log="$1"; shift
  set +e
  xvfb-run -a -s "$XVFB_ARGS" "$BIN" demo "$@" 2>&1 | tee "$log"
  local rc=${PIPESTATUS[0]}
  set -e
  return "$rc"
}

# Did the demo actually execute? If so a non-zero exit is a genuine assertion
# failure (don't mask it with a retry). If not, the game failed to start —
# typically a missing software-GL / X library — so provisioning may help.
demo_actually_ran() {
  grep -qaiE "Demo:|DEMO (PASSED|FAILED)" "$1"
}

# Download a .deb and its target files without root, into $CACHE/root.
provision_software_gl() {
  echo "==> Provisioning software GL stack (lavapipe + X libs) into $CACHE ..." >&2
  if ! command -v apt-get >/dev/null 2>&1 || ! command -v dpkg-deb >/dev/null 2>&1; then
    echo "error: need apt-get + dpkg-deb to auto-provision software GL on this box." >&2
    echo "       Install 'mesa-vulkan-drivers libvulkan1 libxcursor1 libxinerama1' yourself." >&2
    return 1
  fi
  rm -rf "$CACHE"
  mkdir -p "$CACHE/debs" "$CACHE/root"
  ( cd "$CACHE/debs" && apt-get download \
      libvulkan1 mesa-vulkan-drivers libxcursor1 libxinerama1 >/dev/null 2>&1 )
  for d in "$CACHE"/debs/*.deb; do dpkg-deb -x "$d" "$CACHE/root"; done
  local lvp
  lvp="$(find "$CACHE/root" -name 'libvulkan_lvp.so' | head -1)"
  if [ -z "$lvp" ]; then
    echo "error: lavapipe (libvulkan_lvp.so) not found after download." >&2
    return 1
  fi
  printf '{\n  "ICD": { "api_version": "1.1.255", "library_path": "%s" },\n  "file_format_version": "1.0.0"\n}\n' \
    "$lvp" > "$CACHE/icd.json"
  dirname "$lvp" > "$CACHE/libdir"
}

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

echo "==> Attempt 1: Mesa software GL (swrast)..."
export LIBGL_ALWAYS_SOFTWARE=1
# Single-buffered GL so --screenshot can read back the rendered frame headless.
export RIFT_SINGLE_BUFFERED=1
if run_demo "$LOG" "$@"; then
  exit 0
fi
if demo_actually_ran "$LOG"; then
  # The game started and the demo ran — a non-zero exit is a real failure.
  exit 1
fi

echo "==> Game couldn't start with plain software GL; falling back to Zink + lavapipe..."
if [ ! -f "$CACHE/icd.json" ]; then
  provision_software_gl
fi
export VK_ICD_FILENAMES="$CACHE/icd.json"
export LD_LIBRARY_PATH="$(cat "$CACHE/libdir"):${LD_LIBRARY_PATH:-}"
export MESA_LOADER_DRIVER_OVERRIDE=zink
export GALLIUM_DRIVER=zink

echo "==> Attempt 2: Zink on software Vulkan (lavapipe)..."
run_demo "$LOG" "$@"

#!/usr/bin/env bash
# Generate the version.json manifest the game's startup update check reads from
# https://rift.rivi.us/version.json
#
# The `sha` MUST be the short (7-char) commit the released binaries were built
# from — it has to match the SHA build.rs embeds (git rev-parse --short=7 HEAD),
# or the update check will report "update available" for an up-to-date client.
#
# Usage:
#   scripts/gen-version-json.sh [SHA] > version.json
# SHA defaults to the current HEAD; pass an explicit value in CI (e.g. the first
# 7 chars of $GITHUB_SHA) when .git isn't the source of truth.
set -euo pipefail

SHA="${1:-$(git rev-parse --short=7 HEAD)}"
VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"
BASE="https://rift.rivi.us"

cat <<EOF
{
  "version": "${VERSION}",
  "sha": "${SHA}",
  "windows": "${BASE}/rift-setup.exe",
  "linux": "${BASE}/rift-linux.tar.gz",
  "mac": "${BASE}/rift-mac.dmg"
}
EOF

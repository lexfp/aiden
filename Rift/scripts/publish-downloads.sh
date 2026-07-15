#!/usr/bin/env bash
# Publish the built desktop downloads (rift-setup.exe, rift-linux.tar.gz,
# rift-mac.dmg) to the nginx web root on rift.rivi.us, so the download
# buttons on the site and the in-app update check actually resolve.
#
# Why this exists: CI (.github/workflows/release.yml) builds these artifacts
# but only uploads them to GitHub Releases. The website + version.json link to
# https://rift.rivi.us/<file>, so the files must be copied onto the web host.
#
# Usage:
#   scripts/publish-downloads.sh                 # grab newest successful CI run
#   scripts/publish-downloads.sh <run-id>        # use a specific Actions run
#   scripts/publish-downloads.sh --local <dir>   # upload files already in <dir>
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/aiden_key}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_HOST="${REMOTE_HOST:-34.226.69.235}"
REPO="${REPO:-FurryCoder67/Rift}"

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ── Collect artifacts ──────────────────────────────────────────────────────
if [[ "${1:-}" == "--local" ]]; then
  SRC="${2:?--local needs a directory}"
  echo "==> Using local artifacts from $SRC"
else
  RUN_ID="${1:-}"
  if [[ -z "$RUN_ID" ]]; then
    echo "==> Finding newest successful Build & Release run..."
    RUN_ID=$(gh run list -R "$REPO" --workflow=release.yml \
      --json databaseId,conclusion,status \
      --jq 'map(select(.conclusion=="success" or .status=="in_progress"))[0].databaseId')
  fi
  echo "==> Downloading artifacts from run $RUN_ID"
  gh run download "$RUN_ID" -R "$REPO" --dir "$WORK" || true
  SRC="$WORK"
fi

# Flatten: artifacts download into per-name subdirs (windows/, linux/, mac/).
declare -a FILES=()
for f in rift-setup.exe rift-portable.zip rift-linux.tar.gz rift-mac.dmg; do
  found=$(find "$SRC" -name "$f" -type f | head -1)
  if [[ -n "$found" ]]; then
    FILES+=("$found")
    echo "    found $f ($(du -h "$found" | cut -f1))"
  else
    echo "    (skip) $f not present yet"
  fi
done

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "ERROR: no download artifacts found to publish." >&2
  exit 1
fi

# ── Detect the nginx document root on the server ───────────────────────────
echo "==> Detecting nginx web root on $REMOTE_HOST"
WEBROOT=$($SSH "${REMOTE_USER}@${REMOTE_HOST}" \
  "grep -RhoE 'root[[:space:]]+[^;]+;' /etc/nginx/sites-enabled/ /etc/nginx/nginx.conf 2>/dev/null \
   | grep -v '#' | head -1 | sed -E 's/root[[:space:]]+//; s/;//' | xargs")
WEBROOT="${WEBROOT:-/var/www/html}"
echo "    web root: $WEBROOT"

# ── Upload ─────────────────────────────────────────────────────────────────
echo "==> Uploading $(printf '%s ' "${FILES[@]##*/}")"
$SCP "${FILES[@]}" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/"
$SSH "${REMOTE_USER}@${REMOTE_HOST}" "sudo install -m 0644 -t '$WEBROOT' $(printf '/tmp/%s ' "${FILES[@]##*/}") && rm -f $(printf '/tmp/%s ' "${FILES[@]##*/}")"

# ── Verify ─────────────────────────────────────────────────────────────────
echo "==> Verifying over HTTPS"
for f in "${FILES[@]##*/}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://rift.rivi.us/$f")
  echo "    https://rift.rivi.us/$f -> $code"
done
echo "==> Done."

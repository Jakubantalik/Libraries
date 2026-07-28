#!/bin/bash
# Renders the full beam matrix (5 types × 4 variants × dark/light) to PNGs
# through the real SwiftUI + Metal pipeline, for parity diffing against the web
# demo. See PORT_PLAN.md Phase 3.
#
# Needs full Xcode (SwiftPM alone cannot compile the .metal shader). DEVELOPER_DIR
# is used instead of `xcode-select`, so no sudo/admin password is required.
#
# Usage:  ./snapshot.sh [output-dir]
set -euo pipefail

XCODE="${XCODE_APP:-/Applications/Xcode.app}"
if [ ! -d "$XCODE" ]; then
  echo "error: Xcode not found at $XCODE (set XCODE_APP to override)" >&2
  exit 1
fi
export DEVELOPER_DIR="$XCODE/Contents/Developer"

cd "$(dirname "$0")"
OUT="${1:-$PWD/snapshots}"
mkdir -p "$OUT"

echo "Rendering snapshots with $("$DEVELOPER_DIR/usr/bin/xcodebuild" -version | head -1)..."
LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

xcodebuild test \
  -scheme BorderBeamKit \
  -destination 'platform=macOS' \
  > "$LOG" 2>&1 || { grep -iE "error:|failed" "$LOG" | head -20; echo "TEST FAILED (full log: $LOG)"; exit 1; }

# The test process doesn't inherit this shell's env under `xcodebuild test`,
# so it reports where it wrote and we collect from there.
SRC=$(grep -m1 '^SNAPSHOT_DIR=' "$LOG" | cut -d= -f2-)
COUNT=$(grep -m1 '^SNAPSHOT_COUNT=' "$LOG" | cut -d= -f2-)

if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "error: snapshot output dir not reported by the test" >&2
  exit 1
fi

cp "$SRC"/*.png "$OUT"/
echo "Wrote ${COUNT} snapshots to $OUT"

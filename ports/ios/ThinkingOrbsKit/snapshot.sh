#!/usr/bin/env bash
# Capture every (state × size × theme × frozen t) through the real SwiftUI
# Canvas pipeline, headless. No simulator needed — ImageRenderer runs the
# same drawing code the app does.
#
#   ./snapshot.sh [outDir]        # default: ./snapshots
#
# Then diff against the web reference (captured from demo/parity.html):
#   node ../../react-native/thinking-orbs-native/scripts/diff-png.mjs snapshots <webDir>
set -euo pipefail
cd "$(dirname "$0")"

OUT="${1:-$PWD/snapshots}"
rm -rf "$OUT"
ORB_SNAPSHOT_DIR="$OUT" swift test --filter OrbSnapshotTests 2>&1 \
  | grep -E "wrote |error:|failed|Skipped" || true

echo "==> $(ls "$OUT" 2>/dev/null | wc -l | tr -d ' ') PNGs in $OUT"

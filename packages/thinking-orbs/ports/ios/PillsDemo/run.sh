#!/usr/bin/env bash
# Build, install and launch PillsDemo on the simulator.
#
# DEVELOPER_DIR is pinned to Xcode 16.4 because the installed simulator
# runtime is iOS 18.6; Xcode 26 has no matching runtime and fails with a
# confusing "iOS 26.0 is not installed" against a destination that clearly
# exists. The device script pins the opposite way — see run-device.sh.
#
# Release by default: Debug measured 16-24% CPU against 11-17% for Release,
# and the orb's Canvas redraws every frame. CONFIG=Debug ./run.sh to debug.
set -euo pipefail
cd "$(dirname "$0")"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
CONFIG="${CONFIG:-Release}"

DEVICE="${1:-}"
if [ -z "$DEVICE" ]; then
  DEVICE=$(xcrun simctl list devices available \
    | grep -m1 "(Booted)" \
    | grep -Eo '\([0-9A-F-]{36}\)' | tr -d '()')
fi
if [ -z "$DEVICE" ]; then
  echo "No booted simulator. Open one, or pass its UDID as \$1." >&2
  exit 1
fi

echo "==> generating project"
xcodegen generate >/dev/null

echo "==> building $CONFIG"
xcodebuild -project PillsDemo.xcodeproj \
  -scheme PillsDemo \
  -configuration "$CONFIG" \
  -sdk iphonesimulator \
  -destination "id=$DEVICE" \
  -derivedDataPath ./build \
  build | grep -E "error:|BUILD" || true

APP="./build/Build/Products/$CONFIG-iphonesimulator/PillsDemo.app"
[ -d "$APP" ] || { echo "Build produced no app at $APP" >&2; exit 1; }

echo "==> installing"
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl terminate "$DEVICE" com.jakubantalik.PillsDemo 2>/dev/null || true

echo "==> launching"
xcrun simctl launch "$DEVICE" com.jakubantalik.PillsDemo

echo "==> done. The TUNE chip shows this build's timestamp."

#!/bin/bash
# Build and launch the BorderBeamKit demo in the iOS Simulator.
#
#   ./run.sh                 # default device (iPhone 16 Pro)
#   ./run.sh "iPhone 16e"    # pick another simulator
#
# Requires: Xcode (see ../BorderBeamKit/README.md), xcodegen (brew install xcodegen),
# and an installed iOS runtime (xcodebuild -downloadPlatform iOS).
set -euo pipefail

DEVICE="${1:-iPhone 16 Pro}"
BUNDLE_ID="com.jakubantalik.BorderBeamDemo"
XCODE="${XCODE_APP:-/Applications/Xcode.app}"
export DEVELOPER_DIR="$XCODE/Contents/Developer"

cd "$(dirname "$0")"

if ! command -v xcodegen >/dev/null; then
  echo "error: xcodegen not found — run: brew install xcodegen" >&2
  exit 1
fi

if ! xcrun simctl list runtimes | grep -q "^iOS "; then
  echo "error: no iOS simulator runtime installed." >&2
  echo "       run: DEVELOPER_DIR=$DEVELOPER_DIR xcodebuild -downloadPlatform iOS" >&2
  exit 1
fi

echo "▸ Generating project…"
xcodegen generate --quiet

echo "▸ Booting $DEVICE…"
# Already-booted is fine; anything else is a real failure.
xcrun simctl boot "$DEVICE" 2>/dev/null || true
open -a "$XCODE/Contents/Developer/Applications/Simulator.app"

echo "▸ Building…"
xcodebuild \
  -project BorderBeamDemo.xcodeproj \
  -scheme BorderBeamDemo \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath build \
  build > /tmp/borderbeam-demo-build.log 2>&1 \
  || { grep -E "error:" /tmp/borderbeam-demo-build.log | head -20; \
       echo "BUILD FAILED (full log: /tmp/borderbeam-demo-build.log)"; exit 1; }

APP="build/Build/Products/Debug-iphonesimulator/BorderBeamDemo.app"

echo "▸ Installing and launching…"
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl launch "$DEVICE" "$BUNDLE_ID"

echo "✓ Running on $DEVICE"

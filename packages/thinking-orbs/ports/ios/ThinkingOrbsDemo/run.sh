#!/usr/bin/env bash
# Generate, build, install and launch the demo on a booted simulator.
# One step, mirroring border-beam's BorderBeamDemo/run.sh.
set -euo pipefail
cd "$(dirname "$0")"

DEVICE="${1:-booted}"

echo "==> generating project"
xcodegen generate >/dev/null

echo "==> building"
xcodebuild -project ThinkingOrbsDemo.xcodeproj \
  -scheme ThinkingOrbsDemo \
  -sdk iphonesimulator \
  -destination "id=$(xcrun simctl list devices | awk -v d="$DEVICE" '
      d=="booted" && /\(Booted\)/ {match($0,/\(([0-9A-F-]{36})\)/,m); print m[1]; exit}
      d!="booted" && $0 ~ d {match($0,/\(([0-9A-F-]{36})\)/,m); print m[1]; exit}')" \
  -derivedDataPath ./build build | grep -E "error:|BUILD" || true

APP="./build/Build/Products/Debug-iphonesimulator/ThinkingOrbsDemo.app"
echo "==> installing $APP"
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl launch "$DEVICE" com.jakubantalik.ThinkingOrbsDemo
echo "==> launched"

#!/usr/bin/env bash
#
# Run the React Native example on the iOS simulator.
#
# WHY THIS EXISTS: React Native's codegen breaks on paths containing spaces,
# and this repo lives under ".../Work 2023+/...". The build therefore cannot
# run in place. This mirrors the sources into a space-free scratch directory,
# builds there, and installs the result — which is exactly what the ~/dev
# copies of these folders were doing by hand, except nothing here drifts out
# of version control.
#
# Only sources are mirrored; node_modules and Pods stay in the scratch dir
# across runs, so a second run is fast.
#
#   ./run-example.sh          build, install and launch
#   ./run-example.sh --clean  discard the scratch dir first
#
set -euo pipefail
cd "$(dirname "$0")"

SRC="$(pwd)"
WORK="${TO_RN_WORK:-$HOME/.cache/thinking-orbs-rn}"
# The library is a sibling of the example and is consumed from source, so both
# have to land in the scratch tree with their relative layout intact.
PKG_ROOT="$(cd ../.. && pwd)"

if [ "${1:-}" = "--clean" ]; then
  echo "==> removing $WORK"
  rm -rf "$WORK"
fi

echo "==> mirroring sources to $WORK"
mkdir -p "$WORK/ports/react-native"
# --delete keeps the mirror honest: a file deleted in git disappears here too.
# node_modules/Pods/build are excluded so the mirror's own installs survive.
for d in thinking-orbs-native example; do
  rsync -a --delete \
    --exclude node_modules --exclude ios/Pods --exclude ios/build \
    --exclude .expo --exclude .DS_Store \
    "$SRC/$d/" "$WORK/ports/react-native/$d/"
done
# the RN package imports thinking-orbs/engine from the web package's source
rsync -a --delete --exclude node_modules --exclude dist --exclude .DS_Store \
  "$PKG_ROOT/src/" "$WORK/src/"
cp "$PKG_ROOT/package.json" "$WORK/package.json"

echo "==> installing (first run takes a few minutes)"
cd "$WORK/ports/react-native/example"
npm install --silent

echo "==> pods"
cd ios
RUBYOPT="-EUTF-8:UTF-8" LANG=en_US.UTF-8 pod install >/dev/null

echo "==> building"
# Xcode 16.4 for the simulator: the installed runtime is iOS 18.6 and Xcode 26
# has no matching one. Same pin as the SwiftUI demo's run.sh.
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
DEVICE=$(xcrun simctl list devices available \
  | grep -m1 "(Booted)" | grep -Eo '\([0-9A-F-]{36}\)' | tr -d '()')
if [ -z "$DEVICE" ]; then
  echo "No booted simulator. Open one and re-run." >&2
  exit 1
fi

xcodebuild -workspace thinkingorbsexample.xcworkspace \
  -scheme thinkingorbsexample \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "id=$DEVICE" \
  -derivedDataPath ./build \
  build | grep -E "error:|BUILD" || true

APP="./build/Build/Products/Debug-iphonesimulator/thinkingorbsexample.app"
[ -d "$APP" ] || { echo "Build produced no app at $APP" >&2; exit 1; }

echo "==> installing on simulator"
xcrun simctl install "$DEVICE" "$APP"

echo "==> starting Metro (leave this running)"
cd "$WORK/ports/react-native/example"
xcrun simctl launch "$DEVICE" com.jakubantalik.thinkingorbsexample || true
npx expo start --port 8081

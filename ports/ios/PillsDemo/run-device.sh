#!/usr/bin/env bash
# Build, install and launch PillsDemo on a physical iPhone.
#
# Which Xcode matters here. The simulator runs iOS 18.6, which only Xcode 16.4
# supports; the phone runs iOS 26.x, which only Xcode 26 supports. Building the
# device with the wrong one fails with a confusing "not installed" error about
# the platform, so each script pins its own DEVELOPER_DIR rather than relying
# on `xcode-select`.
#
# Builds RELEASE by default. A Debug SwiftUI build of this app measured
# 16-24% CPU against 11-17% for Release in the simulator — roughly 35-40%
# more work per frame — and the gap is wider on device, where the orb's
# Canvas redraws every frame. Debug is worth it only when you need the
# debugger: CONFIG=Debug ./run-device.sh
set -euo pipefail
cd "$(dirname "$0")"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Users/jakub/Downloads/Xcode.app/Contents/Developer}"
CONFIG="${CONFIG:-Release}"

# The two tools want DIFFERENT identifiers for the same phone: xcodebuild
# takes the hardware UDID (xctrace's parenthesised value), devicectl takes its
# own CoreDevice UUID. Passing one to the other silently finds no device.
UDID="${1:-$(xcrun xctrace list devices 2>/dev/null \
  | sed -n '/^== Devices/,/^== Simulators/p' \
  | grep -Eo '\(([0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}|[0-9A-Fa-f]{40})\)' \
  | head -1 | tr -d '()')}"
# Match the UUID by shape, not by column: the device NAME and MODEL both
# contain spaces, so a positional field index lands on "Pro" or "15".
COREDEVICE=$(xcrun devicectl list devices 2>/dev/null \
  | grep connected \
  | grep -Eo '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' \
  | head -1)

if [ -z "$UDID" ]; then
  echo "No device found. Unlock the iPhone, plug it in, and trust this Mac." >&2
  exit 1
fi

echo "==> generating project"
xcodegen generate >/dev/null

echo "==> building $CONFIG for device $UDID"
xcodebuild -project PillsDemo.xcodeproj \
  -scheme PillsDemo \
  -configuration "$CONFIG" \
  -destination "id=$UDID" \
  -derivedDataPath ./build-device \
  -allowProvisioningUpdates \
  build | grep -E "error:|BUILD" || true

APP="./build-device/Build/Products/$CONFIG-iphoneos/PillsDemo.app"
[ -d "$APP" ] || { echo "Build produced no app at $APP" >&2; exit 1; }

echo "==> installing $(basename "$APP")"
xcrun devicectl device install app --device "${COREDEVICE:-$UDID}" "$APP"

# Best-effort: devicectl often cannot resolve the pid of a freshly launched
# app and reports an error even though the launch succeeded. The install
# above is the part that matters.
echo "==> launching"
xcrun devicectl device process launch --device "${COREDEVICE:-$UDID}" \
  com.jakubantalik.PillsDemo 2>/dev/null \
  || echo "    (launch status unknown — tap Pills on the phone)"

echo "==> done. The TUNE chip shows this build's timestamp."

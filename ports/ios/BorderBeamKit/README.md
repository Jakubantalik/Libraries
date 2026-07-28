# BorderBeamKit

SwiftUI port of the [border-beam](https://beam.jakubantalik.com) web library.
iOS 17+ / macOS 14+, rendered with SwiftUI Metal shaders.

> Status: all 5 types implemented (`sm`, `md`, `line`, `pulse-outside`,
> `pulse-inner`) × 4 color variants × dark/light. Visual parity tuning against
> the web demo is pending — see `PORT_PLAN.md` Phase 3 in the repo root.

## Usage

```swift
import BorderBeamKit

// Wrapper view
BorderBeam(size: .md, colorVariant: .ocean, theme: .auto) {
    Card()
}

// Or as a modifier
Card().borderBeam(.md, colorVariant: .colorful)
```

All web props are mirrored: `size`, `colorVariant`, `theme` (`.auto` follows
the system color scheme), `staticColors`, `duration`, `active` (fades in/out
with `onActivate` / `onDeactivate` callbacks), `borderRadius` (explicit —
SwiftUI has no auto-detection; falls back to the size preset), `brightness`,
`saturation`, `hueRange`, `strength`.

## How it works

- All hand-tuned visual data (palettes, presets, oscillator tables) is decoded
  from the bundled `beam-spec.json`, generated from the web library's source via
  `npm run spec` — nothing visual is hard-coded in Swift. To sync after a web
  update: `npm run spec && cp spec/beam-spec.json ports/ios/BorderBeamKit/Sources/BorderBeamKit/Resources/`.
- `BeamShaders.metal` reproduces the web's layer construction per pixel:
  CSS radial-gradient blob stacks (premultiplied source-over), conic
  highlight/bloom gradients, the rotating conic beam-window mask, rounded-rect
  ring geometry via SDF, and the CSS filter chain (`hue-rotate` → `brightness`
  → `saturate`) using the exact W3C feColorMatrix math.
- `TimelineView(.animation)` drives the beam angle and hue shift; the pulse
  family will be driven by `PulseDriver` (a port of `pulseDriver.ts`).

## Building

Requires full Xcode — the `.metal` shader is compiled by Xcode's build system;
Command Line Tools alone can only build the Swift sources and run `swift test`.

You do **not** need `sudo xcode-select`. Point `DEVELOPER_DIR` at Xcode instead,
which needs no admin password and leaves the system toolchain alone:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -scheme BorderBeamKit -destination 'platform=macOS' build
```

## Running the demo in the iOS Simulator

```bash
ports/ios/BorderBeamDemo/run.sh
```

That generates the Xcode project, boots the simulator, builds, installs and
launches. Pass a device name to use a different one, e.g.
`./run.sh "iPhone 16e"`. The app shows all 5 types live with pickers for color
variant, theme, and on/off.

First-time setup (each step is one-off, no admin password needed):

```bash
brew install xcodegen
```

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -downloadPlatform iOS
```

## Parity snapshots

`./snapshot.sh [output-dir]` renders all 5 types × 4 variants × dark/light (40
PNGs) through the real SwiftUI + Metal pipeline, for diffing against the web
demo:

```bash
./snapshot.sh
```

It works headlessly — no simulator, no GUI, no screen-recording permission —
because `ImageRenderer` does execute `colorEffect` Metal shaders. Two details
make the captures deterministic:

- `\.beamFrozenTime` (internal environment value) pins one frame at full
  opacity; `ImageRenderer` never fires `onAppear`, so otherwise the fade would
  sit at 0 and every capture would be empty.
- Freeze times are chosen per family. `line` in particular must land between
  32.5% and 67.5% of its cycle — outside that its `edgeFade` keyframe ramps the
  whole effect toward zero, and a capture would show a legitimately blank card.

Each capture is verified against a beam-off render of the same card, so a
silently empty frame fails the test. Diffing rather than looking for color is
what makes the greyscale `mono` variant detectable.

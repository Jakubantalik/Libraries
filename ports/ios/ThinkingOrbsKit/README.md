# ThinkingOrbsKit

Dotted thought-orb loading indicators for SwiftUI. Port of
[thinking-orbs](https://orbs.jakubantalik.com) — nine hand-tuned animated
states, two purpose-tuned sizes, automatic dark/light.

iOS 15+ / macOS 12+. No dependencies, no Metal — `TimelineView(.animation)`
drives the clock and `Canvas` does the drawing.

## Usage

```swift
import ThinkingOrbsKit

ThinkingOrb(state: .searching, size: .px64)
ThinkingOrb(state: .breathing, size: .px20, theme: .light, speed: 1.5)
```

`state`, `size` (`.px64 | .px20`), `theme` (`.auto | .dark | .light`,
where `.auto` reads `\.colorScheme`), `speed`, `paused`.

Accessibility: each orb is an image element labelled per state, and
`\.accessibilityReduceMotion` renders a single static frame — the same
instant the web build freezes at.

## Verification

Unlike the React Native port, which imports the web engine's compiled
geometry, this package **hand-transcribes** the math to Swift. That is only
safe because of the golden vectors:

```bash
swift test
```

`OrbGoldenTests` evaluates all nine states at both sizes across four frozen
timestamps and compares against `spec/orbs-golden.json` — 72 cases, 70,115
values, tolerance 1e-4. A mistyped constant or a sign error fails with the
exact case and field.

The tunings are **not** transcribed: `scripts/codegen-swift.ts` in the web
repo generates `OrbSpec.swift` from `spec/orbs-spec.json`, so a retune in
the inkform mini page reaches iOS with `npm run spec && npm run
codegen:swift` rather than by retyping float literals.

## Performance

Geometry cost per frame, release build, Apple silicon:

| state | dots | µs/frame |
|---|---|---|
| composing | 566 | 72.6 |
| working | 516 | 57.6 |
| breathing | 484 | 57.6 |
| searching | 204 | 49.5 |
| connecting | 48 + 81 lines | 13.0 |
| shaping (20pt) | 18 | 3.0 |

The heaviest mode is 0.44% of a 60 fps frame. `TimelineView` also stops
being serviced when off-screen, which is the equivalent of the web build's
`IntersectionObserver` pause and costs nothing to get.

## Pixel parity with the web

```bash
./snapshot.sh                    # 144 PNGs: 9 states × 2 sizes × 2 themes × 4 frozen t
```

`ImageRenderer` runs the real SwiftUI Canvas pipeline headlessly — no
simulator, no window, no screen-recording permission. It never fires
`onAppear` and never advances a `TimelineView`, so `.orbFrozenTime(_:)`
pins the instant; without it every capture would be the same t=0 frame.

Copy the output somewhere the web dev server can serve it and diff against
`demo/parity.html` renders of the same instants. Current result over all
144: **worst mean 4.9/255 (1.9%)**, average 0.90 at 64pt and 2.02 at 20pt,
centroids aligned to under half a device pixel.

### Where the residual comes from

It is not antialiasing — it barely shrinks under 4× downsampling (4.90 →
4.43), so it is a low-frequency, systematic difference. Isolated circles
(device px, ink = premultiplied luminance sum):

| radius | CoreGraphics | Chrome canvas |
|---|---|---|
| 20 | 320700 | 320456 |
| 4 | 12956 | 13032 |
| 1 | 804 | 872 |
| 0.5 | 332 | 128 |
| 0.35 | 216 | **0** |

At radius 20 the two agree to 0.08%, which rules out colour space, gamma,
alpha and premultiplication — the ink rule is correct. The divergence is
entirely sub-pixel: CoreGraphics keeps a minimum visible mark rather than
letting a shape disappear, while Chrome drops circles under ~0.4px
outright. These animations are full of sub-pixel dots, so iOS renders
10–26% more total ink.

That also explains the two gradients in the numbers: 20pt is worse than
64pt because `radiusScale` puts a larger share of its dots under a pixel,
and dark is worse than light because bright ink on transparent produces a
bigger absolute luminance difference than dark ink does.

Not compensated, for the same reason as the React Native port: the bias is
not monotonic in radius (CoreGraphics is *lighter* at r=1 and 2.6× heavier
at r=0.5), so any correction is a fitted curve chasing a sub-2% mean — and
not dropping dots the engine asked for is arguably the better behaviour.

## A note on draw order

`OrbGoldenTests` compares dots as a multiset plus a z-monotonicity
assertion, not by array position. `breathing` at 64pt has an odd lane count,
so its centre lane sits exactly on the view plane: its z is computed as
`y·sin(tilt) + z₁·cos(tilt)`, where the two terms cancel to a mathematical
zero. Floating point does not cancel exactly, so those 44 dots land on
±1e-17 noise whose sign depends on each platform's libm — and JavaScript and
Swift z-sort them into different orders.

The two engines produce an identical multiset of dots; only the order within
that tie group differs, and every dot in it has depth 0.5, hence identical
radius, ink and alpha. The order among them cannot change a pixel. "Same
dots, drawn far to near" is the contract; exact array position is not.

## Demo

```bash
../ThinkingOrbsDemo/run.sh
```

Generates the Xcode project, builds, installs and launches on a booted
simulator.

## License

MIT

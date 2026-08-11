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

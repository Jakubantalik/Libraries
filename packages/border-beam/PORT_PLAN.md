# Port plan: border-beam → iOS (SwiftUI) + React Native

Decisions (agreed 2026-07-27):

- **iOS:** SwiftUI, iOS 17+, Metal shaders (`Canvas` + `Shader` / `layerEffect`).
- **React Native:** `@shopify/react-native-skia` + `react-native-reanimated`, iOS **and** Android, Expo-compatible.
- **Scope:** everything at once — all 5 types (`sm`, `md`, `line`, `pulse-outside`, `pulse-inner`) × 4 color variants (`colorful`, `mono`, `ocean`, `sunset`) × dark/light themes.
- **Fidelity:** pixel-close parity; the web demo is the visual reference.

## What is being ported

The web library builds its visuals from:

- Stacks of 8–9 blurred radial-gradient ellipses per layer (`colorPalettes`, `smallColorPalettes`, `lineColorPalettes`, `lineInnerGradientData`, `lineBloomColors` in `src/styles.ts`).
- A rounded-rect border ring mask (`mask-composite: exclude` tricks).
- A rotating conic-gradient mask (`--beam-angle` via `@property`) that creates the traveling beam.
- CSS filters: `hue-rotate` / `brightness` / `saturate` / `blur`.
- Pulse family: a shared ~30 fps JS oscillator loop (~15 desynced cosine oscillators per instance) writing CSS variables (`src/pulseDriver.ts`).
- Behavior: fade in/out with `onActivate`/`onDeactivate`, offscreen pause, reduced-motion support, border-radius auto-detection, `strength` control, per-axis glow scaling for `pulse-outside` (350×140 reference geometry).

## Phase 0 — Platform-neutral spec (`spec/beam-spec.json`)

All hand-tuned values live in data, not logic. A script exports from the TS source:

- Gradient palettes (colors, ellipse sizes/positions, opacities) for every type × variant × theme.
- `sizePresets` and `sizeThemePresets` (stroke/inner/bloom opacities, saturation, brightness, hairline).
- Line bloom/spike gradient tables and inner gradient data.
- Pulse geometry and oscillator tables (`a`/`b`/`period`/`delay`/`unit` per oscillator, hue drift config).
- Mask geometry (conic mask stops per type), blur radii, default durations.

Both ports consume **generated code** from this spec (codegen → `BeamSpec.swift`, TS constants for RN). The web library remains the source of truth; a spec bump regenerates both ports. Spec is versioned; all three packages track it.

## Phase 1 — iOS Swift package (`BorderBeamKit`)

Distribution: Swift Package Manager, iOS 17+, plus a demo app mirroring the web demo.

Rendering mapping:

| Web | SwiftUI |
|---|---|
| Stacked blurred radial-gradient ellipses | Single Metal fragment shader summing the ellipse field per pixel |
| Border ring mask (`mask-composite: exclude`) | Rounded-rect SDF band (`abs(sdf) < strokeWidth`) in the shader |
| Rotating conic mask | Angle uniform from `TimelineView(.animation)`; conic falloff in-shader |
| `hue-rotate`/`brightness`/`saturate` | Exact CSS filter color matrices in the shader |
| `blur(8px)` bloom | Gaussian falloff baked into the ellipse field, or a second blurred pass (decide in spike) |
| Pulse oscillator loop | Direct port of `pulseDriver.ts` math via `TimelineView`, values as uniforms |

API mirrors the React props:

```swift
content.borderBeam(.md, colorVariant: .colorful, theme: .auto, ...)
BorderBeam(size: .pulseOutside) { Card() }
```

`size`, `colorVariant`, `theme` (`.auto` via `colorScheme`), `duration`, `active` (fade in/out + callbacks), `borderRadius` (explicit param; preset default fallback — no auto-detect in SwiftUI), `brightness`, `saturation`, `hueRange`, `strength`.

Behavior parity: `accessibilityReduceMotion`, offscreen pause, `pulse-outside` per-axis glow scaling from `GeometryReader`.

Order: `md` shader spike (validates approach) → `sm` → `line` (most complex) → pulses + oscillator driver → fade/lifecycle polish.

## Phase 2 — React Native package (`border-beam-native`)

Stack: `@shopify/react-native-skia` + `react-native-reanimated` as peer deps, new + old architecture, iOS and Android.

Rendering mapping:

| Web | Skia |
|---|---|
| Radial-gradient ellipses | `RadialGradient` fills or a runtime effect (SkSL) sharing the Metal shader's design |
| Border ring mask | `Mask`/`DiffRect`/path ops, or SDF in the runtime effect |
| Conic rotating mask | `SweepGradient` alpha mask, angle from a Reanimated `SharedValue` |
| Filters | Skia `ColorMatrix` (same matrices as iOS) |
| Blur | `BlurMask` / `Blur` image filter |
| Pulse driver | Shared Reanimated UI-thread loop (`useFrameCallback`), throttled ~30 fps |

API: reuse the web `BorderBeamProps` minus DOM-specific bits. `<BorderBeam>` wraps children in a `View` with an absolutely-positioned Skia canvas (oversized for `pulse-outside`). Explicit `borderRadius` prop + preset default. Reduced motion via `AccessibilityInfo`; offscreen pause via visibility hooks.

Order: `md` spike → remaining types; Android verification pass per type.

## Phase 3 — Parity verification

**Done:**

- iOS snapshot harness (`ports/ios/BorderBeamKit/snapshot.sh`) renders all 40 combinations (5 types × 4 variants × dark/light) through the real SwiftUI + Metal pipeline. Headless — `ImageRenderer` does execute `colorEffect` Metal shaders, so no simulator, GUI, or screen-recording permission is needed.
  - Determinism comes from the internal `\.beamFrozenTime` environment value (`ImageRenderer` never fires `onAppear`, so the fade would otherwise sit at 0).
  - Freeze times are per-family; `line` must land between 32.5% and 67.5% of its cycle or its `edgeFade` keyframe legitimately renders near-nothing.
  - Every capture is diffed against a beam-off render of the same card, so empty frames fail. Diffing (not color detection) is what covers greyscale `mono`.
- Web reference capture technique: pin `--beam-angle-<id>`/`--beam-opacity-<id>` and the filter directly via injected CSS. Negative `animation-delay` is **not** reliable for this — it froze at an arbitrary phase.

**Parity result (2026-07-28): pixel-close confirmed across the full matrix.**
The automated harness (`demo/parity.html` + `demo/scripts/parity-capture.mjs` +
`demo/scripts/parity-diff.py`) freezes web and iOS at identical per-family
timestamps on identical scene geometry and pixel-diffs all 40 combinations:
worst mean difference 1.21/255 (~0.5%), worst p99 15/255, worst hot-pixel share
0.62%. No combination crossed the outlier threshold. Re-run with:
`node scripts/parity-capture.mjs` (dev server on :5173) then
`python3 scripts/parity-diff.py`, after `./snapshot.sh` on the iOS side.

**RN runtime verification: blocked locally — move to CI.** The example app
builds, installs, launches, and Metro bundles the library (1687 modules, no
errors), but the native binary registers zero TurboModules
(`PlatformConstants not found`, empty registry) even from a fresh SDK 53
scaffold with wiped DerivedData. Root causes eliminated along the way: stale
Metro cache (fix: `--clear`), un-hoisted `expo-asset` (fix: `expo install
expo-asset`), stale DerivedData reuse. What remains is machine-specific
(macOS 15.3.1 → Xcode 16.4 → Expo SDK 53 ceiling). Recommendation: verify the
RN port in CI on a current-Xcode macOS runner (or any machine on macOS 26+),
where SDK 57 works and none of these constraints exist. Note the RN port's
rendering itself has strong indirect evidence: its SkSL shaders are
line-for-line mirrors of the Metal shaders that passed the 40-frame pixel
diff, and were themselves validated against Skia's real compiler via
CanvasKit renders.

**Remaining:**

- RN runtime verification + snapshot harness, in CI (see above).
- Android emulator pass — especially `pulse-outside`, whose halo renders behind an opaque child.
- Performance: 60 fps sustained with several instances on mid-range devices; profile GPU time.

## Findings worth keeping

- **CSS clamps `opacity` to [0,1]; the shaders originally did not.** Four presets
  exceed 1 (`pulse-outside` light stroke 1.96 and inner 1.04, `pulse-inner` dark
  stroke 1.54, `line` dark stroke 1.14). Unclamped, premultiplied alpha rose
  above 1 and compositing broke down — the `pulse-outside` light 1px ring blew
  out and stopped tracing the card's corners. Both shader pairs now clamp.
- **Toolchain ceiling on the current dev machine.** macOS 15.3.1 caps Xcode at
  16.4 (Swift 6.1), which caps Expo at SDK 53 — SDK 57's `expo-modules-jsi`
  needs Swift tools 6.2 (Xcode 26 → macOS 26.2). This constrains any RN work on
  that machine, not just this project. The library itself is unaffected: its
  peer deps are satisfied by both SDK generations.
- **The web demo is not showing stock library output.** Its
  `.beam-host--pulse-outside-tuned` preset applies `--pulse-glow-boost: 1.05`
  with `1.71×` layer opacity and matching glow brightness/saturation. Comparing
  a port against the demo without those hooks makes a correct port look "scaled
  down". Both ports now implement the 1.3.0 tuning hooks (`BeamTuning` /
  `tuning`), with the demo preset exported for reference.

**iOS simulator: verified.** All 5 types run live on iPhone 16 Pro (iOS 18.6) with
the Metal shaders compiled for `iphonesimulator`. `ports/ios/BorderBeamDemo/run.sh`
generates the project (XcodeGen), boots, builds, installs and launches in one step.

## Phase 4 — Docs and release

- Per-platform READMEs (install + usage), mirroring the web docs.
- SPM release for `BorderBeamKit`; npm release for `border-beam-native`.
- Version-sync policy: all packages track the shared spec version.

## Risks

1. **CSS gradient semantics** — `radial-gradient(ellipse WxH at X Y, color, transparent)` falloff/premultiplication must be reproduced exactly in the shaders or colors will drift. The `md` spike exists to nail this first.
2. **`line` type complexity** — traveling glow + 7 spike gradients + breathe/spike oscillators; budget the most verification time.
3. **`hue-rotate` fidelity** — CSS `hue-rotate` is a defined linear matrix (not true HSL rotation); use the spec matrix in both ports.
4. **Android color management** — wide gamut (iOS) vs sRGB (many Androids) can shift saturated colors; the parity harness catches this.

## Execution order

Phase 0 → iOS `md` spike → RN `md` spike (validates shared-shader design early) → parallel-track remaining types per platform → parity harness → docs/release.

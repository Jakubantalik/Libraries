# border-beam-native

React Native port of the [border-beam](https://beam.jakubantalik.com) web
library, rendered with [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/)
and [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/).
Expo-compatible.

> **Status: beta — iOS-verified only.** All 5 types implemented (`sm`, `md`,
> `line`, `pulse-outside`, `pulse-inner`) × 4 color variants × dark/light.
> Visual parity tuning against the web demo is pending — see `PORT_PLAN.md`
> Phase 3 in the repo root.
>
> **Android: untested.** The code is pure Skia with no platform branches, so it
> *should* run on Android, but no one has verified it — treat it as
> experimental there and please report what you find. The known risk areas:
> `pulse-outside` renders its halo beyond the component's bounds at
> `zIndex: -1` behind an opaque child (ancestor `overflow` handling differs on
> Android), color management can shift saturated colors (sRGB vs wide gamut),
> and blur behavior may differ subtly.

## Install

```sh
npm install border-beam-native @shopify/react-native-skia react-native-reanimated
```

## Usage

```tsx
import { BorderBeam } from 'border-beam-native';

<BorderBeam size="md" colorVariant="ocean" theme="auto" borderRadius={16}>
  <Card />
</BorderBeam>
```

All web props are mirrored: `size`, `colorVariant`, `theme` (`'auto'` follows
the system scheme), `staticColors`, `duration`, `active` (fades in/out with
`onActivate` / `onDeactivate`), `borderRadius` (explicit — no DOM
auto-detection; falls back to the size preset), `brightness`, `saturation`,
`hueRange`, `strength`, plus `style` for the wrapping `View`.

## Running the example app

`../example` is an Expo app that renders all 5 types with live pickers for
color variant, theme, active, and the web-demo tuning preset. It consumes this
package straight from source (Metro `watchFolders` + an `extraNodeModules`
alias), so edits hot-reload without a build step.

```bash
cd ports/react-native/example && npm install
```

```bash
npx expo run:ios
```

```bash
npx expo run:android
```

`expo run:*` is required rather than Expo Go, because Skia and Reanimated are
native modules. The first run does a prebuild + CocoaPods install and is slow;
later runs reuse it.

## Tuning

`tuning` exposes the library's consumer hooks (border-beam 1.3.0) — the
equivalent of `--pulse-glow-boost`, `--beam-stroke-opacity`, `--beam-core-blur`
and friends:

```tsx
import { BorderBeam, WEB_DEMO_PULSE_PRESET } from 'border-beam-native';

<BorderBeam size="pulse-outside" tuning={WEB_DEMO_PULSE_PRESET}>…</BorderBeam>
```

Worth knowing: the web demo's `pulse-outside` card is **not** stock output — it
applies a 1.05× glow boost with 1.71× layer opacity. Untuned beams are
deliberately softer than the demo; `WEB_DEMO_PULSE_PRESET` reproduces it.

## How it works

- All visual data comes from `beam-spec.json`, generated from the web library
  (`npm run spec` in the repo root). To sync after a web update:
  `npm run spec && cp spec/beam-spec.json ports/react-native/border-beam-native/src/`.
- `rotateShader.ts` is an SkSL runtime effect mirroring BorderBeamKit's Metal
  shader line-for-line: CSS radial-gradient blob stacks, conic gradients, the
  rotating beam-window mask, rounded-rect ring SDF geometry, and the CSS
  filter chain (`hue-rotate` → `brightness` → `saturate`) via W3C
  feColorMatrix math.
- The beam angle and hue shift run as Reanimated derived values on the UI
  thread (Skia `useClock`); the JS thread is untouched per-frame.
- The SkSL is validated against the real Skia compiler (CanvasKit) in CI-able
  scripts; see `PORT_PLAN.md` Phase 3 for the parity harness.

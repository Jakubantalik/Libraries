# thinking-orbs-native

Dotted thought-orb loading indicators for React Native, rendered with Skia.
Port of [thinking-orbs](https://orbs.jakubantalik.com) — nine hand-tuned
animated states, two purpose-tuned sizes, automatic dark/light.

> **Status: running on the iOS simulator** (iPhone 16 Pro, iOS 18.6, Expo
> SDK 53 / RN 0.79.6 / Skia 2.0.0-next.4) via `../example`. Geometry, types
> and the Skia draw sequence are verified as described below. Still
> unverified: a physical device and Android.

## Install

```bash
npm install thinking-orbs-native @shopify/react-native-skia react-native-reanimated
```

## Usage

```tsx
import { ThinkingOrb } from 'thinking-orbs-native';

<ThinkingOrb state="searching" size={64} />;
```

Props mirror the web package: `state`, `size` (`64 | 20`), `theme`
(`'auto' | 'dark' | 'light'`), `speed`, `paused`, `accessibilityLabel`,
`style` — plus one addition, `displaySize`.

`displaySize` renders the orb at an arbitrary dp size while keeping the
tuned `size` preset's geometry: the Skia canvas is sized to `displaySize`
and the drawing is scaled into it. Since a frame is a list of vector
circles, that stays sharp at any factor, unlike a transform on the view,
which upscales an already-rasterised canvas. Use it when a layout needs the
64 design at some other size — the example app's pill-to-sheet morph grows
its orb from 48 to 133dp this way.

## How parity is achieved

The geometry is not re-implemented. This package depends on
`thinking-orbs/engine` — the same compiled, React-free frame functions the
web component runs — and only translates the resulting dot list into Skia
draw calls. A frame arrives already z-sorted, radius-clamped and culled, so
the renderer draws the array in order and derives nothing.

`npm run verify:golden` asserts the resolved engine reproduces
`spec/orbs-golden.json` exactly (72 cases, 70,115 values, tolerance 1e-4).
It is not checking arithmetic — it is checking that the dependency resolved
to the engine those vectors came from, since a stale or duplicated copy of
`thinking-orbs` in the tree would otherwise surface as an animation subtly
out of step with the web.

## How the Skia drawing is verified

`scripts/render-canvaskit.mjs` replays the exact draw sequence from
`ThinkingOrb.tsx` through CanvasKit — the WASM build of the same Skia
engine react-native-skia wraps — and `scripts/diff-png.mjs` pixel-diffs the
result against the browser's canvas output for the same frozen instants
(captured via `demo/parity.html` in the web repo).

```bash
node scripts/render-canvaskit.mjs
node scripts/diff-png.mjs canvaskit-out web-out
```

Current result over 9 states at 64px, dark, two timestamps each: worst mean
difference **1.4/255 (0.55%)**, centroids aligned to under half a device
pixel. See below for what the residual is.

## Threading

The frame is built and recorded into an `SkPicture` on the JS thread; Skia
rasterises it on the UI thread. The heaviest mode (`composing`, 566 dots)
costs **0.12 ms per frame** on desktop V8 — under 1% of a 60 fps budget,
and a few times that under Hermes on a mid-range phone.

That headroom is why the geometry is deliberately **not** workletized.
Doing so would require `'worklet'` directives throughout the shared engine
(measured: without them Reanimated's Babel plugin produces zero worklets,
so calling it from the UI thread would throw), coupling the web library to
Reanimated's toolchain and risking a bundler silently stripping the
directives. The part that actually must not jank — rasterisation — is on
the UI thread either way.

## Known difference from the web

Skia and Chrome's 2D canvas rasterise **sub-pixel circles** differently,
and many of the far-depth dots in these animations are well under a pixel
across. Measured on isolated circles (device px, ink = premultiplied
luminance sum):

| radius | Skia | Chrome canvas |
|---|---|---|
| 20 | 320011 | 320456 |
| 4 | 13300 | 13032 |
| 1 | 764 | 872 |
| 0.5 | 192 | 128 |
| 0.35 | 64 | **0** |

At radius 20 the two agree to 0.14%, which rules out any colour-space,
gamma, alpha or compositing discrepancy — the ink rule and premultiplication
are correct. The divergence is purely a sub-pixel antialiasing curve, and at
the bottom of the range Chrome drops the circle entirely while Skia still
draws it.

Net effect: this port renders the faintest, smallest dots slightly more
present than the web does. It is a rasteriser property rather than a port
defect, and if anything the Skia result is the more faithful one — dots the
engine asked for do not silently vanish. It is not worth compensating for:
the bias is not even monotonic in radius (Skia is *lighter* at r=1 and
heavier at r=0.5), so any correction would be a fitted transfer function
chasing a sub-1%-mean difference.

## License

MIT

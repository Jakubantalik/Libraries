# border-beam

Animated border beam effect for React. A lightweight component that adds a traveling or breathing glow animation around any element — cards, buttons, inputs, or search bars.

## Install

```bash
npm install border-beam
```

## Quick start

```tsx
import { BorderBeam } from 'border-beam';

function App() {
  return (
    <BorderBeam>
      <div style={{ padding: 32, borderRadius: 16, background: '#1d1d1d' }}>
        Your content here
      </div>
    </BorderBeam>
  );
}
```

The component wraps your content and overlays the animated beam effect. It auto-detects the `border-radius` of the first child element.

## Types

Built-in presets control the glow style and motion. They fall into two families:

### Rotate (traveling beam)

```tsx
<BorderBeam size="md">  {/* Full border glow (default) */}
  <Card />
</BorderBeam>

<BorderBeam size="sm">  {/* Compact glow for small elements */}
  <IconButton />
</BorderBeam>

<BorderBeam size="line">  {/* Bottom-only traveling glow */}
  <SearchBar />
</BorderBeam>
```

### Pulse (breathing glow, no rotation)

```tsx
<BorderBeam size="pulse-inner">    {/* Contained breathing border glow */}
  <Card />
</BorderBeam>

<BorderBeam size="pulse-outside">  {/* Outward-blooming halo around the element */}
  <Card />
</BorderBeam>
```

Both pulse types support all color variants, `strength`, `theme`, and the breathe
speed via `duration` (defaults to `2.3`).

> **`pulse-outside` requires an opaque wrapped child.** The colorful core and halo
> render *behind* your content (`z-index: -1`) and bloom outward, so only the part
> that spills beyond the element shows. If your child is transparent, the inner glow
> will show through. The wrapper uses `overflow: visible`, so make sure the
> surrounding layout has room (or `overflow: visible`) for the halo to spill.

> **`pulse-outside` relies on the wrapped element's own 1px border as the idle
> hairline.** It does not paint its own hairline by default, so the colored stroke
> rides directly on top of your element's existing edge instead of doubling it. If
> your child has no border, add a subtle 1px border (or `box-shadow: inset 0 0 0 1px`)
> so the edge stays defined while the beam is faded out.

## Color variants

Four color palettes are available:

```tsx
<BorderBeam colorVariant="colorful" />  {/* Rainbow spectrum (default) */}
<BorderBeam colorVariant="mono" />      {/* Grayscale */}
<BorderBeam colorVariant="ocean" />     {/* Blue-purple tones */}
<BorderBeam colorVariant="sunset" />    {/* Orange-yellow-red tones */}
```

All variants except `mono` animate through a hue-shift cycle.

## Theme

Adapts beam colors for dark or light backgrounds:

```tsx
<BorderBeam theme="dark" />   {/* Dark background (default) */}
<BorderBeam theme="light" />  {/* Light background */}
<BorderBeam theme="auto" />   {/* Detects system preference */}
```

## Strength

Control the overall intensity of the effect without affecting the wrapped content:

```tsx
<BorderBeam strength={0.7}>  {/* 70% intensity */}
  <Card />
</BorderBeam>
```

`strength` accepts a value from `0` (invisible) to `1` (full intensity, default).

## Play / pause

Toggle the animation on and off with smooth fade transitions:

```tsx
const [active, setActive] = useState(true);

<BorderBeam active={active} onDeactivate={() => console.log('faded out')}>
  <Card />
</BorderBeam>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Content to wrap |
| `size` | `'sm' \| 'md' \| 'line' \| 'pulse-outside' \| 'pulse-inner'` | `'md'` | Size/type preset |
| `colorVariant` | `'colorful' \| 'mono' \| 'ocean' \| 'sunset'` | `'colorful'` | Color palette |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'dark'` | Background adaptation |
| `strength` | `number` | `1` | Effect opacity (0–1), only affects the beam layers |
| `duration` | `number` | `1.96` / `3.1` / `2.3` | Animation cycle duration in seconds (rotate / line / pulse) |
| `active` | `boolean` | `true` | Whether the animation is playing |
| `borderRadius` | `number` | auto-detected | Custom border radius in px |
| `brightness` | `number` | per-type (`1.3`) | Glow brightness multiplier; falls back to the type's preset default |
| `saturation` | `number` | `1.2` | Glow saturation multiplier |
| `hueRange` | `number` | `30` | Hue rotation range in degrees |
| `staticColors` | `boolean` | `false` | Disable hue-shift animation |
| `className` | `string` | — | Additional class on the wrapper |
| `style` | `CSSProperties` | — | Additional inline styles on the wrapper |
| `onActivate` | `() => void` | — | Called when fade-in completes |
| `onDeactivate` | `() => void` | — | Called when fade-out completes |

All standard `HTMLDivElement` attributes are also forwarded to the wrapper.

## How it works

`BorderBeam` renders a wrapper `<div>` with:

- **`::after`** — the beam stroke (rotate: conic gradient masked to the border; pulse: the colored perimeter ring / hairline)
- **`::before`** — inner glow layer (pulse-outside pushes this outward behind the content)
- **`[data-beam-bloom]`** — outer bloom/glow child div

All effect layers are absolutely positioned and use `pointer-events: none`, so they never interfere with your content. The rotate and line types animate via CSS `@property` keyframes for smooth GPU-accelerated transitions; because the keyframes also declare explicit `0% / 50% / 100%` stops, browsers without `@property` support degrade gracefully (stepped instead of interpolated motion) rather than breaking. The pulse types drive their slow breathing from a single shared, frame-rate-capped (~30fps) `requestAnimationFrame` loop that writes plain CSS custom properties — so the breathing works even without `@property` support, repaints less often, and automatically pauses when the instance is inactive, offscreen, or the user prefers reduced motion. The pulse types also isolate their stacking context, cap blur radii, and hint `will-change` on the animated layers for performance.

## Project structure

```
border-beam/
├── src/
│   ├── index.ts          # Public exports
│   ├── BorderBeam.tsx     # React component
│   ├── types.ts           # TypeScript type definitions
│   ├── styles.ts          # CSS generation engine
│   └── pulseDriver.ts     # Shared rAF loop driving the pulse breathing
├── demo/                  # Vite + React demo site
├── dist/                  # Built output (ESM + CJS + types)
├── package.json
├── LICENSE
└── README.md
```

## Requirements

- React 18+
- Modern browser with CSS `@property` support (Chrome 85+, Safari 15.4+, Firefox 128+)

## Accessibility

The effect layers are purely decorative and use `pointer-events: none`. They do not affect keyboard navigation or screen readers. The pulse types ship a built-in `prefers-reduced-motion: reduce` block that disables their animations; the rotate types respect `prefers-reduced-motion` when implemented by the consumer.

## License

[MIT](./LICENSE)

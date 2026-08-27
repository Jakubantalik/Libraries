# liquid-gooey

Liquid effects for React UI. Two effects and one modifier cover the whole family:

- **Morph** — touching pieces merge gooily and change shape like jelly. Menus, avatar groups, morphing panels.
- **Move** — the surface trails a moving element as liquid rubber with a droplet tail. Sliders, tab indicators, dragged things.

Plus **`dissolve`**, an orthogonal modifier: your imagery melts into whatever it touches. It isn't a third effect — the effects describe how the *surface moves*, dissolve describes what your *content* does where two surfaces meet.

Cross-browser (Safari included), crisp text/icons/images at all times, real shadows on the merged liquid, zero idle cost.

## Why

The usual gooey effect runs blur + alpha-contrast over your actual UI. That one decision costs you everything else: text goes soft, images smear, shadows become impossible (the contrast step eats them), and Safari renders it wrong. So the effect stays confined to decorative colored circles.

liquid-gooey splits it in two — a silhouette layer carries the goo and the shadow, your real DOM rides crisp on top. Same liquid, none of the tax.

- **Real shadows.** Parsed from `box-shadow` syntax and rebuilt on the *merged* silhouette, so one consistent shadow hugs the liquid through every merge, split and bridge — no handoff, nothing to flash.
- **Crisp everything.** Text, icons and photos stay pixel-sharp because they are never filtered.
- **Images that actually melt.** Opt-in dissolve warps imagery at the contact point with SVG displacement — two materials mixing, not a blur.
- **Safari included.** Filters run on SVG content, never CSS `url()` on HTML — that's the specific thing WebKit gets wrong.
- **It's real UI, not decoration.** The content layer is live DOM: focus rings, hit targets, ARIA and handlers all intact.
- **Zero idle cost.** Component-driven springs compile to GPU-composited CSS `linear()` easings; the measurement loop sleeps completely when nothing moves.
- **Two effects, not fifty knobs.** Morph and Move take 3–4 normalized knobs each, plus a `dissolve` modifier — with the full physics underneath when you want it.

```bash
npm install liquid-gooey
```

```tsx
import { Liquid } from 'liquid-gooey'

<Liquid blur={6} contrast={18} fill="#fff" shadow="0 2px 6px rgba(0,0,0,.08)">
  {/* MORPH (default): give items x/y and the library animates element and
      liquid in perfect sync — a plus-menu that splits like droplets */}
  <Liquid.Item x={open ? -54 : 0} y={open ? -34 : 0} transition="bouncy">
    <button className="round-btn">…</button>
  </Liquid.Item>
  <Liquid.Item x={0} y={open ? -64 : 0} transition="bouncy" delay={40}>
    <button className="round-btn">…</button>
  </Liquid.Item>
</Liquid>
```

Run the playground: `npm install && npm run dev` — add `?pro` to the URL for the full raw-physics control panels.

## The four effects

### Morph (default)

Merging is automatic: blobs share the group's goo filter, so touching pieces bridge and merge. One optional power:

```tsx
// Shape change: the liquid mass flows toward the new centre first, then size
// and corner radius adapt — content cross-blurs inside the moving liquid.
<Liquid.Item morph={{ shape: true }}>
  <div className={open ? 'panel-open' : 'panel-closed'}>…</div>
</Liquid.Item>
```

| Knob | Default | Meaning |
| --- | --- | --- |
| `shape` | `false` | Liquid shape-change physics (springs + droplet travel + corner timeline). |
| `speed` | `1` | Tempo multiplier for the shape physics (2 = twice as fast, same character). |
| `bounce` | `0.5` | `0..1` — how much the physics overshoot and wobble. `0` = calm, critically damped. |
| `contentBlur` | `7` | Max px **your content** cross-blurs by while the liquid is in motion, sharpening as it settles. `0` disables. |

Morph acts on both halves of the effect: the *surface* (merge, springs, corner timeline) and your *content* (`contentBlur` while moving).

### Dissolve (a modifier, not an effect)

```tsx
<Liquid.Item dissolve />                      // the tuned look
<Liquid.Item dissolve={0.5} />                // scaled intensity
<Liquid.Item dissolve={{ mix: 0.7, active: dragging }} />   // full DissolveOptions
```

The item's imagery melts into a touching neighbour at the contact point — a liquid warp with two-liquid mixing, not a blur. Strength ramps with proximity, tracking where the goo bridge actually forms, so it needs no gating of its own; wire `active` to your drag state if you want it to clear on release. Text is never melted, only imagery.

Today it applies to morph items. Under `effect="move"` it is ignored with a dev warning: the melt is drawn from the element's measured rect while move's liquid deliberately lags on a spring, so the two would visibly disagree.

### Move

```tsx
<Liquid.Item effect="move" move={{ springiness: 0.5, trail: 0.575 }}>
  <div className="thumb" style={{ transform: `translateX(${x}px)` }} />
</Liquid.Item>
```

You move the element however you like (CSS, pointer events, Framer Motion) — the liquid trails it.

| Knob | Default | Meaning |
| --- | --- | --- |
| `springiness` | `0.5` | `0..1` — how tightly the liquid chases. 0 = heavy syrup, 1 = near-instant. |
| `wobble` | `0.5` | `0..1` — overshoot on arrival. |
| `stretch` | `0.36` | `0..1` — velocity stretch of the drop. |
| `trail` | `0.575` | `0..1` — trailing droplet size. 0 disables the tail. |

All defaults reproduce the library's tuned look exactly — knobs at rest change nothing.

### Melt

Two images running molten into each other: the goo averages their colours where
they touch, each crisp face dissolves back at the seam, and a marbling pass folds
the two palettes into streaks inside the contact area.

```tsx
<Liquid>
  <Liquid.Item effect="melt">
    <div className="card"><img src={a} /></div>
  </Liquid.Item>
  <Liquid.Item effect="melt">
    <div className="card"><img src={b} /></div>
  </Liquid.Item>
</Liquid>
```

Move the elements however you like — the melt follows their rendered rects. The
source is read from the first `<img>` inside the item, or passed as
`melt={{ src }}`. Your element stays interactive (drag handlers, focus) but is
painted by the melt layer, so style its size and radius as usual.

Pairwise by design: the first two melt items in a group form the pair, because
the seam maths is two-body.

| Knob | Default | Meaning |
| --- | --- | --- |
| `blur` | `7` | Goo sigma — how far the bodies reach, and how wide the colour averaging runs. |
| `contrast` | `40` | Sharpness of the liquid boundary. |
| `reach` | `0.8` | How far each crisp face dissolves back before the neighbour. |
| `fade` | `17` | Softness of that dissolve. |
| `warp` | `0` | Turbulence displacement of the molten layer (px). |
| `mix` | `1` | `0..1` — marbling strength in the touch area. |
| `mixBlur` | `8` | Blur of the marble pass's source colours: low keeps image detail, high folds pre-averaged soup. |
| `gravity` | `1.9` | How deep the marble zone reaches into each card. |
| `waviness` | `12` | Wavelength of the warp noise: low = long lazy rolls, high = fine ripples. |

### Bend

The body deforms with velocity, like a soft bar pulled through liquid: dragging
vertically arcs the long edges (the middle leads, the ends lag), dragging
sideways reshapes the rounded caps (the leading one blunts, the trailing one
stretches). The surface stays glued to its content — there is no lag and no
tail, so text and icons never slide off their own card.

```tsx
<Liquid.Item effect="bend" bend={{ vertical: 0.6, horizontal: 0.35 }}>
  <div className="card" style={{ transform: `translate(${x}px, ${y}px)` }}>…</div>
</Liquid.Item>
```

| Knob | Default | Meaning |
| --- | --- | --- |
| `vertical` | `0.6` | `0..1` — bow strength of the long edges. |
| `horizontal` | `0.35` | `0..1` — cap deformation. |

The live bend is published on the item as CSS variables — `--lg-bend-x` /
`--lg-bend-y` (px) and `--lg-bend-xn` / `--lg-bend-yn` (unitless, for `deg`
maths) — so the content can lean, rotate or shear along with the silhouette:

```css
.card > * {
  transform: translateY(calc(var(--lg-bend-y, 0px) * 2))
             rotate(calc(var(--lg-bend-yn, 0) * 1deg));
}
```

## `<Liquid>` (the group)

Renders a `position: relative` div; the liquid silhouette svg sits behind all children.

| Prop | Default | Description |
| --- | --- | --- |
| `blur` | `6` | Goo blur sigma (px). Larger = pieces bridge from farther away. **Bridging is a ratio of blur to gap** — roughly, neighbours merge once `blur` ≳ the gap between them. Items 8px apart barely bridge at `blur={5}` and merge cleanly at `blur={12}`. If pieces that should merge look separate, raise `blur` (or close the gap) before suspecting anything else. |
| `contrast` | `18` | Alpha-contrast slope. Larger = sharper liquid edge. |
| `fill` | `'#fff'` | Liquid surface color. Any CSS color; `var(--surface)` works (theming). |
| `shadow` | — | `box-shadow` syntax, multi-layer supported. Rendered on the **merged** silhouette, so one consistent shadow hugs the liquid through every merge and split. `inset` layers paint INSIDE the liquid edge — inner rings and top highlights follow the merged goo too. |
| `filterPadding` | `24` | Extra filter-region slack (px) if blobs travel outside the group's box. |
| `waviness` | `0` | Max px the liquid boundary undulates — the silhouette and its shadows run through a gentle noise displacement, so edges read as fluid rather than geometric. |
| `wavinessFreq` | `0.018` | Noise frequency of that undulation; lower = longer, lazier waves. |

Plus all standard `div` props. **Size the group to contain the full travel of its items** (like a menu reserving its open footprint).

## `<Liquid.Item>`

| Prop | Description |
| --- | --- |
| `effect` | `'morph'` (default), `'move'`, `'melt'` or `'bend'`. |
| `morph` / `move` / `melt` / `bend` | The knobs above, plus `advanced` (below). |
| `dissolve` | `true`, `0..1`, or raw `DissolveOptions` — melts imagery where surfaces meet. Orthogonal to `effect`. |
| `x` `y` `scale` `transition` `delay` | Component-driven position: the library animates element + liquid in one commit — pixel-perfect sync. `transition` is `'snappy' \| 'smooth' \| 'bouncy'`, `{ stiffness, damping, mass }` or `{ duration, ease }`. |
| `observe` | Plain-merge items animated by *your* code: the liquid follows the child's rendered rect. Implied by `morph.shape`, `dissolve` and `effect="move"`. |
| `radius` | Override the measured border-radius (`number` or `[tl, tr, br, bl]`). |

Border-radius is measured from computed style; percentage radii, circles and pills just work.

## Advanced (the pro escape hatch)

Every raw engine value stays reachable — the slim knobs map onto them, and `advanced` merges over the mapping:

```tsx
<Liquid.Item
  morph={{
    shape: true,
    advanced: {
      evolve: { massStiffness: 320, cornerDuration: 820, roundness: 1 /* EvolveOptions */ },
      blobInset: 2,   // shrink the blob so an opaque photo covers its own liquid
      bridgeGrow: 8,  // liquid coat that swells out and necks into a neighbour
    },
  }}
  // dissolve takes its raw options directly — no `advanced` detour
  dissolve={{ warp: 26, mix: 0.7, gravity: 60, active: dragging /* DissolveOptions */ }}
/>

<Liquid.Item effect="move" move={{ advanced: { stiffness: 380, damping: 18 /* MoveOptions */ } }} />
```

Exported for typing and defaults: `EvolveOptions` / `EVOLVE_DEFAULTS`, `MoveOptions` / `MOVE_DEFAULTS`, `DissolveOptions`, `Transition`, `presets`. Highlights:

- **EvolveOptions** — `massStiffness/Damping`, `sizeStiffness/Damping`, `radiusStiffness/Damping`, `contentBlur` (cross-blur px), `roundness` (0–1 droplet strength), `anticipation`/`travel` (ms the droplet lead ramps in / px it reaches), corner timeline `cornerDuration`/`cornerDelay`/`cornerEase`.
- **DissolveOptions** — `blur`, `warp`, `zone`, `range`, `mix` (two-liquid erosion), `gravity`/`taper` (pointy directional flow), `warpFreq`, `flowSpeed` (churn), `warpStyle`, `detail`, `active`/`releaseMs` (wire `active` to your drag; release completes in exactly `releaseMs`).
- **MoveOptions** — `stiffness`, `damping`, `stretch`, `tail`.

## How it works (and why it's fast)

You cannot run a goo filter over real UI pixels — it destroys text and images, and WebKit's CSS `url()` filters on HTML are broken anyway. So the library uses two layers with one source of truth:

- **Silhouette layer (below):** an SVG holding one plain blob per item, mirroring each item's geometry. The goo filter and the shadow chain run here. Filters on *SVG content* render identically in Chrome, Firefox and Safari.
- **Content layer (above):** your real, interactive, unfiltered elements — crisp at all times. Give them transparent backgrounds; the liquid below is their surface.

Performance:

- Component-driven motion compiles springs to CSS `linear()` easings (cached) — GPU-composited transitions, no per-frame JS.
- Observed items share one per-group rAF loop that **sleeps entirely** (zero idle cost) after ~0.5s of stillness and wakes instantly via MutationObserver / transition events / ResizeObserver / pointer events.
- The dissolve overlay renders only near contact and sleeps with the engine.

Caveats: the dissolve warps a snapshot of each image's `src` (rebuilt on resize), and writes `mask-image` onto `<img>` elements during contact — don't combine with your own masks there. `morph.shape` writes `filter: blur()` onto the element mid-morph — don't combine with your own `filter` there. Rotation isn't mirrored (v1).

## Notes

- **Accessibility**: the content layer is real DOM — focus rings, hit targets and ARIA are never filtered.
- **Reduced motion**: component-driven transitions collapse to instant snaps under `prefers-reduced-motion`.
- **Theming**: pass `fill="var(--surface)"` and let CSS variables switch light/dark.
- **Item backgrounds** should be transparent — the blob is the surface. An opaque child (a full-bleed image in a circle) covers its own blob, which is exactly right for image chips.

## Publishing

```bash
npm run typecheck && npm run build
npm publish        # from a logged-in npm account
```

`dist/` ships ESM + CJS + types; `sideEffects: false`; React ≥18 peer dependency.

## Credits

Filter architecture distilled from the PRO7 "Gooey plus menu" prototype; API philosophy inspired by [Sileo](https://sileo.aaryan.design/).

MIT

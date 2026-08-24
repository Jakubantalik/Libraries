import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { CycleEvent } from './engine';
import type { PresetName } from './presets';

/**
 * Theme mode for the img-fx effect.
 *
 * - `auto` (default): walks a small priority chain and updates live on any
 *   change:
 *     1. `<html data-theme="dark|light">`             — shadcn / SSR apps
 *     2. `<html class="dark">` / `class="light">`     — Tailwind v3 darkMode
 *     3. `<html style="color-scheme: dark|light">`    — CSS-only toggles
 *     4. `matchMedia('(prefers-color-scheme: dark)')` — OS preference
 *     5. `'dark'` fallback (SSR-safe; re-resolves on hydration)
 *   A MutationObserver on `<html>` re-resolves whenever class / style /
 *   data-theme changes, so JS theme toggles propagate without a remount.
 * - `dark` / `light`: pin to a specific mode regardless of system / app
 *   preference.
 */
export type ImageGenerationTheme = 'auto' | 'dark' | 'light';

/** Bundled preset names. Each preset ships both a dark and light tunings block. */
export type ImageGenerationPreset = PresetName;

/** Phase event emitted by the auto-reveal scheduler. */
export type ImageGenerationCycleEvent = CycleEvent;

/**
 * Imperative handle exposed via `ref` on `<ImageGeneration>`. Lets callers
 * trigger a single reveal from a button click or other user action without
 * enabling `autoReveal`.
 *
 * The wrapper element itself is also reachable via `handle.element`.
 */
export interface ImageGenerationHandle {
  /** The wrapper `<div>` element. */
  element: HTMLDivElement | null;
  /**
   * Run a reveal pass now.
   *
   * - No-op if a reveal is already in progress (currently revealing, holding
   *   the image visible, or fading back to the shader).
   * - `hold: 'auto'` (default) — runs reveal -> hold (`revealHoldMs`) -> hide
   *   automatically, mirroring the auto-loop's pass.
   * - `hold: 'manual'` — runs reveal then stays in the visible phase until
   *   `triggerHide()` is called. Use this for "Reveal / Hide" toggle buttons.
   *
   * Requires a non-empty `images` prop; otherwise it's a silent no-op.
   */
  triggerReveal: (opts?: { hold?: 'auto' | 'manual' }) => void;
  /**
   * Manually trigger the hide fade if an image is currently revealed (in
   * `reveal` or `visible` phase). No-op otherwise.
   */
  triggerHide: () => void;
  /**
   * Regenerate the currently revealed image in place: the image breaks into
   * the effect's pixel-cell grid, the cells churn (pop in/out with the
   * preset's flicker clock) while the shader plays through the gaps, and
   * after `durationMs` the next image from the pool dissolves in over the
   * churn (held like `triggerReveal({ hold: 'manual' })`).
   *
   * By default the effect is also recolored from the outgoing image — its
   * palette is sampled from the visible pixels and mapped onto the preset's
   * palette slots by luminance rank, so the churn reads as pixelation born
   * from that image rather than the preset's stock colors. The preset
   * palette (or the `colors` prop, when set) is restored automatically once
   * the new image is fully visible.
   *
   * The churn always runs on a pixel-mosaic preset (`pixels-mechanic` /
   * `pixels-organic`). When the active preset is `sweep-gradient`, the effect
   * temporarily switches to a randomly-picked pixel preset for the churn and
   * restores the authored preset once the new image is fully visible.
   *
   * Options:
   * - `durationMs` — churn length before the next image auto-reveals.
   *   @default 4000
   * - `tintFromImage` — recolor the effect from the outgoing image.
   *   @default true
   * - `autoReveal` — set to `false` to churn indefinitely instead; end it
   *   manually with `triggerReveal()` (next image dissolves in over the
   *   churn) or `triggerHide()`.
   *   @default true
   *
   * No-op unless an image is currently revealed (`reveal` or `visible`
   * phase). Emits an `idle` cycle event when the churn starts.
   */
  triggerRegenerate: (opts?: {
    durationMs?: number;
    tintFromImage?: boolean;
    autoReveal?: boolean;
  }) => void;
  /**
   * Returns true while an image is showing on top of the shader (any of the
   * `reveal`, `visible`, or `hide` phases). Useful for driving the label /
   * icon of a Reveal/Hide toggle button.
   */
  isImageActive: () => boolean;
}

export interface ImageGenerationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Single host element to wrap. The wrapper sizes itself to the child; the
   * shader paints inside the wrapper at full size, clipped to the child's
   * border-radius.
   */
  children: ReactNode;

  /**
   * Selects which bundled preset to render.
   *
   * - `pixels-organic` - Chromium Flow rendered as a pixel mosaic.
   * - `pixels-mechanic`- Nebula rendered as a pixel mosaic.
   * - `sweep-gradient` - Gradient Sweep rendered as a pixel mosaic.
   *
   * @default 'pixels-organic'
   */
  preset?: ImageGenerationPreset;

  /**
   * Theme mode. `'auto'` resolves via `matchMedia('(prefers-color-scheme: dark)')`
   * and switches live when the OS theme changes.
   * @default 'auto'
   */
  theme?: ImageGenerationTheme;

  /**
   * Effect strength (0..1). Multiplies the shader canvas opacity. The shader
   * keeps animating at full intensity at any value; only the rendered alpha
   * is scaled down.
   * @default 1
   */
  strength?: number;

  /**
   * Pixel-cell size multiplier for the mosaic effect. Scales the on-screen
   * size of each pixel cell (and the matching reveal dissolve) without
   * touching the preset:
   *
   *   - `1` (default) — the preset's authored cell size.
   *   - `0.5` — cells at half size (finer grid, effect reads as "zoomed out").
   *   - `2` — cells at double size (chunkier grid, "zoomed in").
   *
   * Implemented by dividing the shader grid's base cell count by this value,
   * so the shader mosaic and the reveal pixel dissolve stay in lockstep. The
   * grid always keeps a floor of 2 cells, so extreme values are safe.
   * @default 1
   */
  pixelScale?: number;

  /**
   * Card background colour. Accepts any CSS colour string the browser can
   * parse — hex (`#rgb` / `#rrggbb` / `#rrggbbaa`), `rgb()` / `rgba()`,
   * `hsl()` / `hsla()`, named colours, modern `color(...)` syntax — and is
   * applied two ways:
   *
   *   1. Verbatim as the wrapper element's CSS `background`, so the
   *      original alpha is preserved visually.
   *   2. Parsed to an opaque RGB triple for the shader's `u_cardBg`
   *      uniform, which drives colour-proximity / contrast logic so any
   *      shader colours that match the card background get faded out and
   *      the effect stays visually balanced.
   *
   * Alpha is intentionally dropped when feeding the shader — the renderer
   * has no source for what's behind a translucent card and can't composite
   * correctly. If precise shader behaviour matters under a translucent
   * surface, pass the opaque colour you want the shader to reason against.
   *
   * Useful for keeping colours in sync when the host card surface changes
   * (e.g. dark-mode card swatch). When omitted, the preset's bundled
   * `cardBg` (always opaque hex) is used.
   */
  cardBg?: string;

  /**
   * Optional palette override for the running effect (up to 7 CSS colors,
   * one per shader palette slot). A slot with a value replaces the preset
   * color verbatim; `null` / `undefined` slots keep the preset color. Pass
   * `undefined` (or omit) to use the preset palette.
   *
   * Useful for re-tinting the effect from external data — e.g. colors
   * sampled from the image being regenerated — while keeping the exact same
   * animation and cell grid.
   */
  colors?: (string | null | undefined)[];

  /**
   * Image pool used by the reveal animation. Pass a single string to reveal
   * the same image every cycle, or an array for random pick (never
   * repeating the previous index).
   * @default []
   */
  images?: string | string[];

  /**
   * When true, runs the auto-reveal scheduler:
   *   shader (random delay) -> reveal -> hold -> hide -> repeat.
   * @default false
   */
  autoReveal?: boolean;

  /**
   * Random shader-only delay range in seconds between reveals.
   * @default [2, 4]
   */
  revealDelayRange?: [number, number];

  /**
   * One-time delay applied before the very first reveal (after `autoReveal`
   * is enabled or `triggerReveal` runs the first cycle). Subsequent reveals
   * follow `revealDelayRange`.
   *
   * - `number`: exact seconds.
   * - `[min, max]`: seconds range, randomised once at cycle creation.
   * - `undefined` (default): library picks a small jitter (0-1.5 s) so
   *   multiple instances on the same page don't tick in lockstep.
   *
   * Useful for staggering hero cards (e.g. card #2 = `[1, 3]`, card #3 =
   * `[1, 3]`) so they don't all reveal at once.
   */
  revealInitialDelay?: number | [number, number];

  /**
   * Time the image stays fully visible after the reveal animation completes,
   * before the hide cross-fade kicks in.
   *
   * - `number` — fixed milliseconds.
   * - `[min, max]` — random milliseconds per cycle, picked fresh each reveal.
   *
   * @default 2000
   */
  revealHoldMs?: number | [number, number];

  /** ms cross-fade back to the shader. @default 300 */
  revealFadeOutMs?: number;

  /**
   * Optional explicit corner radius (CSS px). When omitted, reads the
   * computed `border-radius` of the wrapped child each resize.
   */
  borderRadius?: number;

  /** Freezes the shader and the auto-reveal scheduler. @default false */
  paused?: boolean;

  /** Phase event hook for the auto-reveal cycle. */
  onCycle?: (event: ImageGenerationCycleEvent) => void;

  /**
   * Optional callback invoked just before each image pick that returns a list
   * of src strings the cycle MUST avoid this round. Use this to coordinate
   * multiple `<ImageGeneration>` instances that share an image pool so they
   * never display the same image at the same time.
   *
   * The callback runs on every pick (including manual `triggerReveal()`) so
   * it can read live state. If every candidate is excluded, the cycle falls
   * back to a normal random pick so it never gets stuck.
   */
  excludeSrcs?: () => string[] | Set<string> | null | undefined;

  /** Forwarded class name for the wrapper element. */
  className?: string;

  /** Forwarded inline styles for the wrapper element. */
  style?: CSSProperties;
}

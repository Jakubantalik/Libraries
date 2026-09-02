/**
 * Bundled preset configurations for the img-fx effect.
 *
 * Direct ports of the bundled JSON presets in `presets/`:
 *   • preset-pixels-style-3.json  -> pixels-organic  (Chromium Flow)
 *   • preset-pixels-style-4.json  -> pixels-mechanic (Nebula)
 *   • sweep-gradient defaults     -> sweep-gradient  (Gradient Sweep)
 *
 * Each preset ships a `dark` and `light` mode block; the resolved theme picks
 * the right one at runtime.
 *
 * Note: older dot-based presets were removed from the bundled preset surface
 * to keep the package aligned with the demo and the supported public API.
 */

import { PIXELS_MECHANIC } from './pixels-mechanic';
import { PIXELS_ORGANIC } from './pixels-organic';
import { SWEEP_GRADIENT } from './sweep-gradient';

export type PresetName = 'pixels-organic' | 'pixels-mechanic' | 'sweep-gradient';
export type PresetTheme = 'dark' | 'light';

/** Per-cell mosaic configuration for pixel-mode rendering. */
export interface MosaicConfig {
  /** Cell-size 0..1; converted in shader to `floor(6 + cellSize*74)` cells. */
  cellSize: number;
  /** Inter-cell spacing 0..1. */
  gap: number;
  /** Highlight scale boost 0..1. */
  hlScale: number;
  /** Background fill opacity. */
  fillOpacity: number;
  /** Edge fade band in CSS px. */
  edgeFade: number;
  /** Edge fade strength 0..1. */
  fadeStr: number;
}

/** Reveal animation tunings (per-mode). */
export interface RevealConfig {
  /** Duration of the shader-based reveal mask animation (sec). */
  duration: number;
  /** Easing key applied during the reveal animation. */
  easing: EasingKey;
  /** Mask-shape type (geometric or shader-driven). */
  maskShape: MaskShape;
  /** Mask edge softness 0..1. */
  softness: number;
  /** Max CSS-px blur applied to the mask canvas during reveal. */
  blur: number;
  /** Pixel-cell dissolve duration (sec). */
  pixDuration: number;
  /** Easing for the pixel-cell dissolve. */
  pixEasing: EasingKey;
}

export type EasingKey =
  | 'linear'
  | 'smoothstep'
  | 'easeOutCubic'
  | 'easeOutQuint'
  | 'easeInOutCubic'
  | 'easeOutExpo'
  | 'easeOutBack';

export type MaskShape =
  | 'shader'
  | 'shaderHighlight'
  | 'shaderColor1'
  | 'shaderColor2'
  | 'shaderColor3'
  | 'shaderColor4'
  | 'shaderColor5'
  | 'radialCenter'
  | 'radialCorner'
  | 'linearTop'
  | 'linearBottom'
  | 'linearLeft'
  | 'linearRight'
  | 'diagonalTL'
  | 'diagonalBR'
  | 'diamond'
  | 'blindsH'
  | 'blindsV'
  | 'gradientSweep';

/** A single theme-mode block of a preset (mirrors the JSON shape). */
export interface PresetMode {
  theme: PresetTheme;
  effectIndex: number;
  colors: [string, string, string, string, string, string, string];
  alphas: [number, number, number, number, number, number, number];
  cardBg: string;
  /** 0 = off (raw shader), 1 = pixels. */
  dotMode: 0 | 1;
  pixelConfig: MosaicConfig;
  /** Drift angle (degrees). */
  direction: number;
  speed: number;
  intensity: number;
  scale: number;
  softness: number;
  distortion: number;
  /** Gradient sweep cell flicker amplitude 0..1. */
  flicker?: number;
  complexity: number;
  shape: number;
  blur: number;
  highlight: number;
  vignette: number;
  vigOpacity: number;
  shaderOpacity: number;
  /** Gradient sweep movement easing type (0..4). */
  sweepEase?: number;
  revealConfig: RevealConfig;
  /** Human-readable effect name for diagnostics. */
  effect: string;
}

export interface Preset {
  name: PresetName;
  modes: Record<PresetTheme, PresetMode>;
}

/* ============================================================ */
/* Internal engine-only types                                   */
/* ============================================================ */
/* The dot renderer is still wired through the engine in case we
 * ever ship a dot-mode preset again, but no bundled preset since
 * 0.2.0 sets `dotMode: 2`, so the dot fields are not part of the
 * public types. Engine code that needs full access (the unreachable
 * `preset.dotMode === 2` branches in reveal.ts / renderer.ts) casts
 * the public `PresetMode` up to `EnginePresetMode` at the boundary.
 *
 * Mark `@internal` so API Extractor / IDE autocomplete keep them
 * out of consumer-facing surfaces. */

/** @internal Full mosaic shape including disc-render fields. */
export interface EngineMosaicConfig extends MosaicConfig {
  /** Per-cell base opacity (dot mode only). */
  dotOpacity: number;
  /** Disc radius 0..1 (dot mode only). */
  dotSize: number;
  /** Disc edge softness (dot mode only). */
  dotSoftness: number;
}

/** @internal Full reveal shape including dot-mode timing. */
export interface EngineRevealConfig extends RevealConfig {
  /** Dot-mode reveal duration (sec). */
  dotDuration: number;
  /** Easing for the dot-mode reveal. */
  dotEasing: EasingKey;
}

/** @internal Full preset-mode shape used by the engine. */
export interface EnginePresetMode extends Omit<PresetMode, 'dotMode' | 'pixelConfig' | 'revealConfig'> {
  /** 0 = off (raw shader), 1 = pixels, 2 = dots. */
  dotMode: 0 | 1 | 2;
  pixelConfig: EngineMosaicConfig;
  /** Disc mosaic config (only consulted when `dotMode === 2`). */
  dotConfig: EngineMosaicConfig;
  revealConfig: EngineRevealConfig;
}

/** @internal */
export interface EnginePreset {
  name: PresetName;
  modes: Record<PresetTheme, EnginePresetMode>;
}

/* Runtime preset map. The underlying object literals (in
 * `pixels-mechanic.ts` / `pixels-organic.ts`) are typed as
 * `EnginePreset` so they can carry the dot-mode fields without TS
 * errors, but the public `PRESETS` is downcast to the narrower
 * `Preset` shape so consumers don't see them in autocomplete /
 * type-info. The cast is sound: every bundled preset uses
 * `dotMode: 1`, which is in both `0 | 1` and `0 | 1 | 2`. */
const _PRESETS_INTERNAL: Record<PresetName, EnginePreset> = {
  'pixels-organic': PIXELS_ORGANIC,
  'pixels-mechanic': PIXELS_MECHANIC,
  'sweep-gradient': SWEEP_GRADIENT
};

export const PRESETS = _PRESETS_INTERNAL as unknown as Record<PresetName, Preset>;

/** @internal Engine-only accessor that returns the full preset
 * shape (including the dot-mode fields hidden from the public
 * `PRESETS` map). Lets engine code keep its `preset.dotMode === 2`
 * branches intact without per-call casts. */
export function _getEnginePreset(name: PresetName): EnginePreset {
  return _PRESETS_INTERNAL[name];
}

/**
 * `#rrggbb` -> normalized [r, g, b] in 0..1.
 *
 * @deprecated Use {@link parseCssColor} instead. `hexToRgb` only handles
 * `#rgb` / `#rrggbb` input — passing anything else (e.g. `rgba(...)`,
 * a colour name, `hsl(...)`) produces `NaN` channels and breaks shader
 * uniforms. Kept exported for backward compatibility; internal callers
 * now route through `parseCssColor`.
 */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

/**
 * Cached singleton 2D context. We delegate non-hex parsing to the browser's
 * own CSS colour parser by writing into `ctx.fillStyle` and reading back the
 * canonical form. Allocated once per page, reused for every parse call.
 */
let _colorCtx: CanvasRenderingContext2D | null | undefined;
function getColorCtx(): CanvasRenderingContext2D | null {
  if (_colorCtx !== undefined) return _colorCtx;
  if (typeof document === 'undefined') {
    _colorCtx = null;
    return null;
  }
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  _colorCtx = c.getContext('2d');
  return _colorCtx;
}

/**
 * Parse any CSS colour string to normalised `[r, g, b]` in 0..1.
 *
 * Accepts every value the host browser understands: hex (`#rgb`,
 * `#rrggbb`, `#rrggbbaa`), `rgb()` / `rgba()`, `hsl()` / `hsla()`, named
 * colours (`white`, `crimson`, …), and modern syntaxes like
 * `color(display-p3 …)`.
 *
 * **Alpha is dropped.** The shader's `u_cardBg` uniform is opaque RGB —
 * the renderer has no source for what's behind the card, so it can't
 * composite a translucent background colour correctly. The wrapper's CSS
 * `background` keeps the original string with its alpha intact, so
 * visually the card surface stays translucent; the shader's contrast /
 * proximity logic just uses the underlying opaque tint. If precise shader
 * behaviour matters, pass the opaque colour you actually want the shader
 * to reason against.
 *
 * Hex strings take a synchronous fast path that works in SSR. Everything
 * else needs the browser; if no canvas is available (Node, broken DOM) or
 * the input is unparseable, falls back to `[0, 0, 0]` (black).
 */
export function parseCssColor(input: string): [number, number, number] {
  if (typeof input !== 'string' || input.length === 0) return [0, 0, 0];

  // Hex fast path — synchronous, SSR-friendly, no DOM dependency.
  if (input[0] === '#') {
    let h = input.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if ((h.length === 6 || h.length === 8) && /^[0-9a-fA-F]+$/.test(h)) {
      return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255
      ];
    }
  }

  // Anything else: delegate to the browser. `ctx.fillStyle = badInput`
  // silently rejects and keeps the previous value, so probe with TWO
  // distinct sentinels — invalid input will preserve whichever sentinel
  // was set, while valid input canonicalises to the same string both
  // times. A single sentinel would give a false rejection whenever the
  // user's input happened to canonicalise to that same sentinel (e.g.
  // `'magenta'` -> `'#ff00ff'`).
  const ctx = getColorCtx();
  if (!ctx) return [0, 0, 0];

  ctx.fillStyle = '#000000';
  ctx.fillStyle = input;
  const after1 = ctx.fillStyle as string;
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = input;
  const after2 = ctx.fillStyle as string;
  if (after1 !== after2) {
    // Input was rejected — readback equals whichever sentinel was set.
    return [0, 0, 0];
  }
  const out = after1;

  if (out[0] === '#') {
    return [
      parseInt(out.slice(1, 3), 16) / 255,
      parseInt(out.slice(3, 5), 16) / 255,
      parseInt(out.slice(5, 7), 16) / 255
    ];
  }
  const m = out.match(/^rgba?\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/);
  if (m) {
    const clamp = (n: number): number => Math.max(0, Math.min(255, n)) / 255;
    return [clamp(parseFloat(m[1])), clamp(parseFloat(m[2])), clamp(parseFloat(m[3]))];
  }
  return [0, 0, 0];
}

export { PIXELS_ORGANIC, PIXELS_MECHANIC, SWEEP_GRADIENT };

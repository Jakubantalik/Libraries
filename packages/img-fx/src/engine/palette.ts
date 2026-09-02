/**
 * Image-palette sampling for the regenerate flow.
 *
 * `samplePaletteFromCanvas` averages the source canvas down to a small grid,
 * sorts its pixels by luminance, and replaces each of the preset's 7 palette
 * slots with the image color at the same luminance RANK the slot has inside
 * the preset palette. The effect keeps its authored contrast structure (which
 * slots read dark / light) but wears the image's colors — same cells, same
 * animation, image-born pixelation.
 */
import { parseCssColor } from '../presets';

export interface SampledPalette {
  /** One CSS hex color per shader palette slot (7 entries). */
  colors: string[];
  /** Average image color — used as the card surface behind the effect. */
  cardBg: string;
}

const lum = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;
const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Downsample grid edge. 24x24 = 576 samples — plenty for a 7-color palette. */
const GRID = 24;

// One shared scratch canvas for all instances/calls (sampling is synchronous
// and single-threaded, so reuse is safe and avoids per-call allocations).
let scratch: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function getScratchCtx(): CanvasRenderingContext2D | null {
  if (scratchCtx) return scratchCtx;
  if (typeof document === 'undefined') return null;
  scratch = document.createElement('canvas');
  scratch.width = GRID;
  scratch.height = GRID;
  scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  return scratchCtx;
}

/**
 * Sample an image-derived recolor for the running effect from `src` (any
 * drawable canvas — typically the reveal overlay showing the current image).
 *
 * `presetColors` is the active preset mode's 7-slot palette; the returned
 * `colors` array maps image colors onto those slots by luminance rank.
 * Returns null when sampling isn't possible (SSR, empty canvas).
 */
export function samplePaletteFromCanvas(
  src: HTMLCanvasElement,
  presetColors: readonly string[]
): SampledPalette | null {
  if (src.width === 0 || src.height === 0) return null;
  const ctx = getScratchCtx();
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, GRID, GRID);
  ctx.drawImage(src, 0, 0, GRID, GRID);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, GRID, GRID).data;
  } catch {
    // Tainted canvas (cross-origin image without CORS) — can't sample.
    return null;
  }

  const px: Array<{ r: number; g: number; b: number; lum: number }> = [];
  let ar = 0;
  let ag = 0;
  let ab = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue; // skip fully-transparent corners (radius)
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    px.push({ r, g, b, lum: lum(r, g, b) });
    ar += r;
    ag += g;
    ab += b;
  }
  if (px.length === 0) return null;
  px.sort((a, b) => a.lum - b.lum);
  const cardBg = hex(ar / px.length, ag / px.length, ab / px.length);

  // Preset slots ranked by luminance -> image luminance quantile per rank.
  const ranked = presetColors
    .map((color, slot) => {
      const [r, g, b] = parseCssColor(color);
      return { slot, lum: lum(r, g, b) };
    })
    .sort((a, b) => a.lum - b.lum);
  const colors: string[] = new Array(ranked.length);
  for (let rank = 0; rank < ranked.length; rank++) {
    // Spread ranks across the image's luminance range (5th..95th percentile).
    const q = 0.05 + (0.9 * rank) / Math.max(1, ranked.length - 1);
    const p = px[Math.min(px.length - 1, Math.round(q * (px.length - 1)))];
    colors[ranked[rank].slot] = hex(p.r, p.g, p.b);
  }
  return { colors, cardBg };
}

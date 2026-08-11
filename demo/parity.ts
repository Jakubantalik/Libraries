// Parity harness. Renders every (state × size × theme) at FROZEN timestamps
// through the real library code, and reports either a pixel hash (cheap
// regression check) or a PNG data URL (for cross-platform diffing).
//
// Two jobs:
//  1. Refactor safety net — hash before a change, hash after, require equal.
//  2. Phase 3 port parity — the web-side capture that iOS/RN renders are
//     diffed against. Frozen `t` is what makes the comparison meaningful:
//     both sides evaluate the same instant, so any difference is real.
//
// Timestamps are deliberately spread across each mode's phase structure.
// Border-beam's port taught us a single freeze time can land in a lull and
// hide real differences (its `line` type rendered near-nothing outside a
// 32.5–67.5% window), so every capture samples four instants.

import { MODE_DRAWS } from '../src/engine/registry';
import { resolvePreset } from '../src/presets';
import type { OrbSize, OrbState } from '../src/types';

const STATES: OrbState[] = [
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping'
];
const SIZES: OrbSize[] = [64, 20];

// Chosen to straddle hold and transition phases. `shaping` has the longest
// structure (3 shapes × 2.3s = 6.9s before the speed multiplier), so the
// samples walk across it rather than clustering in one hold.
export const FREEZE_TIMES = [0.6, 1.7, 3.3, 5.1];

const DPR = 2;

function render(state: OrbState, size: OrbSize, dark: boolean, t: number): HTMLCanvasElement {
  const { mode, opts } = resolvePreset(state, size);
  const canvas = document.createElement('canvas');
  canvas.width = size * DPR;
  canvas.height = size * DPR;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, size, size);
  MODE_DRAWS[mode](ctx, size, t, dark, opts);
  return canvas;
}

/** FNV-1a over the raw RGBA bytes — order-sensitive, so any pixel shift trips it. */
function hashPixels(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface CaptureOptions {
  /** 'hash' for the regression check, 'png' for cross-platform diffing. */
  format?: 'hash' | 'png';
  states?: OrbState[];
  sizes?: OrbSize[];
  themes?: boolean[];
  times?: number[];
}

/** Key format: `<state>-<size>-<d|l>-<t>` — stable across runs and platforms. */
export function orbCapture(options: CaptureOptions = {}): Record<string, number | string> {
  const {
    format = 'hash',
    states = STATES,
    sizes = SIZES,
    themes = [true, false],
    times = FREEZE_TIMES
  } = options;

  const out: Record<string, number | string> = {};
  for (const state of states) {
    for (const size of sizes) {
      for (const dark of themes) {
        for (const t of times) {
          const canvas = render(state, size, dark, t);
          out[`${state}-${size}-${dark ? 'd' : 'l'}-${t}`] =
            format === 'png' ? canvas.toDataURL('image/png') : hashPixels(canvas);
        }
      }
    }
  }
  return out;
}

declare global {
  interface Window {
    orbCapture: typeof orbCapture;
    FREEZE_TIMES: number[];
  }
}

window.orbCapture = orbCapture;
window.FREEZE_TIMES = FREEZE_TIMES;

const el = document.getElementById('out');
if (el) {
  const hashes = orbCapture() as Record<string, number>;
  const keys = Object.keys(hashes);
  el.textContent = `${keys.length} captures ready (${STATES.length} states × ${SIZES.length} sizes × 2 themes × ${FREEZE_TIMES.length} times).\nCall window.orbCapture({format:'png'}) for images.\n\n${keys
    .slice(0, 8)
    .map((k) => `${k}  ${hashes[k]}`)
    .join('\n')}\n…`;
}

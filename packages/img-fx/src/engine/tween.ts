/**
 * Easing function table — keys match the `EasingKey` type in `presets/index.ts`
 * and the dropdown options in `image.html` (lines 2343-2351).
 */
import type { EasingKey } from '../presets';

export type EaseFn = (t: number) => number;

export const EASING_FNS: Record<EasingKey, EaseFn> = {
  linear: (t) => t,
  smoothstep: (t) => t * t * (3 - 2 * t),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutBack: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }
};

export function ease(key: EasingKey, t: number): number {
  const fn = EASING_FNS[key] ?? EASING_FNS.smoothstep;
  return fn(Math.max(0, Math.min(1, t)));
}

export type EaseFn = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  smoothstep: (t: number) => t * t * (3 - 2 * t),
} as const;

export interface Tween {
  from: number;
  to: number;
  dur: number;
  ease: EaseFn;
  startMs: number;
  val: number;
  done: boolean;
}

export function tween(from: number, to: number, dur: number, e: EaseFn = ease.linear): Tween {
  return { from, to, dur, ease: e, startMs: -1, val: from, done: false };
}

export function tweenStart(tw: Tween, nowMs: number): void {
  tw.startMs = nowMs;
  tw.val = tw.from;
  tw.done = false;
}

export function tweenTick(tw: Tween, nowMs: number): number {
  if (tw.done || tw.startMs < 0) return tw.val;
  const t = Math.min(1, (nowMs - tw.startMs) / tw.dur);
  tw.val = tw.from + (tw.to - tw.from) * tw.ease(t);
  if (t >= 1) tw.done = true;
  return tw.val;
}

/**
 * Per-frame animation values for the `line` family — CSS keyframe tables from
 * the spec, interpolated with the same per-segment timing functions the web
 * version uses (`linear` for travel/edge-fade, `ease-in-out` for
 * breathe/spike/spike2).
 */

/** Cosine ping-pong in [0,1] (same as pulseDriver, exported for worklets). */
export function pingPongWorklet(phase: number): number {
  'worklet';
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** CSS ease-in-out = cubic-bezier(0.42, 0, 0.58, 1); y for progress x. */
export function cssEaseInOut(x: number): number {
  'worklet';
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Solve the bezier's t for x via bisection (x1=0.42, x2=0.58).
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 12; i++) {
    const mt = 1 - t;
    const bx = 3 * mt * mt * t * 0.42 + 3 * mt * t * t * 0.58 + t * t * t;
    if (bx < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  const mt = 1 - t;
  // y1=0, y2=1.
  return 3 * mt * t * t + t * t * t;
}

/**
 * Samples a keyframe table [[percent, value], ...] at cycle progress p (0..1),
 * applying the timing function per segment (CSS keyframe semantics).
 */
export function sampleKeyframes(
  table: number[][],
  p: number,
  easeInOut: boolean
): number {
  'worklet';
  const pct = p * 100;
  if (pct <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [p0, v0] = table[i - 1];
    const [p1, v1] = table[i];
    if (pct <= p1) {
      const f = p1 > p0 ? (pct - p0) / (p1 - p0) : 1;
      const eased = easeInOut ? cssEaseInOut(f) : f;
      return v0 + (v1 - v0) * eased;
    }
  }
  return table[table.length - 1][1];
}

export interface LineFrameValues {
  x: number;      // beam x, fraction of width
  w: number;      // width multiplier
  h: number;      // height multiplier (breathe)
  spike: number;
  spike2: number;
  edge: number;   // edge fade opacity 0..1
}

export interface LineKeyframeTables {
  travel: { x: number[][]; w: number[][] };
  edgeFade: number[][];
  breathe: number[][];
  spike: number[][];
  spike2: number[][];
  durationScale: { travel: number; edgeFade: number; breathe: number; spike: number; spike2: number };
}

/** Samples every line animation at absolute time t (seconds). */
export function lineFrameValues(
  tables: LineKeyframeTables,
  t: number,
  duration: number
): LineFrameValues {
  'worklet';
  const cyc = (period: number) => (t / period) % 1;
  return {
    x: sampleKeyframes(tables.travel.x, cyc(duration * tables.durationScale.travel), false),
    w: sampleKeyframes(tables.travel.w, cyc(duration * tables.durationScale.travel), false),
    h: sampleKeyframes(tables.breathe, cyc(duration * tables.durationScale.breathe), true),
    spike: sampleKeyframes(tables.spike, cyc(duration * tables.durationScale.spike), true),
    spike2: sampleKeyframes(tables.spike2, cyc(duration * tables.durationScale.spike2), true),
    edge: sampleKeyframes(tables.edgeFade, cyc(duration * tables.durationScale.edgeFade), false),
  };
}

/** Resolves a bloom-gradient size multiplier variable to its current value. */
export function multValue(mult: string, v: LineFrameValues): number {
  'worklet';
  if (mult === 'spike') return v.spike;
  if (mult === 'spike2') return v.spike2;
  if (mult === 'inv-spike') return 2 - v.spike;
  if (mult === 'inv-spike2') return 2 - v.spike2;
  if (mult === 'h') return v.h;
  if (mult === 'w') return v.w;
  return 1;
}

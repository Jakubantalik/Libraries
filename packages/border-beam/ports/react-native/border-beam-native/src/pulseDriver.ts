import type { Oscillator } from './spec';

/**
 * Port of the web library's `pulseDriver.ts` oscillator math for the pulse
 * family. Values are sampled per-frame in a Reanimated worklet on the UI
 * thread and fed to the pulse shaders as uniforms.
 */

/** Cosine ease-in-out factor in [0, 1]: 0 at phase 0/1, 1 at phase 0.5. */
export function pingPong(phase: number): number {
  'worklet';
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/**
 * Samples one oscillator at absolute time `t` seconds. `durationScale` is
 * `duration / 2.3` — spec oscillators are emitted at the default 2.3 s pulse
 * duration and their periods/delays scale linearly.
 */
export function oscillatorValue(osc: Oscillator, t: number, durationScale: number): number {
  'worklet';
  const period = osc.period * durationScale;
  const delay = osc.delay * durationScale;
  const phase = (t - delay) / period;
  return osc.a + (osc.b - osc.a) * pingPong(phase);
}

/** Continuous full-circle hue rotation in degrees (pulse family). */
export function pulseHueDegrees(t: number, period: number): number {
  'worklet';
  return ((t / period) % 1) * 360;
}

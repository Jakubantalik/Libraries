/**
 * CSS filter chain `hue-rotate(θ) brightness(b) saturate(s)` as a 3x3 matrix,
 * using the W3C feColorMatrix math browsers use (NOT a true HSL rotation).
 * Identical to BorderBeamKit's BeamColorMatrix — keep both in sync.
 */

export function hueRotateMatrix(degrees: number): number[] {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

export function saturateMatrix(s: number): number[] {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
}

export function multiply3x3(a: number[], b: number[]): number[] {
  const out = new Array<number>(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += a[row * 3 + k] * b[k * 3 + col];
      }
      out[row * 3 + col] = sum;
    }
  }
  return out;
}

/** Composed matrix for `hue-rotate(hue) brightness(b) saturate(s)`. */
export function composedFilterMatrix(hueDegrees: number, brightness: number, saturation: number): number[] {
  'worklet';
  // Inlined (rather than calling the helpers) so the whole computation can run
  // as a Reanimated worklet on the UI thread.
  const rad = (hueDegrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const b = brightness;
  const hue = [
    (0.213 + c * 0.787 - s * 0.213) * b, (0.715 - c * 0.715 - s * 0.715) * b, (0.072 - c * 0.072 + s * 0.928) * b,
    (0.213 - c * 0.213 + s * 0.143) * b, (0.715 + c * 0.285 + s * 0.140) * b, (0.072 - c * 0.072 - s * 0.283) * b,
    (0.213 - c * 0.213 - s * 0.787) * b, (0.715 - c * 0.715 + s * 0.715) * b, (0.072 + c * 0.928 + s * 0.072) * b,
  ];
  const sat = saturation;
  const sm = [
    0.213 + 0.787 * sat, 0.715 - 0.715 * sat, 0.072 - 0.072 * sat,
    0.213 - 0.213 * sat, 0.715 + 0.285 * sat, 0.072 - 0.072 * sat,
    0.213 - 0.213 * sat, 0.715 - 0.715 * sat, 0.072 + 0.928 * sat,
  ];
  const out = new Array<number>(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += sm[row * 3 + k] * hue[k * 3 + col];
      }
      out[row * 3 + col] = sum;
    }
  }
  return out;
}

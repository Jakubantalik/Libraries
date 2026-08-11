/**
 * Phase 0 of the native ports (see PORT_PLAN.md): export every hand-tuned value
 * from the web library into a platform-neutral spec consumed by the iOS
 * (BorderBeamKit) and React Native (border-beam-native) code generators.
 *
 * Data tables are imported straight from src/styles.ts so they can never drift
 * from the web implementation. Structural constants that live inside CSS
 * template literals in styles.ts (conic mask stops, keyframe tables, blur
 * radii, mask edge fades) are transcribed here once, with a comment pointing at
 * the source lines; if you change them in styles.ts, change them here too.
 *
 * Usage: npm run spec  (writes spec/beam-spec.json)
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sizePresets,
  sizeThemePresets,
  colorPalettes,
  smallColorPalettes,
  lineColorPalettes,
  lineInnerGradientData,
  lineBloomColors,
  PULSE_RING_MAP,
  PULSE_INNER_SIZES,
  PULSE_INNER_BLOOM,
  PULSE_OUTER_CORE,
  PULSE_OUTER_BLOOM,
  pulseParams,
  pulseOscillatorDefs,
} from '../src/styles';
import type { BorderBeamColorVariant, BorderBeamSize } from '../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** Strip the per-instance `-${id}` suffix pattern from an oscillator prop name. */
function cleanProp(prop: string): string {
  return prop.replace(/^--/, '').replace(/-$/, '');
}

const DEFAULT_PULSE_DURATION = 2.3;

/** Oscillator tables per pulse size × theme at the default duration.
 *  Periods/delays scale linearly with `duration / 2.3` (see pulseParams durScale). */
function pulseSection(size: 'pulse-inner' | 'pulse-outside') {
  const out: Record<string, unknown> = {};
  for (const theme of ['dark', 'light'] as const) {
    const p = pulseParams(size as BorderBeamSize, theme, DEFAULT_PULSE_DURATION);
    out[theme] = {
      // Base breathing parameters (sp=size swing, dr=drift px, op=quadrant
      // opacity swing, gh=global height swing, bs/ss/ghs=period bases seconds).
      params: p,
      oscillators: pulseOscillatorDefs('', p).map(o => ({
        prop: cleanProp(o.prop),
        a: +o.a.toFixed(4),
        b: +o.b.toFixed(4),
        period: +o.period.toFixed(4),
        delay: +o.delay.toFixed(4),
        unit: o.unit,
      })),
      // Frozen bloom layers use the time-average of the [1-op, 1] breathing range.
      frozenBloomAlpha: +(1 - p.op * 0.5).toFixed(3),
    };
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Structural constants transcribed from the CSS generators in src/styles.ts.
 * Conic stops are [position%, alpha] pairs on white (dark theme) or black
 * (light theme). All angles start from the animated beam angle.
 * ──────────────────────────────────────────────────────────────────────────*/

// styles.ts generateBorderVariantCSS / generateSmallVariantCSS `whiteGradient`
const rotateWhiteGradientStops = {
  dark: [[0, 0], [54, 0], [57, 0.1], [60, 0.3], [63, 0.6], [66, 0.75], [69, 0.6], [72, 0.3], [75, 0.1], [78, 0], [100, 0]],
  light: [[0, 0], [54, 0], [57, 0.08], [60, 0.2], [63, 0.4], [66, 0.55], [69, 0.4], [72, 0.2], [75, 0.08], [78, 0], [100, 0]],
};

// styles.ts `bloomGradient` (same for md + sm)
const rotateBloomGradientStops = {
  dark: [[0, 0], [58, 0], [62, 0.03], [65, 0.08], [67, 0.2], [69, 0.45], [70, 0.85], [70.5, 0.85], [71.5, 0.45], [73, 0.2], [75, 0.08], [78, 0.03], [82, 0]],
  light: [[0, 0], [58, 0], [62, 0.02], [65, 0.08], [67, 0.2], [69, 0.4], [70, 0.6], [70.5, 0.6], [71.5, 0.4], [73, 0.2], [75, 0.08], [78, 0.02], [82, 0]],
};

// styles.ts beam ::after / ::before conic mask (md), alpha-on-white stops
const rotateBeamMaskStops = [[0, 0], [30, 0], [36, 0.1], [44, 0.35], [52, 1], [80, 1], [86, 0.35], [92, 0.1], [95, 0], [100, 0]];

// styles.ts `smallMask` — wider window for the sm variant ::before
const smallMaskStops = [[0, 0], [22, 0], [28, 0.12], [36, 0.4], [46, 1], [82, 1], [88, 0.4], [94, 0.12], [97, 0], [100, 0]];

// styles.ts generateLineVariantCSS keyframe tables (percent → value)
const lineKeyframes = {
  travel: { x: [[0, 0.06], [10, 0.15], [20, 0.25], [30, 0.35], [40, 0.44], [50, 0.5], [60, 0.56], [70, 0.65], [80, 0.75], [90, 0.85], [100, 0.94]],
            w: [[0, 0.5], [10, 0.8], [20, 1.1], [30, 1.3], [40, 1.45], [50, 1.5], [60, 1.45], [70, 1.3], [80, 1.1], [90, 0.8], [100, 0.5]] },
  edgeFade: [[0, 0], [12.5, 0], [32.5, 1], [67.5, 1], [87.5, 0], [100, 0]],
  breathe: [[0, 0.8], [25, 1.25], [55, 0.85], [80, 1.3], [100, 0.8]],
  spike: [[0, 0.8], [25, 1.3], [50, 0.9], [75, 1.4], [100, 0.8]],
  spike2: [[0, 1.2], [25, 0.7], [50, 1.4], [75, 0.8], [100, 1.2]],
  // Multipliers on the base duration for each keyframe animation.
  durationScale: { travel: 1, edgeFade: 1, breathe: 1.3, spike: 1.33, spike2: 1.7 },
  easing: { travel: 'linear', edgeFade: 'linear', breathe: 'easeInOut', spike: 'easeInOut', spike2: 'easeInOut' },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Line bloom gradients as structured data.
 *
 * Replicates styles.ts `getLineBloomGradients` (incl. the mono attenuation
 * rules that live in code there), but emits records instead of CSS strings so
 * the native ports can build the blobs per-frame.
 *
 * Each record: ellipse at (xPct% of width | the traveling beam x) + yOffPx
 * from the bottom edge, radii = base × multiplier variable, alpha stops
 * (piecewise linear, pos 0..1 of the ellipse extent).
 * Multiplier vars: 'spike' | 'spike2' | 'inv-spike' (= 2-spike) |
 * 'inv-spike2' | 'h' | 'w' | 'one'.
 * ──────────────────────────────────────────────────────────────────────────*/

interface RGBAv { r: number; g: number; b: number; a: number }

function parseRGBA(css: string): RGBAv {
  const m = css.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!m) throw new Error(`unparsable color: ${css}`);
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
}

/** styles.ts `withAlpha`: replace the alpha outright. */
function withAlphaV(css: string, alpha: number): RGBAv {
  return { ...parseRGBA(css), a: alpha };
}

/** styles.ts `attenuateSpike`: rgba scales alpha by factor; rgb sets alpha=factor. */
function attenuateV(css: string, factor: number): RGBAv {
  const c = parseRGBA(css);
  const hadAlpha = /^rgba/.test(css.trim());
  return { ...c, a: +(hadAlpha ? c.a * factor : factor).toFixed(4) };
}

interface BloomStop { r: number; g: number; b: number; a: number; pos: number }
interface BloomGradient {
  /** Fixed x as % of width, or null when the gradient travels with beam x. */
  xPct: number | null;
  yOffPx: number;
  w: { base: number; mult: string };
  h: { base: number; mult: string };
  stops: BloomStop[];
}

function stop(c: RGBAv, pos: number): BloomStop {
  return { r: c.r, g: c.g, b: c.b, a: +c.a.toFixed(4), pos };
}

function lineBloomStructured(variant: BorderBeamColorVariant, isDark: boolean): BloomGradient[] {
  const spikeColors = isDark ? colorPalettes[variant].spike : colorPalettes[variant].spikeLt;
  const bloomData = lineBloomColors[variant][isDark ? 'dark' : 'light'];
  const isMono = variant === 'mono';

  const att = isMono ? 0.14 : 1;
  const sc1 = isMono ? attenuateV(spikeColors.primary, 0.14) : parseRGBA(spikeColors.primary);
  const sc1_mid = isMono ? attenuateV(spikeColors.primary, 0.09) : parseRGBA(spikeColors.primary);
  const sc2 = isMono ? attenuateV(spikeColors.secondary, 0.12) : parseRGBA(spikeColors.secondary);
  const sc2_mid = isMono
    ? withAlphaV(spikeColors.secondary, 0.06)
    : withAlphaV(spikeColors.secondary, 0.49);

  const spikes = bloomData.spikes.map(s =>
    isMono
      ? { c1: attenuateV(s.color1, att), c2: attenuateV(s.color2, att * 0.7) }
      : { c1: parseRGBA(s.color1), c2: parseRGBA(s.color2) }
  );

  const thinW1 = isMono ? 12 : 0.8;
  const thinW2 = isMono ? 14 : 2;
  const thinW3 = isMono ? 12 : 1.2;
  const thinW4 = isMono ? 10 : 0.6;
  const thinH1 = isMono ? 42 : 92;
  const thinH2 = isMono ? 38 : 72;
  const thinH3 = isMono ? 40 : 85;
  const thinH4 = isMono ? 32 : 60;
  const thinLW = isMono ? 12 : 1;

  const white = (a: number): RGBAv => ({ r: 255, g: 255, b: 255, a });
  const black = (a: number): RGBAv => ({ r: 0, g: 0, b: 0, a });
  const fadeOf = (c: RGBAv): RGBAv => ({ ...c, a: 0 });

  if (isDark) {
    const glowDotC = white(isMono ? 0.5 : 1);
    const glowDot20 = white(isMono ? 0.45 : 0.9);
    const glowDot50 = white(isMono ? 0.25 : 0.5);
    const glowAmbC = white(isMono ? 0.15 : 0.3);
    const glowAmb25 = white(isMono ? 0.06 : 0.12);
    const glowAmb55 = white(isMono ? 0.015 : 0.03);
    return [
      { xPct: 8, yOffPx: -2, w: { base: thinW1, mult: 'spike' }, h: { base: thinH1, mult: 'h' },
        stops: [stop(sc1, 0), stop(sc1_mid, 0.30), stop(fadeOf(sc1_mid), 0.88)] },
      { xPct: 22, yOffPx: -4, w: { base: 10, mult: 'spike2' }, h: { base: 35, mult: 'h' },
        stops: [stop(sc2, 0), stop(sc2_mid, 0.50), stop(fadeOf(sc2_mid), 0.95)] },
      { xPct: 36, yOffPx: -3, w: { base: thinW2, mult: 'inv-spike' }, h: { base: thinH2, mult: 'h' },
        stops: [stop(spikes[0].c1, 0), stop(spikes[0].c2, 0.40), stop(fadeOf(spikes[0].c2), 0.90)] },
      { xPct: 50, yOffPx: -2, w: { base: 14, mult: 'spike2' }, h: { base: 28, mult: 'h' },
        stops: [stop(spikes[1].c1, 0), stop(spikes[1].c2, 0.55), stop(fadeOf(spikes[1].c2), 0.96)] },
      { xPct: 64, yOffPx: -4, w: { base: thinW3, mult: 'inv-spike2' }, h: { base: thinH3, mult: 'h' },
        stops: [stop(spikes[2].c1, 0), stop(spikes[2].c2, 0.35), stop(fadeOf(spikes[2].c2), 0.89)] },
      { xPct: 78, yOffPx: -2, w: { base: 7, mult: 'spike' }, h: { base: 45, mult: 'h' },
        stops: [stop(spikes[3].c1, 0), stop(spikes[3].c2, 0.48), stop(fadeOf(spikes[3].c2), 0.94)] },
      { xPct: 92, yOffPx: -3, w: { base: thinW4, mult: 'inv-spike' }, h: { base: thinH4, mult: 'h' },
        stops: [stop(spikes[4].c1, 0), stop(spikes[4].c2, 0.42), stop(fadeOf(spikes[4].c2), 0.91)] },
      { xPct: null, yOffPx: 1, w: { base: 21, mult: 'spike' }, h: { base: 15, mult: 'spike2' },
        stops: [stop(glowDotC, 0), stop(glowDot20, 0.20), stop(glowDot50, 0.50), stop(white(0), 1)] },
      { xPct: null, yOffPx: 0, w: { base: 42, mult: 'w' }, h: { base: 40, mult: 'h' },
        stops: [stop(glowAmbC, 0), stop(glowAmb25, 0.25), stop(glowAmb55, 0.55), stop(white(0), 0.80)] },
    ];
  }

  const sc1_lt = isMono ? attenuateV(spikeColors.primary, 0.11) : withAlphaV(spikeColors.primary, 0.85);
  const sc2_lt = isMono ? attenuateV(spikeColors.secondary, 0.09) : withAlphaV(spikeColors.secondary, 0.7);
  return [
    { xPct: 8, yOffPx: -2, w: { base: thinW1, mult: 'spike' }, h: { base: thinH1, mult: 'h' },
      stops: [stop(sc1, 0), stop(sc1_lt, 0.30), stop(fadeOf(sc1_lt), 0.88)] },
    { xPct: 22, yOffPx: -4, w: { base: 10, mult: 'spike2' }, h: { base: 35, mult: 'h' },
      stops: [stop(sc2, 0), stop(sc2_lt, 0.50), stop(fadeOf(sc2_lt), 0.95)] },
    { xPct: 36, yOffPx: -3, w: { base: thinW2, mult: 'inv-spike' }, h: { base: thinH2, mult: 'h' },
      stops: [stop(spikes[0].c1, 0), stop(spikes[0].c2, 0.40), stop(fadeOf(spikes[0].c2), 0.90)] },
    { xPct: 50, yOffPx: -2, w: { base: 14, mult: 'spike2' }, h: { base: 28, mult: 'h' },
      stops: [stop(spikes[1].c1, 0), stop(spikes[1].c2, 0.55), stop(fadeOf(spikes[1].c2), 0.96)] },
    { xPct: 64, yOffPx: -4, w: { base: thinW3, mult: 'inv-spike2' }, h: { base: thinH3, mult: 'h' },
      stops: [stop(spikes[2].c1, 0), stop(spikes[2].c2, 0.35), stop(fadeOf(spikes[2].c2), 0.89)] },
    { xPct: 78, yOffPx: -2, w: { base: 7, mult: 'spike' }, h: { base: 45, mult: 'h' },
      stops: [stop(spikes[3].c1, 0), stop(spikes[3].c2, 0.48), stop(fadeOf(spikes[3].c2), 0.94)] },
    { xPct: 92, yOffPx: -3, w: { base: thinLW, mult: 'inv-spike' }, h: { base: thinH4, mult: 'h' },
      stops: [stop(spikes[4].c1, 0), stop(spikes[4].c2, 0.42), stop(fadeOf(spikes[4].c2), 0.91)] },
    { xPct: null, yOffPx: 0, w: { base: 50, mult: 'w' }, h: { base: 32, mult: 'h' },
      stops: [stop(black(0.5), 0), stop(black(0.18), 0.30), stop(black(0.03), 0.60), stop(black(0), 0.85)] },
  ];
}

function lineBloomAllVariants() {
  const out: Record<string, { dark: BloomGradient[]; light: BloomGradient[] }> = {};
  for (const v of ['colorful', 'mono', 'ocean', 'sunset'] as BorderBeamColorVariant[]) {
    out[v] = { dark: lineBloomStructured(v, true), light: lineBloomStructured(v, false) };
  }
  return out;
}

const spec = {
  specVersion: '1.0.0',
  sourceLibrary: { name: pkg.name, version: pkg.version },
  generated: new Date().toISOString().slice(0, 10),
  reference: 'Web demo at https://beam.jakubantalik.com is the visual ground truth.',

  enums: {
    sizes: ['sm', 'md', 'line', 'pulse-outside', 'pulse-inner'],
    colorVariants: ['colorful', 'mono', 'ocean', 'sunset'],
    themes: ['dark', 'light'],
  },

  defaults: {
    size: 'md',
    colorVariant: 'colorful',
    theme: 'dark',
    // Rotation/travel duration by family (BorderBeam.tsx finalDuration).
    duration: { line: 3.1, pulse: 2.3, rotate: 1.96 },
    hueRange: 30,
    lineHueRangeCap: 13,
    strength: 1,
    brightnessFallback: 1.3,
    fadeInSeconds: 0.6,
    fadeOutSeconds: 0.5,
    fadeEasing: 'ease',
    // Rotate family hue-shift: ±hueRange over a 12 s ease-in-out ping-pong.
    rotateHueShiftPeriod: 12,
    // Line bloom layer swings ±(hueRange+10) over 8 s.
    lineBloomHueShiftPeriod: 8,
    lineBloomHueRangeBonus: 10,
    // Mono variant halves stroke/inner/bloom opacity (all families).
    monoOpacityMultiplier: 0.5,
    // 'mono' forces staticColors: true.
    monoForcesStaticColors: true,
    // Pulse driver frame cap (pulseDriver.ts).
    pulseDriverFps: 30,
  },

  sizePresets,
  sizeThemePresets,

  palettes: {
    // 9-blob perimeter gradients for md + pulse ring; spike colors for line bloom.
    border: colorPalettes,
    // Compact gradients for the sm (button) variant, incl. dedicated inner set.
    small: smallColorPalettes,
    // Traveling line gradients (per theme), sizes scale with --beam-w/h.
    line: lineColorPalettes,
    lineInner: lineInnerGradientData,
    lineBloom: lineBloomColors,
  },

  rotate: {
    whiteGradientStops: rotateWhiteGradientStops,
    bloomGradientStops: rotateBloomGradientStops,
    beamMaskStops: rotateBeamMaskStops,
    smallMaskStops,
    // md ::before inner gradients derive from palette.border: size × 0.9,
    // alpha 0.45 (0.225 for mono). sm uses palettes.small.inner directly.
    innerGradientDerivation: { sizeScale: 0.9, alpha: 0.45, monoAlpha: 0.225 },
    // Inner layer edge mask: solid at edges, transparent 28px in (both axes).
    innerEdgeMaskPx: 28,
    // Inner layer inset shadow: `inset 0 0 <blur> 1px <themeColors.innerShadow>`.
    innerShadowBlur: { md: 9, sm: 5 },
    bloomBlurPx: 8,
    spin: { from: 0, to: 360, easing: 'linear' },
  },

  line: {
    keyframes: lineKeyframes,
    // ::after / ::before mask ellipse (px × travel scale vars) anchored at bottom.
    beamMaskEllipse: { w: 78, h: 60, softStop: [45, 0.5] },
    bloomMaskEllipse: { w: 84, h: 110, softStop: [35, 0.5] },
    whiteHighlight: {
      dark: { w: 24, h: 28, yOffset: 2, stops: [[0, 0.38], [30, 0.12], [65, 0]] },
      light: { w: 35, h: 28, yOffset: 2, stops: [[0, 0.6], [35, 0.25], [70, 0]], onBlack: true },
    },
    // Structured bloom gradients per variant × theme (spikes + traveling dot +
    // ambient), with mono attenuation already applied — see lineBloomStructured.
    bloomGradients: lineBloomAllVariants(),
    // Mono bloom gets a base blur even with static colors (styles.ts).
    monoBloomExtraBlurPx: 6,
    bloomBlurPx: 8,
  },

  pulse: {
    // Which size-region (1-3) and opacity quadrant each of the 9 border palette
    // gradients belongs to (shared by ring + inner layers).
    ringMap: PULSE_RING_MAP,
    innerSizes: PULSE_INNER_SIZES,
    innerBloom: PULSE_INNER_BLOOM,
    outerCore: PULSE_OUTER_CORE,
    outerBloom: PULSE_OUTER_BLOOM,
    // Corner accents on pulse-inner ::before (white on dark / black on light).
    innerCornerAccent: { sizePx: 60, alpha: { dark: 0.18, light: 0.08 }, fadeStop: 70 },
    inner: pulseSection('pulse-inner'),
    outside: pulseSection('pulse-outside'),
    // Continuous full-circle hue rotation period seconds (staticColors → none).
    huePeriod: { 'pulse-inner': 16, 'pulse-outside': 14 },
    outsideConstants: {
      glowScale: { x: 0.95, y: 0.9 },
      glowBlurPx: { dark: 3, light: 6 },
      bloomBlurPx: { dark: 22.5, light: 15 },
      coreInsetPx: 10,
      bloomInsetPx: 30,
      // Glow geometry is authored for a 350×140 reference element and scaled
      // per-axis to the measured element, clamped to [0.35, 4].
      referenceSize: { w: 350, h: 140 },
      scaleClamp: { min: 0.35, max: 4 },
      hairline: { rgb: { dark: [70, 70, 70], light: [0, 0, 0] } },
    },
    innerBloomBlurPx: 8,
    // Oscillator curve: value = a + (b-a) * (1 - cos(2π·(t-delay)/period)) / 2
    oscillatorCurve: 'cosinePingPong',
  },

  filters: {
    // CSS filter order everywhere: hue-rotate → brightness → saturate (blur first
    // where present). hue-rotate uses the CSS/SVG linear matrix, NOT true HSL
    // rotation — ports must use the same matrix for color parity:
    // https://www.w3.org/TR/filter-effects-1/#feColorMatrixElement (type="hueRotate")
    order: ['blur?', 'hue-rotate', 'brightness', 'saturate'],
    hueRotateModel: 'css-fecolormatrix-huerotate-linearRGB-off',
  },
};

const outDir = join(root, 'spec');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'beam-spec.json');
writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n');
console.log(`Wrote ${outPath}`);

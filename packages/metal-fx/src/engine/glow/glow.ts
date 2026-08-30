/**
 * SVG glow overlay — a luminance-driven halo that tracks the brightest point
 * on the shader's perimeter.
 *
 * How it works:
 *   1. Samples luminance at N points around the component's perimeter.
 *   2. A state machine tracks which perimeter point is brightest, with dwell
 *      timers and fade-in/out transitions when relocating to a new hotspot.
 *   3. Static SVG path elements (blurred strokes at multiple radii) are
 *      positioned at the current hotspot via CSS transform.
 *   4. The stroke color is tinted to match the shader's color at that point.
 */
import { HALO_SEGMENTS, EXTRA_SEGMENTS } from '../perfConfig';
import type { MetalFxInstance, ShaderRGB } from '../renderer/core';
import { sampleShaderLumAt, sampleShaderRGBAt, sampleShaderRGBChromatic } from '../renderer/sampling';
import { type Tween, ease, tween, tweenStart, tweenTick } from '../tween';
import { hsvToRgb, rgbToHsv } from '../color';
import {
  type GlowOptions,
  type PerimSample,
  type Pt,
  PERIM_SAMPLES,
  buildPerimTable,
  buildStaticBlobPath,
  buildSvgMarkup,
  rrPerim,
  sampleAtArc,
  shapePerim,
  smoothstep,
  tangentAngleAtArc,
} from './geometry';

// ─── Constants ────────────────────────────────────────────────────────────

const FADE_RATE = 0.00875;
const LO = 0.08, HI = 0.32;
const RELOCATE_DELTA = 0.05;
const MIN_DWELL_MS = 3000;
const PEAK_OP = 0.85, BASE_OP = 0.34;
const RELOC_FADE_MS = 1500;
const WANDER_RANGE = 15, WANDER_LERP = 0.0075, WANDER_RETARGET = 120;
const INSET = 1.5;
const HALO_HALFLEN = 7.8;
const EXTRA_HALFLEN = 9.13952, EXTRA_OUTWARD = 1.0;
const EXTRA_SCALE = 1 / 3;
const HALO_OP_MUL = 0.8;
const EXTRA_INTENSITY = 3.51;
const TINT_HOLD_MS = 2000, TINT_FADE_MS = 400;
const LT_SAT_BOOST = 2.625, LT_VAL_MULT = 1.008, LT_MIN_VAL = 0.31;
const REF_W = 140, REF_H = 40, REF_R = 20;

// ─── Types ────────────────────────────────────────────────────────────────

export type { GlowOptions } from './geometry';

export interface GlowHandles {
  svg: SVGSVGElement;
  haloGroup: SVGGElement;
  haloInner: SVGGElement;
  extraGroup: SVGGElement;
  extraInner: SVGGElement;
  fadeCircle: SVGCircleElement;
  width: number; height: number; cornerRadius: number; kind: 'pill' | 'circle';
  /** Master scale used at injection time so per-frame position math
   *  (INSET / EXTRA_OUTWARD) stays consistent with the strokes already
   *  baked into the SVG markup. */
  scale: number;
  perim: PerimSample[];
  currentIdx: number; appearedAt: number; glowOpacity: number;
  relocTween: Tween | null; relocNextIdx: number;
  wanderS: number; wanderTargetS: number; wanderFrames: number;
  tintFrom: ShaderRGB; tintTarget: ShaderRGB; tintTween: Tween | null; tintHoldUntil: number;
  lastHaloStroke: string; lastExtraStroke: string;
}

let glowIdSeq = 0;
const _pt: Pt = { x: 0, y: 0 };

// ─── Public API ───────────────────────────────────────────────────────────

export function injectGlow(container: HTMLElement, opts: GlowOptions): GlowHandles {
  const p = `mfxg_${++glowIdSeq}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'metal-fx-glow-svg');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('viewBox', `0 0 ${opts.width} ${opts.height}`);
  svg.innerHTML = buildSvgMarkup(opts, p);
  container.appendChild(svg);

  const q = (id: string) => svg.querySelector(`#${p}_${id}`) as SVGElement;
  const haloGroup = q('h') as SVGGElement;
  const haloInner = q('hI') as SVGGElement;
  const extraGroup = q('e') as SVGGElement;
  const extraInner = q('eI') as SVGGElement;
  const fadeCircle = q('fc') as SVGCircleElement;

  const ratio = shapePerim(opts.width, opts.height, opts.cornerRadius, opts.kind) / rrPerim(REF_W, REF_H, REF_R);
  const haloHL = Math.max(1, HALO_HALFLEN * ratio);
  const extraHL = Math.max(0.6, EXTRA_HALFLEN * EXTRA_SCALE * ratio);
  const haloD = buildStaticBlobPath(haloHL, HALO_SEGMENTS);
  const extraD = buildStaticBlobPath(extraHL, EXTRA_SEGMENTS);

  const haloPaths = [q('pXl'), q('pLg'), q('pMd'), q('pSm')] as SVGPathElement[];
  const extraPaths = [q('eO'), q('eC')] as SVGPathElement[];
  for (const path of haloPaths) path.setAttribute('d', haloD);
  for (const path of extraPaths) path.setAttribute('d', extraD);

  haloInner.style.transformOrigin = '0 0';
  extraInner.style.transformOrigin = '0 0';
  haloInner.style.willChange = 'transform';
  extraInner.style.willChange = 'transform';
  haloInner.style.transition = 'transform 100ms linear';
  extraInner.style.transition = 'transform 100ms linear';

  haloGroup.style.willChange = 'opacity';
  extraGroup.style.willChange = 'opacity';
  haloGroup.style.transition = 'opacity 100ms linear';
  extraGroup.style.transition = 'opacity 100ms linear';

  fadeCircle.style.willChange = 'transform';

  return {
    svg, haloGroup, haloInner, extraGroup, extraInner, fadeCircle,
    width: opts.width, height: opts.height, cornerRadius: opts.cornerRadius, kind: opts.kind,
    scale: opts.scale ?? 1,
    perim: buildPerimTable(opts),
    currentIdx: 0, appearedAt: 0, glowOpacity: 0,
    relocTween: null, relocNextIdx: -1,
    wanderS: 0, wanderTargetS: 0, wanderFrames: 0,
    tintFrom: { r: 255, g: 255, b: 255 }, tintTarget: { r: 255, g: 255, b: 255 }, tintTween: null, tintHoldUntil: 0,
    lastHaloStroke: '', lastExtraStroke: '',
  };
}

// ─── Per-frame update ─────────────────────────────────────────────────────

export function updateGlow(h: GlowHandles, inst: MetalFxInstance, nowMs: number, strengthMul: number, theme: 'dark' | 'light' = 'dark'): void {
  const { width: W, height: H, cornerRadius: R, perim } = h;
  if (perim.length === 0) return;

  const halfWin = 2;

  let maxLum = -1, maxIdx = h.currentIdx, curLum = 0;
  for (let i = 0; i < perim.length; i++) {
    const pt = perim[i];
    const lum = sampleShaderLumAt(inst, pt.x, pt.y, halfWin);
    if (lum > maxLum) { maxLum = lum; maxIdx = i; }
    if (i === h.currentIdx) curLum = lum;
  }

  const dwellActive = h.appearedAt > 0 && nowMs - h.appearedAt < MIN_DWELL_MS;
  const targetOp = BASE_OP + (PEAK_OP - BASE_OP) * smoothstep(LO, HI, curLum);
  const rivalDominates = !dwellActive && maxLum - curLum > RELOCATE_DELTA;

  if (!h.relocTween || h.relocTween.done) {
    if (h.appearedAt === 0) {
      h.currentIdx = maxIdx; h.appearedAt = nowMs;
      h.wanderS = 0; h.wanderTargetS = 0; h.wanderFrames = 0;
      h.relocTween = tween(0, targetOp, RELOC_FADE_MS, ease.smoothstep);
      tweenStart(h.relocTween, nowMs);
    } else if (h.relocTween?.done && h.relocTween.to === 0) {
      h.currentIdx = h.relocNextIdx; h.appearedAt = nowMs;
      h.wanderS = 0; h.wanderTargetS = 0; h.wanderFrames = 0;
      const np = perim[h.currentIdx];
      const nl = sampleShaderLumAt(inst, np.x, np.y, halfWin);
      const fadeInTarget = BASE_OP + (PEAK_OP - BASE_OP) * smoothstep(LO, HI, nl);
      h.relocTween = tween(0, fadeInTarget, RELOC_FADE_MS, ease.smoothstep);
      tweenStart(h.relocTween, nowMs);
    } else if (rivalDominates) {
      h.relocNextIdx = maxIdx;
      h.relocTween = tween(h.glowOpacity, 0, RELOC_FADE_MS, ease.smoothstep);
      tweenStart(h.relocTween, nowMs);
    } else {
      h.glowOpacity += (targetOp - h.glowOpacity) * FADE_RATE;
    }
  }

  if (h.relocTween) {
    h.glowOpacity = tweenTick(h.relocTween, nowMs);
  }
  h.glowOpacity = Math.max(0, Math.min(1, h.glowOpacity));

  const ratio = shapePerim(W, H, R, h.kind) / rrPerim(REF_W, REF_H, REF_R);
  const wanderRange = WANDER_RANGE * ratio;
  if (h.wanderFrames++ >= WANDER_RETARGET) { h.wanderTargetS = (Math.random() * 2 - 1) * wanderRange; h.wanderFrames = 0; }
  h.wanderS += (h.wanderTargetS - h.wanderS) * WANDER_LERP;

  const blobArc = perim[h.currentIdx].arc + h.wanderS;

  // INSET / EXTRA_OUTWARD are absolute SVG-unit offsets; multiply by the
  // master scale so the catch-light sits at the right perpendicular distance
  // when the host element is rendered at non-1× layout (e.g. CSS zoom: 2).
  const insetS = INSET * h.scale;
  sampleAtArc(blobArc, W, H, R, insetS, 0, h.kind, _pt);
  const blobX = _pt.x, blobY = _pt.y;
  const tangent = tangentAngleAtArc(blobArc, W, H, R, insetS, h.kind);
  const tx = `translate(${blobX.toFixed(3)}px,${blobY.toFixed(3)}px) rotate(${tangent.toFixed(4)}rad)`;
  h.haloInner.style.transform = tx;

  const extraOut = EXTRA_OUTWARD * ratio * h.scale;
  sampleAtArc(blobArc, W, H, R, insetS, extraOut, h.kind, _pt);
  h.extraInner.style.transform = `translate(${_pt.x.toFixed(3)}px,${_pt.y.toFixed(3)}px) rotate(${tangent.toFixed(4)}rad)`;
  h.fadeCircle.style.transform = `translate(${_pt.x.toFixed(3)}px,${_pt.y.toFixed(3)}px)`;

  const light = theme === 'light';
  const samp = light
    ? sampleShaderRGBChromatic(inst, blobX, blobY, halfWin)
    : sampleShaderRGBAt(inst, blobX, blobY, halfWin);

  if (!h.tintTween) {
    h.tintFrom = { ...samp }; h.tintTarget = { ...samp };
    h.tintTween = tween(0, 1, TINT_FADE_MS);
    tweenStart(h.tintTween, nowMs);
    h.tintHoldUntil = light ? 0 : nowMs + TINT_HOLD_MS;
  } else if (h.tintTween.done) {
    if (light) {
      h.tintFrom = {
        r: h.tintFrom.r + (h.tintTarget.r - h.tintFrom.r) * h.tintTween.val,
        g: h.tintFrom.g + (h.tintTarget.g - h.tintFrom.g) * h.tintTween.val,
        b: h.tintFrom.b + (h.tintTarget.b - h.tintFrom.b) * h.tintTween.val,
      };
      h.tintTarget = { ...samp };
      h.tintTween = tween(0, 1, TINT_FADE_MS);
      tweenStart(h.tintTween, nowMs);
    } else if (nowMs >= h.tintHoldUntil) {
      h.tintFrom = { ...h.tintTarget };
      h.tintTarget = { ...samp };
      h.tintTween = tween(0, 1, TINT_FADE_MS);
      tweenStart(h.tintTween, nowMs);
      h.tintHoldUntil = nowMs + TINT_HOLD_MS;
    }
  }
  tweenTick(h.tintTween!, nowMs);
  const ft = h.tintTween!.val;

  let tR: number, tG: number, tB: number;
  if (light) {
    tR = Math.round(h.tintFrom.r + (h.tintTarget.r - h.tintFrom.r) * ft);
    tG = Math.round(h.tintFrom.g + (h.tintTarget.g - h.tintFrom.g) * ft);
    tB = Math.round(h.tintFrom.b + (h.tintTarget.b - h.tintFrom.b) * ft);
  } else {
    const hR = h.tintFrom.r + (h.tintTarget.r - h.tintFrom.r) * ft;
    const hG = h.tintFrom.g + (h.tintTarget.g - h.tintFrom.g) * ft;
    const hB = h.tintFrom.b + (h.tintTarget.b - h.tintFrom.b) * ft;
    const peak = Math.max(hR, hG, hB) || 1;
    tR = Math.round(255 * (hR / peak)); tG = Math.round(255 * (hG / peak)); tB = Math.round(255 * (hB / peak));
  }

  const tinted = `rgb(${tR},${tG},${tB})`;
  if (tinted !== h.lastHaloStroke) { h.lastHaloStroke = tinted; h.haloInner.style.stroke = tinted; }

  if (light) {
    const hsv = rgbToHsv(tR, tG, tB);
    const [er, eg, eb] = hsvToRgb(hsv[0], Math.min(1, hsv[1] * LT_SAT_BOOST), Math.max(LT_MIN_VAL, hsv[2] * LT_VAL_MULT));
    const extraTinted = `rgb(${er},${eg},${eb})`;
    if (extraTinted !== h.lastExtraStroke) { h.lastExtraStroke = extraTinted; h.extraInner.style.stroke = extraTinted; }
  } else if (h.lastExtraStroke !== '#ffffff') {
    h.lastExtraStroke = '#ffffff'; h.extraInner.style.stroke = '#ffffff';
  }

  const m = Math.max(0, Math.min(1, strengthMul));
  h.haloGroup.style.opacity = (h.glowOpacity * HALO_OP_MUL * m).toFixed(3);
  h.extraGroup.style.opacity = Math.min(1, h.glowOpacity * EXTRA_INTENSITY * m).toFixed(3);
}

export function resizeGlow(handles: GlowHandles, container: HTMLElement, opts: GlowOptions): GlowHandles {
  for (const svg of Array.from(container.querySelectorAll('.metal-fx-glow-svg'))) {
    if (svg.parentNode === container) container.removeChild(svg);
  }
  void handles;
  return injectGlow(container, opts);
}

/**
 * Pure geometry + SVG markup for the glow overlay.
 *
 * Perimeter math (rounded-rect / circle arc-length sampling), blob path
 * generation, SVG filter/mask construction, and HSV colour helpers.
 * No state — every function is a pure transform.
 */
import { PERIM_SAMPLES } from '../perfConfig';

const INSET = 1.5;
const EXTRA_SCALE = 1 / 3;
const EXTRA_STROKE_OUTER = 4.0 * EXTRA_SCALE;
const EXTRA_STROKE_CORE = 2.0 * EXTRA_SCALE;
const EXTRA_BLUR_OUTER = 2.0 * EXTRA_SCALE;
const EXTRA_BLUR_CORE = 1.35 * EXTRA_SCALE;
const EXTRA_FADE_R = 13.0 * EXTRA_SCALE;

export { PERIM_SAMPLES };

export interface GlowOptions {
  width: number;
  height: number;
  cornerRadius: number;
  kind: 'pill' | 'circle';
  /** Master multiplier for absolute SVG units (stroke widths, blur,
   *  fade-circle radius). 1 is the canonical 1× rendering. Set to 2 when
   *  the host element is rendered at a 2× layout (e.g. CSS zoom: 2) so
   *  the glow grows proportionally. */
  scale?: number;
}
export interface Pt { x: number; y: number }
export interface PerimSample extends Pt { arc: number }

export function rrPerim(w: number, h: number, r: number): number {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  return 2 * Math.max(0, w - 2 * rr) + 2 * Math.max(0, h - 2 * rr) + 2 * Math.PI * rr;
}

export function shapePerim(w: number, h: number, r: number, kind: 'pill' | 'circle'): number {
  if (kind === 'circle') return 2 * Math.PI * Math.max(0, Math.min(r, Math.min(w, h) / 2));
  return rrPerim(w, h, r);
}

export function sampleAtArc(s: number, w: number, h: number, r: number, inset: number, outward: number, kind: 'pill' | 'circle', out?: Pt): Pt {
  const o = out || { x: 0, y: 0 };
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (kind === 'circle') {
    const perim = 2 * Math.PI * rr;
    if (perim <= 0.0001) { o.x = w * 0.5; o.y = h * 0.5; return o; }
    s = ((s % perim) + perim) % perim;
    const theta = -Math.PI / 2 + (s / perim) * Math.PI * 2;
    const rad = Math.max(0, rr - inset + outward);
    o.x = w * 0.5 + rad * Math.cos(theta);
    o.y = h * 0.5 + rad * Math.sin(theta);
    return o;
  }
  const topLen = Math.max(0, w - 2 * rr), sideLen = Math.max(0, h - 2 * rr);
  const arcLen = (Math.PI * rr) / 2;
  const perim = 2 * (topLen + sideLen) + 4 * arcLen;
  s = ((s % perim) + perim) % perim;
  const rad = Math.max(0, rr - inset + outward);
  let d = s;
  if (d < topLen) { o.x = rr + d; o.y = inset - outward; return o; }
  d -= topLen;
  if (d < arcLen) {
    const theta = -Math.PI / 2 + (arcLen > 0 ? d / arcLen : 0) * (Math.PI / 2);
    o.x = (w - rr) + rad * Math.cos(theta); o.y = rr + rad * Math.sin(theta); return o;
  }
  d -= arcLen;
  if (d < sideLen) { o.x = w - inset + outward; o.y = rr + d; return o; }
  d -= sideLen;
  if (d < arcLen) {
    const theta = (arcLen > 0 ? d / arcLen : 0) * (Math.PI / 2);
    o.x = (w - rr) + rad * Math.cos(theta); o.y = (h - rr) + rad * Math.sin(theta); return o;
  }
  d -= arcLen;
  if (d < topLen) { o.x = w - rr - d; o.y = h - inset + outward; return o; }
  d -= topLen;
  if (d < arcLen) {
    const theta = Math.PI / 2 + (arcLen > 0 ? d / arcLen : 0) * (Math.PI / 2);
    o.x = rr + rad * Math.cos(theta); o.y = (h - rr) + rad * Math.sin(theta); return o;
  }
  d -= arcLen;
  if (d < sideLen) { o.x = inset - outward; o.y = h - rr - d; return o; }
  d -= sideLen;
  const theta = Math.PI + (arcLen > 0 ? d / arcLen : 0) * (Math.PI / 2);
  o.x = rr + rad * Math.cos(theta); o.y = rr + rad * Math.sin(theta);
  return o;
}

export function buildStaticBlobPath(halfLen: number, segments: number): string {
  const step = (halfLen * 2) / segments;
  let d = '';
  for (let i = 0; i <= segments; i++) {
    const x = -halfLen + i * step;
    d += (i === 0 ? 'M ' : 'L ') + x.toFixed(3) + ' 0 ';
  }
  return d;
}

const _ta: Pt = { x: 0, y: 0 };
const _tb: Pt = { x: 0, y: 0 };

export function tangentAngleAtArc(s: number, w: number, h: number, r: number, inset: number, kind: 'pill' | 'circle'): number {
  const eps = 0.1;
  sampleAtArc(s - eps, w, h, r, inset, 0, kind, _ta);
  sampleAtArc(s + eps, w, h, r, inset, 0, kind, _tb);
  return Math.atan2(_tb.y - _ta.y, _tb.x - _ta.x);
}

export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function buildPerimTable(opts: GlowOptions): PerimSample[] {
  const perim = shapePerim(opts.width, opts.height, opts.cornerRadius, opts.kind);
  const insetS = INSET * (opts.scale ?? 1);
  const table: PerimSample[] = [];
  for (let i = 0; i < PERIM_SAMPLES; i++) {
    const arc = (i / PERIM_SAMPLES) * perim;
    const pt = sampleAtArc(arc, opts.width, opts.height, opts.cornerRadius, insetS, 0, opts.kind);
    table.push({ x: pt.x, y: pt.y, arc });
  }
  return table;
}

export function buildSvgMarkup(opts: GlowOptions, p: string): string {
  const { width: W, height: H, cornerRadius: R } = opts;
  const s = opts.scale ?? 1;
  const ringInset = opts.kind === 'circle' ? 2 : 1;
  const innerR = Math.max(0, R - ringInset);
  // Filter region grows with scale so blurred strokes don't get clipped at
  // bigger sizes. The 200/540/440 baseline matches the canonical 1× pill.
  const fX = (-200 * s).toFixed(0), fY = fX;
  const fW = (540 * s).toFixed(0), fH = (440 * s).toFixed(0);
  const fRect = `x="${fX}" y="${fY}" width="${fW}" height="${fH}"`;
  const fr = `${fRect} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"`;
  // Stroke widths and blur stdDeviations are absolute SVG units; multiply
  // by `s` so they remain proportional when viewBox grows with the host.
  const sw = (n: number) => (n * s).toFixed(3);
  const sd = (n: number) => (n * s).toFixed(3);
  return [
    '<defs>',
    `<filter id="${p}_bXl" ${fr}><feGaussianBlur stdDeviation="${sd(8.4)}"/></filter>`,
    `<filter id="${p}_bLg" ${fr}><feGaussianBlur stdDeviation="${sd(4.8)}"/></filter>`,
    `<filter id="${p}_bMd" ${fr}><feGaussianBlur stdDeviation="${sd(2.1)}"/></filter>`,
    `<filter id="${p}_bSm" ${fr}><feGaussianBlur stdDeviation="${sd(0.9)}"/></filter>`,
    `<filter id="${p}_ebO" ${fr}><feGaussianBlur stdDeviation="${sd(EXTRA_BLUR_OUTER)}"/></filter>`,
    `<filter id="${p}_ebC" ${fr}><feGaussianBlur stdDeviation="${sd(EXTRA_BLUR_CORE)}"/></filter>`,
    `<radialGradient id="${p}_fg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="white"/><stop offset="0.30" stop-color="white"/><stop offset="0.65" stop-color="#404040"/><stop offset="1" stop-color="black"/></radialGradient>`,
    `<mask id="${p}_fm" maskUnits="userSpaceOnUse" ${fRect}><rect ${fRect} fill="black"/><circle id="${p}_fc" cx="0" cy="0" r="${(EXTRA_FADE_R * s).toFixed(3)}" fill="url(#${p}_fg)"/></mask>`,
    `<mask id="${p}_rm" maskUnits="userSpaceOnUse" ${fRect}><rect ${fRect} fill="#808080"/><rect x="0" y="0" width="${W}" height="${H}" rx="${R}" ry="${R}" fill="white"/><rect x="${ringInset}" y="${ringInset}" width="${W - ringInset * 2}" height="${H - ringInset * 2}" rx="${innerR}" ry="${innerR}" fill="black"/></mask>`,
    '</defs>',
    // Safari clips mask to the masked element's bbox; our horizontal strokes
    // have zero height, so the mask becomes a sliver. These spacer rects
    // inflate the bbox to the full filter region.
    `<g id="${p}_h" mask="url(#${p}_rm)" opacity="0">`,
    `<rect ${fRect} fill="none" pointer-events="none"/>`,
    `<g id="${p}_hI" stroke="white">`,
    `<path id="${p}_pXl" stroke-width="${sw(26.4)}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.385" filter="url(#${p}_bXl)"/>`,
    `<path id="${p}_pLg" stroke-width="${sw(15.6)}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.595" filter="url(#${p}_bLg)"/>`,
    `<path id="${p}_pMd" stroke-width="${sw(7.2)}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.70" filter="url(#${p}_bMd)"/>`,
    `<path id="${p}_pSm" stroke-width="${sw(3.0)}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.70" filter="url(#${p}_bSm)"/>`,
    '</g></g>',
    `<g id="${p}_e" mask="url(#${p}_rm)" opacity="0">`,
    `<rect ${fRect} fill="none" pointer-events="none"/>`,
    `<g mask="url(#${p}_fm)">`,
    `<g id="${p}_eI" stroke="white">`,
    `<path id="${p}_eO" stroke-width="${sw(EXTRA_STROKE_OUTER)}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85" filter="url(#${p}_ebO)"/>`,
    `<path id="${p}_eC" stroke-width="${sw(EXTRA_STROKE_CORE)}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="1.0" filter="url(#${p}_ebC)"/>`,
    '</g></g></g>',
  ].join('');
}

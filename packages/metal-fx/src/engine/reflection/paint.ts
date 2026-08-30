/** Proximity reflection — public API and per-frame paint loop. */
import type { MetalFxInstance } from '../renderer/core';
import {
  ATTACH_RANGE_PX,
  BASE_ALPHA,
  BOOST_ALPHA,
  BORDER_HILITE_ALPHA,
  BORDER_HILITE_PX,
  FILL_CIRCLE_ATTENUATION,
  FILL_EXTRA_ALPHA,
  FILL_OPACITY_MUL,
  GLOBAL_ATTENUATION,
  GRAD_FAR,
  GRAD_MID,
  GRAD_NEAR,
  OVERLAP_MIN_PX,
  INTENSITY_MULT,
  MAX_ALPHA_STACK,
  RANGE_PX,
  REF_DRAW_CSS_W,
  REFLECTION_BLOCKED_TAGS,
  STROKE_CSS_PX,
  STROKE_EXTRA_ALPHA,
  type ReflectionTarget,
} from './constants';
import {
  type BoxRect,
  type DrawDst,
  drawBorderHighlight,
  isHorizontalNeighbour,
  isVerticalNeighbour,
  maskedFillPasses,
  maskedStrokePasses,
  shortestRectDistance,
} from './geometry';
import { attachObservers, detachObservers, readCornerRadius, readHairlineSpec } from './observers';

export type { ReflectionTarget } from './constants';

const targets: Set<ReflectionTarget> = new Set();

export function addReflectionTarget(
  el: HTMLElement,
  anchor: MetalFxInstance,
  anchorEl: HTMLElement
): ReflectionTarget | null {
  if (typeof document === 'undefined') return null;
  if (REFLECTION_BLOCKED_TAGS.has(el.tagName)) return null;
  for (const existing of targets) {
    if (existing.el === el) return existing;
  }

  const wrap = document.createElement('div');
  wrap.setAttribute('data-metal-fx-reflection', '');
  wrap.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'metal-fx-reflection-canvas';
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;

  const strokeCanvas = document.createElement('canvas');
  strokeCanvas.className = 'metal-fx-reflection-stroke-canvas';
  const strokeCtx = strokeCanvas.getContext('2d', { alpha: true });
  if (!strokeCtx) return null;

  wrap.appendChild(canvas);
  wrap.appendChild(strokeCanvas);

  const cs = getComputedStyle(el);
  let appliedPositionRelative = false;
  if (cs.position === 'static') {
    el.style.position = 'relative';
    appliedPositionRelative = true;
  }
  let appliedIsolation = false;
  if (cs.isolation !== 'isolate') {
    el.style.isolation = 'isolate';
    appliedIsolation = true;
  }
  el.setAttribute('data-metal-fx-reflect-host', '');
  el.insertBefore(wrap, el.firstChild);

  const initialSpec = readHairlineSpec(el);
  const target: ReflectionTarget = {
    el,
    anchor,
    anchorEl,
    wrap,
    canvas,
    ctx,
    strokeCanvas,
    strokeCtx,
    cornerRadius: readCornerRadius(el),
    hairlineWidth: initialSpec.width,
    hairlineOuterCssPx: initialSpec.outerCssPx,
    appliedPositionRelative,
    appliedIsolation,
    resizeObserver: null,
    mutationObserver: null,
  };
  attachObservers(target);
  targets.add(target);
  return target;
}

export function removeReflectionTarget(el: HTMLElement): void {
  for (const target of targets) {
    if (target.el === el) {
      detachObservers(target);
      target.canvas.width = 0;
      target.canvas.height = 0;
      target.strokeCanvas.width = 0;
      target.strokeCanvas.height = 0;
      if (target.wrap.parentNode === target.el) {
        target.el.removeChild(target.wrap);
      }
      target.el.removeAttribute('data-metal-fx-reflect-host');
      if (target.appliedPositionRelative) target.el.style.position = '';
      if (target.appliedIsolation) target.el.style.isolation = '';
      targets.delete(target);
      return;
    }
  }
}

export function paintReflections(): void {
  if (targets.size === 0) return;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const anchorRects = new Map<HTMLElement, DOMRect>();

  for (const t of targets) {
    const tRect = t.el.getBoundingClientRect();
    let aRect = anchorRects.get(t.anchorEl);
    if (!aRect) {
      aRect = t.anchorEl.getBoundingClientRect();
      anchorRects.set(t.anchorEl, aRect);
    }
    if (tRect.width < 1 || tRect.height < 1) continue;
    if (aRect.width < 1 || aRect.height < 1) continue;

    if (
      !isHorizontalNeighbour(aRect, tRect, OVERLAP_MIN_PX, ATTACH_RANGE_PX) &&
      !isVerticalNeighbour(aRect, tRect, OVERLAP_MIN_PX, ATTACH_RANGE_PX)
    ) {
      if (t.canvas.width !== 1) { t.canvas.width = 1; t.canvas.height = 1; }
      if (t.strokeCanvas.width !== 1) { t.strokeCanvas.width = 1; t.strokeCanvas.height = 1; }
      continue;
    }

    const anchorCanvas = t.anchor.canvas;
    const sw = anchorCanvas.width | 0;
    const sh = anchorCanvas.height | 0;
    if (sw < 4 || sh < 4) continue;

    const acx = (aRect.left + aRect.right) * 0.5;
    const acy = (aRect.top + aRect.bottom) * 0.5;
    const tcx = (tRect.left + tRect.right) * 0.5;
    const tcy = (tRect.top + tRect.bottom) * 0.5;
    const dx = acx - tcx;
    const dy = acy - tcy;

    const edgeGapH = Math.max(aRect.left - tRect.right, tRect.left - aRect.right, 0);
    const edgeGapV = Math.max(aRect.top - tRect.bottom, tRect.top - aRect.bottom, 0);
    const isHorizontalLayout = edgeGapH >= edgeGapV;

    const dist = shortestRectDistance(aRect, tRect);
    let proximity = 1 - Math.min(1, dist / RANGE_PX);
    proximity = proximity * proximity * (3 - 2 * proximity);
    const intensity = BASE_ALPHA + (BOOST_ALPHA - BASE_ALPHA) * proximity;

    const reflectionAlpha = Math.min(
      MAX_ALPHA_STACK,
      intensity * INTENSITY_MULT * GLOBAL_ATTENUATION
    );

    // Effective scale of the host element. Anything drawn on the reflection
    // canvas (strokes, border-highlight) is in DEVICE pixels, so it doesn't
    // automatically grow when the host is rendered at non-1× layout (CSS
    // zoom: 2, etc.). Multiply absolute-pixel constants by the anchor's
    // scale so the reflection scales together with the metal effect itself.
    const sScale = t.anchor.scale ?? 1;
    const hairlineCssPx = Math.max(STROKE_CSS_PX * sScale, t.hairlineWidth);
    const strokeBandPx = Math.max(1, Math.round(hairlineCssPx * dpr));
    const borderHighlightPx = Math.max(
      1,
      Math.round(Math.max(BORDER_HILITE_PX * sScale, t.hairlineWidth) * dpr)
    );

    const overscanCssPx = t.hairlineOuterCssPx;
    t.wrap.style.inset = `${-overscanCssPx}px`;
    t.wrap.style.borderRadius = `${Math.max(0, t.cornerRadius)}px`;

    const tw = Math.max(1, Math.round((tRect.width + overscanCssPx * 2) * dpr));
    const th = Math.max(1, Math.round((tRect.height + overscanCssPx * 2) * dpr));
    if (t.canvas.width !== tw) t.canvas.width = tw;
    if (t.canvas.height !== th) t.canvas.height = th;
    if (t.strokeCanvas.width !== tw) t.strokeCanvas.width = tw;
    if (t.strokeCanvas.height !== th) t.strokeCanvas.height = th;

    const ctx = t.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tw, th);
    const strokeCtx = t.strokeCtx;
    strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
    strokeCtx.clearRect(0, 0, tw, th);

    const bandDevPx = Math.min(RANGE_PX * dpr, Math.max(tw, th));
    let g0x: number, g0y: number, g1x: number, g1y: number;
    if (isHorizontalLayout) {
      g0x = dx > 0 ? tw : 0; g1x = dx > 0 ? tw - bandDevPx : bandDevPx;
      g0y = th * 0.5; g1y = th * 0.5;
    } else {
      g0y = dy > 0 ? th : 0; g1y = dy > 0 ? th - bandDevPx : bandDevPx;
      g0x = tw * 0.5; g1x = tw * 0.5;
    }
    const grad = ctx.createLinearGradient(g0x, g0y, g1x, g1y);
    grad.addColorStop(0, `rgba(0,0,0,${GRAD_NEAR})`);
    grad.addColorStop(0.5, `rgba(0,0,0,${GRAD_MID})`);
    grad.addColorStop(1, `rgba(0,0,0,${GRAD_FAR})`);

    const anchorCssW = sw / dpr;
    const refWdpr = Math.max(1, Math.round(REF_DRAW_CSS_W * Math.max(0.1, anchorCssW / 140) * dpr));

    let drawX: number, drawY: number, drawW: number, drawH: number;
    let flipX = false, flipY = false;
    if (isHorizontalLayout) {
      const overlapTop = Math.max(aRect.top, tRect.top);
      const overlapBot = Math.min(aRect.bottom, tRect.bottom);
      flipX = true;
      drawX = dx > 0 ? tw - refWdpr : 0;
      drawY = Math.round((overlapTop - tRect.top + overscanCssPx) * dpr);
      drawW = refWdpr;
      drawH = Math.max(1, Math.round((overlapBot - overlapTop) * dpr));
    } else {
      const overlapLeft = Math.max(aRect.left, tRect.left);
      const overlapRight = Math.min(aRect.right, tRect.right);
      flipY = true;
      drawX = Math.round((overlapLeft - tRect.left + overscanCssPx) * dpr);
      drawY = dy > 0 ? th - refWdpr : 0;
      drawW = Math.max(1, Math.round((overlapRight - overlapLeft) * dpr));
      drawH = refWdpr;
    }
    const drawDst: DrawDst = { x: drawX, y: drawY, w: drawW, h: drawH, flipX, flipY };

    const strokeBox: BoxRect = { x: 0, y: 0, w: tw, h: th, r: Math.max(0, t.cornerRadius * dpr) };

    const fillReflectionAlpha = Math.min(
      MAX_ALPHA_STACK,
      reflectionAlpha * FILL_EXTRA_ALPHA * FILL_OPACITY_MUL * FILL_CIRCLE_ATTENUATION
    );
    maskedFillPasses(ctx, anchorCanvas, sw, sh, tw, th, fillReflectionAlpha, grad, drawDst, strokeBox, dpr);

    maskedStrokePasses(
      strokeCtx, anchorCanvas, sw, sh, tw, th,
      strokeBox, reflectionAlpha, strokeBandPx, grad, STROKE_EXTRA_ALPHA, drawDst
    );

    drawBorderHighlight(
      strokeCtx, strokeBox, borderHighlightPx,
      g0x, g0y, g1x, g1y,
      Math.min(0.85, BORDER_HILITE_ALPHA * reflectionAlpha)
    );

    ctx.globalCompositeOperation = 'source-over';
    strokeCtx.globalCompositeOperation = 'source-over';
  }
}

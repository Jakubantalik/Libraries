/**
 * Style observation for reflection targets.
 *
 * Reads corner radii and hairline specs from computed styles, and
 * attaches ResizeObserver / MutationObserver so values stay fresh
 * without per-frame getComputedStyle calls.
 */
import type { ReflectionTarget } from './constants';

export function readCornerRadius(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const radii = [
    parseFloat(cs.borderTopLeftRadius) || 0,
    parseFloat(cs.borderTopRightRadius) || 0,
    parseFloat(cs.borderBottomRightRadius) || 0,
    parseFloat(cs.borderBottomLeftRadius) || 0,
  ].filter((v) => v > 0);
  return radii.length ? Math.min.apply(null, radii) : 0;
}

/**
 * Read the visible "hairline" geometry of the host so the 1-px stroke
 * reflection sits exactly on the host's existing ring.
 *
 * Returns the visible thickness (`width`) and the OUTWARD extent past the
 * padding-box edge (`outerCssPx`) — the wrap is overscanned by `outerCssPx`
 * on every side so its outer rim lines up with the host's visible silhouette.
 *
 * Source contributions:
 *   - CSS `border-*-width` (max across the 4 sides)
 *   - smallest `inset` `box-shadow` with spread > 0
 *   - smallest outset `box-shadow` with spread > 0
 */
export function readHairlineSpec(el: HTMLElement): { width: number; outerCssPx: number } {
  const cs = getComputedStyle(el);
  const borderMax = Math.max(
    parseFloat(cs.borderTopWidth) || 0,
    parseFloat(cs.borderRightWidth) || 0,
    parseFloat(cs.borderBottomWidth) || 0,
    parseFloat(cs.borderLeftWidth) || 0
  );

  let smallestInsetSpread = 0;
  let smallestOutsetSpread = 0;
  const shadow = cs.boxShadow;
  if (shadow && shadow !== 'none') {
    const safe = shadow.replace(/rgba?\([^)]*\)/g, (m) => m.replace(/,/g, '\u0000'));
    const parts = safe.split(/,\s*/);
    let inset = Infinity;
    let outset = Infinity;
    for (const part of parts) {
      const nums = part.match(/-?\d+(?:\.\d+)?px/g);
      if (!nums || nums.length < 4) continue;
      const spread = parseFloat(nums[3]);
      if (!(spread > 0)) continue;
      if (/\binset\b/.test(part)) {
        if (spread < inset) inset = spread;
      } else if (spread < outset) {
        outset = spread;
      }
    }
    if (Number.isFinite(inset)) smallestInsetSpread = inset;
    if (Number.isFinite(outset)) smallestOutsetSpread = outset;
  }

  const outerCssPx = Math.max(borderMax, smallestOutsetSpread);
  const width =
    Math.max(borderMax, smallestInsetSpread, smallestOutsetSpread) || 1;

  return { width, outerCssPx };
}

function refreshTargetStyles(t: ReflectionTarget): void {
  t.cornerRadius = readCornerRadius(t.el);
  const spec = readHairlineSpec(t.el);
  t.hairlineWidth = spec.width;
  t.hairlineOuterCssPx = spec.outerCssPx;
}

export function attachObservers(t: ReflectionTarget): void {
  if (typeof ResizeObserver !== 'undefined') {
    t.resizeObserver = new ResizeObserver(() => refreshTargetStyles(t));
    t.resizeObserver.observe(t.el);
  }
  if (typeof MutationObserver !== 'undefined') {
    t.mutationObserver = new MutationObserver(() => refreshTargetStyles(t));
    t.mutationObserver.observe(t.el, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }
}

export function detachObservers(t: ReflectionTarget): void {
  t.resizeObserver?.disconnect();
  t.resizeObserver = null;
  t.mutationObserver?.disconnect();
  t.mutationObserver = null;
}

export type CornerRadii = [number, number, number, number]

export interface BlobBox {
  x: number
  y: number
  w: number
  h: number
  r: CornerRadii
}

/** Transform-free position of `el` relative to `ancestor` via the offsetParent
 *  chain — the blob mirrors motion separately, so its base box must ignore the
 *  transform currently applied to the wrapper. */
export function offsetTo(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0
  let y = 0
  let node: HTMLElement | null = el
  while (node && node !== ancestor && ancestor.contains(node)) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

export function measureRadius(el: Element, w: number, h: number): CornerRadii {
  const cs = getComputedStyle(el)
  const parse = (v: string): number => {
    const first = v.split(' ')[0]
    if (first.endsWith('%')) return ((parseFloat(first) || 0) / 100) * Math.min(w, h)
    return parseFloat(first) || 0
  }
  return [
    parse(cs.borderTopLeftRadius),
    parse(cs.borderTopRightRadius),
    parse(cs.borderBottomRightRadius),
    parse(cs.borderBottomLeftRadius),
  ]
}

export function normalizeRadius(r: number | CornerRadii): CornerRadii {
  return typeof r === 'number' ? [r, r, r, r] : r
}

/** Rounded-rect path with per-corner radii, CSS-style overlap clamping. */
export function roundedRectPath(x: number, y: number, w: number, h: number, radii: CornerRadii): string {
  let [tl, tr, br, bl] = radii.map(v => Math.max(0, v)) as CornerRadii
  const f = Math.min(
    1,
    w / Math.max(1e-6, tl + tr),
    w / Math.max(1e-6, bl + br),
    h / Math.max(1e-6, tl + bl),
    h / Math.max(1e-6, tr + br),
  )
  tl *= f
  tr *= f
  br *= f
  bl *= f
  return (
    `M ${x + tl} ${y} ` +
    `H ${x + w - tr} A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr} ` +
    `V ${y + h - br} A ${br} ${br} 0 0 1 ${x + w - br} ${y + h} ` +
    `H ${x + bl} A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl} ` +
    `V ${y + tl} A ${tl} ${tl} 0 0 1 ${x + tl} ${y} Z`
  )
}

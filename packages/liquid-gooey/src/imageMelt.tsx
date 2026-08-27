import { useEffect, useId, useRef, useState } from 'react'
import { useGooeyContext } from './context'

/** Image melt (the v2 "melt lab" effect, engine-free): two image-filled
 *  cards whose surfaces run molten where they touch — colours averaged
 *  through the goo, the crisp faces dissolving at the seam, and a marbling
 *  pass folding the two palettes into streaks in the touch area.
 *
 *  Architecture: the participating items' DOM stays interactive but paints
 *  nothing (opacity 0); an SVG layer in the group re-renders their imagery
 *  as pattern-filled rounded rects through the melt's filter stack,
 *  following the live rects each frame. Pairwise by design — the first two
 *  melt items in a group form the pair; the seam maths is two-body. */

export interface ImageMeltOptions {
  /** Goo sigma: how far the bodies reach for each other AND how wide the
   *  colour averaging runs. Default 7. */
  blur?: number
  /** Alpha-contrast slope of the liquid boundary. Default 40. */
  contrast?: number
  /** How far each crisp face dissolves back before the neighbour, as a
   *  factor of the half-diagonal. Default 0.8. */
  reach?: number
  /** Softness of that dissolve (mask blur sigma). Default 17. */
  fade?: number
  /** Turbulence displacement of the molten layer, px. Default 0. */
  warp?: number
  /** 0..1 two-liquid marbling strength in the touch area. Default 1. */
  mix?: number
  /** Blur of the marble pass's source colours. Default 8. */
  mixBlur?: number
  /** How deep the marble zone reaches into each card. Default 1.9. */
  gravity?: number
  /** Wavelength control of the warp noise. Default 12. */
  waviness?: number
}

export const IMAGE_MELT_DEFAULTS: Required<ImageMeltOptions> = {
  blur: 7,
  contrast: 40,
  reach: 0.8,
  fade: 17,
  warp: 0,
  mix: 1,
  mixBlur: 8,
  gravity: 1.9,
  waviness: 12,
}

export interface ImageMeltEntry {
  el: HTMLElement
  src: string
  opts: Required<ImageMeltOptions>
}

/** Registry lives on the Gooey group via context. */
export interface ImageMeltRegistry {
  register(entry: ImageMeltEntry): () => void
  subscribe(fn: () => void): () => void
  entries(): ImageMeltEntry[]
}

export function createImageMeltRegistry(): ImageMeltRegistry {
  const set = new Set<ImageMeltEntry>()
  const subs = new Set<() => void>()
  const notify = () => subs.forEach(f => f())
  return {
    register(entry) {
      set.add(entry)
      notify()
      return () => {
        set.delete(entry)
        notify()
      }
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    entries: () => [...set],
  }
}

interface CardGeom {
  x: number
  y: number
  w: number
  h: number
  r: number
}

function readGeom(group: HTMLElement, el: HTMLElement): CardGeom {
  const gr = group.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const rad = parseFloat(cs.borderTopLeftRadius) || 0
  return {
    x: r.left - gr.left,
    y: r.top - gr.top,
    w: r.width,
    h: r.height,
    r: Math.min(rad, r.width / 2, r.height / 2),
  }
}

const geomKey = (g: CardGeom) =>
  `${Math.round(g.x * 2)},${Math.round(g.y * 2)},${Math.round(g.w)},${Math.round(g.h)},${Math.round(g.r)}`

/** Exponential chase toward a target — the eased proximity that keeps the
 *  melt growing in over ~200ms instead of popping at the goo threshold. */
function useEasedValue(target: number, rate = 14): number {
  const [value, setValue] = useState(target)
  const st = useRef({ value: target, target, raf: 0, last: 0 })
  useEffect(() => {
    const s = st.current
    s.target = target
    if (s.raf) return
    s.last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000)
      s.last = now
      const k = 1 - Math.exp(-rate * dt)
      s.value += (s.target - s.value) * k
      if (Math.abs(s.value - s.target) < 0.004) s.value = s.target
      setValue(s.value)
      s.raf = s.value === s.target ? 0 : requestAnimationFrame(tick)
    }
    s.raf = requestAnimationFrame(tick)
    return () => {
      if (s.raf) cancelAnimationFrame(s.raf)
      s.raf = 0
    }
  }, [target, rate])
  return value
}

/** The melt SVG for one pair, rendered into the group. Pure function of the
 *  two geometries + sources + tuning; ids namespaced per instance. */
function MeltPair({
  a,
  b,
  srcA,
  srcB,
  opts,
  width,
  height,
}: {
  a: CardGeom
  b: CardGeom
  srcA: string
  srcB: string
  opts: Required<ImageMeltOptions>
  width: number
  height: number
}) {
  const uid = `lgm-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const { blur: gooBlur, contrast, reach, fade, warp, mix, mixBlur, gravity, waviness } = opts

  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  const gap = Math.max(
    0,
    Math.hypot(
      Math.max(Math.abs(ca.x - cb.x) - (a.w + b.w) / 2, 0),
      Math.max(Math.abs(ca.y - cb.y) - (a.h + b.h) / 2, 0),
    ),
  )
  const near = Math.max(0, Math.min(1, 1 - gap / Math.max(8, gooBlur * 2.6)))
  const proxTarget = near * near * (3 - 2 * near)
  const prox = useEasedValue(proxTarget)

  const intercept = Math.round((0.5 - contrast * (5 / 12)) * 100) / 100
  const rA = (Math.hypot(a.w, a.h) / 2) * reach * prox
  const rB = (Math.hypot(b.w, b.h) / 2) * reach * prox
  const seam = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 }
  const dxc = cb.x - ca.x
  const dyc = cb.y - ca.y
  const dc = Math.max(1e-3, Math.hypot(dxc, dyc))
  const tx = -dyc / dc
  const ty = dxc / dc
  const ovx = Math.max(0, (a.w + b.w) / 2 - Math.abs(dxc))
  const ovy = Math.max(0, (a.h + b.h) / 2 - Math.abs(dyc))
  const tanHalf = 0.5 * (ovx * Math.abs(tx) + ovy * Math.abs(ty)) * prox
  const seamDeg = Math.round((Math.atan2(ty, tx) * 180) / Math.PI)
  const mixAmt = Math.round(mix * prox * 100) / 100
  const blurEff = Math.round((2 + (gooBlur - 2) * prox) * 10) / 10
  const warpEff = Math.round(warp * prox * 10) / 10
  const colorBlur = Math.round(blurEff * 2.5 * 10) / 10
  const edgeSoft = Math.round((0.4 + (2 + gooBlur * 0.8) * prox) * 10) / 10

  const gA = `translate(${a.x}, ${a.y})`
  const gB = `translate(${b.x}, ${b.y})`

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-gooey-imagemelt=""
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* No x/y: the rects referencing these patterns already sit inside a
            translated <g>, and userSpaceOnUse resolves in that transformed
            space — an origin here shifted the tile a second time, so the
            image repeated instead of filling the card once. */}
        <pattern id={`${uid}-pa`} patternUnits="userSpaceOnUse" width={a.w} height={a.h}>
          <image href={srcA} width={a.w} height={a.h} preserveAspectRatio="xMidYMid slice" />
        </pattern>
        <pattern id={`${uid}-pb`} patternUnits="userSpaceOnUse" width={b.w} height={b.h}>
          <image href={srcB} width={b.w} height={b.h} preserveAspectRatio="xMidYMid slice" />
        </pattern>
        {/* Goo on colour: blur mixes both images, contrast re-solidifies only
            alpha; colours come from a wider blur clipped into that shape, so
            internal edges average away while the boundary stays liquid. */}
        <filter id={`${uid}-goo`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blurEff} result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${intercept}`}
            result="goo"
          />
          <feGaussianBlur in="SourceGraphic" stdDeviation={colorBlur} result="bc" />
          <feComposite in="bc" in2="goo" operator="in" result="mix" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency={(2 + waviness * 1.2) / 1000}
            numOctaves="2"
            seed="4"
            result="wn"
          />
          <feDisplacementMap in="mix" in2="wn" scale={warpEff} xChannelSelector="R" yChannelSelector="G" result="warped" />
          {/* Solidify by self-compositing (premultiplied-safe), then restore
              the anti-aliased edge with a sub-pixel blur. */}
          <feComposite in="warped" in2="warped" operator="over" result="s1" />
          <feComposite in="s1" in2="s1" operator="over" result="s2" />
          <feComposite in="s2" in2="s2" operator="over" result="solid" />
          <feGaussianBlur in="solid" stdDeviation="0.6" />
        </filter>
        <filter id={`${uid}-soft`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={fade} />
        </filter>
        {/* Marbling: nested large-scale displacements fold the molten colours
            into streaks, clipped to the goo silhouette. */}
        {mixAmt > 0.01 && (
          <filter id={`${uid}-marble`} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={mixBlur} result="c" />
            <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="5" result="n1" />
            <feDisplacementMap in="c" in2="n1" scale={mixAmt * 90} xChannelSelector="R" yChannelSelector="G" result="d1" />
            <feTurbulence type="fractalNoise" baseFrequency="0.019" numOctaves="2" seed="11" result="n2" />
            <feDisplacementMap in="d1" in2="n2" scale={mixAmt * 50} xChannelSelector="R" yChannelSelector="G" result="d2" />
            <feComposite in="d2" in2="d2" operator="over" result="m1" />
            <feComposite in="m1" in2="m1" operator="over" result="m2" />
            <feGaussianBlur in="m2" stdDeviation="0.6" result="marble" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={blurEff} result="mb" />
            <feColorMatrix
              in="mb"
              type="matrix"
              values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${intercept}`}
              result="mg"
            />
            <feTurbulence
              type="fractalNoise"
              baseFrequency={(2 + waviness * 1.2) / 1000}
              numOctaves="2"
              seed="4"
              result="mwn"
            />
            <feDisplacementMap in="mg" in2="mwn" scale={warpEff} xChannelSelector="R" yChannelSelector="G" result="mshape" />
            <feComposite in="marble" in2="mshape" operator="in" />
          </filter>
        )}
        {mixAmt > 0.01 && (
          <mask id={`${uid}-marblemask`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
            <g filter={`url(#${uid}-soft)`}>
              <ellipse
                cx={seam.x}
                cy={seam.y}
                rx={(rA + rB) / 2 + tanHalf}
                ry={((rA + rB) / 2) * gravity}
                transform={`rotate(${seamDeg}, ${seam.x}, ${seam.y})`}
                fill="#fff"
              />
            </g>
          </mask>
        )}
        <filter id={`${uid}-edge`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={edgeSoft} />
        </filter>
        {/* Crisp faces: each is its plain card minus a blurred seam-spanning
            erase ellipse — apart, a card is exactly a card. */}
        <mask id={`${uid}-ma`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <g filter={`url(#${uid}-edge)`}>
            <g transform={gA}>
              <rect width={a.w} height={a.h} rx={a.r} fill="#fff" />
            </g>
          </g>
          <g filter={`url(#${uid}-soft)`}>
            <ellipse
              cx={seam.x}
              cy={seam.y}
              rx={rB + tanHalf}
              ry={rB}
              transform={`rotate(${seamDeg}, ${seam.x}, ${seam.y})`}
              fill="#000"
            />
          </g>
        </mask>
        <mask id={`${uid}-mb`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <g filter={`url(#${uid}-edge)`}>
            <g transform={gB}>
              <rect width={b.w} height={b.h} rx={b.r} fill="#fff" />
            </g>
          </g>
          <g filter={`url(#${uid}-soft)`}>
            <ellipse
              cx={seam.x}
              cy={seam.y}
              rx={rA + tanHalf}
              ry={rA}
              transform={`rotate(${seamDeg}, ${seam.x}, ${seam.y})`}
              fill="#000"
            />
          </g>
        </mask>
      </defs>

      {/* MOLTEN layer */}
      <g filter={`url(#${uid}-goo)`}>
        <g transform={gA}><rect width={a.w} height={a.h} rx={a.r} fill={`url(#${uid}-pa)`} /></g>
        <g transform={gB}><rect width={b.w} height={b.h} rx={b.r} fill={`url(#${uid}-pb)`} /></g>
      </g>

      {/* MARBLE layer */}
      {mixAmt > 0.01 && (
        <g mask={`url(#${uid}-marblemask)`}>
          <g filter={`url(#${uid}-marble)`}>
            <g transform={gA}><rect width={a.w} height={a.h} rx={a.r} fill={`url(#${uid}-pa)`} /></g>
            <g transform={gB}><rect width={b.w} height={b.h} rx={b.r} fill={`url(#${uid}-pb)`} /></g>
          </g>
        </g>
      )}

      {/* CRISP layer */}
      <g mask={`url(#${uid}-ma)`}>
        <g transform={gA}><rect width={a.w} height={a.h} rx={a.r} fill={`url(#${uid}-pa)`} /></g>
      </g>
      <g mask={`url(#${uid}-mb)`}>
        <g transform={gB}><rect width={b.w} height={b.h} rx={b.r} fill={`url(#${uid}-pb)`} /></g>
      </g>
    </svg>
  )
}

/** Rendered by the Gooey group: watches the registered melt items and draws
 *  the pair. rAF-measured; re-renders only when a rect actually moves. */
export function ImageMeltLayer({ registry }: { registry: ImageMeltRegistry }) {
  const { getGroup } = useGooeyContext()
  const [, bump] = useState(0)
  const [geoms, setGeoms] = useState<{ a: CardGeom; b: CardGeom } | null>(null)
  const keyRef = useRef('')

  useEffect(() => registry.subscribe(() => bump(v => v + 1)), [registry])

  const pair = registry.entries().slice(0, 2)
  const active = pair.length === 2

  useEffect(() => {
    if (!active) {
      setGeoms(null)
      keyRef.current = ''
      return
    }
    let raf = 0
    const tick = () => {
      const group = getGroup()
      if (group) {
        const a = readGeom(group, pair[0].el)
        const b = readGeom(group, pair[1].el)
        const key = geomKey(a) + '|' + geomKey(b)
        if (key !== keyRef.current) {
          keyRef.current = key
          setGeoms({ a, b })
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pair[0]?.el, pair[1]?.el, getGroup])

  if (!active || !geoms) return null
  const group = getGroup()
  const w = group?.offsetWidth ?? 0
  const h = group?.offsetHeight ?? 0
  return (
    <MeltPair
      a={geoms.a}
      b={geoms.b}
      srcA={pair[0].src}
      srcB={pair[1].src}
      opts={pair[0].opts}
      width={w}
      height={h}
    />
  )
}

/** Host for one melting item: keeps the child interactive but invisible —
 *  the melt SVG is the painter. Auto-detects the image source from the
 *  first <img> descendant when `src` isn't given. */
export function ImageMeltItem({
  src,
  opts,
  registry,
  children,
}: {
  src?: string
  opts: Required<ImageMeltOptions>
  registry: ImageMeltRegistry
  children: React.ReactNode
}) {
  const hostRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    const target = host?.firstElementChild as HTMLElement | null
    if (!target) return
    const img = src ?? target.querySelector('img')?.src ?? (target as HTMLImageElement).src
    if (!img) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[liquid-gooey] effect="melt" needs an image: pass melt={{ src }} or put an <img> inside the item.')
      }
      return
    }
    // The DOM element stays for layout + interaction; the SVG paints it.
    const prevOpacity = target.style.opacity
    target.style.opacity = '0'
    const unregister = registry.register({ el: target, src: img, opts })
    return () => {
      target.style.opacity = prevOpacity
      unregister()
    }
  }, [src, opts, registry])

  return <span ref={hostRef} style={{ display: 'contents' }}>{children}</span>
}

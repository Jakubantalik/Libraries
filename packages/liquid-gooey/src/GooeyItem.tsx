import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useGooeyContext, type GooeyContextValue } from './context'
import {
  measureRadius,
  normalizeRadius,
  offsetTo,
  roundedRectPath,
  type BlobBox,
  type CornerRadii,
} from './geometry'
import { useIsoLayoutEffect, useReducedMotion } from './hooks'
import { EVOLVE_DEFAULTS, MOVE_DEFAULTS, type EvolveOptions, type MoveOptions } from './observer'
import { easingFunction, resolveTransition, type Transition } from './spring'

export type GooeyEffect = 'morph' | 'evolve' | 'move'

/** Full tuning surface of the contact melt ("dissolve"). All values optional —
 *  the defaults are the library's tuned look. */
export interface DissolveOptions {
  /** Melt blur in px. Default 8. */
  blur?: number
  /** Displacement strength of the liquid warp. Default 26. */
  warp?: number
  /** Magnetic drift toward the contact, px. Default 4. */
  pull?: number
  /** Distance where melting starts (defaults from the group's goo blur). */
  range?: number
  /** Size of the melt zone around the contact, px. */
  zone?: number
  /** 0..1 — two-liquid mixing: erodes the melted copy into tendrils so the
   *  liquid behind shows through the gaps. Default 0.7 when dissolving. */
  mix?: number
  /** Px the melt is drawn toward the neighbour's centre (flow gravity). */
  gravity?: number
  /** 0..1 — how pointy that flow tapers toward the neighbour. */
  taper?: number
  /** Noise frequency multiplier: <1 broad swirls, >1 fine veins. */
  warpFreq?: number
  /** Px/s the noise field drifts so the liquid churns. 0 = static. */
  flowSpeed?: number
  /** 'fractalNoise' (soft billows) or 'turbulence' (veinier). */
  warpStyle?: 'fractalNoise' | 'turbulence'
  /** Noise octaves; higher = finer swirls. */
  detail?: number
  /** While false the melt fades out over `releaseMs`, regardless of
   *  proximity. */
  active?: boolean
  /** Structural release time when `active` goes false, ms. */
  releaseMs?: number
  /** Ms the melt takes to evaporate (opacity -> 0), independent of
   *  `releaseMs`. Defaults to `releaseMs`. */
  fadeMs?: number
  /** 0..1 — overall dissolve intensity, independent of proximity: caps how
   *  far the melt can develop even at full contact (scales warp/blur/
   *  gravity/mix and the hole depth together). Default 1. */
  strength?: number
  /** How deep this piece may sink into its neighbour before the melt is fully
   *  gone, as a fraction of the smaller body (1 = completely engulfed).
   *  Melting is a surface event — once a piece is well inside the other there
   *  is no seam left to mix at, so the melt recedes and the content resolves
   *  back to crisp. Default 0.8; raise toward (or past) 1 to keep melting
   *  while deeply overlapped. */
  sink?: number
  /** What the liquid is made of. 'liquid' (default): the group fill — white
   *  surface goo with imagery melted over it. 'image': the liquid body IS the
   *  image, so the neck between two items blends both images' colours. */
  surface?: 'liquid' | 'image'
  /** Blur (px) of the seam-blend layer — the imagery painted once more
   *  through a plain heavy blur at the contact, half opacity per side, so
   *  the seam shows the two pictures' colours literally averaged. Defaults
   *  to 1.6x `blur`; 0 disables. */
  seamBlur?: number
}

export interface GooeyItemProps {
  /** Liquid behavior of this piece:
   *  - 'morph' (default): merges gooily with touching neighbours.
   *  - 'evolve': the surface springs behind size/shape changes and settles
   *    like jelly.
   *  - 'move': the surface lags a moving element and stretches with velocity —
   *    liquid rubber (great for dragged things).
   *  Combine with an array. Anything beyond 'morph' runs on the measurement
   *  engine, so it implies observe mode. */
  effect?: GooeyEffect | GooeyEffect[]
  /** Tuning for effect="evolve": springs for mass / size / corner radius,
   *  content cross-blur, and droplet roundness. See EvolveOptions. */
  evolve?: EvolveOptions
  /** Tuning for effect="move": trail spring, velocity stretch, tail size. */
  move?: MoveOptions
  /** Mirrored mode: translation applied to both the wrapper and its blob. */
  x?: number
  y?: number
  scale?: number
  /** Mirrored mode: spring preset/config or `{ duration, ease }`. Default 'smooth'. */
  transition?: Transition
  /** Mirrored mode: transition delay in ms (stagger). Default 0. */
  delay?: number
  /** Observe mode: you animate the child however you like (Framer Motion, GSAP,
   *  CSS); the blob follows its rendered rect. `x/y/scale` are ignored. */
  observe?: boolean
  /** Observe mode: liquid-melt the item's imagery at the point where it
   *  touches a neighbour — a turbulence-displacement warp bends the image and
   *  its edge like two materials merging, ramping in as the goo bridge forms.
   *  `blur` is the melt blur in px (default 8), `warp` the displacement
   *  strength (default 26), `pull` the magnetic drift toward the contact in px
   *  (default 4), `range` the distance where melting starts (defaults from the
   *  group's goo blur). Text is never melted. */
  contactBlur?: boolean | DissolveOptions
  /** Override the measured border-radius for the blob (px). */
  radius?: number | CornerRadii
  /** Observe mode: shrink the blob by this many px on every side, so an opaque
   *  element (e.g. a round photo) fully covers its own liquid — white then
   *  only appears as the merge bridge. */
  blobInset?: number
  /** Observe mode: px the blob swells back out (beyond blobInset) as the item
   *  nears a neighbour — the element visibly grows a liquid coat that necks
   *  into the other surface. */
  bridgeGrow?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

function toEffects(effect: GooeyEffect | GooeyEffect[] | undefined): GooeyEffect[] {
  return Array.isArray(effect) ? effect : effect ? [effect] : []
}

export function GooeyItem(props: GooeyItemProps) {
  const ctx = useGooeyContext()
  const needsEngine = props.observe || toEffects(props.effect).some(e => e !== 'morph')
  return needsEngine ? (
    <ObservedItem {...props} ctx={ctx} />
  ) : (
    <MirroredItem {...props} ctx={ctx} />
  )
}

type Internal = GooeyItemProps & { ctx: GooeyContextValue }

function transitionKey(t: Transition | undefined): string {
  return typeof t === 'string' ? t : JSON.stringify(t ?? null)
}

function sameBox(a: BlobBox | null, b: BlobBox): boolean {
  return (
    !!a &&
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h &&
    a.r.every((v, i) => v === b.r[i])
  )
}

function MirroredItem({
  x = 0,
  y = 0,
  scale = 1,
  transition = 'smooth',
  delay = 0,
  radius,
  className,
  style,
  children,
  ctx,
}: Internal) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const blobRef = useRef<SVGGraphicsElement | null>(null)
  const [box, setBox] = useState<BlobBox | null>(null)
  const reduced = useReducedMotion()

  const tKey = transitionKey(transition)
  const { duration, easing } = useMemo(
    () => resolveTransition(transition, reduced),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tKey, reduced],
  )

  const radiusKey = radius == null ? '' : JSON.stringify(radius)
  useIsoLayoutEffect(() => {
    const el = wrapRef.current
    const group = ctx.getGroup()
    if (!el || !group) return
    const measure = () => {
      const base = offsetTo(el, group)
      const w = el.offsetWidth
      const h = el.offsetHeight
      const target = (el.firstElementChild as HTMLElement | null) ?? el
      const r: CornerRadii =
        radius != null ? normalizeRadius(radius) : measureRadius(target, w, h)
      const next: BlobBox = { x: base.x, y: base.y, w, h, r }
      setBox(prev => (sameBox(prev, next) ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(group)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, radiusKey])

  // Content and blob are animated by ONE JS clock — no CSS transition on the
  // wrapper. A compositor transition keeps playing through a main-thread
  // stall while the blob (always written from JS) freezes; under Safari's
  // SVG-filter load that read as icons and photos sailing away from their own
  // liquid. With both written in the same rAF tick from the same easing
  // curve, they can only ever move together: a stall holds the whole
  // ensemble, which reads as a hitch, never a tear. The curve is identical to
  // the CSS one (same duration/easing via easingFunction), so browsers that
  // never stall render exactly what they did before.
  const cur = useRef<{ x: number; y: number; s: number } | null>(null)
  const writeTransform = (px: number, py: number, ps: number) => {
    const t = `translate(${px}px, ${py}px)` + (ps !== 1 ? ` scale(${ps})` : '')
    if (wrapRef.current) wrapRef.current.style.transform = t
    if (blobRef.current) blobRef.current.style.transform = t
  }
  useIsoLayoutEffect(() => {
    const from = cur.current
    if (
      !from ||
      duration <= 0 ||
      (from.x === x && from.y === y && from.s === scale)
    ) {
      cur.current = { x, y, s: scale }
      writeTransform(x, y, scale)
      return
    }
    // Retarget like a CSS transition: from the currently rendered value, full
    // duration. `delay` holds at the start value first (stagger).
    const f = { ...from }
    const ease = easingFunction(easing)
    const start = performance.now() + delay
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration))
      const e = ease(p)
      const cx = f.x + (x - f.x) * e
      const cy = f.y + (y - f.y) * e
      const cs = f.s + (scale - f.s) * e
      cur.current = { x: cx, y: cy, s: cs }
      writeTransform(cx, cy, cs)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, scale, duration, easing, delay])

  return (
    <>
      <div
        ref={wrapRef}
        className={className}
        style={{
          display: 'inline-block',
          ...style,
          // `transform` is owned imperatively (see above) — React must never
          // render it, or a re-render mid-flight would snap to the target.
          willChange: 'transform',
        }}
      >
        {children}
      </div>
      {ctx.portal &&
        box &&
        createPortal(
          renderBlob(
            box,
            {
              transformBox: 'fill-box',
              transformOrigin: 'center',
              willChange: 'transform',
            },
            el => {
              blobRef.current = el
              // The blob (re)mounts whenever the measured box changes; catch
              // it up to the currently rendered value immediately.
              if (el) {
                const c = cur.current ?? { x, y, s: scale }
                el.style.transform =
                  `translate(${c.x}px, ${c.y}px)` + (c.s !== 1 ? ` scale(${c.s})` : '')
              }
            },
          ),
          ctx.portal,
        )}
    </>
  )
}

function renderBlob(
  box: BlobBox,
  style: CSSProperties,
  setRef: (el: SVGGraphicsElement | null) => void,
) {
  const [tl, tr, br, bl] = box.r
  const uniform = tl === tr && tr === br && br === bl
  if (uniform) {
    // Clamp to min(w,h)/2: SVG clamps rx and ry independently, so a large
    // radius on a wide short box (the `border-radius: 999px` pill idiom)
    // would degenerate into an ellipse instead of a pill.
    const rx = Math.max(0, Math.min(tl, Math.min(box.w, box.h) / 2))
    return (
      <rect
        ref={setRef}
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={rx}
        style={style}
      />
    )
  }
  return (
    <path
      ref={setRef}
      d={roundedRectPath(box.x, box.y, box.w, box.h, box.r)}
      style={style}
    />
  )
}

function ObservedItem({
  radius,
  blobInset,
  bridgeGrow,
  contactBlur,
  effect,
  evolve,
  move,
  className,
  style,
  children,
  ctx,
}: Internal) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const blobRef = useRef<SVGRectElement | null>(null)
  const meltRef = useRef<SVGGElement | null>(null)
  const blendRef = useRef<{
    active?: boolean
    releaseMs?: number
    fadeMs?: number
    strength?: number
    sink?: number
    seamBlur?: number
  } | null>(null)

  const opts = typeof contactBlur === 'object' ? contactBlur : {}
  const blendBlur = opts.blur ?? 8
  const blendWarp = opts.warp ?? 26
  const blendPull = opts.pull ?? 4
  const blendRange = opts.range
  const blendZone = opts.zone
  const blendMix = opts.mix ?? 0
  const blendGravity = opts.gravity ?? 60
  const blendTaper = opts.taper ?? 1
  const blendWarpFreq = opts.warpFreq ?? 1.7
  const blendFlowSpeed = opts.flowSpeed ?? 22
  const blendWarpStyle = opts.warpStyle ?? 'fractalNoise'
  const blendDetail = opts.detail ?? 2
  const blendActive = opts.active !== false
  const blendRelease = opts.releaseMs ?? 240
  const blendFade = opts.fadeMs
  const blendStrength = opts.strength ?? 1
  // Left undefined when unset so the engine owns the default in one place.
  const blendSink = opts.sink
  const blendSurface = opts.surface
  const blendSeamBlur = opts.seamBlur

  const effects = toEffects(effect)
  const dynamics = {
    evolve: effects.includes('evolve'),
    move: effects.includes('move'),
    evolveOpts: { ...EVOLVE_DEFAULTS, ...evolve },
    moveOpts: { ...MOVE_DEFAULTS, ...move },
  }
  const hasDynamics = dynamics.evolve || dynamics.move

  const radiusKey = radius == null ? '' : JSON.stringify(radius)
  // `active` is intentionally NOT in the key: it changes every drag and must
  // not tear down the melt structure — the engine reads it live.
  const blendKey = contactBlur
    ? `${blendBlur}/${blendWarp}/${blendPull}/${blendRange ?? 'auto'}/${blendZone ?? 'auto'}/${blendMix}/${blendGravity}/${blendTaper}/${blendWarpFreq}/${blendFlowSpeed}/${blendWarpStyle}/${blendDetail}/${blendSurface ?? 'liquid'}/${(blendSeamBlur ?? 1) > 0 ? 'seam' : 'noseam'}`
    : ''
  const effectKey =
    effects.join(',') +
    (dynamics.evolve ? JSON.stringify(dynamics.evolveOpts) : '') +
    (dynamics.move ? JSON.stringify(dynamics.moveOpts) : '')
  useIsoLayoutEffect(() => {
    const host = hostRef.current
    const blob = blobRef.current
    const target = (host?.firstElementChild as HTMLElement | null) ?? null
    if (!target || !blob) return
    const blend =
      contactBlur && meltRef.current
        ? {
            host: meltRef.current,
            blur: blendBlur,
            warp: blendWarp,
            pull: blendPull,
            range: blendRange,
            zone: blendZone,
            mix: blendMix,
            gravity: blendGravity,
            taper: blendTaper,
            warpFreq: blendWarpFreq,
            flowSpeed: blendFlowSpeed,
            warpStyle: blendWarpStyle,
            detail: blendDetail,
            active: blendActive,
            releaseMs: blendRelease,
            fadeMs: blendFade,
            strength: blendStrength,
            sink: blendSink,
            surface: blendSurface,
            seamBlur: blendSeamBlur,
          }
        : undefined
    blendRef.current = blend ?? null
    return ctx.engine.add({
      target,
      blob,
      radius: radius == null ? undefined : normalizeRadius(radius)[0],
      blobInset,
      bridgeGrow,
      blend,
      dynamics: hasDynamics ? dynamics : undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, radiusKey, blendKey, effectKey, blobInset, bridgeGrow])

  // `active` / `releaseMs` / `fadeMs` / `strength` / `sink` are pushed
  // straight into the live config so a drag release (or a strength slider)
  // updates the melt without rebuilding its SVG structure.
  useEffect(() => {
    if (!blendRef.current) return
    blendRef.current.active = blendActive
    blendRef.current.releaseMs = blendRelease
    blendRef.current.fadeMs = blendFade
    blendRef.current.strength = blendStrength
    blendRef.current.sink = blendSink
    blendRef.current.seamBlur = blendSeamBlur
    ctx.engine.wake()
  }, [ctx, blendActive, blendRelease, blendFade, blendStrength, blendSink, blendSeamBlur])

  return (
    <>
      <span ref={hostRef} className={className} style={{ display: 'contents', ...style }}>
        {children}
      </span>
      {ctx.portal &&
        createPortal(
          <rect
            ref={blobRef}
            x={0}
            y={0}
            width={0}
            height={0}
            style={{
              willChange: 'transform',
              // Dynamics scale (stretch / squash) about the blob's own centre.
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />,
          ctx.portal,
        )}
      {contactBlur !== undefined &&
        contactBlur !== false &&
        ctx.meltPortal &&
        createPortal(<g ref={meltRef} opacity={0} />, ctx.meltPortal)}
    </>
  )
}

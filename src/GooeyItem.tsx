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
import { resolveTransition, type Transition } from './spring'

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
  /** Fade-out time when `active` goes false, ms. */
  releaseMs?: number
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

  const tf = `translate(${x}px, ${y}px)` + (scale !== 1 ? ` scale(${scale})` : '')
  // Classic `transform`/`transition`, never individual translate properties:
  // WebKit's individual-property support on SVG elements is what breaks sync.
  const tr = duration > 0 ? `transform ${duration}ms ${easing} ${delay}ms` : 'none'

  // The blob does NOT run its own transition: it samples the wrapper's actual
  // animated matrix each frame while the wrapper animates. Two identical CSS
  // transitions are only identical in theory — the blob lives inside a
  // filtered <g>, and WebKit rasterises that filtered layer behind plain DOM,
  // so the crisp content visibly runs ahead of its own liquid surface (icons
  // detaching from their buttons). Sampling the real value is the same curve
  // by construction, in every browser, and costs frames only while animating.
  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current
    const blob = blobRef.current
    if (!wrap || !blob) return
    let raf = 0
    const until = performance.now() + duration + delay + 80
    const tick = () => {
      const m = getComputedStyle(wrap).transform
      blob.style.transform = m && m !== 'none' ? m : tf
      if (performance.now() < until) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [tf, duration, delay, box])

  return (
    <>
      <div
        ref={wrapRef}
        className={className}
        style={{
          display: 'inline-block',
          ...style,
          transform: tf,
          transition: tr,
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
              transform: tf,
              transformBox: 'fill-box',
              transformOrigin: 'center',
              willChange: 'transform',
            },
            el => {
              blobRef.current = el
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
  const blendRef = useRef<{ active?: boolean; releaseMs?: number } | null>(null)

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
    ? `${blendBlur}/${blendWarp}/${blendPull}/${blendRange ?? 'auto'}/${blendZone ?? 'auto'}/${blendMix}/${blendGravity}/${blendTaper}/${blendWarpFreq}/${blendFlowSpeed}/${blendWarpStyle}/${blendDetail}`
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

  // `active` / `releaseMs` are pushed straight into the live config so a drag
  // release fades the melt without rebuilding it.
  useEffect(() => {
    if (!blendRef.current) return
    blendRef.current.active = blendActive
    blendRef.current.releaseMs = blendRelease
    ctx.engine.wake()
  }, [ctx, blendActive, blendRelease])

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

import { measureRadius } from './geometry'

// Vite dev only: this module owns live singletons — the measurement loop and
// the overlay DOM it built. React Refresh hot-swaps our importers while the
// RUNNING engine keeps executing the old code, so an engine edit could leave
// a page showing new controls wired to old behavior; that stale-engine state
// repeatedly presented as "the fix didn't work". Any edit here is a full
// reload. Dead code in production builds (import.meta.hot is undefined).
const viteHot = (
  import.meta as { hot?: { accept(cb: () => void): void; invalidate(): void } }
).hot
if (viteHot) viteHot.accept(() => viteHot.invalidate())


export interface BlendConfig {
  /** SVG group in the melt-overlay layer; the engine builds the warped-image
   *  structure inside it (pattern-filled rounded rects run through a
   *  turbulence → displacement → blur → saturation filter chain). Filters on
   *  SVG content render correctly in every browser — CSS url() filters on
   *  HTML are what WebKit breaks. */
  host: SVGGElement
  /** Melt blur radius in px. */
  blur: number
  /** Displacement strength of the liquid warp (feDisplacementMap scale). */
  warp: number
  /** Max px the melted imagery is pulled toward the contact. */
  pull: number
  /** Distance (px) at which melting starts; defaults from the group's goo blur. */
  range?: number
  /** Base radius (px) of the melt zone around the contact point. Defaults
   *  from the group's goo blur — the mixing zone matches the bridge width
   *  instead of swallowing the whole element. */
  zone?: number
  /** 0..1 — two-liquid mixing: the melted image is eroded into noise-shaped
   *  tendrils so the neighbour's liquid (already behind it) shows through the
   *  gaps. Never paints a shape — a painted disc reads as a visible circle. */
  mix?: number
  /** Px the melted material is drawn toward the NEIGHBOUR's centre at full
   *  contact — the dissolve streams into the other body instead of
   *  scattering symmetrically. Default 25. */
  gravity?: number
  /** 0..1 — how POINTY the gravity flow is. Each layer's mask is pushed
   *  further along the flow and shrunk, so their union tapers to a tip
   *  instead of stretching as an even blob. Default 0.65. */
  taper?: number
  /** Noise octaves — higher = finer, more detailed swirls. Default 2. */
  detail?: number
  /** Multiplier on the noise frequency: <1 = broad lazy swirls, >1 = fine
   *  busy veins. Default 1. */
  warpFreq?: number
  /** Px/s the noise field drifts, so the liquid visibly churns while held
   *  instead of sitting frozen. 0 = static. Default 26. */
  flowSpeed?: number
  /** 'fractalNoise' = soft billows (default), 'turbulence' = veinier,
   *  more marbled liquid. */
  warpStyle?: 'fractalNoise' | 'turbulence'
  /** While false, the melt fades out over `releaseMs` regardless of
   *  proximity — e.g. the moment a drag is released. Default true. */
  active?: boolean
  /** Structural release time when `active` goes false, ms. Default 240. */
  releaseMs?: number
  /** Ms the melt takes to EVAPORATE — its opacity fades to zero over this,
   *  independently of `releaseMs`, so the dissolve can leave gradually
   *  instead of blinking out. May exceed `releaseMs` (the melt then lives
   *  until the fade finishes). Defaults to `releaseMs`. */
  fadeMs?: number
  /** 0..1 — overall dissolve intensity, independent of proximity: a master
   *  ceiling on how far the melt can develop even at full contact. Scales
   *  warp/blur/gravity/mix AND the hole depth together, so a weak strength
   *  reads as a shallower liquid rather than an erased edge with no melt to
   *  justify it. 1 = full strength (default). */
  strength?: number
  /** How deep this piece may sink into its neighbour before the melt is fully
   *  gone, as a fraction of the smaller body (1 = completely engulfed).
   *  Melting is a SURFACE event: it belongs to the moment two skins meet, and
   *  once a piece is well inside the other there is no seam left to mix at —
   *  it has simply joined. Without this the proximity gap pins to zero on
   *  first overlap and the melt stays at full while the piece buries itself,
   *  which reads as a smear that should have resolved. Default 0.8; raise
   *  toward (or past) 1 to keep melting while deeply overlapped. */
  sink?: number
  /** What the liquid is MADE OF. 'liquid' (default): the group's fill — the
   *  classic white/surface goo, imagery painted over it. 'image': the item's
   *  blob is pattern-filled with its own imagery, so the goo neck between
   *  two such items renders as a blur-blend of both images' local colours —
   *  no surface material visible at the seam at all. */
  surface?: 'liquid' | 'image'
  /** Blur radius (px) of the seam-blend layer: the item's imagery painted
   *  once more through a PLAIN heavy blur, masked to the contact zone, at
   *  half opacity. Both sides of a pair paint one, so the seam shows the two
   *  pictures' local colours literally averaged — a guaranteed-smooth wash
   *  over any hard crossing edge, independent of warp and erosion. Defaults
   *  to 1.6x `blur`; 0 disables the layer. */
  seamBlur?: number
}

export interface EvolveOptions {
  /** Spring driving the liquid mass's centre. Default 320 / 17. */
  massStiffness?: number
  massDamping?: number
  /** Spring driving width/height. Default 170 / 11.5. */
  sizeStiffness?: number
  sizeDamping?: number
  /** Spring driving the corner radius. Default 900 / 60 — stiff and
   *  overdamped, so the element's own border-radius transition timing shows
   *  through instead of the spring imposing its own. Soften it to make the
   *  corners lag the element. */
  radiusStiffness?: number
  radiusDamping?: number
  /** Max content cross-blur during the morph, px. 0 disables. Default 7. */
  contentBlur?: number
  /** 0..1 — how strongly the blob rounds into a droplet while morphing. Default 1. */
  roundness?: number
  /** Corner-forming timeline: starts at the very beginning of the morph and
   *  runs droplet-round → target radius over `cornerDuration` ms with
   *  `cornerEase` (a cubic-bezier(...) string, 'ease-in-out' or 'linear'),
   *  after `cornerDelay` ms. No motion gating — tweak duration/easing and it
   *  behaves like a normal animation. Defaults 460 / 0 / smooth. */
  cornerDuration?: number
  cornerDelay?: number
  cornerEase?: string
  /** Ms the travel lead takes to ramp in — how EAGERLY the droplet commits to
   *  the destination. 0 leads instantly; it never scales the reach.
   *  Default 90. */
  anticipation?: number
  /** Px the mass centre leads ahead of the element — how FAR the droplet
   *  travels toward the destination before it inflates. 0 disables.
   *  Default 32. */
  travel?: number
}

export const EVOLVE_DEFAULTS: Required<EvolveOptions> = {
  massStiffness: 320,
  massDamping: 17,
  sizeStiffness: 170,
  sizeDamping: 11.5,
  radiusStiffness: 900,
  radiusDamping: 60,
  contentBlur: 7,
  roundness: 1,
  cornerDuration: 460,
  cornerDelay: 0,
  cornerEase: 'cubic-bezier(0.3, 1.05, 0.4, 1)',
  anticipation: 90,
  travel: 32,
}

const easeCache = new Map<string, (t: number) => number>()

/** Evaluate a CSS timing function ('cubic-bezier(...)', 'ease-in-out',
 *  'linear') at progress t — lets the engine's corner timeline match the
 *  element's CSS transition exactly. */
function easingFn(spec: string): (t: number) => number {
  let fn = easeCache.get(spec)
  if (fn) return fn
  const m = /cubic-bezier\(([^)]+)\)/.exec(spec)
  if (m) {
    const [x1, y1, x2, y2] = m[1].split(',').map(Number)
    fn = (t: number) => {
      if (t <= 0) return 0
      if (t >= 1) return 1
      let lo = 0
      let hi = 1
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        const x = 3 * mid * (1 - mid) * (1 - mid) * x1 + 3 * mid * mid * (1 - mid) * x2 + mid ** 3
        if (x < t) lo = mid
        else hi = mid
      }
      const u = (lo + hi) / 2
      return 3 * u * (1 - u) * (1 - u) * y1 + 3 * u * u * (1 - u) * y2 + u ** 3
    }
  } else if (spec === 'ease-in-out') {
    fn = easingFn('cubic-bezier(0.42, 0, 0.58, 1)')
  } else {
    fn = (t: number) => Math.min(1, Math.max(0, t))
  }
  easeCache.set(spec, fn)
  return fn
}

export interface MoveOptions {
  /** Spring pulling the liquid surface after the element. Lower stiffness /
   *  damping = a laggier, more rubbery trail. Default 380 / 18. */
  stiffness?: number
  damping?: number
  /** Max axial stretch at speed (0 = rigid). Default 0.18. */
  stretch?: number
  /** Trailing droplet size as a fraction of the body. 0 disables the tail.
   *  Default 0.46. */
  tail?: number
  /** How FAR the tail extends behind the body — the reach of the tongue,
   *  from hugging the trailing edge (0) to trailing a full extra
   *  body-length (1). Size is `tail`'s job alone. Default 0.5. */
  force?: number
  /** Vertical body bow: vertical velocity arcs the top and bottom edges —
   *  the middle leads into the motion, the ends lag, like a flexible bar
   *  pulled through liquid. 0 disables. Default 0.3. */
  bend?: number
  /** Horizontal cap deformation: horizontal velocity reshapes the rounded
   *  left/right sides — the leading cap blunts against the flow, the
   *  trailing cap stretches out, like a soft body pushed through liquid.
   *  0 disables. Default 0.3. */
  bendX?: number
}

export const MOVE_DEFAULTS: Required<MoveOptions> = {
  stiffness: 380,
  damping: 18,
  stretch: 0.18,
  tail: 0.46,
  force: 0.5,
  // Both bows are OPT-IN. As defaults they deformed every move item: the
  // sliders' circular thumbs turned egg-shaped mid-drag (cap deformation)
  // and sagged off the track's centreline (vertical bow) from nothing but
  // spring wobble in the velocity.
  bend: 0,
  bendX: 0,
}

export interface ItemDynamics {
  /** Liquid surface springs behind size/shape changes and settles like jelly. */
  evolve: boolean
  /** Surface lags the moving element and stretches with velocity — liquid rubber. */
  move: boolean
  /** Resolved evolve tuning; falls back to EVOLVE_DEFAULTS. */
  evolveOpts?: Required<EvolveOptions>
  /** Resolved move tuning; falls back to MOVE_DEFAULTS. */
  moveOpts?: Required<MoveOptions>
}

export interface ObservedTarget {
  target: HTMLElement
  blob: SVGRectElement
  radius?: number
  /** Px to shrink the blob on every side relative to the element — lets an
   *  opaque element (e.g. a round photo) fully cover its own liquid so white
   *  only appears as the merge bridge. */
  blobInset?: number
  /** Px the blob swells back OUT (beyond blobInset) as the item nears a
   *  neighbour — an opaque element visibly grows a liquid coat that necks
   *  into the other surface, instead of merging invisibly behind itself. */
  bridgeGrow?: number
  blend?: BlendConfig
  dynamics?: ItemDynamics
}

interface Frame {
  x: number
  y: number
  w: number
  h: number
}

interface MeltEntry {
  el: HTMLImageElement
  /** One rect per melt layer, all fed by the same image pattern. */
  rects: SVGRectElement[]
  pattern: SVGPatternElement
  image: SVGImageElement
  radiusPx: number
  /** Geometry sampled during the frame's READ pass (group coordinates).
   *  Measuring lazily inside the write pass meant every item's mask write
   *  invalidated layout for the next item's read — one forced synchronous
   *  layout per item per frame. */
  measured: { x: number; y: number; w: number; h: number; ow: number; oh: number } | null
  /** True once the pattern feeds a pre-downscaled copy (see downscaleHref). */
  lowRes: boolean
  /** Last geometry + mask written, so unchanged frames stay DOM-silent. */
  lastGeom: string | null
  lastHole: string | null
}

interface MeltLayer {
  /** Compact fingerprint of the last values written to this layer's filter
   *  primitives — a matching frame skips every write, so WebKit does not
   *  re-rasterize the layer at all. */
  last?: string
  /** The layer's <filter>; its region is resized per frame to the melt zone. */
  filter: SVGElement
  disp: SVGElement
  blurEl: SVGElement
  erode: SVGElement
  /** The noise source — baseFrequency is re-aimed per frame so the field is
   *  elongated ALONG the flow (melting drips), not isotropic swirl. */
  turb: SVGElement
  /** Scrolls the shared noise field so the liquid churns over time. */
  noiseOffset: SVGElement
  circle: SVGCircleElement
  gl: SVGGElement
  shift: SVGGElement
}

/** Two graded warp layers sharing one noise field: a wide, gentle ripple and
 *  a tight, strong core — the melt reads as one continuous liquid that gets
 *  progressively deeper toward the contact point. */
/** Melt layers ordered outermost → innermost. Blur, warp and erosion ramp
 *  smoothly across them and each is masked to a progressively tighter radius,
 *  so the stack reads as a continuous gradient rather than discrete bands. */
interface MeltRefs {
  layers: MeltLayer[]
  entries: MeltEntry[]
  /** The seam-blend layer: the item's imagery drawn once more through a
   *  plain heavy blur, masked to the contact zone, at half opacity. Both
   *  sides of a pair paint one, so the seam shows the two pictures' local
   *  colours literally averaged — the guaranteed-smooth base the turbulence
   *  layers then texture. Null when the item was built without it. */
  seam: {
    gl: SVGGElement
    filter: SVGElement
    blurEl: SVGElement
    circle: SVGCircleElement
    last?: string
  } | null
}

/** How many stacked layers approximate the gradient. */
const MELT_LAYERS = 3

/** Total length of the corner timeline (delay + duration). */
function cornerTotalOf(eo: Required<EvolveOptions>): number {
  return Math.max(0, eo.cornerDelay) + Math.max(1, eo.cornerDuration)
}

/** Clamp a CSS corner radius for use as an SVG rect `rx`.
 *
 *  SVG clamps `rx` to w/2 and `ry` (defaulted from rx) to h/2 INDEPENDENTLY,
 *  so a large radius on a wide short box — the `border-radius: 999px` pill
 *  idiom — degenerates into an ellipse. Clamping to min(w,h)/2 keeps it a
 *  true pill, matching how CSS renders the same value. */
function pillRadius(r: number, w: number, h: number): number {
  return Math.max(0, Math.min(r, Math.min(w, h) / 2))
}

/** Centre-based liquid body: the mass's centre leads, size follows, corner
 *  radius adapts last — the order real liquid reads as. */
interface Sim {
  cx: number
  cy: number
  w: number
  h: number
  r: number
  vcx: number
  vcy: number
  vw: number
  vh: number
  vr: number
}

interface Item extends ObservedTarget {
  baseW: number
  baseH: number
  radiusPx: number
  last: Frame | null
  frame: Frame | null
  lastBlend: { cx: number; cy: number; s: number; d: number; pk: string } | null
  melt: MeltRefs | null
  sim: Sim | null
  /** Peak-hold envelope of morph motion: rises instantly, decays smoothly —
   *  keeps roundness/blur monotone through the springs' settle oscillations. */
  motionEnv: number
  /** Previous target centre + smoothed target velocity, for anticipation. */
  tPrev: { cx: number; cy: number } | null
  tvx: number
  tvy: number
  /** Ramp-in envelope for the travel lead, 0..1, timed by `anticipation`. */
  lead01: number
  /** Corner timeline: morph start time + target-size change tracking. */
  cornerT0: number
  lastTargetMoveT: number
  lastTargetSize: { w: number; h: number } | null
  /** Latch: a morph is in progress, so the corner timeline can't restart. */
  morphActive: boolean
  /** Rate-limited droplet-roundness value — glides, never steps. */
  round01: number
  /** Trailing droplet for move items: a laggier satellite the goo filter
   *  strings into a teardrop tail while the element is in motion. */
  tailEl: SVGCircleElement | null
  /** Two intermediate droplets between body and main satellite — the taper
   *  that keeps the tail reading as one organic tongue, not a lone circle. */
  tailMidA: SVGCircleElement | null
  tailMidB: SVGCircleElement | null
  /** Wobble phase, advanced by distance travelled (not wall time), so the
   *  mid-droplets weave slightly and the tail never looks die-cut. */
  tailPhase: number
  /** Smoothed body-bow displacements (px): Y arcs top/bottom edges,
   *  X arcs left/right. */
  bendCur: number
  bendCurX: number
  /** Path that replaces the rect while the body is bowed — a rect cannot
   *  arc, so the bend renders as a real curved silhouette. */
  bendPathEl: SVGPathElement | null
  lastBendD: string | null
  /** Last "--lg-bend-x,--lg-bend-y" write, to skip redundant style sets. */
  lastBendVars: string | null
  tailX: number
  tailY: number
  tailVx: number
  tailVy: number
  tailR: number
  /** True while an evolve morph has a motion blur written onto the target. */
  contentBlurred: boolean
  /** Last values painted to the blob by the dynamics branch. Writes are
   *  skipped when unchanged: the 300ms asleep-check calls writeBlob too, and
   *  an unconditional setAttribute — even with an identical value — dirties
   *  the SVG filter, which Safari answers by re-rasterizing the whole filter
   *  region. A settled sim must be DOM-silent. */
  lastPaint: { t: string; w: string; h: string; rx: string } | null
  /** Last tail-circle write ('hidden' when parked at r=0), same reason. */
  lastTail: string | null
  /** Last effective blob inset written (bridgeGrow makes it proximity-driven). */
  lastBi: number
  /** Time-smoothed bridgeGrow inset; null until the first frame seeds it. */
  biSmooth: number | null
  /** Smoothed melt strength: fast attack, gradual release-time decay. */
  meltFade: number
  /** In-flight release: start strength + elapsed ms, so the fade completes in
   *  exactly `releaseMs` instead of chasing zero forever. */
  meltRel: { from: number; t: number } | null
  /** Smoothed overlay opacity — carries the progressive release fade, and
   *  keeps a re-approach mid-fade from popping back to full. */
  meltOp: number
  /** Accumulated noise-drift phase — makes the liquid churn. */
  meltPhase: number
  /** Previous frame position, to gate the churn on actual movement. */
  meltPrev: { x: number; y: number } | null
  /** Last contact geometry, so the fading tail keeps its position. */
  meltGeom: { o: Frame } | null
  /** performance.now() of the last melt layer/entry write pass — writes back
   *  off to ~28fps when the frame clock degrades (see frameEma), because each
   *  one re-rasterizes turbulence filters, which WebKit runs on the CPU. */
  meltWroteAt: number
  /** Dominant flow axis of the anisotropic noise ('x' = features elongated
   *  horizontally), held with hysteresis — re-aiming exactly at |gux|==|guy|
   *  flipped the whole texture 90° on every crossing of the diagonal while
   *  dragging around the contact, a hard visible flicker. */
  meltAxis: 'x' | 'y' | null
  /** Last host opacity/transform written. */
  meltHostLast: string | null
  ro: ResizeObserver
}

/** Semi-implicit Euler spring step; returns [position, velocity]. */
function springStep(
  cur: number,
  vel: number,
  target: number,
  k: number,
  c: number,
  dt: number,
): [number, number] {
  const a = k * (target - cur) - c * vel
  const v = vel + a * dt
  return [cur + v * dt, v]
}

/** Spring advance over a WALL-CLOCK dt, substepped at ≤1/60s so the
 *  integration stays stable no matter how long the frame gap was.
 *
 *  The loop used to clamp dt to 1/24 per FRAME instead: at Safari's worst
 *  (~1 paint per 2s under filter load) the simulation then advanced 42ms per
 *  2000ms of wall time — everything ran in ~50x slow motion, so timed melt
 *  releases visibly never finished (avatars stayed erased) and silhouettes
 *  trailed their elements by seconds. Time must follow the wall clock; only
 *  the integration STEP is capped. */
function springSteps(
  cur: number,
  vel: number,
  target: number,
  k: number,
  c: number,
  dt: number,
): [number, number] {
  let n = Math.max(1, Math.ceil(dt * 60))
  const h = dt / n
  let p = cur
  let v = vel
  while (n-- > 0) {
    const step = springStep(p, v, target, k, c, h)
    p = step[0]
    v = step[1]
  }
  return [p, v]
}

/** Quantize a value so near-identical frames produce IDENTICAL strings and
 *  the dirty-checks can skip the DOM write — WebKit re-rasterizes a filter's
 *  whole region on any primitive-attribute write, identical value or not. */
function q(v: number, step: number): number {
  return Math.round(v / step) * step
}

const SVG_NS = 'http://www.w3.org/2000/svg'
let meltCounter = 0

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

/** Shared per-group measurement loop for observe-mode items: mirrors externally
 *  animated elements onto their blobs each frame, then sleeps entirely once
 *  nothing has moved for ~half a second. MutationObserver + transition /
 *  animation events + a slow safety tick wake it, so idle cost is zero.
 *
 *  Items opted into contact blur additionally get a liquid melt at the point
 *  where they touch a neighbour: their images are re-rendered as SVG shapes
 *  warped by a turbulence displacement field — edges bend and smear like two
 *  materials merging — while the originals' edges dissolve under them. */
/** Pre-downscaled copy of an <img> for the melt patterns. The pattern draws
 *  its source at display size on EVERY filter-graph execution — megapixel
 *  photos inside a 40px avatar meant layers x entries full-resolution
 *  rescales per animated frame, a dominant slice of the melt's cost on
 *  WebKit's CPU rasterizer. The copy keeps 3x the display size (device
 *  pixels on a 3x phone plus warp-stretch headroom), so nothing visible is
 *  lost. Returns null when the image is not decodable yet, is already
 *  small, or would taint the canvas (cross-origin) — caller keeps the
 *  original then. */
function downscaleHref(el: HTMLImageElement): string | null {
  try {
    if (!el.complete || !el.naturalWidth) return null
    const dw = Math.max(2, Math.min(el.naturalWidth, Math.round((el.offsetWidth || 40) * 3)))
    const dh = Math.max(2, Math.min(el.naturalHeight, Math.round((el.offsetHeight || 40) * 3)))
    if (el.naturalWidth <= dw * 1.5) return null
    const cv = document.createElement('canvas')
    cv.width = dw
    cv.height = dh
    const c2 = cv.getContext('2d')
    if (!c2) return null
    // Mirror `preserveAspectRatio: slice`: cover-crop, centred.
    const scale = Math.max(dw / el.naturalWidth, dh / el.naturalHeight)
    const sw = dw / scale
    const sh = dh / scale
    c2.drawImage(el, (el.naturalWidth - sw) / 2, (el.naturalHeight - sh) / 2, sw, sh, 0, 0, dw, dh)
    return cv.toDataURL()
  } catch {
    return null
  }
}

export class ObserveEngine {
  /** Goo blur of the owning group; used to derive the default blend range. */
  gooBlur = 6

  private items = new Set<Item>()
  private awake = false
  private clean = 0
  private raf = 0
  private sourcesReady = false
  private mo: MutationObserver | null = null
  private interval: ReturnType<typeof setInterval> | null = null
  private removeListeners: Array<() => void> = []

  constructor(private getGroup: () => HTMLElement | null) {}

  add(t: ObservedTarget): () => void {
    const item: Item = {
      ...t,
      baseW: t.target.offsetWidth || 1,
      baseH: t.target.offsetHeight || 1,
      radiusPx: this.resolveRadius(t),
      last: null,
      frame: null,
      lastBlend: null,
      melt: null,
      sim: null,
      motionEnv: 0,
      tPrev: null,
      tvx: 0,
      tvy: 0,
      lead01: 0,
      cornerT0: 0,
      lastTargetMoveT: 0,
      lastTargetSize: null,
      morphActive: false,
      round01: 0,
      tailEl: null,
      tailMidA: null,
      tailMidB: null,
      tailPhase: 0,
      bendCur: 0,
      bendCurX: 0,
      bendPathEl: null,
      lastBendD: null,
      lastBendVars: null,
      tailX: 0,
      tailY: 0,
      tailVx: 0,
      tailVy: 0,
      tailR: 0,
      contentBlurred: false,
      lastPaint: null,
      lastTail: null,
      lastBi: t.blobInset ?? 0,
      biSmooth: null,
      meltFade: 0,
      meltRel: null,
      meltOp: 1,
      meltPhase: 0,
      meltPrev: null,
      meltGeom: null,
      meltWroteAt: 0,
      meltAxis: null,
      meltHostLast: null,
      ro: new ResizeObserver(() => {
        item.baseW = t.target.offsetWidth || 1
        item.baseH = t.target.offsetHeight || 1
        item.radiusPx = this.resolveRadius(t)
        this.syncMelt(item)
        this.wake()
      }),
    }
    item.ro.observe(t.target)
    this.items.add(item)
    this.refreshMelt(item)
    if (t.dynamics?.move) {
      // Painted before (below) the main blob; the goo merge does the rest.
      // Three circles: main satellite plus two tapering mid-droplets, so the
      // merged silhouette is a tongue that thins organically, not one disc.
      const tail = svg('circle', { cx: '0', cy: '0', r: '0' })
      const midA = svg('circle', { cx: '0', cy: '0', r: '0' })
      const midB = svg('circle', { cx: '0', cy: '0', r: '0' })
      t.blob.parentNode?.insertBefore(tail, t.blob)
      t.blob.parentNode?.insertBefore(midA, t.blob)
      t.blob.parentNode?.insertBefore(midB, t.blob)
      item.tailEl = tail
      item.tailMidA = midA
      item.tailMidB = midB
      const bendPath = svg('path', { d: '' }) as SVGPathElement
      t.blob.parentNode?.insertBefore(bendPath, t.blob)
      item.bendPathEl = bendPath
    }
    this.ensureSources()
    this.measureAll()
    this.wake()
    return () => {
      item.ro.disconnect()
      this.items.delete(item)
      this.clearBlend(item)
      if (item.contentBlurred) item.target.style.removeProperty('filter')
      item.tailEl?.remove()
      item.tailMidA?.remove()
      item.tailMidB?.remove()
      item.bendPathEl?.remove()
    }
  }

  wake = (): void => {
    this.clean = 0
    if (this.awake || this.items.size === 0) return
    this.awake = true
    this.raf = requestAnimationFrame(this.loop)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.mo?.disconnect()
    this.removeListeners.forEach(off => off())
    this.removeListeners = []
    if (this.interval) clearInterval(this.interval)
    this.items.forEach(i => i.ro.disconnect())
    this.items.clear()
    this.awake = false
    this.sourcesReady = false
  }

  private resolveRadius(t: ObservedTarget): number {
    if (t.radius != null) return t.radius
    return measureRadius(t.target, t.target.offsetWidth, t.target.offsetHeight)[0]
  }

  /** (Re)build the warped-image SVG structure for a melt item. Two graded
   *  warp layers share ONE noise field (same frequency + seed): a wide gentle
   *  ripple and a tight strong core. Same field, different displacement
   *  scales → the layers align and read as a single liquid getting deeper
   *  toward the contact. The noise frequency is derived from the melt zone,
   *  so several ripple wavelengths fit across it — a fixed low frequency
   *  displaces the whole zone as one chunk, which reads as a shifted ghost
   *  copy instead of liquid. */
  /** Resize response. The melt DOM only needs REBUILDING when the set of
   *  images changes; a resize alone just makes the cached corner radii stale.
   *
   *  Rebuilding on every resize tore down and recreated three turbulence
   *  filters plus a pattern + <image> per photo, and WebKit re-decodes and
   *  re-rasterises all of it synchronously. The pill resizes the moment the
   *  hover gap opens — i.e. exactly as the flight begins — so that landed as
   *  a ~120ms main-thread stall. CSS transitions keep running on the
   *  compositor through a stall, but the silhouette is written from this
   *  loop, so the liquid froze while the content sailed on: the timing
   *  mismatch, and it never showed in Chromium because the rebuild is cheap
   *  enough there to fit in a frame. */
  private syncMelt(item: Item): void {
    if (!item.blend) return
    const melt = item.melt
    const t = item.target
    const imgs =
      t instanceof HTMLImageElement
        ? [t]
        : (Array.from(t.querySelectorAll('img')) as HTMLImageElement[])
    const same =
      !!melt &&
      melt.entries.length === imgs.length &&
      melt.entries.every((e, i) => e.el === imgs[i])
    if (!same) {
      this.refreshMelt(item)
      return
    }
    for (const entry of melt.entries) {
      entry.radiusPx = measureRadius(entry.el, entry.el.offsetWidth, entry.el.offsetHeight)[0]
      // Geometry is re-derived from the new radius on the next write.
      entry.lastGeom = null
    }
  }

  private refreshMelt(item: Item): void {
    const blend = item.blend
    if (!blend) return
    const host = blend.host
    while (host.firstChild) host.removeChild(host.firstChild)
    const t = item.target
    const imgs =
      t instanceof HTMLImageElement
        ? [t]
        : (Array.from(t.querySelectorAll('img')) as HTMLImageElement[])
    const uid = `gooey-melt-${++meltCounter}`
    const seed = String((meltCounter * 7) % 100)
    const zone = blend.zone ?? this.gooBlur * 2.2 + 4
    const freqK = Math.max(0.2, blend.warpFreq ?? 1)
    const bf = Math.min(0.3, Math.max(0.01, freqK / (zone * 1.1))).toFixed(4)
    const octaves = String(Math.max(1, Math.round(blend.detail ?? 2)))
    const noiseType = blend.warpStyle ?? 'fractalNoise'

    const defs = svg('defs', {})
    const gradient = svg('radialGradient', { id: `${uid}-g` })
    gradient.append(
      // Long, smooth falloff: the melt reads as a gradient from intact rim
      // to fully mixed core, not as a disc with a soft edge.
      // Core-to-mid FULLY opaque, rim tight. Two failure modes shaped this:
      // a translucent middle let the white silhouette neck glow through the
      // copy right at the seam (a bright ring/dot wherever the goo bridges
      // dark imagery — the neck sits between the photos' rounded corners, so
      // nothing else can cover it), and a half-opaque rim let the copy's
      // blurred imagery drift far past the neck, reading as fog over a
      // contrasting neighbour. Opaque to 55%, then a fast falloff.
      svg('stop', { offset: '0%', 'stop-color': '#fff' }),
      svg('stop', { offset: '55%', 'stop-color': '#fff' }),
      svg('stop', { offset: '78%', 'stop-color': '#fff', 'stop-opacity': '0.55' }),
      svg('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': '0' }),
    )
    defs.append(gradient)

    const mkLayer = (suffix: string) => {
      // Region in USER SPACE, resized per frame to the melt zone (see the
      // write pass). As a %-of-bbox region it covered the whole group — and
      // feTurbulence is generated on the CPU across the entire region, so the
      // cost scaled with the group, not with the small area the mask actually
      // reveals. That was the ~110ms main-thread stall at the start of a
      // flight: the content kept moving on the compositor while this loop —
      // which writes the silhouette — was blocked, so the liquid visibly fell
      // behind the UI.
      const filter = svg('filter', {
        id: `${uid}-f${suffix}`,
        filterUnits: 'userSpaceOnUse',
        x: '0',
        y: '0',
        width: '0',
        height: '0',
        'color-interpolation-filters': 'sRGB',
      })
      const turb = svg('feTurbulence', {
        type: noiseType,
        baseFrequency: bf,
        numOctaves: octaves,
        seed,
        result: 'noise0',
      })
      filter.append(turb)
      // Scrolling the noise field (rather than re-seeding, which jumps) makes
      // the liquid churn continuously while the surfaces are held together.
      const noiseOffset = svg('feOffset', { in: 'noise0', dx: '0', dy: '0', result: 'noise' })
      const disp = svg('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'noise',
        scale: '0',
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'disp',
      })
      filter.append(noiseOffset)
      const blurEl = svg('feGaussianBlur', { in: 'disp', stdDeviation: '0', result: 'soft' })
      // Melted material reads as concentrated pigment, not fog.
      const sat = svg('feColorMatrix', {
        in: 'soft',
        type: 'saturate',
        values: '1.2',
        result: 'col',
      })
      // Two-liquid mixing WITHOUT painting anything: threshold the same noise
      // into an alpha map and clip the melted copy with it, so the image
      // breaks into tendrils and the liquid already behind shows through the
      // gaps. Identity by default (alpha = 1 everywhere).
      const erode = svg('feColorMatrix', {
        in: 'noise',
        type: 'matrix',
        values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1',
        result: 'erode',
      })
      const clip = svg('feComposite', { in: 'col', in2: 'erode', operator: 'in' })
      filter.append(disp, blurEl, sat, erode, clip)
      const mask = svg('mask', {
        id: `${uid}-m${suffix}`,
        maskUnits: 'userSpaceOnUse',
        x: '-10000',
        y: '-10000',
        width: '20000',
        height: '20000',
      })
      const circle = svg('circle', { cx: '0', cy: '0', r: '0', fill: `url(#${uid}-g)` })
      mask.append(circle)
      defs.append(filter, mask)
      // `filter` and `mask` MUST live on separate elements. SVG orders them
      // filter → mask, so masking a filtered layer should clip the blur to
      // the contact zone; with both on ONE <g>, WebKit effectively masks
      // first and then blurs, so the melt's blurred copy bleeds far outside
      // its zone and paints a washed-out blob over whatever is next to it —
      // the neighbouring avatar "disappearing" in Safari while Chromium (which
      // orders them per spec) renders the identical values correctly.
      // Outer <g> owns the mask + opacity, inner <g> owns the filter, so the
      // order is unambiguous in every engine.
      const gl = svg('g', {})
      gl.setAttribute('mask', `url(#${uid}-m${suffix})`)
      gl.setAttribute('opacity', '0')
      const filtered = svg('g', {})
      filtered.setAttribute('filter', `url(#${uid}-f${suffix})`)
      const shift = svg('g', {})
      filtered.append(shift)
      gl.append(filtered)
      return { filter, disp, blurEl, erode, turb, noiseOffset, circle, gl, shift }
    }
    // Outermost first so inner (stronger) layers paint on top.
    const layers = Array.from({ length: MELT_LAYERS }, (_, i) => mkLayer(`l${i}`))
    host.append(defs, ...layers.map(l => l.gl))

    // Seam-blend layer, UNDER the turbulence layers: the imagery through a
    // plain heavy blur, masked to the contact zone, at half opacity. Blur is
    // local colour-averaging, and with both sides of a pair painting one,
    // the seam renders the two pictures' tones literally averaged — the
    // guaranteed-smooth base the turbulence layers then texture. Plain blur
    // only: no turbulence to re-rasterize, so it is cheap per frame.
    let seam: NonNullable<MeltRefs['seam']> | null = null
    if ((blend.seamBlur ?? 1) > 0) {
      const filter = svg('filter', {
        id: `${uid}-fs`,
        filterUnits: 'userSpaceOnUse',
        x: '0',
        y: '0',
        width: '0',
        height: '0',
        'color-interpolation-filters': 'sRGB',
      })
      const blurEl = svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '0' })
      filter.append(blurEl)
      const mask = svg('mask', {
        id: `${uid}-ms`,
        maskUnits: 'userSpaceOnUse',
        x: '-10000',
        y: '-10000',
        width: '20000',
        height: '20000',
      })
      const circle = svg('circle', { cx: '0', cy: '0', r: '0', fill: `url(#${uid}-g)` })
      mask.append(circle)
      defs.append(filter, mask)
      const gl = svg('g', {})
      gl.setAttribute('mask', `url(#${uid}-ms)`)
      gl.setAttribute('opacity', '0')
      const filtered = svg('g', {})
      filtered.setAttribute('filter', `url(#${uid}-fs)`)
      gl.append(filtered)
      // Under the turbulence layers: base wash first, texture on top.
      host.insertBefore(gl, defs.nextSibling)
      seam = { gl, filter, blurEl, circle: circle as SVGCircleElement }
    }

    const entries: MeltEntry[] = imgs.map((el, i) => {
      const pattern = svg('pattern', {
        id: `${uid}-p${i}`,
        patternUnits: 'userSpaceOnUse',
        x: '0',
        y: '0',
        width: '1',
        height: '1',
      })
      const image = svg('image', { width: '1', height: '1', preserveAspectRatio: 'xMidYMid slice' })
      image.setAttribute('href', el.currentSrc || el.src)
      pattern.append(image)
      defs.append(pattern)
      const rects = layers.map(l => {
        const rect = svg('rect', { x: '0', y: '0', width: '0', height: '0', fill: `url(#${uid}-p${i})` })
        l.shift.append(rect)
        return rect
      })
      // The seam rect joins entry.rects, so the per-frame geometry writer
      // positions it exactly like the turbulence layers' rects.
      if (seam) {
        const rect = svg('rect', { x: '0', y: '0', width: '0', height: '0', fill: `url(#${uid}-p${i})` })
        seam.gl.firstElementChild!.append(rect)
        rects.push(rect)
      }
      const radiusPx = measureRadius(el, el.offsetWidth, el.offsetHeight)[0]
      return {
        el,
        rects,
        pattern,
        image,
        radiusPx,
        lowRes: false,
        measured: null,
        lastGeom: null,
        lastHole: null,
      }
    })

    host.setAttribute('opacity', '0')
    item.melt = { layers, entries, seam }

    // surface: 'image' — the LIQUID ITSELF is made of the image, not of the
    // group fill. The blob is pattern-filled with the item's own imagery
    // (objectBoundingBox, so the pattern rides the blob with zero per-frame
    // bookkeeping), and the goo filter's blur then mixes both bodies' colours
    // wherever their blobs merge: the neck becomes a gradient of the two
    // images' local tones — colour averaging by the same blur that builds
    // the neck — instead of a strip of bare surface material.
    if (blend.surface === 'image' && imgs[0]) {
      const bp = svg('pattern', {
        id: `${uid}-bp`,
        patternUnits: 'objectBoundingBox',
        patternContentUnits: 'objectBoundingBox',
        width: '1',
        height: '1',
      })
      const bpImage = svg('image', {
        width: '1',
        height: '1',
        preserveAspectRatio: 'xMidYMid slice',
      })
      bpImage.setAttribute('href', imgs[0].currentSrc || imgs[0].src)
      bp.append(bpImage)
      defs.append(bp)
      item.blob.setAttribute('fill', `url(#${uid}-bp)`)
    } else {
      // Back to inheriting the group fill if a rebuild dropped the mode.
      item.blob.removeAttribute('fill')
    }
  }

  /** Remove all melt traces: hide the warped overlay, restore image masks. */
  private clearBlend(item: Item): void {
    item.blend?.host.setAttribute('opacity', '0')
    // The DOM no longer matches the caches — drop them all, or the next melt
    // would skip the writes that re-apply the state.
    item.meltHostLast = null
    item.meltWroteAt = 0
    item.meltAxis = null
    for (const layer of item.melt?.layers ?? []) layer.last = undefined
    if (item.melt?.seam) {
      item.melt.seam.last = undefined
      item.melt.seam.gl.setAttribute('opacity', '0')
    }
    for (const entry of item.melt?.entries ?? []) {
      entry.el.style.removeProperty('mask-image')
      entry.el.style.removeProperty('-webkit-mask-image')
      entry.el.style.removeProperty('mask-composite')
      entry.el.style.removeProperty('-webkit-mask-composite')
      entry.lastHole = null
      entry.lastGeom = null
    }
  }

  private lastNow = 0

  /** EMA of the raw frame interval (ms) — the melt write pass consults it to
   *  pick its cadence: every frame while the clock is healthy, backed off to
   *  ~28fps when frames are dropping (WebKit under CPU-raster load is exactly
   *  the case that degrades the clock). Seeded at 60Hz-healthy. */
  private frameEma = 17

  private loop = (now: number): void => {
    if (this.items.size === 0) {
      this.awake = false
      this.lastNow = 0
      return
    }
    // WALL-CLOCK dt (capped only against tab-switch gaps): timed fades and
    // smoothing must complete in real time even when paints are slow —
    // springs handle large dt via substepping (see springSteps).
    const dt = this.lastNow ? Math.min(0.25, Math.max(1 / 240, (now - this.lastNow) / 1000)) : 1 / 60
    if (this.lastNow) {
      // Spikes clamped so one GC hitch doesn't flip the cadence for long.
      this.frameEma += (Math.min(now - this.lastNow, 80) - this.frameEma) * 0.12
    }
    this.lastNow = now
    if (this.measureAll(dt)) this.clean = 0
    else this.clean++
    if (this.clean > 30) {
      this.awake = false
      this.lastNow = 0
      return
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private measureAll(dt = 1 / 60): boolean {
    const group = this.getGroup()
    if (!group || this.items.size === 0) return false
    const g = group.getBoundingClientRect()
    let changed = false
    // ONE read pass, before any write. bridgeGrow proximity needs every
    // neighbour's frame before any blob is written — and the melt entries must
    // be measured here too: reading them lazily inside writeBlend meant each
    // item's mask-image write invalidated layout for the next item's read, so
    // a 4-item group forced four synchronous layouts every frame. Safari pays
    // for those far more than Chromium does, which is most of why the same
    // component ran smooth in one and stuttered in the other.
    for (const item of this.items) {
      const r = item.target.getBoundingClientRect()
      item.frame = { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height }
    }
    for (const item of this.items) {
      if (!item.blend || !item.melt) continue
      for (const entry of item.melt.entries) {
        const ir = entry.el.getBoundingClientRect()
        entry.measured = {
          x: ir.left - g.left,
          y: ir.top - g.top,
          w: ir.width,
          h: ir.height,
          ow: entry.el.offsetWidth,
          oh: entry.el.offsetHeight,
        }
      }
    }
    for (const item of this.items) {
      if (this.writeBlob(item, dt)) changed = true
    }
    for (const item of this.items) {
      if (item.blend && this.writeBlend(item, dt)) changed = true
    }
    return changed
  }

  /** Effective blob inset: bridgeGrow pulls it toward negative (a visible
   *  liquid coat) as the nearest neighbour approaches.
   *
   *  Smoothed on a time constant rather than tracking proximity instantly.
   *  The raw value is a function of the dragged neighbour's position, so it
   *  moves as fast as the pointer does and lands on a different value every
   *  frame; the blob grows symmetrically from it, so that per-frame step is
   *  visible on the silhouette's far edge as a size flicker. It stayed small
   *  enough to read as smooth at 60fps, but a frame-rate drop multiplies the
   *  per-frame delta — which is why the pill's left edge flashed in Safari
   *  and not in Chromium. dt-based smoothing makes the growth rate identical
   *  at any frame rate. */
  private effectiveInset(item: Item, dt: number): number {
    let bi = item.blobInset ?? 0
    const grow = item.bridgeGrow ?? 0
    if (grow > 0 && item.frame) {
      const f = item.frame
      const range = Math.max(14, this.gooBlur * 3)
      let best = Infinity
      for (const other of this.items) {
        if (other === item || !other.frame) continue
        const o = other.frame
        const dx = Math.max(o.x - (f.x + f.w), f.x - (o.x + o.w), 0)
        const dy = Math.max(o.y - (f.y + f.h), f.y - (o.y + o.h), 0)
        const gap = Math.hypot(dx, dy)
        if (gap < best) best = gap
      }
      if (best < range) bi -= grow * smoothstep(1 - best / range)
    }
    if (grow <= 0) {
      item.biSmooth = bi
      return bi
    }
    if (item.biSmooth === null) item.biSmooth = bi
    else item.biSmooth += (bi - item.biSmooth) * Math.min(1, dt * 18)
    return item.biSmooth
  }

  private writeBlob(item: Item, dt: number): boolean {
    const f = item.frame!
    const dyn = item.dynamics
    if (!dyn || (!dyn.evolve && !dyn.move)) {
      const bi = this.effectiveInset(item, dt)
      const last = item.last
      const frameChanged =
        !last ||
        Math.abs(last.x - f.x) >= 0.05 ||
        Math.abs(last.y - f.y) >= 0.05 ||
        Math.abs(last.w - f.w) >= 0.05 ||
        Math.abs(last.h - f.h) >= 0.05
      const biChanged = Math.abs(bi - item.lastBi) >= 0.05
      if (!frameChanged && !biChanged) return false
      item.blob.style.transform = `translate(${f.x + bi}px, ${f.y + bi}px)`
      if (frameChanged || biChanged) {
        const bw = Math.max(0, f.w - bi * 2)
        const bh = Math.max(0, f.h - bi * 2)
        item.blob.setAttribute('width', String(bw))
        item.blob.setAttribute('height', String(bh))
        // CSS border-radius doesn't scale with transforms, but the rendered
        // corner does — track it through the rect/layout-width ratio.
        const scale = item.baseW > 0 ? f.w / item.baseW : 1
        item.blob.setAttribute('rx', String(pillRadius(item.radiusPx * scale - bi, bw, bh)))
      }
      // This branch bypasses the dynamics paint cache — drop it so a later
      // dynamics frame can't mistake the DOM for already matching.
      item.lastPaint = null
      item.last = f
      item.lastBi = bi
      return true
    }

    // Liquid dynamics: the surface is a simulated body chasing the element.
    // Centre-based on purpose: the mass's CENTRE moves first (fast spring),
    // size follows on a slower jelly spring, corner radius adapts last —
    // liquid flows to where it's going before it takes the new shape.
    const tcx = f.x + f.w / 2
    const tcy = f.y + f.h / 2
    // Evolve re-measures the element's border-radius every frame, so the
    // element's OWN css transition timing (duration/easing) shows through on
    // the liquid surface. A one-time snapshot would ignore it entirely.
    let tr: number
    if (dyn.evolve) {
      // measureRadius already resolves the CURRENT radius for the CURRENT
      // box (px values pass through as-is; % values resolve against the
      // ow/oh passed in) — no further scaling is needed or correct here.
      // The previous version additionally multiplied by (f.w / ow): the
      // getBoundingClientRect width (f.w, float) vs offsetWidth (ow, an
      // independently-rounded integer) differ by sub-pixel noise on every
      // animation frame, especially under Safari's own layout rounding
      // during a live width transition. That near-1.0 ratio contributed
      // nothing functionally but injected exactly that noise into the
      // radius spring's target — which a near-critically-damped spring
      // tracks almost instantly, i.e. visible per-frame jitter ("flashing")
      // on the rendered corner.
      const ow = item.target.offsetWidth
      const oh = item.target.offsetHeight
      tr = measureRadius(item.target, ow, oh)[0]
    } else {
      tr = item.radiusPx * (item.baseW > 0 ? f.w / item.baseW : 1)
    }
    if (!item.sim) {
      item.sim = { cx: tcx, cy: tcy, w: f.w, h: f.h, r: tr, vcx: 0, vcy: 0, vw: 0, vh: 0, vr: 0 }
    }
    const s = item.sim
    if (dyn.move) {
      // Lag + wobble: liquid rubber trailing the element.
      const mo = dyn.moveOpts ?? MOVE_DEFAULTS
      ;[s.cx, s.vcx] = springSteps(s.cx, s.vcx, tcx, mo.stiffness, mo.damping, dt)
      ;[s.cy, s.vcy] = springSteps(s.cy, s.vcy, tcy, mo.stiffness, mo.damping, dt)
    } else if (dyn.evolve) {
      // Mass moves first: springs can only chase, so aim AHEAD of the moving
      // target by its (smoothed) velocity — the droplet travels toward the
      // destination while still small, then the size catches up.
      const eo = dyn.evolveOpts ?? EVOLVE_DEFAULTS
      const rawVx = item.tPrev ? (tcx - item.tPrev.cx) / dt : 0
      const rawVy = item.tPrev ? (tcy - item.tPrev.cy) / dt : 0
      item.tvx = item.tvx * 0.7 + rawVx * 0.3
      item.tvy = item.tvy * 0.7 + rawVy * 0.3
      item.tPrev = { cx: tcx, cy: tcy }
      // Lead direction: the target's own velocity while it is moving, else
      // whatever distance the droplet still has to cover.
      const remX = tcx - s.cx
      const remY = tcy - s.cy
      const rem = Math.hypot(remX, remY)
      const vMag = Math.hypot(item.tvx, item.tvy)
      let dx = 0
      let dy = 0
      if (vMag > 1e-3) {
        dx = item.tvx / vMag
        dy = item.tvy / vMag
      } else if (rem > 1e-3) {
        dx = remX / rem
        dy = remY / rem
      }
      // `anticipation` only times the ramp-in; it must never scale the reach,
      // or a small value would silently cancel `travel`.
      const tau = Math.max(0, eo.anticipation) / 1000
      const k = tau > 0 ? 1 - Math.exp(-dt / tau) : 1
      item.lead01 += ((rem > 0.5 ? 1 : 0) - item.lead01) * k
      // Clamping the reach to the remaining distance keeps the lead from
      // pulling the spring target past the destination as it arrives.
      const reach = Math.min(Math.max(0, eo.travel) * item.lead01, rem)
      const ox = dx * reach
      const oy = dy * reach
      ;[s.cx, s.vcx] = springSteps(s.cx, s.vcx, tcx + ox, eo.massStiffness, eo.massDamping, dt)
      ;[s.cy, s.vcy] = springSteps(s.cy, s.vcy, tcy + oy, eo.massStiffness, eo.massDamping, dt)
    } else {
      s.cx = tcx
      s.cy = tcy
      s.vcx = 0
      s.vcy = 0
    }
    if (dyn.evolve) {
      // Size adapts after the mass, radius after the size.
      const eo = dyn.evolveOpts ?? EVOLVE_DEFAULTS
      ;[s.w, s.vw] = springSteps(s.w, s.vw, f.w, eo.sizeStiffness, eo.sizeDamping, dt)
      ;[s.h, s.vh] = springSteps(s.h, s.vh, f.h, eo.sizeStiffness, eo.sizeDamping, dt)
      // Default near-critical damping: the corner radius must land without
      // bouncing — the roundness envelope already supplies the liquid overshoot.
      ;[s.r, s.vr] = springSteps(s.r, s.vr, tr, eo.radiusStiffness, eo.radiusDamping, dt)
    } else {
      s.w = f.w
      s.h = f.h
      s.r = tr
      s.vw = 0
      s.vh = 0
      s.vr = 0
    }
    let extra = ''
    const speed = Math.hypot(s.vcx, s.vcy)
    if (dyn.move && speed > 2) {
      // Mild stretch along the velocity axis — the drop shape itself comes
      // from the trailing satellite below, not from squashing the body into
      // an ellipse.
      const st = Math.min((dyn.moveOpts ?? MOVE_DEFAULTS).stretch, speed * 0.0006)
      const a = Math.round(Math.atan2(s.vcy, s.vcx) * 100) / 100
      extra += ` rotate(${a}rad) scale(${(1 + st).toFixed(3)}, ${(1 / (1 + st * 0.65)).toFixed(3)}) rotate(${-a}rad)`
    }
    if (dyn.move && item.tailEl) {
      // Trailing droplet: chases the body's centre on a laggier spring and
      // swells with speed — the goo filter strings body + satellite into a
      // moving-drop silhouette with a liquid tail. The lag is clamped so the
      // satellite always overlaps the body's blur field: a small circle on
      // its own sits below the goo alpha threshold and would simply vanish.
      const round = (v: number) => Math.round(v * 10) / 10
      if (item.tailR === 0 && Math.abs(item.tailX) < 0.001 && Math.abs(item.tailY) < 0.001) {
        item.tailX = s.cx
        item.tailY = s.cy
      }
      ;[item.tailX, item.tailVx] = springSteps(item.tailX, item.tailVx, s.cx, 170, 22, dt)
      ;[item.tailY, item.tailVy] = springSteps(item.tailY, item.tailVy, s.cy, 170, 22, dt)
      const bi = item.blobInset ?? 0
      // The droplet belongs to the SIDE it trails from, and it has to clear
      // that side to be seen at all. Both were wrong for a non-square body:
      // sizing off min(w,h) made a wide card's tail as small as its short
      // edge, and capping the lag at that same number kept the droplet
      // buried inside a 246px-wide card — invisible however large the knob.
      // Perpendicular extent sets the SIZE (a horizontal drag trails the
      // card's height, a vertical one its width), and the lag cap clears the
      // body's own half-extent along the motion.
      const ux = speed > 0.001 ? s.vcx / speed : 1
      const uy = speed > 0.001 ? s.vcy / speed : 0
      const perp = Math.max(4, Math.abs(ux) * s.h + Math.abs(uy) * s.w - bi * 2)
      const halfAlong = (Math.abs(ux) * s.w + Math.abs(uy) * s.h) / 2
      const base = perp / 2
      const lagX = item.tailX - s.cx
      const lagY = item.tailY - s.cy
      const lag = Math.hypot(lagX, lagY)
      // `force` = the tongue's reach: how far past the body's trailing edge
      // the satellite may lag before being dragged along.
      const mo = dyn.moveOpts ?? MOVE_DEFAULTS
      const maxLag = halfAlong + base * (0.2 + mo.force * 1.6)
      if (lag > maxLag) {
        item.tailX = s.cx + (lagX / lag) * maxLag
        item.tailY = s.cy + (lagY / lag) * maxLag
      }
      // Growth is RELATIVE, not a fixed px-per-speed slope. An absolute
      // slope is a size cap in disguise: a wide card trailing its 246px
      // side needed ~2000px/s before the droplet finished growing, so it
      // stayed a pebble at any human drag speed. The droplet now reaches
      // its full size — `tail` x the trailing side's half-extent, so tail 1
      // is a drop as big as the side it leaves — at a reachable ~400px/s,
      // whatever the body's dimensions.
      const tailK = mo.tail
      // Size is not speed-scaled: once the drag is genuinely moving, the
      // tail is at its full `tail`-fraction of the trailing side (tail 1 =
      // the whole side). The short onset ramp only stops it popping in on
      // micro-jitters; reach/extension is `force`'s job above.
      const onset = Math.max(0, Math.min(1, (speed - 20) / 120))
      const targetR = base * tailK * onset
      item.tailR += (targetR - item.tailR) * Math.min(1, dt * 10)

      if (item.tailR < 0.3) {
        if (item.lastTail !== 'hidden') {
          item.tailEl.setAttribute('r', '0')
          item.tailMidA?.setAttribute('r', '0')
          item.tailMidB?.setAttribute('r', '0')
          item.lastTail = 'hidden'
        }
      } else {
        // Wobble phase rides distance travelled, so it freezes when the
        // drag pauses instead of idling on wall time.
        item.tailPhase += speed * dt * 0.045
        // Mid-droplets sit at 45% and 75% of the way out, tapering, each
        // nudged off-axis in opposite directions — the merged tongue gets a
        // slight S-curve and stops reading as a plain circle chain.
        const wob = item.tailR * 0.16
        const px = -uy
        const py = ux
        const w1 = Math.sin(item.tailPhase) * wob
        const w2 = Math.sin(item.tailPhase + 2.4) * -wob
        const aX = s.cx + lagX * 0.45 + px * w1
        const aY = s.cy + lagY * 0.45 + py * w1
        const bX = s.cx + lagX * 0.75 + px * w2
        const bY = s.cy + lagY * 0.75 + py * w2
        const tail =
          `${round(item.tailX)},${round(item.tailY)},${round(item.tailR)},` +
          `${round(aX)},${round(aY)},${round(bX)},${round(bY)}`
        if (tail !== item.lastTail) {
          item.tailEl.setAttribute('cx', String(round(item.tailX)))
          item.tailEl.setAttribute('cy', String(round(item.tailY)))
          item.tailEl.setAttribute('r', String(round(item.tailR)))
          if (item.tailMidA) {
            item.tailMidA.setAttribute('cx', String(round(aX)))
            item.tailMidA.setAttribute('cy', String(round(aY)))
            item.tailMidA.setAttribute('r', String(round(item.tailR * 0.62)))
          }
          if (item.tailMidB) {
            item.tailMidB.setAttribute('cx', String(round(bX)))
            item.tailMidB.setAttribute('cy', String(round(bY)))
            item.tailMidB.setAttribute('r', String(round(item.tailR * 0.4)))
          }
          item.lastTail = tail
        }
      }
    }
    let renderR = Math.max(0, s.r)
    let cornerActive = false
    if (dyn.evolve) {
      const eo = dyn.evolveOpts ?? EVOLVE_DEFAULTS
      const now = performance.now()
      // Corner timeline: detect a morph beginning (target size starts
      // changing after a quiet spell) and run droplet-round → target radius
      // over the configured duration/easing/delay, starting at t=0 of the
      // morph — a normal animation, no motion gating.
      const prevSize = item.lastTargetSize
      const sizeDelta = prevSize ? Math.abs(f.w - prevSize.w) + Math.abs(f.h - prevSize.h) : 0
      // LATCHED trigger: the timeline starts once per morph and cannot
      // restart until the size has been still AND the timeline has finished.
      // A gap-based test ("no size change for 120ms → new morph") restarts
      // mid-morph whenever frames are delivered irregularly — which Safari
      // does under filter repaints — and each restart snaps the corners back
      // to fully round, reading as flashing.
      if (sizeDelta > 0.5) {
        if (!item.morphActive) {
          item.cornerT0 = now
          item.morphActive = true
        }
        item.lastTargetMoveT = now
      } else if (
        item.morphActive &&
        now - item.lastTargetMoveT > 150 &&
        now - item.cornerT0 > cornerTotalOf(eo)
      ) {
        item.morphActive = false
      }
      item.lastTargetSize = { w: f.w, h: f.h }
      const cornerTotal = cornerTotalOf(eo)
      let target01 = 0
      if (item.cornerT0 > 0 && eo.roundness > 0 && now - item.cornerT0 < cornerTotal) {
        const p = Math.min(
          1,
          Math.max(0, (now - item.cornerT0 - Math.max(0, eo.cornerDelay)) / Math.max(1, eo.cornerDuration)),
        )
        const eased = easingFn(eo.cornerEase)(p)
        target01 = Math.min(1, Math.max(0, (1 - eased) * eo.roundness))
      }
      // Rate-limit the roundness so it GLIDES to the timeline value instead of
      // stepping: at morph start the timeline jumps to full round — invisible
      // when opening from a circle, a hard snap when closing from a card.
      const maxStep = dt * 8
      item.round01 += Math.max(-maxStep, Math.min(maxStep, target01 - item.round01))
      cornerActive =
        (item.cornerT0 > 0 && now - item.cornerT0 < cornerTotal + 80) ||
        Math.abs(target01 - item.round01) > 0.004 ||
        item.round01 > 0.004
      if (item.round01 > 0.001) {
        // The boost may only RAISE the radius above the spring value: when the
        // size spring undershoots, min(w,h)/2 can fall below the corner radius
        // and would drag it down — that reads as the corners pulsing.
        const roundTarget = Math.max(Math.min(s.w, s.h) / 2, renderR)
        renderR = renderR + (roundTarget - renderR) * item.round01
        // And never dip below the destination radius on the way down. (Safe
        // unconditionally: SVG clamps rx to half the rect on its own.)
        renderR = Math.max(renderR, tr)
      }
      // Content cross-blur still follows physical motion.
      const motionRaw = Math.min(
        1,
        (Math.hypot(s.vcx, s.vcy) + Math.abs(s.vw) + Math.abs(s.vh)) / 420,
      )
      item.motionEnv = Math.max(motionRaw, item.motionEnv - dt * 1.9)
      const motion = item.motionEnv
      const blurPx = motion * motion * Math.max(0, eo.contentBlur)
      if (blurPx > 0.3) {
        item.target.style.filter = `blur(${blurPx.toFixed(1)}px)`
        item.contentBlurred = true
      } else if (item.contentBlurred) {
        item.target.style.removeProperty('filter')
        item.contentBlurred = false
      }
    }
    const bi = item.blobInset ?? 0
    const bw = Math.max(0, s.w - bi * 2)
    const bh = Math.max(0, s.h - bi * 2)
    const paintRx = pillRadius(renderR - bi, bw, bh)
    // Body bow, two independent axes: vertical velocity arcs the top and
    // bottom edges (middle leads, ends lag), horizontal velocity arcs the
    // left and right edges — each behind its own knob. A rect cannot arc,
    // so while bowed the silhouette is drawn as a path with the affected
    // edges curved, and the rect is parked at zero size.
    let bendD = ''
    if (dyn.move && item.bendPathEl) {
      const mo = dyn.moveOpts ?? MOVE_DEFAULTS
      const cap = Math.min(bw, bh) * 0.5
      const bTy = Math.max(-cap, Math.min(cap, s.vcy * 0.05)) * mo.bend
      // The cap deformation reads at larger amplitudes than the bow, so the
      // horizontal axis gets a higher ceiling and a hotter velocity slope.
      const capX = Math.min(bw, bh) * 0.9
      const bTx = Math.max(-capX, Math.min(capX, s.vcx * 0.09)) * mo.bendX
      item.bendCur += (bTy - item.bendCur) * Math.min(1, dt * 9)
      item.bendCurX += (bTx - item.bendCurX) * Math.min(1, dt * 9)
      // Expose the live bend to the content as CSS vars, so the DOM inside
      // can lean with the liquid (the silhouette arcs; real elements can
      // only translate/skew, so the content chooses its own response).
      const bvx = Math.round(item.bendCurX * 10) / 10
      const bvy = Math.round(item.bendCur * 10) / 10
      const bendVars = `${bvx},${bvy}`
      if (bendVars !== item.lastBendVars) {
        item.target.style.setProperty('--lg-bend-x', `${bvx}px`)
        item.target.style.setProperty('--lg-bend-y', `${bvy}px`)
        // Unitless twins: CSS calc() cannot turn px into deg, so rotation/
        // skew/scale responses need the raw numbers.
        item.target.style.setProperty('--lg-bend-xn', String(bvx))
        item.target.style.setProperty('--lg-bend-yn', String(bvy))
        item.lastBendVars = bendVars
      }
      const bendActive = Math.abs(item.bendCur) > 0.5 || Math.abs(item.bendCurX) > 0.5
      if (bendActive && bw > 1 && bh > 1) {
        const r = Math.min(paintRx, bw / 2, bh / 2)
        // Vertical bow: quadratic sag b at the edge midpoint (control 2b).
        const cy = Math.round(item.bendCur * 2 * 10) / 10
        // Horizontal "bend" on a pill can't bow the side edges — they are
        // zero-length between the corner arcs, so a curve there only shoves
        // the caps sideways. Real physics deforms the CAPS instead: the
        // leading cap blunts against the flow (shorter horizontal extent),
        // the trailing cap stretches out behind, roughly twice as far.
        const k = item.bendCurX
        const rxR = Math.max(r * 0.2, Math.min(r * 3, k > 0 ? r - 0.8 * k : r + 1.6 * -k))
        const rxL = Math.max(r * 0.2, Math.min(r * 3, k > 0 ? r + 1.6 * k : r - 0.8 * -k))
        // Quarter-circle as cubic: control offset 0.5523 x the radius.
        const K = 0.5523
        const f = (v: number) => Math.round(v * 10) / 10
        bendD =
          `M ${f(rxL)} 0 Q ${f(bw / 2)} ${cy} ${f(bw - rxR)} 0 ` +
          `C ${f(bw - rxR + K * rxR)} 0 ${f(bw)} ${f(r - K * r)} ${f(bw)} ${f(r)} ` +
          `L ${f(bw)} ${f(bh - r)} ` +
          `C ${f(bw)} ${f(bh - r + K * r)} ${f(bw - rxR + K * rxR)} ${f(bh)} ${f(bw - rxR)} ${f(bh)} ` +
          `Q ${f(bw / 2)} ${f(bh + item.bendCur * 2)} ${f(rxL)} ${f(bh)} ` +
          `C ${f(rxL - K * rxL)} ${f(bh)} 0 ${f(bh - r + K * r)} 0 ${f(bh - r)} ` +
          `L 0 ${f(r)} ` +
          `C 0 ${f(r - K * r)} ${f(rxL - K * rxL)} 0 ${f(rxL)} 0 Z`
      }
    }
    const bending = bendD !== ''
    const paint = {
      t: `translate(${s.cx - s.w / 2 + bi}px, ${s.cy - s.h / 2 + bi}px)` + extra,
      w: bending ? '0' : String(bw),
      h: String(bh),
      rx: String(paintRx),
    }
    const lp = item.lastPaint
    if (!lp || lp.t !== paint.t) item.blob.style.transform = paint.t
    if (!lp || lp.w !== paint.w) item.blob.setAttribute('width', paint.w)
    if (!lp || lp.h !== paint.h) item.blob.setAttribute('height', paint.h)
    if (!lp || lp.rx !== paint.rx) item.blob.setAttribute('rx', paint.rx)
    item.lastPaint = paint
    if (item.bendPathEl) {
      if (bendD !== (item.lastBendD ?? '')) {
        item.bendPathEl.setAttribute('d', bendD)
        item.lastBendD = bendD
      }
      if (bending) item.bendPathEl.style.transform = paint.t
    }
    item.last = f
    const settled =
      Math.abs(s.cx - tcx) < 0.05 &&
      Math.abs(s.cy - tcy) < 0.05 &&
      Math.abs(s.w - f.w) < 0.05 &&
      Math.abs(s.h - f.h) < 0.05 &&
      Math.abs(s.r - tr) < 0.05 &&
      speed < 1 &&
      Math.abs(s.vw) + Math.abs(s.vh) + Math.abs(s.vr) < 1 &&
      item.motionEnv < 0.01 &&
      item.tailR < 0.3 &&
      !cornerActive
    return !settled
  }

  /** Nearest-neighbour proximity → a liquid warp-melt at the contact point.
   *  The strength is ONE smoothed value: fast attack while approaching, and
   *  a gradual `releaseMs` decay whenever the target drops — whether from a
   *  drag release (`active: false`), moving out of range, or absorption. No
   *  path clears instantly. */
  private writeBlend(item: Item, dt: number): boolean {
    const f = item.frame!
    const blend = item.blend!
    const melt = item.melt
    if (!melt) return false
    // Melt range tracks where the goo bridge actually forms (~2.5x the goo
    // blur) — melting before surfaces visually neck reads as a bug.
    const range = blend.range ?? Math.max(10, this.gooBlur * 2.5)
    let bestGap = Infinity
    let bestOther: Frame | null = null
    for (const other of this.items) {
      if (other === item || !other.frame) continue
      const o = other.frame
      const dx = Math.max(o.x - (f.x + f.w), f.x - (o.x + o.w), 0)
      const dy = Math.max(o.y - (f.y + f.h), f.y - (o.y + o.h), 0)
      const gap = Math.hypot(dx, dy)
      if (gap < bestGap) {
        bestGap = gap
        bestOther = o
      }
    }
    // How far INSIDE the neighbour this piece has travelled. `bestGap` is an
    // outside distance and clamps to 0 the instant the boxes touch, so on its
    // own it cannot tell "just met" from "buried" — everything past first
    // contact looks identical to it. Overlap depth is the missing half of the
    // measurement: the shallower of the two axis overlaps, which is how deep
    // the piece has actually sunk rather than how much area happens to
    // intersect. Normalized by the SMALLER body, since that is the most
    // overlap the pair can ever produce, so 1 means fully engulfed and the
    // two items agree on the number from either side.
    let embed = 0
    /** Longest axis of the overlap rect — how much SEAM the pair currently
     *  shares. The photo-edge erasure must scale with this: a hole sized to
     *  the melt zone is a dot on a 40px seam, and everything past it stays a
     *  razor-sharp photo edge cutting across the neighbour. */
    let contactSpan = 0
    if (bestOther && bestGap === 0) {
      const o = bestOther
      const ox = Math.min(f.x + f.w, o.x + o.w) - Math.max(f.x, o.x)
      const oy = Math.min(f.y + f.h, o.y + o.h) - Math.max(f.y, o.y)
      const span = Math.max(1, Math.min(f.w, f.h, o.w, o.h))
      embed = Math.max(0, Math.min(ox, oy)) / span
      contactSpan = Math.max(0, Math.max(ox, oy))
    }
    // Target strength from proximity and activity; squared smoothstep biases
    // the ramp late — barely anything at first neck.
    let sTarget = 0
    if (bestOther && bestGap < range && blend.active !== false) {
      // FULL strength while bridged, soft only at the entry: the melt used to
      // keep ramping across the whole range (0.34 at half range), so a long
      // goo neck carried only ghost-faint imagery — the taffy strand read as
      // bare liquid with two weak stubs. A strand exists exactly while the
      // neck does, and it should be as saturated mid-flight as at contact;
      // the outer 35% of the range remains the fade-in so approach still
      // reads as gradual.
      const sRaw = smoothstep(Math.min(1, (1 - bestGap / range) / 0.65))
      // Strength is a CEILING, not a linear scale: even at full contact the
      // melt cannot exceed it, but it still ramps the same way on approach —
      // scaling sRaw itself would also slow the ramp, reading as "farther
      // away" rather than "weaker".
      const strength = Math.max(0, Math.min(1, blend.strength ?? 1))
      // Sink-out: the melt belongs to the seam, so it recedes as the seam is
      // swallowed. The ramp begins as soon as the piece is properly overlapping
      // rather than merely touching, and is finished by `sink` — well before
      // the piece is buried, since by then it reads as joined, not melting.
      // Smoothstep at both ends so neither the onset nor the finish shows an
      // edge as the piece is dragged in and out.
      const sink = Math.max(0.01, blend.sink ?? 0.45)
      const sunk = smoothstep(
        Math.max(0, Math.min(1, (embed - sink * 0.2) / Math.max(0.01, sink * 0.8))),
      )
      sTarget = Math.pow(sRaw, 1.25) * strength * (1 - sunk)
    }
    // Asymmetric smoothing: quick attack; the release is a TIMED fade that
    // reaches the target in exactly `releaseMs`. An exponential chase here
    // needs ~4.4 time constants to clear its threshold, so a 110ms release
    // still had the image masked ~490ms later — and whenever the consumer
    // removed the element mid-tail (an avatar landing in its slot), the
    // residual dissolve hole popped off in a single frame.
    if (sTarget >= item.meltFade) {
      item.meltFade += (sTarget - item.meltFade) * Math.min(1, dt * 16)
      item.meltRel = null
    } else if (sTarget > 0.02) {
      // In-range fluctuation (pointer jitter, slow retreat): a gentle chase
      // down, NOT the evaporation pipeline. Engaging the timed release here
      // started the opacity fade mid-hover — the dissolve visibly vanished
      // while still necking, then popped back on re-approach.
      item.meltFade += (sTarget - item.meltFade) * Math.min(1, dt * 6)
      item.meltRel = null
    } else {
      // The melt lives until BOTH the structural release and the opacity
      // fade are done, so `fadeMs` can outlast `releaseMs` and give a long,
      // clearly readable evaporation.
      const relMs = Math.max(
        40,
        Math.max(blend.releaseMs ?? 240, blend.fadeMs ?? blend.releaseMs ?? 240),
      )
      if (!item.meltRel) item.meltRel = { from: item.meltFade, t: 0 }
      const rel = item.meltRel
      rel.t += dt * 1000
      const k = Math.min(1, rel.t / relMs)
      // (1-k)^2: fast start, gentle tail — the exponential's look, but it
      // lands on an exact zero instead of an asymptote.
      item.meltFade = sTarget + (rel.from - sTarget) * (1 - k) * (1 - k)
    }
    if (sTarget === 0 && item.meltFade < 0.001) item.meltFade = 0
    const s = item.meltFade
    if (s <= 0.001) {
      if (item.lastBlend && item.lastBlend.s !== 0) {
        this.clearBlend(item)
        item.lastBlend = { cx: 0, cy: 0, s: 0, d: 0, pk: '' }
        return true
      }
      return false
    }
    // Geometry: fresh while in contact; while the tail fades out of range,
    // keep melting around the LAST contact point.
    let o = bestOther
    if ((!o || bestGap >= range) && item.meltGeom) o = item.meltGeom.o
    if (!o) return false
    const cx =
      f.x + f.w < o.x
        ? (f.x + f.w + o.x) / 2
        : o.x + o.w < f.x
          ? (o.x + o.w + f.x) / 2
          : (Math.max(f.x, o.x) + Math.min(f.x + f.w, o.x + o.w)) / 2
    const cy =
      f.y + f.h < o.y
        ? (f.y + f.h + o.y) / 2
        : o.y + o.h < f.y
          ? (o.y + o.h + f.y) / 2
          : (Math.max(f.y, o.y) + Math.min(f.y + f.h, o.y + o.h)) / 2
    item.meltGeom = { o: { ...o } }
    // Progressive release: OPACITY leads, STRUCTURE lags. Scaling warp and
    // blur down with the strength made the copy un-warp while still opaque —
    // the image visibly "snapped back to normal" before disappearing.
    // Instead the melt keeps most of its liquid character (structure relaxes
    // only ~45%) and EVAPORATES: the overlay's opacity rides the timed
    // release curve to zero, while the original image restores in sync with
    // the true strength `s`.
    const rel = item.meltRel
    // Opacity runs on its OWN clock (`fadeMs`), not on the strength ratio —
    // that tied the fade to `releaseMs`, so at the tuned 110ms release it was
    // over before it could be read as a fade at all.
    const fadeMs = Math.max(40, blend.fadeMs ?? blend.releaseMs ?? 240)
    const fadeK = rel ? Math.min(1, rel.t / fadeMs) : 0
    // Eased so it leaves gently instead of stepping off at a constant rate.
    const relFade = rel ? (1 - fadeK) * (1 - fadeK) : 1
    const sStruct = rel ? Math.min(1, rel.from * (0.55 + 0.45 * (1 - fadeK))) : s
    const eStruct = sStruct * sStruct * (3 - 2 * sStruct)
    // Falling follows the timed curve EXACTLY — it is already smooth, and a
    // lagging chase here left the overlay at ~0.4 opacity when the fade hit
    // zero and clearBlend cut it off: a visible pop at the very end. Only a
    // re-approach mid-fade ramps, so opacity can't jump back to full.
    item.meltOp =
      relFade < item.meltOp
        ? relFade
        : item.meltOp + (relFade - item.meltOp) * Math.min(1, dt * 16)
    // Melt zone sized like the goo bridge (from the group's blur), growing a
    // little as contact deepens, and never swallowing the whole element —
    // only the part around the contact mixes; the rest stays intact.
    const zone = blend.zone ?? this.gooBlur * 2.2 + 4
    const d = Math.min(Math.min(f.w, f.h) * 0.9, zone * (0.7 + 0.6 * sStruct))
    // Churn phase, gated on ACTUAL movement: liquid only flows while the
    // element is being dragged — a held drag freezes, and churn scales with
    // drag speed.
    const flowSpeed = Math.max(0, blend.flowSpeed ?? 26)
    const prevPos = item.meltPrev
    const moveSpeed = prevPos
      ? Math.hypot(f.x - prevPos.x, f.y - prevPos.y) / Math.max(1e-3, dt)
      : 0
    item.meltPrev = { x: f.x, y: f.y }
    // Phase advance capped per frame: dt is wall-clock, and after a slow
    // frame a full-dt advance would visibly teleport the noise field.
    const phaseAdv = Math.min(dt, 1 / 24) * flowSpeed * 0.12 * Math.min(1, moveSpeed / 40)
    item.meltPhase += phaseAdv
    const lb = item.lastBlend
    // Live-tunable params join the still-frame check: without them a slider
    // change on a static pose (the tuning workflow) never re-ran the writes
    // and the knob looked dead until the next drag.
    const paramKey = `${blend.seamBlur ?? ''}/${blend.strength ?? ''}/${blend.warp}/${blend.blur}/${blend.mix ?? ''}/${blend.gravity ?? ''}`
    if (
      phaseAdv < 1e-4 &&
      lb &&
      lb.pk === paramKey &&
      Math.abs(lb.cx - cx) < 0.05 &&
      Math.abs(lb.cy - cy) < 0.05 &&
      Math.abs(lb.s - s) < 0.005 &&
      Math.abs(lb.d - d) < 0.05
    ) {
      return false
    }
    // Write cadence, ADAPTIVE on frame health. Every write below dirties a
    // turbulence/displacement filter, and WebKit re-rasterizes those on the
    // CPU — at full frame rate on a struggling device the paint loop drowns
    // (measured: ~1 paint per 2s in the iOS simulator). But a fixed 35ms
    // throttle on a healthy 60Hz clock quantizes to every THIRD frame: the
    // warped copy held still while the dragged photo glided, then hopped
    // 3-5px to catch up — a 20Hz strobe that reads as the dissolve
    // flickering during any in-contact move. So: while the frame clock is
    // healthy the overlay is written every frame and tracks the photo
    // exactly; when frames drop (the CPU-raster case the throttle protects)
    // the 35ms backoff re-engages by itself. The simulation state above is
    // already advanced either way; only the DOM flush waits. The active flag
    // stays true so the loop keeps ticking.
    const nowMs = performance.now()
    if (this.frameEma > 20 && nowMs - item.meltWroteAt < 35) return true
    item.meltWroteAt = nowMs
    const round = (v: number) => Math.round(v * 10) / 10
    const host = blend.host

    const n = melt.layers.length

    // Gravity direction: toward the NEIGHBOUR's centre.
    const ncx = o.x + o.w / 2
    const ncy = o.y + o.h / 2
    const gdx = ncx - cx
    const gdy = ncy - cy
    const gdl = Math.hypot(gdx, gdy) || 1
    const gux = gdx / gdl
    const guy = gdy / gdl
    const gAmt = Math.max(0, blend.gravity ?? 25) * eStruct
    const gDeg = round((Math.atan2(guy, gux) * 180) / Math.PI)
    const r3 = (v: number) => Math.round(v * 1000) / 1000
    const taper = Math.max(0, Math.min(1, blend.taper ?? 0.65))

    // MELTING is anisotropic: real melt drips ALONG the flow. Elongate the
    // noise features along the dominant gravity axis (low frequency along,
    // high across) so the displacement forms streaks/drips instead of an
    // isotropic swirl. Re-aimed only when the dominant axis flips.
    const freqK = Math.max(0.2, blend.warpFreq ?? 1)
    const zoneBase = blend.zone ?? this.gooBlur * 2.2 + 4
    const bfBase = Math.min(0.3, Math.max(0.01, freqK / (zoneBase * 1.1)))
    const alongF = (bfBase * 0.35).toFixed(4)
    const acrossF = (bfBase * 1.6).toFixed(4)
    // Dominant axis held with HYSTERESIS: re-aiming exactly at |gux|==|guy|
    // rotated the whole noise field 90° on every crossing of the diagonal —
    // dragging around the contact wobbles the gravity vector across it
    // repeatedly, and each flip re-generates the turbulence: a hard texture
    // flicker. The axis only flips once the other component clearly wins.
    const ax = Math.abs(gux)
    const ay = Math.abs(guy)
    const axis: 'x' | 'y' =
      item.meltAxis === 'x'
        ? ay > ax * 1.25 ? 'y' : 'x'
        : item.meltAxis === 'y'
          ? ax > ay * 1.25 ? 'x' : 'y'
          : ax >= ay ? 'x' : 'y'
    item.meltAxis = axis
    const bfStr = axis === 'x' ? `${alongF} ${acrossF}` : `${acrossF} ${alongF}`

    // Progressive melt: every layer shares one noise field (so they stay in
    // phase and read as a single liquid) but blur, warp and erosion ramp
    // smoothly from the zone's rim to its core, each masked to a tighter
    // radius. Stacked, that approximates a continuous gradient — a two-step
    // version banded visibly once blur got large.
    //
    // All masks are CONCENTRIC and centred AT the seam (tiny bias toward the
    // neighbour): the warped imagery must cover the white liquid bridge, and
    // with two melting items their copies overlap and interleave in the neck
    // — colour mixes with colour. Centred into the item instead, the copies
    // hugged their own edge and the neck showed as bare white fog between
    // them. Pointiness comes from the content's gravity stretch — a
    // per-layer pushed disc separates from the body and shows a detached
    // circular fragment.
    const bx = cx + gux * d * 0.05
    const by = cy + guy * d * 0.05
    // Every value below is QUANTIZED before writing, and each layer keeps a
    // fingerprint of its last-written values: a frame that lands on the same
    // quantized values skips the layer's writes entirely, so its turbulence
    // filter is not re-rasterized. The steps are chosen below what the soft
    // noise can visually resolve.
    const layerVals: string[][] = melt.layers.map((_, i) => {
      const t = n > 1 ? i / (n - 1) : 1 // 0 = outermost rim, 1 = tip
      // Outer layer carries REAL warp (0.45, was 0.2): the rim of the melt is
      // what the eye reads as the image's own edge bending — a calm rim made
      // the surface look rigid with only the core swirling. Blur floor is up
      // for the same reason: blur is local colour-averaging, and the taffy
      // look wants the strand smoothed into blended tones over its whole
      // length, not just at the tip.
      const blurK = 0.15 + 0.85 * Math.pow(t, 1.4)
      const warpK = 0.45 + 0.55 * t
      const pr = 0.7 + 0.45 * t
      const oa = 6 * Math.sin(item.meltPhase * pr)
      const ob = 2 * Math.sin(item.meltPhase * pr * 1.31 + 1.7)
      return [
        String(q(blend.warp * warpK * eStruct, 0.25)),
        String(q(blend.blur * blurK * eStruct, 0.25)),
        String(q(gux * oa - guy * ob, 0.5)),
        String(q(guy * oa + gux * ob, 0.5)),
        String(q(bx, 0.5)),
        String(q(by, 0.5)),
        // Outermost disc at 0.95d, not 1.15d: past d the copy has left the
        // neck entirely, and its blurred rim smearing onto the neighbour's
        // body was half of the white-fog-ring report (the other half was the
        // gradient rim above).
        String(q(d * (0.95 - 0.55 * t), 0.5)),
        String(q(Math.min(1, eStruct * (0.75 + 0.25 * t)), 0.02)),
      ]
    })
    // (The single fingerprint-guarded write pass for the layers sits below,
    // once the shift transform and erosion row are computable too — they
    // dirty the same filters, so they must share the fingerprint.)
    // Anchored stretch, NOT translation: scaling from the trailing edge of
    // the melt zone keeps the warped copy aligned with the original at the
    // back (a translated copy shows its silhouette as an offset ghost ring),
    // while its leading side streams toward the pill by up to `gravity` px.
    const anchorX = cx - gux * d
    const anchorY = cy - guy * d
    // Taper now shapes the STRETCH (how sharply content is drawn out toward
    // the pill) rather than mask geometry.
    // Gap-aware: while the bodies are APART the copies must travel the whole
    // neck to meet mid-strand — that meeting is what mixes the two images
    // into averaged tones along the bridge. The old 0.6 cap stopped the
    // stretch at the seam, so a long neck stayed bare liquid with two short
    // stubs of imagery at its ends.
    // Stretch dies as the bodies MERGE: it exists to carry imagery across a
    // neck, and once the pieces overlap there is no neck to cross — the same
    // stretch then just paints a scaled ghost of the image over its own crisp
    // photo (misaligned edges, the "grown image" look). Gone by ~45% embed.
    // Floored, not zeroed. Killing the stretch outright on overlap also
    // disconnected `gravity` in exactly the phase where the melt is supposed
    // to run deepest — max gravity did nothing once the cards touched. The
    // ghost-over-own-photo problem it was guarding against is now handled at
    // the source: the leading edge is feathered away by the cross-fade, so
    // there is no crisp edge left for a stretched copy to double.
    const settle = 1 - 0.45 * smoothstep(Math.min(1, embed * 2.2))
    const kFlow =
      Math.min(2.2, (gAmt + bestGap) / Math.max(8, 2 * d)) * (0.5 + taper) * settle
    const flow = (k: number) => {
      const sx = r3(1 + kFlow * k)
      const sy = r3(1 / (1 + kFlow * 0.35 * k))
      return (
        `translate(${round(anchorX)}, ${round(anchorY)}) rotate(${gDeg}) ` +
        `scale(${sx}, ${sy}) ` +
        `rotate(${-gDeg}) translate(${round(-anchorX)}, ${round(-anchorY)})`
      )
    }
    // Two-liquid mixing by EROSION, not by painting: threshold the same noise
    // into an alpha map (alpha = k·R + c) and clip the melted copy with it.
    // The image breaks into tendrils and the liquid already behind shows
    // through the gaps — no shape is drawn, so no disc can appear. The core
    // erodes harder than the outer ripple, so mixing deepens toward the seam.
    const mixAmt = Math.max(0, Math.min(1, blend.mix ?? 0)) * eStruct
    const erodeRow = (amt: number) => {
      if (amt < 0.002) return '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1'
      // fractalNoise R sits around 0.5; a SOFT slope keeps tendril edges
      // feathered — a steep one cut the image into hard patchy fragments.
      const k = r3(1 + 4 * amt)
      const c = r3(1 - k * (0.38 + 0.12 * amt))
      return `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${k} 0 0 0 ${c}`
    }
    // ONE fingerprint-guarded write pass per layer: any single primitive
    // write re-rasterizes the layer's turbulence filter, so all of a layer's
    // values must be compared — and skipped — together.
    // Filter region: the mask only reveals a disc around the contact, so the
    // region only has to cover that disc plus however far blur/warp/gravity
    // can carry pixels into it. Quantized to 8px so small movements don't
    // re-trigger a raster.
    // The melt zone is a STRAND, not a disc, whenever the bodies are apart:
    // the mask disc is stretched along the flow axis so the revealed imagery
    // spans the whole goo neck. A circle sized to the seam left a long neck
    // as bare liquid with imagery only at its ends; sized to the neck it
    // swallowed the bodies sideways. Elongation only, width unchanged.
    const elong = q(1 + Math.min(1.8, bestGap / Math.max(8, 2 * d)), 0.05)
    const zoneT =
      elong > 1.001
        ? `translate(${round(bx)}, ${round(by)}) rotate(${gDeg}) ` +
          `scale(${r3(elong)}, 1) ` +
          `rotate(${-gDeg}) translate(${round(-bx)}, ${round(-by)})`
        : ''
    // Region grows with the elongated strand plus the stronger stretch.
    const spread = blend.blur * 2.5 + blend.warp + gAmt * 0.5 + kFlow * d + 8
    const rr = q(d * 1.15 * elong + spread, 8)
    const regionX = String(q(bx - rr, 8))
    const regionY = String(q(by - rr, 8))
    const regionW = String(q(rr * 2, 8))

    melt.layers.forEach((layer, i) => {
      const t = n > 1 ? i / (n - 1) : 1
      const v = layerVals[i]
      const shiftT = flow(0.4 + 0.6 * t)
      const erodeV = erodeRow(q(mixAmt * (0.15 + 0.85 * t), 0.01))
      const fp =
        v.join(',') + '|' + bfStr + '|' + shiftT + '|' + erodeV + '|' + zoneT +
        '|' + regionX + ',' + regionY + ',' + regionW
      if (layer.last === fp) return
      layer.last = fp
      layer.filter.setAttribute('x', regionX)
      layer.filter.setAttribute('y', regionY)
      layer.filter.setAttribute('width', regionW)
      layer.filter.setAttribute('height', regionW)
      layer.disp.setAttribute('scale', v[0])
      layer.blurEl.setAttribute('stdDeviation', v[1])
      if (layer.turb.getAttribute('baseFrequency') !== bfStr) {
        layer.turb.setAttribute('baseFrequency', bfStr)
      }
      layer.noiseOffset.setAttribute('dx', v[2])
      layer.noiseOffset.setAttribute('dy', v[3])
      layer.circle.setAttribute('cx', v[4])
      layer.circle.setAttribute('cy', v[5])
      layer.circle.setAttribute('r', v[6])
      // Mask writes don't dirty the turbulence raster — the transform rides
      // the shared fingerprint anyway so a still frame writes nothing.
      if (zoneT) layer.circle.setAttribute('transform', zoneT)
      else layer.circle.removeAttribute('transform')
      layer.gl.setAttribute('opacity', v[7])
      layer.shift.setAttribute('transform', shiftT)
      layer.erode.setAttribute('values', erodeV)
    })
    // Seam-blend layer: plain blur, no turbulence — the guaranteed-smooth
    // colour-averaging wash under the textured layers. Half opacity so a
    // pair's two washes sum to an average of both pictures at the seam.
    if (melt.seam) {
      const seam = melt.seam
      const sBlur = q((blend.seamBlur ?? blend.blur * 1.6) * eStruct, 0.25)
      const sOp = q(Math.min(1, eStruct * 1.2) * 0.55, 0.02)
      const sR = q(d * 1.25, 0.5)
      const fp =
        `${sBlur}|${sOp}|${q(bx, 0.5)},${q(by, 0.5)},${sR}|${zoneT}` +
        `|${regionX},${regionY},${regionW}`
      if (seam.last !== fp) {
        seam.last = fp
        seam.filter.setAttribute('x', regionX)
        seam.filter.setAttribute('y', regionY)
        seam.filter.setAttribute('width', regionW)
        seam.filter.setAttribute('height', regionW)
        seam.blurEl.setAttribute('stdDeviation', String(sBlur))
        seam.circle.setAttribute('cx', String(q(bx, 0.5)))
        seam.circle.setAttribute('cy', String(q(by, 0.5)))
        seam.circle.setAttribute('r', String(sR))
        if (zoneT) seam.circle.setAttribute('transform', zoneT)
        else seam.circle.removeAttribute('transform')
        seam.gl.setAttribute('opacity', String(sOp))
      }
    }
    // Gentle magnetic pull of the melted body toward the contact.
    const icx = f.x + f.w / 2
    const icy = f.y + f.h / 2
    const ang = Math.atan2(cy - icy, cx - icx)
    // Pull holds with the structure during the fade — the overlay must not
    // glide back while it evaporates.
    const pull = blend.pull * sStruct
    const hostStr =
      r3(item.meltOp).toString() +
      '|' +
      `translate(${round(Math.cos(ang) * pull)}px, ${round(Math.sin(ang) * pull)}px)`
    if (hostStr !== item.meltHostLast) {
      item.meltHostLast = hostStr
      const parts = hostStr.split('|')
      host.setAttribute('opacity', parts[0])
      host.style.transform = parts[1]
    }

    // Depth 2.2x-biased: the original's edge is FULLY erased from s ≈ 0.45 —
    // a partially faded high-contrast edge still reads as an edge, and the
    // edge must be gone as soon as the goo neck reaches it. But ONLY then:
    // the hole strength is gated on the actual bridging distance, not the
    // melt's `range` — a large range starts the warp far out (anticipation),
    // and opening the hole that early revealed the item's own white blob
    // through the erased edge as a hard pale wedge, with no neck to justify
    // it.
    const bridgeRange = Math.max(10, this.gooBlur * 2.5)
    const sBridge = bestOther
      ? bestGap < bridgeRange
        ? smoothstep(1 - bestGap / bridgeRange)
        : 0
      : s
    // Quantized alongside the geometry below, for the same reason: a new
    // alpha means a new mask string means a re-raster of every photo.
    const holeAlpha = q(Math.max(0, 1 - Math.min(s, sBridge) * 2.2), 0.05).toFixed(2)
    const holeMid = (Math.round(((1 + 2 * Number(holeAlpha)) / 3) * 20) / 20).toFixed(2)
    for (const entry of melt.entries) {
      // Swap in the downscaled pattern source once the image has decoded —
      // at mount (refreshMelt) it usually hasn't, so this must be lazy.
      if (!entry.lowRes) {
        const lo = downscaleHref(entry.el)
        if (lo) {
          entry.image.setAttribute('href', lo)
          entry.lowRes = true
        } else if (entry.el.complete && entry.el.naturalWidth) {
          entry.lowRes = true // already small, or tainted: original is final
        }
      }
      const ir = entry.measured
      if (!ir || ir.w < 1 || ir.h < 1) continue
      const ix = ir.x
      const iy = ir.y
      // Warped copy geometry (group coordinates), written to every layer.
      const kx = (ir.ow || ir.w) / ir.w
      const geom = `${round(ix)},${round(iy)},${round(ir.w)},${round(ir.h)},${round(pillRadius(entry.radiusPx / (kx || 1), ir.w, ir.h))}`
      if (geom !== entry.lastGeom) {
        entry.lastGeom = geom
        for (const rect of entry.rects) {
          rect.setAttribute('x', String(round(ix)))
          rect.setAttribute('y', String(round(iy)))
          rect.setAttribute('width', String(round(ir.w)))
          rect.setAttribute('height', String(round(ir.h)))
          rect.setAttribute(
            'rx',
            String(round(pillRadius(entry.radiusPx / (kx || 1), ir.w, ir.h))),
          )
        }
        entry.pattern.setAttribute('x', String(round(ix)))
        entry.pattern.setAttribute('y', String(round(iy)))
        entry.pattern.setAttribute('width', String(round(ir.w)))
        entry.pattern.setAttribute('height', String(round(ir.h)))
        entry.image.setAttribute('width', String(round(ir.w)))
        entry.image.setAttribute('height', String(round(ir.h)))
      }
      // Edge dissolve on the original image, imagery only — labels around it
      // stay sharp. Coordinates in the image's untransformed layout space.
      const ky = (ir.oh || ir.h) / ir.h
      // Only images the neck actually REACHES may dissolve. Relying on the
      // hole landing off-canvas is not enough: once the two items overlap
      // (a chip dragged onto the pill) the contact point sits INSIDE the
      // group, so every image in it got a live hole — including ones the
      // neck is nowhere near.
      const gapToImg = Math.hypot(
        Math.max(ix - cx, cx - (ix + ir.w), 0),
        Math.max(iy - cy, cy - (iy + ir.h), 0),
      )
      if (gapToImg > d) {
        if (entry.lastHole !== null) {
          entry.lastHole = null
          entry.el.style.removeProperty('mask-image')
          entry.el.style.removeProperty('-webkit-mask-image')
          entry.el.style.removeProperty('mask-composite')
          entry.el.style.removeProperty('-webkit-mask-composite')
        }
        continue
      }
      // The hole must always eat an EDGE, never the middle. `cx,cy` is the
      // centre of the contact SPAN, so as soon as the boxes overlap deeply it
      // lands inside a photo — a hole centred on a 32px avatar with the neck's
      // radius erases the whole face, which is the "avatars disappear while
      // dragging" report. Push the centre out to the image's own rim along the
      // contact direction, and cap the radius to that rim, so the far side of
      // every image always survives.
      const ow = ir.ow || ir.w
      const oh = ir.oh || ir.h
      const rim = Math.min(ow, oh) / 2
      let lx = (cx - ix) * kx
      let ly = (cy - iy) * ky
      let vx = lx - ow / 2
      let vy = ly - oh / 2
      const vlen = Math.hypot(vx, vy)
      if (vlen < rim) {
        if (vlen < 1e-3) {
          vx = gux
          vy = guy
        } else {
          vx /= vlen
          vy /= vlen
        }
        lx = ow / 2 + vx * rim
        ly = oh / 2 + vy * rim
      }
      // Quantized to whole pixels. Every distinct mask string makes WebKit
      // re-rasterise that <img>, and with a photo per group member this ran on
      // every frame of a drag — the dominant cost behind the main-thread
      // stalls that desynced the silhouette. The hole is a soft gradient, so
      // 1px steps are invisible, and most frames now reuse the cached string
      // and write nothing.
      const hx = Math.round(lx)
      const hy = Math.round(ly)
      // Sized to the SEAM, not just the melt zone: once the boxes overlap,
      // the shared edge is contactSpan long, and an erasure sized to the
      // zone alone leaves most of that edge as a razor-sharp photo line
      // cutting across the neighbour. Growing the hole with the span erases
      // the whole crossing edge — what shows through is the image-filled
      // blobs beneath, whose goo blur is already blending both pictures'
      // local colours, so the seam resolves as the two tones melting
      // together instead of a hard cut.
      const hd = q(
        Math.min(Math.max(d, contactSpan * 0.75) * Math.min(kx, ky), rim),
        1,
      )
      // White stops (opaque under both alpha- and luminance-mode masking), and
      // a final keep-stop that reaches the image's farthest corner. The hole's
      // own stops only span the neck, so on any image bigger than the neck
      // every pixel past them is outside the gradient's stop range: Chromium
      // extends the last colour (opaque, image intact) but WebKit paints
      // nothing there and erases the image.
      //
      // The stop is sized to the element, NOT some huge constant: WebKit sizes
      // the gradient's raster by its declared extent, so a `9999px` stop asked
      // it to rasterise an enormous buffer and cost ~130ms of main thread on
      // the frame the mask changed.
      const far =
        round(
          Math.max(
            Math.hypot(hx, hy),
            Math.hypot(hx - ow, hy),
            Math.hypot(hx, hy - oh),
            Math.hypot(hx - ow, hy - oh),
          ),
        ) + 2
      // Erasure must stay INSIDE the warped copy's coverage. The copy's mask
      // falls to ~0.25 opacity by 82% of its disc, so a hole restoring at
      // 0.8·hd left an annulus where the photo was already erased but the
      // copy was nearly gone — the white silhouette showed through as a pale
      // ring hugging the melt. Tighter stops keep the fully-erased core well
      // under the copy's opaque middle, and the photo is back to intact
      // before the copy's falloff can no longer cover it.
      let hole: string
      if (bestGap === 0 && contactSpan > 4 && bestOther) {
        const o2 = bestOther
        // OVERLAPPED: the crossing edge is contactSpan long, and any disc —
        // however sized — softens one point of it and leaves the rest razor
        // sharp. So while the boxes overlap, the erasure is a LINEAR feather
        // instead: the image's whole leading edge (everything facing the
        // neighbour, full width) fades out across a band, and with both
        // sides feathering toward each other the seam is a true cross-fade —
        // each pixel a weighted average of the two pictures. The band width
        // rides seamBlur, so the public knob directly widens the melt.
        //
        // ONE radial mask, centred on the NEIGHBOUR's centre: everything on
        // my body nearest them fades out, curved around their body — corner
        // contact, edge contact and deep overlap all feather correctly with
        // a single gradient. (The previous approach — two axis gradients
        // combined with mask-composite — depended on compositing support and
        // on both writes landing; one browser quirk and an edge stayed
        // razor. A lone gradient cannot half-apply.)
        const ncx2 = (o2.x + o2.w / 2 - ix) * kx
        const ncy2 = (o2.y + o2.h / 2 - iy) * ky
        // Cover the whole crossing region: farthest corner of the OVERLAP
        // rect from the neighbour centre, in my local px.
        const ovx0 = (Math.max(f.x, o2.x) - ix) * kx
        const ovy0 = (Math.max(f.y, o2.y) - iy) * ky
        const ovx1 = (Math.min(f.x + f.w, o2.x + o2.w) - ix) * kx
        const ovy1 = (Math.min(f.y + f.h, o2.y + o2.h) - iy) * ky
        const rEnd = Math.round(
          Math.max(
            Math.hypot(ovx0 - ncx2, ovy0 - ncy2),
            Math.hypot(ovx1 - ncx2, ovy0 - ncy2),
            Math.hypot(ovx0 - ncx2, ovy1 - ncy2),
            Math.hypot(ovx1 - ncx2, ovy1 - ncy2),
          ) + 3,
        )
        const band = Math.round(
          Math.min(
            rim * 2.6,
            Math.max(hd, (blend.seamBlur ?? blend.blur * 1.6) * 3.2),
          ),
        )
        const rCore = Math.max(0, rEnd - band)
        const farR =
          Math.round(
            Math.max(
              Math.hypot(ncx2, ncy2),
              Math.hypot(ncx2 - ow, ncy2),
              Math.hypot(ncx2, ncy2 - oh),
              Math.hypot(ncx2 - ow, ncy2 - oh),
            ),
          ) + 2
        hole = `radial-gradient(circle at ${Math.round(ncx2)}px ${Math.round(ncy2)}px, rgba(255,255,255,${holeAlpha}) ${rCore}px, #fff ${rEnd}px, #fff ${farR}px)`
      } else {
        hole = `radial-gradient(circle at ${hx}px ${hy}px, rgba(255,255,255,${holeAlpha}) ${round(hd * 0.2)}px, rgba(255,255,255,${holeMid}) ${round(hd * 0.45)}px, #fff ${round(hd * 0.78)}px, #fff ${far}px)`
      }
      if (hole !== entry.lastHole) {
        entry.lastHole = hole
        entry.el.style.setProperty('mask-image', hole)
        entry.el.style.setProperty('-webkit-mask-image', hole)
        // Single-image masks need no compositing; clear any stale one.
        entry.el.style.removeProperty('mask-composite')
        entry.el.style.removeProperty('-webkit-mask-composite')
      }
    }
    item.lastBlend = { cx, cy, s, d, pk: paramKey }
    return true
  }

  private ensureSources(): void {
    if (this.sourcesReady) return
    const group = this.getGroup()
    if (!group) return
    this.sourcesReady = true
    this.mo = new MutationObserver(muts => {
      for (const m of muts) {
        const t = m.target
        // Ignore our own writes: blob attrs inside the silhouette svg and
        // melt-overlay writes.
        if (!(t instanceof Element) || !t.closest('[data-gooey-svg], [data-gooey-overlay]')) {
          this.wake()
          return
        }
      }
    })
    this.mo.observe(group, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style', 'class'],
    })
    const wake = () => this.wake()
    for (const type of ['transitionrun', 'animationstart', 'pointerdown']) {
      group.addEventListener(type, wake, true)
      this.removeListeners.push(() => group.removeEventListener(type, wake, true))
    }
    window.addEventListener('scroll', wake, { capture: true, passive: true })
    this.removeListeners.push(() => window.removeEventListener('scroll', wake, true))
    // Safety net for motion the wake sources can't see (e.g. WAAPI):
    // a cheap silent check 3x/second while asleep.
    this.interval = setInterval(() => {
      if (!this.awake && this.measureAll()) this.wake()
    }, 300)
  }
}

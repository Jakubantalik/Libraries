import { measureRadius } from './geometry'

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
}

export const MOVE_DEFAULTS: Required<MoveOptions> = {
  stiffness: 380,
  damping: 18,
  stretch: 0.18,
  tail: 0.46,
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
}

interface MeltLayer {
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
  lastBlend: { cx: number; cy: number; s: number; d: number } | null
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
      tailX: 0,
      tailY: 0,
      tailVx: 0,
      tailVy: 0,
      tailR: 0,
      contentBlurred: false,
      lastPaint: null,
      lastTail: null,
      lastBi: t.blobInset ?? 0,
      meltFade: 0,
      meltRel: null,
      meltOp: 1,
      meltPhase: 0,
      meltPrev: null,
      meltGeom: null,
      ro: new ResizeObserver(() => {
        item.baseW = t.target.offsetWidth || 1
        item.baseH = t.target.offsetHeight || 1
        item.radiusPx = this.resolveRadius(t)
        this.refreshMelt(item)
        this.wake()
      }),
    }
    item.ro.observe(t.target)
    this.items.add(item)
    this.refreshMelt(item)
    if (t.dynamics?.move) {
      // Painted before (below) the main blob; the goo merge does the rest.
      const tail = svg('circle', { cx: '0', cy: '0', r: '0' })
      t.blob.parentNode?.insertBefore(tail, t.blob)
      item.tailEl = tail
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
      svg('stop', { offset: '0%', 'stop-color': '#fff' }),
      svg('stop', { offset: '35%', 'stop-color': '#fff', 'stop-opacity': '0.95' }),
      svg('stop', { offset: '60%', 'stop-color': '#fff', 'stop-opacity': '0.6' }),
      svg('stop', { offset: '82%', 'stop-color': '#fff', 'stop-opacity': '0.25' }),
      svg('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': '0' }),
    )
    defs.append(gradient)

    const mkLayer = (suffix: string) => {
      const filter = svg('filter', {
        id: `${uid}-f${suffix}`,
        x: '-60%',
        y: '-60%',
        width: '220%',
        height: '220%',
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
      const gl = svg('g', {})
      gl.setAttribute('filter', `url(#${uid}-f${suffix})`)
      gl.setAttribute('mask', `url(#${uid}-m${suffix})`)
      gl.setAttribute('opacity', '0')
      const shift = svg('g', {})
      gl.append(shift)
      return { disp, blurEl, erode, turb, noiseOffset, circle, gl, shift }
    }
    // Outermost first so inner (stronger) layers paint on top.
    const layers = Array.from({ length: MELT_LAYERS }, (_, i) => mkLayer(`l${i}`))
    host.append(defs, ...layers.map(l => l.gl))

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
      const radiusPx = measureRadius(el, el.offsetWidth, el.offsetHeight)[0]
      return { el, rects, pattern, image, radiusPx }
    })

    host.setAttribute('opacity', '0')
    item.melt = { layers, entries }
  }

  /** Remove all melt traces: hide the warped overlay, restore image masks. */
  private clearBlend(item: Item): void {
    item.blend?.host.setAttribute('opacity', '0')
    for (const entry of item.melt?.entries ?? []) {
      entry.el.style.removeProperty('mask-image')
      entry.el.style.removeProperty('-webkit-mask-image')
    }
  }

  private lastNow = 0

  private loop = (now: number): void => {
    if (this.items.size === 0) {
      this.awake = false
      this.lastNow = 0
      return
    }
    const dt = this.lastNow ? Math.min(1 / 24, Math.max(1 / 240, (now - this.lastNow) / 1000)) : 1 / 60
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
    // Frames first: bridgeGrow proximity needs every neighbour's frame before
    // any blob is written.
    for (const item of this.items) {
      const r = item.target.getBoundingClientRect()
      item.frame = { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height }
    }
    for (const item of this.items) {
      if (this.writeBlob(item, dt)) changed = true
    }
    for (const item of this.items) {
      if (item.blend && this.writeBlend(item, g, dt)) changed = true
    }
    return changed
  }

  /** Effective blob inset: bridgeGrow pulls it toward negative (a visible
   *  liquid coat) as the nearest neighbour approaches. */
  private effectiveInset(item: Item): number {
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
    return bi
  }

  private writeBlob(item: Item, dt: number): boolean {
    const f = item.frame!
    const dyn = item.dynamics
    if (!dyn || (!dyn.evolve && !dyn.move)) {
      const bi = this.effectiveInset(item)
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
      ;[s.cx, s.vcx] = springStep(s.cx, s.vcx, tcx, mo.stiffness, mo.damping, dt)
      ;[s.cy, s.vcy] = springStep(s.cy, s.vcy, tcy, mo.stiffness, mo.damping, dt)
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
      ;[s.cx, s.vcx] = springStep(s.cx, s.vcx, tcx + ox, eo.massStiffness, eo.massDamping, dt)
      ;[s.cy, s.vcy] = springStep(s.cy, s.vcy, tcy + oy, eo.massStiffness, eo.massDamping, dt)
    } else {
      s.cx = tcx
      s.cy = tcy
      s.vcx = 0
      s.vcy = 0
    }
    if (dyn.evolve) {
      // Size adapts after the mass, radius after the size.
      const eo = dyn.evolveOpts ?? EVOLVE_DEFAULTS
      ;[s.w, s.vw] = springStep(s.w, s.vw, f.w, eo.sizeStiffness, eo.sizeDamping, dt)
      ;[s.h, s.vh] = springStep(s.h, s.vh, f.h, eo.sizeStiffness, eo.sizeDamping, dt)
      // Default near-critical damping: the corner radius must land without
      // bouncing — the roundness envelope already supplies the liquid overshoot.
      ;[s.r, s.vr] = springStep(s.r, s.vr, tr, eo.radiusStiffness, eo.radiusDamping, dt)
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
      ;[item.tailX, item.tailVx] = springStep(item.tailX, item.tailVx, s.cx, 170, 22, dt)
      ;[item.tailY, item.tailVy] = springStep(item.tailY, item.tailVy, s.cy, 170, 22, dt)
      const bi = item.blobInset ?? 0
      const base = Math.max(4, Math.min(s.w, s.h) - bi * 2)
      const lagX = item.tailX - s.cx
      const lagY = item.tailY - s.cy
      const lag = Math.hypot(lagX, lagY)
      const maxLag = base * 0.8
      if (lag > maxLag) {
        item.tailX = s.cx + (lagX / lag) * maxLag
        item.tailY = s.cy + (lagY / lag) * maxLag
      }
      const targetR = Math.min(
        base * (dyn.moveOpts ?? MOVE_DEFAULTS).tail,
        Math.max(0, (speed - 20) * 0.03),
      )
      item.tailR += (targetR - item.tailR) * Math.min(1, dt * 10)
      if (item.tailR < 0.3) {
        if (item.lastTail !== 'hidden') {
          item.tailEl.setAttribute('r', '0')
          item.lastTail = 'hidden'
        }
      } else {
        const tail = `${round(item.tailX)},${round(item.tailY)},${round(item.tailR)}`
        if (tail !== item.lastTail) {
          item.tailEl.setAttribute('cx', String(round(item.tailX)))
          item.tailEl.setAttribute('cy', String(round(item.tailY)))
          item.tailEl.setAttribute('r', String(round(item.tailR)))
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
    const paint = {
      t: `translate(${s.cx - s.w / 2 + bi}px, ${s.cy - s.h / 2 + bi}px)` + extra,
      w: String(bw),
      h: String(bh),
      rx: String(pillRadius(renderR - bi, bw, bh)),
    }
    const lp = item.lastPaint
    if (!lp || lp.t !== paint.t) item.blob.style.transform = paint.t
    if (!lp || lp.w !== paint.w) item.blob.setAttribute('width', paint.w)
    if (!lp || lp.h !== paint.h) item.blob.setAttribute('height', paint.h)
    if (!lp || lp.rx !== paint.rx) item.blob.setAttribute('rx', paint.rx)
    item.lastPaint = paint
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
  private writeBlend(item: Item, g: DOMRect, dt: number): boolean {
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
    // Target strength from proximity and activity; squared smoothstep biases
    // the ramp late — barely anything at first neck.
    let sTarget = 0
    if (bestOther && bestGap < range && blend.active !== false) {
      // Mild bias only: with `range` tuned to the real necking distance, the
      // dissolve must track the BRIDGE onset — a squared curve left a sharp
      // avatar edge visible inside an already-formed neck.
      const sRaw = smoothstep(1 - bestGap / range)
      // Strength is a CEILING, not a linear scale: even at full contact the
      // melt cannot exceed it, but it still ramps the same way on approach —
      // scaling sRaw itself would also slow the ramp, reading as "farther
      // away" rather than "weaker".
      const strength = Math.max(0, Math.min(1, blend.strength ?? 1))
      sTarget = Math.pow(sRaw, 1.25) * strength
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
        item.lastBlend = { cx: 0, cy: 0, s: 0, d: 0 }
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
    const phaseAdv = dt * flowSpeed * 0.12 * Math.min(1, moveSpeed / 40)
    item.meltPhase += phaseAdv
    const lb = item.lastBlend
    if (
      phaseAdv < 1e-4 &&
      lb &&
      Math.abs(lb.cx - cx) < 0.05 &&
      Math.abs(lb.cy - cy) < 0.05 &&
      Math.abs(lb.s - s) < 0.005 &&
      Math.abs(lb.d - d) < 0.05
    ) {
      return false
    }
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
    const bfStr =
      Math.abs(gux) >= Math.abs(guy) ? `${alongF} ${acrossF}` : `${acrossF} ${alongF}`

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
    melt.layers.forEach((layer, i) => {
      const t = n > 1 ? i / (n - 1) : 1 // 0 = outermost rim, 1 = tip
      // Blur eases in with a curve so the rim stays nearly sharp and the
      // core carries the full radius: gentle at first, then rising.
      const blurK = 0.06 + 0.94 * Math.pow(t, 1.7)
      const warpK = 0.2 + 0.8 * t
      layer.disp.setAttribute('scale', String(round(blend.warp * warpK * eStruct)))
      layer.blurEl.setAttribute('stdDeviation', String(round(blend.blur * blurK * eStruct)))
      if (layer.turb.getAttribute('baseFrequency') !== bfStr) {
        layer.turb.setAttribute('baseFrequency', bfStr)
      }
      // BOUNDED, flow-aligned noise oscillation (Lissajous, ±9px along the
      // flow, ±3px across), each layer at its own rate so the field shears —
      // melting slides along gravity. It must stay bounded: a linearly
      // growing offset drags the noise image's own region boundary across
      // the melt, which shows as hard moving lines.
      const pr = 0.7 + 0.45 * t
      const oa = 6 * Math.sin(item.meltPhase * pr)
      const ob = 2 * Math.sin(item.meltPhase * pr * 1.31 + 1.7)
      layer.noiseOffset.setAttribute('dx', String(round(gux * oa - guy * ob)))
      layer.noiseOffset.setAttribute('dy', String(round(guy * oa + gux * ob)))
      layer.circle.setAttribute('cx', String(round(bx)))
      layer.circle.setAttribute('cy', String(round(by)))
      // Wider radius spread than before (rim reaches past the zone, tip
      // concentrates): with the longer gradient tail this turns the zone
      // into a continuous ramp instead of a soft-edged disc.
      layer.circle.setAttribute('r', String(round(d * (1.15 - 0.75 * t))))
      // Rim layer slightly translucent so the onset is gradual; the core
      // still stacks to full alpha.
      layer.gl.setAttribute('opacity', String(round(Math.min(1, eStruct * (0.75 + 0.25 * t)))))
    })
    host.setAttribute('opacity', r3(item.meltOp).toString())
    // Anchored stretch, NOT translation: scaling from the trailing edge of
    // the melt zone keeps the warped copy aligned with the original at the
    // back (a translated copy shows its silhouette as an offset ghost ring),
    // while its leading side streams toward the pill by up to `gravity` px.
    const anchorX = cx - gux * d
    const anchorY = cy - guy * d
    // Taper now shapes the STRETCH (how sharply content is drawn out toward
    // the pill) rather than mask geometry.
    const kFlow = Math.min(0.6, gAmt / Math.max(8, 2 * d)) * (0.5 + taper)
    const flow = (k: number) => {
      const sx = r3(1 + kFlow * k)
      const sy = r3(1 / (1 + kFlow * 0.35 * k))
      return (
        `translate(${round(anchorX)}, ${round(anchorY)}) rotate(${gDeg}) ` +
        `scale(${sx}, ${sy}) ` +
        `rotate(${-gDeg}) translate(${round(-anchorX)}, ${round(-anchorY)})`
      )
    }
    melt.layers.forEach((layer, i) => {
      const t = n > 1 ? i / (n - 1) : 1
      layer.shift.setAttribute('transform', flow(0.4 + 0.6 * t))
    })

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
    melt.layers.forEach((layer, i) => {
      const t = n > 1 ? i / (n - 1) : 1
      layer.erode.setAttribute('values', erodeRow(mixAmt * (0.15 + 0.85 * t)))
    })
    // Gentle magnetic pull of the melted body toward the contact.
    const icx = f.x + f.w / 2
    const icy = f.y + f.h / 2
    const ang = Math.atan2(cy - icy, cx - icx)
    // Pull holds with the structure during the fade — the overlay must not
    // glide back while it evaporates.
    const pull = blend.pull * sStruct
    host.style.transform = `translate(${round(Math.cos(ang) * pull)}px, ${round(Math.sin(ang) * pull)}px)`

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
    const holeAlpha = Math.max(0, 1 - Math.min(s, sBridge) * 2.2).toFixed(3)
    const holeMid = ((1 + 2 * Number(holeAlpha)) / 3).toFixed(3)
    for (const entry of melt.entries) {
      const ir = entry.el.getBoundingClientRect()
      if (ir.width < 1 || ir.height < 1) continue
      const ix = ir.left - g.left
      const iy = ir.top - g.top
      // Warped copy geometry (group coordinates), written to every layer.
      const kx = (entry.el.offsetWidth || ir.width) / ir.width
      for (const rect of entry.rects) {
        rect.setAttribute('x', String(round(ix)))
        rect.setAttribute('y', String(round(iy)))
        rect.setAttribute('width', String(round(ir.width)))
        rect.setAttribute('height', String(round(ir.height)))
        rect.setAttribute(
          'rx',
          String(round(pillRadius(entry.radiusPx / (kx || 1), ir.width, ir.height))),
        )
      }
      entry.pattern.setAttribute('x', String(round(ix)))
      entry.pattern.setAttribute('y', String(round(iy)))
      entry.pattern.setAttribute('width', String(round(ir.width)))
      entry.pattern.setAttribute('height', String(round(ir.height)))
      entry.image.setAttribute('width', String(round(ir.width)))
      entry.image.setAttribute('height', String(round(ir.height)))
      // Edge dissolve on the original image, imagery only — labels around it
      // stay sharp. Coordinates in the image's untransformed layout space; an
      // image far from the contact gets an off-canvas hole, i.e. no effect.
      // The hole is biased 0.25·d INTO the item (opposite gravity) so the
      // item's own edge genuinely dissolves — centred at the contact, half
      // the hole was wasted over the neighbour.
      const ky = (entry.el.offsetHeight || ir.height) / ir.height
      // Centred AT the seam, radius kept to the neck's width: the hole may
      // only eat the sliver of image the neck is consuming. Biased into the
      // item it excavated a crater from the photo's BODY, and what's behind
      // an erased photo is the item's own white blob — a glowing white
      // circle on the image with no liquid to justify it.
      const hx = round((cx - ix) * kx)
      const hy = round((cy - iy) * ky)
      const hd = d * Math.min(kx, ky)
      const hole = `radial-gradient(circle at ${hx}px ${hy}px, rgba(0,0,0,${holeAlpha}) ${round(hd * 0.32)}px, rgba(0,0,0,${holeMid}) ${round(hd * 0.55)}px, black ${round(hd * 0.8)}px)`
      entry.el.style.setProperty('mask-image', hole)
      entry.el.style.setProperty('-webkit-mask-image', hole)
    }
    item.lastBlend = { cx, cy, s, d }
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

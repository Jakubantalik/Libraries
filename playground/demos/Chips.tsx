import { Liquid } from 'liquid-gooey'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import avatar1 from '../assets/avatars/avatar-1.png'
import avatar2 from '../assets/avatars/avatar-2.png'
import avatar3 from '../assets/avatars/avatar-3.png'
import avatar4 from '../assets/avatars/avatar-4.png'
import avatar5 from '../assets/avatars/avatar-5.png'
import avatar6 from '../assets/avatars/avatar-6.png'
import type { DemoProps } from '../App'

interface MeltState {
  /** 0..1 — master ceiling on how far the dissolve can develop; scales the
   *  liquid intensity AND the image-edge erasure together. */
  strength: number
  warp: number
  blur: number
  zone: number
  range: number
  mix: number
  gravity: number
  taper: number
  warpFreq: number
  flowSpeed: number
  detail: number
  release: number
  fade: number
  /** Travel of the released avatar into its gap in the stack. */
  dropDur: number
  /** 0..1 — overshoot of the drop travel (bezier y1 = 1 + 0.8·bounce). */
  dropBounce: number
  /** Px the neighbours get shoved outward when the avatar lands. */
  push: number
  /** 0..1 — how springy the shove chain is (damping of the coupled springs). */
  pushBounce: number
  /** Ms after release the impact lands. 0 = the row reacts the instant you
   *  let go (anticipation); ~dropDur = it waits for the avatar to arrive. */
  pushDelay: number
  /** Anchor-spring stiffness — how fast each avatar oscillates and returns. */
  pushSpeed: number
  /** Neighbour coupling — how far the wave carries down the row. */
  pushSpread: number
}

/** Drop easing from a 0..1 bounce knob: y1 rises past 1 for overshoot.
 *  0.5 reproduces the old "Bounce" preset exactly (y1 = 1.4). */
function dropEase(bounce: number): string {
  return `cubic-bezier(0.34, ${(1 + 0.8 * bounce).toFixed(2)}, 0.64, 1)`
}

function meltSnippet(m: MeltState): string {
  return [
    '// liquid-gooey — Dissolve values',
    'dissolve={{',
    `  strength: ${m.strength}, warp: ${m.warp}, blur: ${m.blur}, mix: ${m.mix}, gravity: ${m.gravity},`,
    `  taper: ${m.taper}, warpFreq: ${m.warpFreq}, flowSpeed: ${m.flowSpeed},`,
    `  detail: ${m.detail}, zone: ${m.zone}, range: ${m.range},`,
    `  releaseMs: ${m.release}, fadeMs: ${m.fade},`,
    '}}',
    `// drop: duration ${m.dropDur}ms, easing '${dropEase(m.dropBounce)}',`,
    `// push: ${m.push}px, springiness ${m.pushBounce}, delay ${m.pushDelay}ms,`,
    `//       speed ${m.pushSpeed}, spread ${m.pushSpread}`,
  ].join('\n')
}

const MELT_DEFAULTS: MeltState = {
  strength: 1,
  warp: 7,
  blur: 8,
  zone: 18,
  range: 49,
  mix: 0.7,
  gravity: 60,
  taper: 0.4,
  warpFreq: 1.7,
  flowSpeed: 22,
  detail: 2,
  release: 380,
  fade: 320,
  dropDur: 400,
  dropBounce: 0.5,
  push: 9,
  pushBounce: 0,
  pushDelay: 110,
  pushSpeed: 80,
  pushSpread: 0,
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="cp-row">
      <span className="cp-label">{label}</span>
      <span className="cp-slider">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
        />
        <span className="cp-val">{value}</span>
      </span>
    </div>
  )
}

// Local portraits (bundled) instead of a remote API — no network dependency
// and no layout flash while images load.
const PORTRAITS = [
  avatar1,
  avatar2,
  avatar3,
  avatar4,
  avatar5,
  avatar6,
]

const INITIAL = 3
/** The loose chip is 40px; a stack avatar is 32px, so the chip SCALES down to
 *  hand off. That scale applies to its box-shadow as well, so the white ring
 *  has to be pre-divided by it — at a flat 2px it renders 1.6px while flying
 *  and then jumped to the avatar's true 2px at the swap: the landing flash. */
const CHIP_PX = 40
const SLOT_PX = 32
const ABSORB_SCALE = SLOT_PX / CHIP_PX
/** Ring thickness as it must LOOK — matches .ap-avatar's box-shadow. */
const RING_PX = 2
/** Avatars are 32px overlapped by 8 → 24px pitch between slots. The hover gap
 *  opens by exactly one pitch, so insertion swaps in with zero movement. */
const PITCH = 24
/** The one draggable face; it JOINS the group on drop (never respawns). */
const CHIP_SRC = PORTRAITS[INITIAL]

export function Chips({ blur, contrast, shadow, pro }: DemoProps) {
  const [group, setGroup] = useState(PORTRAITS.slice(0, INITIAL))
  /** Simple mode: dissolve intensity, the one public knob. 1 = tuned look. */
  const [slimDissolve, setSlimDissolve] = useState(1)
  const [gapIndex, setGapIndex] = useState<number | null>(null)
  const [consumed, setConsumed] = useState(false)
  const [absorbing, setAbsorbing] = useState(false)
  /** True for the single frame where the gap is swapped for the real avatar.
   *  Both layouts are geometrically identical, so with transitions off the
   *  handoff is invisible; with them on, the gapped neighbour would animate
   *  its margin back while the new element pushes it — a 24px jump plus a
   *  matching jump in the pill's width. */
  const [swapping, setSwapping] = useState(false)
  /** Slot the released avatar is travelling into — the chip adopts that slot's
   *  stacking during the flight, so the swap doesn't flip its paint order. */
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  /** Coupled spring chain: every avatar is a spring-mass anchored to its
   *  slot AND connected to its neighbours — the landing impulse goes only to
   *  the immediate neighbours and the coupling propagates it outward as a
   *  wave, like the row is strung on invisible springs. Written imperatively
   *  (transform is not in the React style object, so re-renders keep it). */
  const avatarEls = useRef<Array<HTMLImageElement | null>>([])
  const shove = useRef<{ x: number[]; v: number[]; raf: number; last: number } | null>(null)
  const shoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** True once the flier has IMPACTED (same clock as the shove): the
   *  separator crescents grow open at this moment, not at release and not
   *  at the swap — the hit is what visually seats the avatar. */
  const [seated, setSeated] = useState(false)
  const seatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (seatTimer.current) clearTimeout(seatTimer.current) }, [])
  const stopShove = () => {
    if (shove.current) cancelAnimationFrame(shove.current.raf)
    shove.current = null
    for (const el of avatarEls.current) el?.style.removeProperty('transform')
  }
  useEffect(() => () => {
    if (shoveTimer.current) clearTimeout(shoveTimer.current)
    if (shove.current) cancelAnimationFrame(shove.current.raf)
  }, [])
  const stepShove = (now: number) => {
    const st = shove.current
    if (!st) return
    const dt = Math.min(1 / 30, (now - st.last) / 1000)
    st.last = now
    const K = meltRef.current.pushSpeed // anchor spring (1/s^2)
    const KC = meltRef.current.pushSpread // coupling — carries the wave out
    const zeta = 1.05 - 0.85 * Math.min(1, Math.max(0, meltRef.current.pushBounce))
    const C = 2 * zeta * Math.sqrt(K)
    const n = st.x.length
    let live = false
    for (let i = 0; i < n; i++) {
      let f = -K * st.x[i] - C * st.v[i]
      if (i > 0) f += KC * (st.x[i - 1] - st.x[i])
      if (i < n - 1) f += KC * (st.x[i + 1] - st.x[i])
      st.v[i] += f * dt
    }
    for (let i = 0; i < n; i++) {
      st.x[i] += st.v[i] * dt
      if (Math.abs(st.x[i]) > 0.05 || Math.abs(st.v[i]) > 2) live = true
      avatarEls.current[i]?.style.setProperty('transform', `translateX(${st.x[i].toFixed(2)}px)`)
    }
    if (live) st.raf = requestAnimationFrame(stepShove)
    else stopShove()
  }
  /** Impulse into the slot's immediate neighbours (old indices, pre-swap):
   *  old index g-1 sits left of the gap, old index g sits right of it. */
  const startShove = (g: number, count: number) => {
    stopShove()
    const x = Array(count).fill(0)
    const v = Array(count).fill(0)
    // v0 scaled so the first neighbour peaks ≈ the Push (px) knob, tracking
    // the stiffness knob (peak ≈ v0/sqrt(K_eff), and coupling to resting
    // neighbours roughly doubles the effective stiffness).
    const m = meltRef.current
    const v0 = m.push * Math.sqrt(m.pushSpeed + m.pushSpread * 2) * 1.55
    if (g - 1 >= 0) v[g - 1] = -v0
    if (g < count) v[g] = v0
    shove.current = { x, v, raf: 0, last: performance.now() }
    shove.current.raf = requestAnimationFrame(stepShove)
  }
  const [melt, setMelt] = useState<MeltState>(MELT_DEFAULTS)
  /** The rAF sim reads live knob values without re-subscribing. */
  const meltRef = useRef(melt)
  meltRef.current = melt
  const setM =
    <K extends keyof MeltState>(k: K) =>
    (v: MeltState[K]) =>
      setMelt(prev => ({ ...prev, [k]: v }))
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  const copyValues = () => {
    navigator.clipboard.writeText(meltSnippet(melt)).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1400)
    })
  }
  const chipRef = useRef<HTMLDivElement | null>(null)
  const pillRef = useRef<HTMLDivElement | null>(null)
  const stackRef = useRef<HTMLSpanElement | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const origin = useRef({ x: 0, y: 0 })
  const absorbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (absorbTimer.current) clearTimeout(absorbTimer.current) }, [])
  /** Last stable gap, for hysteresis (see hoverGap). */
  const stableGap = useRef<number | null>(null)

  /** Insertion slot under the chip, or null when not hovering the pill.
   *  Hysteresis: once settled on a slot, the pointer must cross well past its
   *  boundary to flip — hovering exactly on a boundary would otherwise toggle
   *  the gap (and so the pill's width) on every 1px of pointer jitter, each
   *  toggle re-triggering the pill's evolve resize. That rapid retriggering
   *  is what Safari's own repaint timing under the goo filter can show as a
   *  flickering corner radius while dragging near the pill. */
  const hoverGap = (): number | null => {
    const c = chipRef.current?.getBoundingClientRect()
    const p = pillRef.current?.getBoundingClientRect()
    const s = stackRef.current?.getBoundingClientRect()
    if (!c || !p || !s) return null
    const pad = 18
    const near =
      c.left < p.right + pad && c.right > p.left - pad && c.top < p.bottom + pad && c.bottom > p.top - pad
    if (!near) {
      stableGap.current = null
      return null
    }
    const chipCx = c.left + c.width / 2
    const raw = Math.min(group.length, Math.max(0, (chipCx - s.left) / PITCH))
    const prev = stableGap.current
    const g = prev != null && Math.abs(raw - prev) < 0.72 ? prev : Math.round(raw)
    stableGap.current = g
    return g
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (absorbing) return
    stableGap.current = null
    try {
      chipRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events have no active pointer */
    }
    origin.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    setDragging(true)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setPos({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y })
    setGapIndex(hoverGap())
  }
  const endDrag = () => {
    if (!dragging) return
    setDragging(false)
    const g = hoverGap()
    const c = chipRef.current?.getBoundingClientRect()
    const s = stackRef.current?.getBoundingClientRect()
    if (g != null && c && s) {
      // Travel into the open gap; the inserted avatar then occupies exactly
      // that spot, so the swap is seamless — no respawn, no jump.
      const targetCx = s.left + g * PITCH + 16
      const targetCy = s.top + s.height / 2
      setAbsorbing(true)
      setDropIndex(g)
      setPos(prev => ({
        x: prev.x + (targetCx - (c.left + c.width / 2)),
        y: prev.y + (targetCy - (c.top + c.height / 2)),
      }))
      // Impact timing is an explicit knob, not a fraction of the flight: at
      // 0 the row reacts the instant you let go (the shove leads the avatar
      // in, which reads as anticipation); larger values wait for it.
      setSeated(false)
      if (seatTimer.current) clearTimeout(seatTimer.current)
      if (melt.pushDelay <= 0) setSeated(true)
      else seatTimer.current = setTimeout(() => setSeated(true), melt.pushDelay)
      if (melt.push > 0) {
        if (shoveTimer.current) clearTimeout(shoveTimer.current)
        const count = group.length
        if (melt.pushDelay <= 0) startShove(g, count)
        else shoveTimer.current = setTimeout(() => startShove(g, count), melt.pushDelay)
      }
      absorbTimer.current = setTimeout(() => {
        setSwapping(true)
        setGroup(gr => [...gr.slice(0, g), CHIP_SRC, ...gr.slice(g)])
        setGapIndex(null)
        setConsumed(true)
        setAbsorbing(false)
        // The chain keeps ringing across the swap: insert a resting entry
        // for the landed avatar so indices stay aligned with the new group.
        if (shove.current) {
          shove.current.x.splice(g, 0, 0)
          shove.current.v.splice(g, 0, 0)
        }
        // Re-enable transitions only after the swapped layout has painted.
        requestAnimationFrame(() => requestAnimationFrame(() => setSwapping(false)))
      }, melt.dropDur)
    } else {
      setGapIndex(null)
      setPos({ x: 0, y: 0 })
    }
  }

  const reset = () => {
    if (absorbTimer.current) clearTimeout(absorbTimer.current)
    if (shoveTimer.current) clearTimeout(shoveTimer.current)
    if (seatTimer.current) clearTimeout(seatTimer.current)
    setSeated(false)
    stopShove()
    stableGap.current = null
    setSwapping(true)
    setGroup(PORTRAITS.slice(0, INITIAL))
    setGapIndex(null)
    setConsumed(false)
    setAbsorbing(false)
    setDropIndex(null)
    setDragging(false)
    setPos({ x: 0, y: 0 })
    requestAnimationFrame(() => requestAnimationFrame(() => setSwapping(false)))
  }

  return (
    <div className="ap-wrap">
      <div className="stage">
    <Liquid blur={blur} contrast={contrast} fill="var(--modal-bg)" shadow={shadow} className="ap">
      <button type="button" className="ap-reset" onClick={reset}>
        Reset
      </button>
      {/* Pill resizes CRISP and calm: no content cross-blur, size spring at
          critical damping (follows the width change without bouncing), no
          droplet rounding.
          It must RESIZE ONLY, never move: the pill is anchored at left:20px
          and grows rightward, so its centre target shifts by half the width
          delta. The blob's left edge is centre − width/2 — the ONLY way it
          stays put through the whole transition is mass and size springs with
          IDENTICAL dynamics, so centre and width move in exact lockstep (a
          merely-stiffer mass spring still leads the width and the left edge
          visibly steps sideways and back). `travel: 0` kills the lead —
          `anticipation` alone no longer disables it, it only times the ramp. */}
      <Liquid.Item
        morph={{
          shape: true,
          advanced: {
            evolve: {
              contentBlur: 0,
              sizeStiffness: 380,
              sizeDamping: 40,
              massStiffness: 380,
              massDamping: 40,
              anticipation: 0,
              travel: 0,
              roundness: 0,
            },
          },
        }}
      >
        <div className="ap-pill" ref={pillRef}>
          <span className="ap-label">Share</span>
          <span className="ap-stack" ref={stackRef}>
            {group.map((src, i) => {
              // White separator by MASKING, not by ring: a crescent is carved
              // out of this avatar around its right neighbour (which paints
              // on top), so the pill surface shows through as the gap. The
              // photo keeps its true edge and the design shadow stays
              // visible. Position derives from the neighbour's live margin —
              // when the hover gap opens, the crescent slides off the box and
              // the cut disappears on its own.
              // While an avatar is FLYING into the slot to my right, carve
              // around the flier's landing spot already (-8 overlap) even
              // though the DOM neighbour still holds the open gap — the swap
              // then changes nothing, instead of the cut popping in a frame
              // after the landing.
              const incomingRight = absorbing && dropIndex != null && i === dropIndex - 1
              const nextMl =
                incomingRight
                  ? -8
                  : i < group.length - 1
                    ? gapIndex === i + 1
                      ? PITCH - 8
                      : -8
                    : null
              // Radius rides --seat (0..1, registered + transitioned): resting
              // avatars sit at the default 1 (full 18px cut); the landing
              // pair starts at 0 and grows open at the impact.
              const sep =
                nextMl != null
                  ? `radial-gradient(circle at ${16 + 32 + nextMl}px 16px, transparent calc(var(--seat, 1) * 18px - 0.5px), #000 calc(var(--seat, 1) * 18px))`
                  : undefined
              return (
              <img
                key={src}
                ref={el => {
                  avatarEls.current[i] = el
                }}
                className="ap-avatar"
                src={src}
                alt=""
                draggable={false}
                style={{
                  marginLeft: i === 0 ? 0 : gapIndex === i ? PITCH - 8 : -8,
                  transition: swapping ? 'none' : undefined,
                  maskImage: sep,
                  WebkitMaskImage: sep,
                  ...(incomingRight
                    ? { '--seat': seated ? 1 : 0 }
                    : gapIndex === i + 1
                      ? { '--seat': 0 }
                      : null),
                  // Explicit stacking: DOM order alone makes an avatar
                  // inserted mid-group drop beneath its right-hand
                  // neighbours the instant it appears — a visible flash.
                  // While one is flying into `dropIndex`, the stack already
                  // RESERVES that slot: everyone to its right renumbers up
                  // front, so the flying chip's z-index (= dropIndex) sits
                  // below them for the whole flight instead of tying with
                  // its neighbour and winning on DOM order until the swap
                  // renumbers them and flips it under — the landing flash.
                  // The guard must match the chip's own exactly: `absorbing`
                  // clears in the same batch that inserts the avatar, so the
                  // reservation ends on the very frame the real element takes
                  // over its z-index. The swap changes no paint order at all.
                  zIndex: absorbing && dropIndex != null && i >= dropIndex ? i + 1 : i,
                } as CSSProperties}
              />
              )
            })}
            {/* Gap at the very end opens as trailing padding. */}
            <span
              className="ap-endgap"
              style={{
                width: gapIndex === group.length ? PITCH : 0,
                transition: swapping ? 'none' : undefined,
              }}
            />
          </span>
        </div>
      </Liquid.Item>
      {!consumed && (
        /* The dragged face liquefies into the pill: bridgeGrow grows a white
           coat that necks into the surface, and a warp melt dissolves the
           image ONLY in the mixing zone around the contact point. */
        <Liquid.Item
          morph={{ advanced: { blobInset: 2, bridgeGrow: 8 } }}
          // Simple mode rides `strength` alone; pro overrides every raw value.
          dissolve={{
            strength: pro ? melt.strength : slimDissolve,
            ...(pro
              ? {
                  blur: melt.blur,
                  warp: melt.warp,
                  range: melt.range,
                  zone: melt.zone,
                  mix: melt.mix,
                  gravity: melt.gravity,
                  taper: melt.taper,
                  warpFreq: melt.warpFreq,
                  flowSpeed: melt.flowSpeed,
                  detail: melt.detail,
                }
              : null),
            pull: 0,
            // Dissolve only while actually dragging: on release the melt
            // clears over `releaseMs` while the avatar travels its 420ms
            // into the gap — gone well before it lands.
            active: dragging,
            releaseMs: melt.release,
            fadeMs: melt.fade,
          }}
        >
          <div
            ref={chipRef}
            className={`ap-chip ${dragging ? 'ap-dragging' : ''} ${absorbing ? 'ap-absorbing' : ''} ${
              // The ring is earned by ENGAGING a slot, not by landing in it:
              // it grows while you're still hovering, so by release it is
              // already full and simply rides the flight in unchanged. Growing
              // it during the flight — at any duration — meant it was still
              // arriving as the avatar touched down, which reads as a flash.
              absorbing || (dragging && gapIndex != null) ? 'ap-ringed' : ''
            }`}
            style={
              {
                // Scale (not width/height) for the 40px → 32px handoff: the
                // chip is anchored by `right`/`top`, so resizing the box would
                // shift its centre and miss the slot; a centre-origin scale
                // lands exactly where the inserted avatar appears.
                transform:
                  `translate(${pos.x}px, ${pos.y}px)` +
                  (absorbing ? ` scale(${ABSORB_SCALE})` : ''),
                // While travelling, adopt the stacking of the slot being
                // joined so the handoff to the real avatar is paint-identical.
                zIndex: absorbing && dropIndex != null ? dropIndex : 20,
                // The crescent the landed avatar will wear, worn ALREADY
                // during the flight so the swap is paint-identical. Chip
                // coordinates are pre-scale (40px box, x1.25): neighbour
                // centre 24px right => 30px local, radius 18 => 22.5 local.
                // On the wrapper div, not the img — the engine owns the img's
                // mask for the dissolve hole.
                ...(absorbing && dropIndex != null && dropIndex < group.length
                  ? {
                      maskImage:
                        'radial-gradient(circle at 50px 20px, transparent calc(var(--seat, 1) * 22.5px - 0.6px), #000 calc(var(--seat, 1) * 22.5px))',
                      WebkitMaskImage:
                        'radial-gradient(circle at 50px 20px, transparent calc(var(--seat, 1) * 22.5px - 0.6px), #000 calc(var(--seat, 1) * 22.5px))',
                    }
                  : null),
                // Pinned to 0 outside the flight so the registered property
                // does not TRANSITION from its initial 1 the moment the mask
                // mounts (a phantom cut shrinking right at release).
                '--seat': absorbing ? (seated ? 1 : 0) : 0,
                '--ap-absorb-dur': `${melt.dropDur}ms`,
                '--ap-absorb-ease': dropEase(melt.dropBounce),
                // Pre-divided by the absorb scale so it RENDERS at RING_PX,
                // exactly matching the ring the real avatar already wears.
                '--ap-ring': `${RING_PX / ABSORB_SCALE}px`,
              } as CSSProperties
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img src={CHIP_SRC} alt="Drag into the group" draggable={false} />
          </div>
        </Liquid.Item>
      )}
    </Liquid>
      </div>
      {!pro && (
        <div className="cp-panel">
          <div className="cp-section">
            <div className="cp-section-head">
              <span className="cp-section-title">Morph</span>
            </div>
            <SliderRow label="Dissolve" value={slimDissolve} min={0} max={1} step={0.05} onChange={setSlimDissolve} />
          </div>
        </div>
      )}
      {pro && (
      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">Dissolve controls</span>
            <span className="cp-actions">
              <button
                type="button"
                className={`cp-export ${copied ? 'is-copied' : ''}`}
                onClick={copyValues}
              >
                {copied ? 'Copied' : 'Copy values'}
              </button>
              <button type="button" className="cp-export" onClick={() => setMelt(MELT_DEFAULTS)}>
                Reset
              </button>
            </span>
          </div>
          <SliderRow label="Strength" value={melt.strength} min={0} max={1} step={0.05} onChange={setM('strength')} />
          <SliderRow label="Warp" value={melt.warp} min={0} max={90} step={1} onChange={setM('warp')} />
          <SliderRow label="Mix (two-liquid)" value={melt.mix} min={0} max={1} step={0.05} onChange={setM('mix')} />
          <SliderRow label="Gravity (px)" value={melt.gravity} min={0} max={60} step={1} onChange={setM('gravity')} />
          <SliderRow label="Taper (pointy)" value={melt.taper} min={0} max={1} step={0.05} onChange={setM('taper')} />
          <SliderRow label="Warp freq" value={melt.warpFreq} min={0.3} max={3} step={0.1} onChange={setM('warpFreq')} />
          <SliderRow label="Flow speed" value={melt.flowSpeed} min={0} max={120} step={2} onChange={setM('flowSpeed')} />
          <SliderRow label="Zone (px)" value={melt.zone} min={4} max={40} step={1} onChange={setM('zone')} />
          <SliderRow label="Detail" value={melt.detail} min={1} max={4} step={1} onChange={setM('detail')} />
          <SliderRow label="Blur (px)" value={melt.blur} min={0} max={10} step={0.5} onChange={setM('blur')} />
          <SliderRow label="Range (px)" value={melt.range} min={4} max={50} step={1} onChange={setM('range')} />
          <div className="cp-subhead">Drop animation</div>
          <SliderRow label="Release (ms)" value={melt.release} min={20} max={600} step={10} onChange={setM('release')} />
          <SliderRow label="Fade-out (ms)" value={melt.fade} min={40} max={1200} step={20} onChange={setM('fade')} />
          <SliderRow label="Duration (ms)" value={melt.dropDur} min={120} max={1200} step={20} onChange={setM('dropDur')} />
          <SliderRow label="Bounce" value={melt.dropBounce} min={0} max={1} step={0.05} onChange={setM('dropBounce')} />
          <SliderRow label="Push (px)" value={melt.push} min={0} max={24} step={1} onChange={setM('push')} />
          <SliderRow label="Push springiness" value={melt.pushBounce} min={0} max={1} step={0.05} onChange={setM('pushBounce')} />
          <SliderRow label="Push delay (ms)" value={melt.pushDelay} min={0} max={600} step={10} onChange={setM('pushDelay')} />
          <SliderRow label="Push speed" value={melt.pushSpeed} min={80} max={900} step={10} onChange={setM('pushSpeed')} />
          <SliderRow label="Push spread" value={melt.pushSpread} min={0} max={500} step={10} onChange={setM('pushSpread')} />
        </div>
      </div>
      )}
    </div>
  )
}

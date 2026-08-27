import { Liquid } from 'liquid-gooey'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import folderIcon from '../assets/icon-folder.svg'
import type { DemoProps } from '../App'

/** Draggable item card (Figma 1363:35173 — "Gooey Project · 45 files"):
 *  a white pill with a folder chip, its SURFACE the liquid itself. Dragging
 *  runs the Move effect, so the card trails as liquid rubber with a droplet
 *  tail and snaps back with a wobble — the pill visual IS the blob, and the
 *  chip, title and count ride crisp on top. */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const CLAMP_X = 70
const CLAMP_Y = 60

// The avatar group's drop animation, shared verbatim: 400ms with the
// bounce-0.5 overshoot curve (Chips' dropEase(0.5)).
const DROP_MS = 400
const DROP_EASE = 'cubic-bezier(0.34, 1.40, 0.64, 1)'


export function DragCard({ blur, contrast, dark, shadow, pro, bare }: DemoProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  // The goo shadow is baked into FILTER PRIMITIVES, so swapping the string
  // cuts between the two stacks instantly — CSS has nothing to transition.
  // Tweening the layer values ourselves and re-emitting the string each
  // frame is what actually animates it: 300ms, ease-in-out.
  const [lift, setLift] = useState(0)
  useEffect(() => {
    const from = lift
    const to = dragging ? 1 : 0
    if (from === to) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 300)
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      setLift(from + (to - from) * e)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])
  const [releasing, setReleasing] = useState(false)
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null)
  // The surface stays RIGID with its content (high stiffness — card and
  // text move as one). The liquid character is the BOW: dragged down, the
  // pill's middle leads and its ends lag, arcing like a flexible bar pulled
  // through liquid. No tail.
  const [mv, setMv] = useState({ bend: 0.6, bendX: 0.35, content: 0.3 })

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events have no active pointer */
    }
    drag.current = { id: e.pointerId, dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    setDragging(true)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    setPos({
      x: Math.max(-CLAMP_X, Math.min(CLAMP_X, e.clientX - d.dx)),
      y: Math.max(-CLAMP_Y, Math.min(CLAMP_Y, e.clientY - d.dy)),
    })
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
    // Release: the card flies home on the avatar group's drop animation —
    // 400ms with the same overshoot bezier, so letting go lands with the
    // same bounce the released avatar has.
    setReleasing(true)
    setPos({ x: 0, y: 0 })
    window.setTimeout(() => setReleasing(false), DROP_MS)
  }

  const stage = (
    <Liquid
      blur={blur}
      contrast={contrast}
      fill="var(--card-surface, var(--modal-bg))"
      // Figma 1221:5117: the resting card wears a whisper of a shadow; the
      // dragged card lifts onto a deeper two-layer drop. Ring stays constant.
      // Figma 1221:5117: the resting card wears a whisper of a shadow; the
      // dragged card lifts onto a deeper two-layer drop. Ring stays constant;
      // the two drops interpolate on `lift` so the change is animated.
      shadow={
        dark
          ? // Dark mode wears the shared surface shadow — the same P3 inset
            // rings and drops the email input and every other dark surface
            // use, rather than a hand-rolled pair that read heavier than its
            // neighbours.
            shadow
          : [
              '0 0 0 1px rgba(0,0,0,0.08)',
              `0 ${lerp(1, 3, lift).toFixed(2)}px ${lerp(3, 5, lift).toFixed(2)}px rgba(0,0,0,0.04)`,
              `0 ${lerp(0, 10, lift).toFixed(2)}px ${lerp(0, 24, lift).toFixed(2)}px rgba(0,0,0,${(0.04 * lift).toFixed(3)})`,
            ].join(', ')
      }
      className="dgc"
    >
      {/* springiness 1 = surface glued to content; tail 0 = no droplet at
          all, the bow carries the whole liquid feel. */}
      <Liquid.Item
        effect="move"
        move={{
          springiness: 1,
          stretch: 0,
          advanced: { tail: 0, bend: mv.bend, bendX: mv.bendX },
        }}
      >
        <div
          className="dgc-card"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: releasing ? `transform ${DROP_MS}ms ${DROP_EASE}` : 'none',
            ['--dgc-cb' as string]: mv.content,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="dgc-chip">
            <img src={folderIcon} alt="" draggable={false} />
          </span>
          <span className="dgc-title">Gooey Project</span>
          <span className="dgc-count">45 files</span>
        </div>
      </Liquid.Item>
    </Liquid>
  )
  if (bare) return stage

  return (
    <div className="dgc-wrap">
      <div className="stage">{stage}</div>
      {pro && (
        <div className="cp-panel">
          <div className="cp-section">
            <div className="cp-section-head">
              <span className="cp-section-title">Drag card</span>
            </div>
            <div className="cp-row">
              <span className="cp-label">Bend vertical</span>
              <span className="cp-slider">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mv.bend}
                  onChange={e => setMv(m => ({ ...m, bend: Number(e.target.value) }))}
                />
                <span className="cp-val">{mv.bend}</span>
              </span>
            </div>
            <div className="cp-row">
              <span className="cp-label">Content bend</span>
              <span className="cp-slider">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mv.content}
                  onChange={e => setMv(m => ({ ...m, content: Number(e.target.value) }))}
                />
                <span className="cp-val">{mv.content}</span>
              </span>
            </div>
            <div className="cp-row">
              <span className="cp-label">Bend horizontal</span>
              <span className="cp-slider">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mv.bendX}
                  onChange={e => setMv(m => ({ ...m, bendX: Number(e.target.value) }))}
                />
                <span className="cp-val">{mv.bendX}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

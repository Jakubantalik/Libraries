import { Liquid } from 'liquid-gooey'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import cardA from '../assets/avatars/avatar-5.png'
import cardB from '../assets/avatars/avatar-6.png'
import type { DemoProps } from '../App'

/** Stage is 320x210; cards are 96px squares anchored at the stage centre. */
const CARD = 96
const CLAMP_X = 160 - CARD / 2 - 6
const CLAMP_Y = 105 - CARD / 2 - 6

interface CardState {
  strength: number
  warp: number
  mix: number
  gravity: number
  zone: number
  range: number
}

/** Zone/range scaled up from the avatar tuning — these are 96px slabs, not
 *  32px chips, so the mixing band must be wider to read at all. */
const DEFAULTS: CardState = {
  strength: 1,
  warp: 26,
  mix: 0.7,
  gravity: 60,
  zone: 26,
  range: 44,
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

export function Cards({ blur, contrast, shadow, pro }: DemoProps) {
  const [st, setSt] = useState<CardState>(DEFAULTS)
  const set =
    <K extends keyof CardState>(k: K) =>
    (v: CardState[K]) =>
      setSt(prev => ({ ...prev, [k]: v }))
  const [pos, setPos] = useState([
    { x: -78, y: 0 },
    { x: 78, y: 0 },
  ])
  const drag = useRef<{ id: number; index: number; dx: number; dy: number } | null>(null)

  const onPointerDown = (index: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events have no active pointer */
    }
    drag.current = {
      id: e.pointerId,
      index,
      dx: e.clientX - pos[index].x,
      dy: e.clientY - pos[index].y,
    }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    const x = Math.max(-CLAMP_X, Math.min(CLAMP_X, e.clientX - d.dx))
    const y = Math.max(-CLAMP_Y, Math.min(CLAMP_Y, e.clientY - d.dy))
    setPos(prev => prev.map((p, i) => (i === d.index ? { x, y } : p)))
  }
  const endDrag = () => {
    drag.current = null
  }

  const k = st.strength
  const dissolve = {
    warp: st.warp * k,
    // Lower than the avatar tuning: at the seam of two large photos a heavy
    // blur reads as fog over the neck, not as liquid.
    blur: 5 * k,
    mix: st.mix * k,
    gravity: st.gravity * k,
    taper: 0.95,
    warpFreq: 1,
    flowSpeed: 26,
    detail: 2,
    zone: st.zone,
    range: st.range,
    releaseMs: 110,
    fadeMs: 320,
  }

  return (
    <div className="dc-wrap">
      <div className="stage">
        <Liquid blur={blur} contrast={contrast} fill="#fff" shadow={shadow} className="dc">
          {[cardA, cardB].map((src, i) => (
            <Liquid.Item
              key={i}
              // Both cards dissolve: each melts its own imagery toward the
              // other, so the seam mixes two liquids — always armed, the
              // engine's proximity ramp does the gating.
              dissolve={dissolve}
              morph={{ advanced: { blobInset: 2, bridgeGrow: 10 } }}
            >
              <div
                className="dc-card"
                role="img"
                aria-label={`Draggable photo card ${i + 1}`}
                style={{ transform: `translate(${pos[i].x}px, ${pos[i].y}px)` }}
                onPointerDown={onPointerDown(i)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <img src={src} alt="" draggable={false} />
              </div>
            </Liquid.Item>
          ))}
        </Liquid>
      </div>

      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">{pro ? 'Melting cards' : 'Morph'}</span>
            {pro && (
              <span className="cp-actions">
                <button type="button" className="cp-export" onClick={() => setSt(DEFAULTS)}>
                  Reset
                </button>
              </span>
            )}
          </div>
          <SliderRow label="Dissolve" value={st.strength} min={0} max={1} step={0.05} onChange={set('strength')} />
          {pro && (
            <>
              <SliderRow label="Warp" value={st.warp} min={0} max={90} step={1} onChange={set('warp')} />
              <SliderRow label="Mix (two-liquid)" value={st.mix} min={0} max={1} step={0.05} onChange={set('mix')} />
              <SliderRow label="Gravity (px)" value={st.gravity} min={0} max={90} step={1} onChange={set('gravity')} />
              <SliderRow label="Zone (px)" value={st.zone} min={8} max={60} step={1} onChange={set('zone')} />
              <SliderRow label="Range (px)" value={st.range} min={8} max={90} step={1} onChange={set('range')} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

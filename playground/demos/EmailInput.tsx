import { Liquid } from 'liquid-gooey'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DemoProps } from '../App'

/** Same easing table the other demos use; Bounce is the tuned drop pair
 *  (Chips: 360ms + y1 1.4 — a subtle settle, not a springy wobble). */
const EASES: Record<string, string> = {
  Bounce: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
  Bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  Smooth: 'cubic-bezier(0.3, 1.05, 0.4, 1)',
  Snappy: 'cubic-bezier(0.22, 1, 0.36, 1)',
}

interface EbState {
  dur: number
  ease: string
  crossBlur: number
  /** Resting gap between field and button when open — beyond the goo
   *  bridging distance, so the circle fully detaches at rest. */
  gap: number
}

const DEFAULTS: EbState = {
  dur: 360,
  ease: 'Bounce',
  crossBlur: 2,
  gap: 20,
}

/** Stage 290 / field 202 / button 44. The ensemble stays horizontally
 *  centred in BOTH states: closed it is just the pill (field at left 44),
 *  open it is field + gap + button — the field shifts left while the button
 *  detaches right, symmetric about the stage centre. */
const BTN_W = 44
const openX = (gap: number) => ({
  field: -(BTN_W + gap) / 2,
  btn: BTN_W / 2 + 2 + gap / 2,
})

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

export function EmailInput({ blur, contrast, shadow, pro }: DemoProps) {
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState<EbState>(DEFAULTS)
  const set =
    <K extends keyof EbState>(k: K) =>
    (v: EbState[K]) =>
      setSt(prev => ({ ...prev, [k]: v }))
  /** Cross-blur pulse: re-armed on every open/close so the animation
   *  restarts; cleared after it plays. */
  const [pulsing, setPulsing] = useState(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current) }, [])
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Pulse on every open/close, driven by an EFFECT: side effects inside a
  // setState updater are double-invoked by StrictMode and may run during
  // render — the first version silently broke the whole toggle.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    setPulsing(false)
    const raf = requestAnimationFrame(() => setPulsing(true))
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulsing(false), st.dur + 60)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const vars = {
    '--eb-dur': `${st.dur}ms`,
    '--eb-ease': EASES[st.ease],
    '--eb-blur': `${st.crossBlur}px`,
  } as CSSProperties

  return (
    <div className="eb-wrap">
      <div className="stage">
        <Liquid
          blur={blur}
          contrast={contrast}
          fill="#fff"
          shadow={shadow}
          className={`eb ${pulsing ? 'eb-pulsing' : ''}`}
          style={vars}
        >
          {/* The field is a static mirrored item; the submit button is a
              second one hidden INSIDE its right end. Focus slides the button
              out — the goo necks, stretches and lets go: one shape morphs
              into input + circular button, in perfect element/liquid sync. */}
          <Liquid.Item
            className="eb-slot eb-field-slot"
            x={open ? openX(st.gap).field : 0}
            transition={{ duration: st.dur, ease: EASES[st.ease] }}
          >
            <div className="eb-field">
              <input
                ref={inputRef}
                className="eb-input"
                type="email"
                placeholder="Enter your email"
                aria-label="Email address"
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
              />
            </div>
          </Liquid.Item>
          <Liquid.Item
            className="eb-slot eb-btn-slot"
            x={open ? openX(st.gap).btn : 0}
            transition={{ duration: st.dur, ease: EASES[st.ease] }}
          >
            <button
              type="button"
              className={`eb-btn ${open ? 'eb-btn-open' : ''}`}
              aria-label="Submit email"
              tabIndex={open ? 0 : -1}
              onPointerDown={e => e.preventDefault() /* keep the input focused */}
              onClick={() => inputRef.current?.blur()}
            >
              <svg className="eb-arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9h11M9.5 4.5 14 9l-4.5 4.5" />
              </svg>
            </button>
          </Liquid.Item>
        </Liquid>
      </div>

      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">{pro ? 'Email input' : 'Morph'}</span>
            {pro && (
              <span className="cp-actions">
                <button type="button" className="cp-export" onClick={() => setSt(DEFAULTS)}>
                  Reset
                </button>
              </span>
            )}
          </div>
          <SliderRow label="Duration (ms)" value={st.dur} min={120} max={1200} step={10} onChange={set('dur')} />
          <div className="cp-row">
            <span className="cp-label">Easing</span>
            <select className="cp-ease" value={st.ease} onChange={e => set('ease')(e.target.value)}>
              {Object.keys(EASES).map(name => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <SliderRow label="Cross blur (px)" value={st.crossBlur} min={0} max={6} step={0.5} onChange={set('crossBlur')} />
          {pro && (
            <SliderRow label="Gap (px)" value={st.gap} min={8} max={40} step={2} onChange={set('gap')} />
          )}
        </div>
      </div>
    </div>
  )
}

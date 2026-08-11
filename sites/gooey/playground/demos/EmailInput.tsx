import { Liquid } from 'liquid-gooey'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DemoProps } from '../App'

/** Presets seed the four bezier handles; every one stays editable after, so
 *  the curve is fully authorable rather than a fixed menu. Bounce is the
 *  tuned drop pair (Chips: 360ms + y1 1.4 — a settle, not a wobble). */
const EASE_PRESETS: Record<string, [number, number, number, number]> = {
  Bounce: [0.34, 1.4, 0.64, 1],
  Bouncy: [0.34, 1.56, 0.64, 1],
  Smooth: [0.3, 1.05, 0.4, 1],
  Snappy: [0.22, 1, 0.36, 1],
  Linear: [0, 0, 1, 1],
}

type Bez = [number, number, number, number]

interface EbState {
  dur: number
  /** Preset name, or 'Custom' once a handle is edited by hand. */
  ease: string
  bez: Bez
  crossBlur: number
  /** Resting gap between field and button when open — beyond the goo
   *  bridging distance, so the circle fully detaches at rest. */
  gap: number
  gooBlur: number
  gooContrast: number
}

const DEFAULTS: EbState = {
  dur: 600,
  ease: 'Custom',
  bez: [0.22, 1.3, 0.71, 1],
  crossBlur: 2,
  gap: 20,
  gooBlur: 8,
  gooContrast: 22,
}

const bezStr = (b: Bez) => `cubic-bezier(${b.map(v => Number(v.toFixed(2))).join(', ')})`

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

function snippet(s: EbState): string {
  return [
    '// liquid-gooey — Email input values',
    `transition: { duration: ${s.dur}, ease: '${bezStr(s.bez)}' },`,
    `// gap: ${s.gap}px, icon cross blur: ${s.crossBlur}px`,
    `// goo: blur ${s.gooBlur}, contrast ${s.gooContrast}`,
  ].join('\n')
}

export function EmailInput({ shadow, pro, bare }: DemoProps) {
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState<EbState>(DEFAULTS)
  const set =
    <K extends keyof EbState>(k: K) =>
    (v: EbState[K]) =>
      setSt(prev => ({ ...prev, [k]: v }))
  /** Editing a handle detaches from the preset — the menu says Custom, the
   *  curve keeps whatever you dialled in. */
  const setBez = (i: number) => (v: number) =>
    setSt(prev => {
      const bez = [...prev.bez] as Bez
      bez[i] = v
      const match = Object.entries(EASE_PRESETS).find(([, p]) =>
        p.every((n, j) => Math.abs(n - bez[j]) < 0.005),
      )
      return { ...prev, bez, ease: match ? match[0] : 'Custom' }
    })
  const applyPreset = (name: string) =>
    setSt(prev => ({
      ...prev,
      ease: name,
      bez: (EASE_PRESETS[name] ?? prev.bez) as Bez,
    }))

  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  const copyValues = () => {
    navigator.clipboard.writeText(snippet(st)).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1400)
    })
  }

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

  const ease = bezStr(st.bez)
  const vars = {
    '--eb-dur': `${st.dur}ms`,
    '--eb-ease': ease,
    '--eb-blur': `${st.crossBlur}px`,
  } as CSSProperties

  const stage = (
        <Liquid
          blur={st.gooBlur}
          contrast={st.gooContrast}
          fill="var(--modal-bg)"
          shadow={shadow}
          className={`eb ${pulsing ? 'eb-pulsing' : ''}`}
          style={vars}
        >
          {/* The field is a mirrored item; the submit button is a second one
              hidden INSIDE its right end. Focus pushes them apart —
              symmetrically, so the pair stays centred — and the goo necks,
              stretches and lets go on the way out. */}
          <Liquid.Item
            className="eb-slot eb-field-slot"
            x={open ? openX(st.gap).field : 0}
            transition={{ duration: st.dur, ease }}
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
            transition={{ duration: st.dur, ease }}
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
  )
  if (bare) return stage

  return (
    <div className="eb-wrap">
      <div className="stage">{stage}</div>

      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">{pro ? 'Email input' : 'Morph'}</span>
            {pro && (
              <span className="cp-actions">
                <button
                  type="button"
                  className={`cp-export ${copied ? 'is-copied' : ''}`}
                  onClick={copyValues}
                >
                  {copied ? 'Copied' : 'Copy values'}
                </button>
                <button type="button" className="cp-export" onClick={() => setSt(DEFAULTS)}>
                  Reset
                </button>
              </span>
            )}
          </div>
          <SliderRow label="Duration (ms)" value={st.dur} min={120} max={1200} step={10} onChange={set('dur')} />
          <div className="cp-row">
            <span className="cp-label">Easing</span>
            <select className="cp-ease" value={st.ease} onChange={e => applyPreset(e.target.value)}>
              {Object.keys(EASE_PRESETS).map(name => (
                <option key={name}>{name}</option>
              ))}
              {/* Selectable only implicitly — editing a handle lands here. */}
              <option value="Custom">Custom</option>
            </select>
          </div>
          {pro && (
            <>
              <div className="cp-subhead">Easing curve — {ease}</div>
              <SliderRow label="x1" value={st.bez[0]} min={0} max={1} step={0.01} onChange={setBez(0)} />
              <SliderRow label="y1 (bounce)" value={st.bez[1]} min={-1} max={2} step={0.01} onChange={setBez(1)} />
              <SliderRow label="x2" value={st.bez[2]} min={0} max={1} step={0.01} onChange={setBez(2)} />
              <SliderRow label="y2" value={st.bez[3]} min={-1} max={2} step={0.01} onChange={setBez(3)} />
            </>
          )}
          <SliderRow label="Icon cross blur (px)" value={st.crossBlur} min={0} max={6} step={0.5} onChange={set('crossBlur')} />
          {pro && (
            <>
              <div className="cp-subhead">Layout & goo</div>
              <SliderRow label="Gap (px)" value={st.gap} min={8} max={40} step={2} onChange={set('gap')} />
              <SliderRow label="Goo blur" value={st.gooBlur} min={0} max={16} step={0.5} onChange={set('gooBlur')} />
              <SliderRow label="Goo contrast" value={st.gooContrast} min={4} max={40} step={1} onChange={set('gooContrast')} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

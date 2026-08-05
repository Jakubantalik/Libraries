import { Liquid } from 'liquid-gooey'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { DemoProps } from '../App'

const EASES: Record<string, string> = {
  Smooth: 'cubic-bezier(0.3, 1.05, 0.4, 1)',
  Snappy: 'cubic-bezier(0.22, 1, 0.36, 1)',
  Bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'Ease in-out': 'ease-in-out',
  Linear: 'linear',
}

/** One morph phase. Open and close are tuned independently — a menu usually
 *  wants to arrive with some life and leave quickly and quietly. */
interface PhaseState {
  dur: number
  ease: string
  speed: number
  bounce: number
  contentBlur: number
  fadeDur: number
  fadeDelay: number
}

interface MenuState {
  open: PhaseState
  close: PhaseState
}

const DEFAULTS: MenuState = {
  open: {
    dur: 380,
    ease: 'Smooth',
    speed: 1,
    bounce: 0.2,
    contentBlur: 4,
    fadeDur: 140,
    fadeDelay: 90,
  },
  close: {
    dur: 240,
    ease: 'Snappy',
    speed: 1.3,
    bounce: 0,
    contentBlur: 4,
    fadeDur: 90,
    fadeDelay: 0,
  },
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

function Subhead({ children }: { children: ReactNode }) {
  return <div className="cp-subhead">{children}</div>
}

function PhaseGroup({
  title,
  ph,
  pro,
  onChange,
}: {
  title: string
  ph: PhaseState
  pro: boolean
  onChange: <K extends keyof PhaseState>(k: K, v: PhaseState[K]) => void
}) {
  return (
    <>
      <Subhead>{title}</Subhead>
      <SliderRow label="Duration (ms)" value={ph.dur} min={80} max={1200} step={10} onChange={v => onChange('dur', v)} />
      <div className="cp-row">
        <span className="cp-label">Easing</span>
        <select className="cp-ease" value={ph.ease} onChange={e => onChange('ease', e.target.value)}>
          {Object.keys(EASES).map(name => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>
      <SliderRow label="Speed" value={ph.speed} min={0.25} max={3} step={0.05} onChange={v => onChange('speed', v)} />
      <SliderRow label="Bounce" value={ph.bounce} min={0} max={1} step={0.05} onChange={v => onChange('bounce', v)} />
      {pro && (
        <>
          <SliderRow label="Cross blur (px)" value={ph.contentBlur} min={0} max={20} step={0.5} onChange={v => onChange('contentBlur', v)} />
          <SliderRow label="Fade (ms)" value={ph.fadeDur} min={0} max={600} step={10} onChange={v => onChange('fadeDur', v)} />
          <SliderRow label="Fade delay (ms)" value={ph.fadeDelay} min={0} max={600} step={10} onChange={v => onChange('fadeDelay', v)} />
        </>
      )}
    </>
  )
}

/** Formatting actions. Placeholder glyphs — pending the Figma assets. */
const ACTIONS: Array<{ key: string; label: string; glyph: ReactNode }> = [
  { key: 'bold', label: 'Bold', glyph: <span style={{ fontWeight: 700 }}>B</span> },
  { key: 'italic', label: 'Italic', glyph: <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>I</span> },
  { key: 'underline', label: 'Underline', glyph: <span style={{ textDecoration: 'underline' }}>U</span> },
  { key: 'strike', label: 'Strikethrough', glyph: <span style={{ textDecoration: 'line-through' }}>S</span> },
  {
    key: 'link',
    label: 'Link',
    glyph: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 1 0-4.24-4.24L7.56 4.2" />
        <path d="M9.5 6.5a3 3 0 0 0-4.24 0L3.14 8.62a3 3 0 1 0 4.24 4.24l1.06-1.06" />
      </svg>
    ),
  },
]

const MENU_W = 232
const MENU_H = 44
const DOT = 10

/** Frozen geometry for one appearance: the closed circle's box and the open
 *  toolbar's box, both in whole px. Computed ONCE when the selection is made
 *  — recomputing on re-render is what let the toolbar drift. */
interface Anchor {
  dotL: number
  dotT: number
  barL: number
  barT: number
}

export function TextMenu({ blur, contrast, shadow, pro }: DemoProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [st, setSt] = useState<MenuState>(DEFAULTS)
  const setPhase =
    (phase: 'open' | 'close') =>
    <K extends keyof PhaseState>(k: K, v: PhaseState[K]) =>
      setSt(prev => ({ ...prev, [phase]: { ...prev[phase], [k]: v } }))
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  /** Anchor to the current selection. Closed = a circle ON the selected text;
   *  open = the toolbar above it. Both boxes are frozen here in whole px. */
  const syncToSelection = () => {
    const sel = window.getSelection()
    const stage = stageRef.current
    if (!sel || sel.isCollapsed || !stage) return
    const range = sel.getRangeAt(0)
    if (!stage.contains(range.commonAncestorContainer)) return
    const r = range.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    if (r.width < 1) return
    const cx = r.left + r.width / 2 - s.left
    const cy = r.top + r.height / 2 - s.top
    // Rounded to whole px: fractional boxes let the browser resolve the
    // animated rect differently frame to frame, which reads as a drift.
    setAnchor({
      dotL: Math.round(cx - DOT / 2),
      dotT: Math.round(cy - DOT / 2),
      barL: Math.round(
        Math.min(s.width - MENU_W - 8, Math.max(8, cx - MENU_W / 2)),
      ),
      barT: Math.round(Math.max(6, r.top - s.top - 8 - MENU_H)),
    })
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
  }

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      if (open && (!sel || sel.isCollapsed)) setOpen(false)
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [open])

  // Unmount only after the close morph finishes. The clear runs
  // UNCONDITIONALLY: the anchor mounts while `open` is still false (the
  // two-frame circle window), which arms this timer — without the
  // unconditional clear every menu self-destructed ~0.6s after appearing.
  useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (open || !anchor) return
    closeTimer.current = setTimeout(() => setAnchor(null), st.close.dur + 200)
  }, [open, anchor, st.close.dur])

  const ph = open ? st.open : st.close
  const vars = {
    '--tm-dur': `${ph.dur}ms`,
    '--tm-ease': EASES[ph.ease],
    '--tm-fade-dur': `${ph.fadeDur}ms`,
    '--tm-fade-delay': `${ph.fadeDelay}ms`,
    // Positioning MUST be inline: <Liquid> renders its own
    // `style={{ position: 'relative', ... , ...style }}`, and an inline
    // declaration beats a stylesheet rule — via a class the overlay stayed
    // `relative`, dropped into normal flow below the paragraph, and the
    // toolbar anchored ~150px too low.
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  } as CSSProperties

  return (
    <div className="tm-wrap">
      <div className="stage">
        <div ref={stageRef} className="tm-stage">
          {/* The paragraph sits OUTSIDE the liquid group. The group's liquid
              layer paints at z-index -1 *within the group*, so with the text
              inside it the paragraph rendered on top of the black toolbar and
              read as transparency. As a sibling underneath, the toolbar is
              fully opaque over the text. */}
          <p className="tm-text" onPointerUp={syncToSelection}>
            Select any part of this paragraph to format it. The menu grows out
            of the selection as a drop of liquid — and melts away when the
            selection is dismissed.
          </p>
          <Liquid
            blur={blur}
            contrast={contrast}
            fill="#17181c"
            shadow={shadow}
            className="tm-overlay"
            style={vars}
          >
            {anchor && (
              <Liquid.Item
                morph={{
                  shape: true,
                  speed: ph.speed,
                  bounce: ph.bounce,
                  contentBlur: ph.contentBlur,
                }}
              >
                <div
                  className={`tm-menu ${open ? 'tm-menu-open' : ''}`}
                  role="toolbar"
                  aria-label="Text formatting"
                  aria-hidden={!open}
                  style={
                    open
                      ? { left: anchor.barL, top: anchor.barT, width: MENU_W, height: MENU_H }
                      : { left: anchor.dotL, top: anchor.dotT, width: DOT, height: DOT }
                  }
                >
                  {ACTIONS.map(a => (
                    <button
                      key={a.key}
                      type="button"
                      className={`tm-btn ${active[a.key] ? 'tm-btn-active' : ''}`}
                      aria-label={a.label}
                      aria-pressed={!!active[a.key]}
                      tabIndex={open ? 0 : -1}
                      onPointerDown={e => e.preventDefault() /* keep the selection */}
                      onClick={() => setActive(prev => ({ ...prev, [a.key]: !prev[a.key] }))}
                    >
                      {a.glyph}
                    </button>
                  ))}
                </div>
              </Liquid.Item>
            )}
          </Liquid>
        </div>
      </div>

      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">Selection menu</span>
            <span className="cp-actions">
              <button type="button" className="cp-export" onClick={() => setSt(DEFAULTS)}>
                Reset
              </button>
            </span>
          </div>
          <PhaseGroup title="Open" ph={st.open} pro={pro} onChange={setPhase('open')} />
          <PhaseGroup title="Close" ph={st.close} pro={pro} onChange={setPhase('close')} />
        </div>
      </div>
    </div>
  )
}

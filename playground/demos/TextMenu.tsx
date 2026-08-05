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

interface PhaseState {
  dur: number
  ease: string
  fadeDur: number
  fadeDelay: number
}

interface MenuState {
  open: PhaseState
  close: PhaseState
  /** Ms the toolbar waits after the circle pops in (open) — the circle must
   *  exist first for the oval to visibly bud out of it. */
  barDelay: number
  /** Ms the circle lingers after the toolbar has collapsed back into it. */
  dotLinger: number
}

const DEFAULTS: MenuState = {
  open: { dur: 420, ease: 'Bouncy', fadeDur: 140, fadeDelay: 180 },
  close: { dur: 260, ease: 'Snappy', fadeDur: 80, fadeDelay: 0 },
  barDelay: 90,
  dotLinger: 120,
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
const DOT = 12

/** Frozen geometry for one appearance, whole px. The dot sits at the top
 *  edge of the selection; the toolbar's resting spot is just above it, close
 *  enough that the goo filter keeps a liquid neck between the two. */
interface Anchor {
  dotL: number
  dotT: number
  barL: number
  barT: number
  /** Toolbar-centre → dot-centre offset: its collapsed translate. */
  dx: number
  dy: number
}

export function TextMenu({ blur, contrast, shadow, pro }: DemoProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [st, setSt] = useState<MenuState>(DEFAULTS)
  const setShared =
    <K extends 'barDelay' | 'dotLinger'>(k: K) =>
    (v: number) =>
      setSt(prev => ({ ...prev, [k]: v }))
  const setPhase =
    (phase: 'open' | 'close') =>
    <K extends keyof PhaseState>(k: K) =>
    (v: PhaseState[K]) =>
      setSt(prev => ({ ...prev, [phase]: { ...prev[phase], [k]: v } }))
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

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
    const selTop = r.top - s.top
    const dotL = Math.round(cx - DOT / 2)
    const dotT = Math.round(selTop - DOT + 2) // nudged onto the line's cap edge
    const barL = Math.round(Math.min(s.width - MENU_W - 8, Math.max(8, cx - MENU_W / 2)))
    const barT = Math.round(Math.max(6, dotT - 4 - MENU_H))
    setAnchor({
      dotL,
      dotT,
      barL,
      barT,
      dx: dotL + DOT / 2 - (barL + MENU_W / 2),
      dy: dotT + DOT / 2 - (barT + MENU_H / 2),
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

  // Unmount only after the close choreography (toolbar collapse + dot
  // linger) finishes. The clear runs UNCONDITIONALLY — the anchor mounts
  // with `open` still false, and that window must not arm a self-destruct.
  useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (open || !anchor) return
    closeTimer.current = setTimeout(
      () => setAnchor(null),
      st.close.dur + st.dotLinger + 250,
    )
  }, [open, anchor, st.close.dur, st.dotLinger])

  const ph = open ? st.open : st.close
  const vars = {
    '--tm-fade-dur': `${ph.fadeDur}ms`,
    '--tm-fade-delay': `${ph.fadeDelay}ms`,
    // Positioning MUST be inline: <Liquid> renders its own inline
    // `position: relative`, which beats any stylesheet rule.
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  } as CSSProperties

  return (
    <div className="tm-wrap">
      <div className="stage">
        <div ref={stageRef} className="tm-stage">
          {/* The paragraph sits OUTSIDE the liquid group: the liquid paints
              at z -1 within its own group, so text inside the group would
              render on top of the toolbar (the old fake "transparency"). */}
          <p className="tm-text" onPointerUp={syncToSelection}>
            Select any part of this paragraph to format it. The menu grows out
            of the selection as a drop of liquid — and melts away when the
            selection is dismissed.
          </p>
          <Liquid blur={blur} contrast={contrast} fill="#17181c" shadow={shadow} style={vars}>
            {anchor && (
              <>
                {/* TWO liquid elements, both mirrored morph items driven by
                    transform only (translate + scale — the box itself never
                    animates, so there is no geometry left to jump):
                    1. the circle, popping onto the selection;
                    2. the toolbar, budding OUT of the circle — it starts
                       collapsed at the circle's centre and springs up into
                       place, the goo filter necking the two while they
                       separate. At rest they stay close enough to keep a
                       liquid tail down to the selection. */}
                <Liquid.Item
                  scale={open ? 1 : 0.01}
                  transition={{
                    duration: open ? Math.min(200, st.open.dur * 0.5) : Math.max(120, st.close.dur * 0.7),
                    ease: EASES[open ? st.open.ease : st.close.ease],
                  }}
                  delay={open ? 0 : st.dotLinger}
                  style={{ position: 'absolute', left: anchor.dotL, top: anchor.dotT }}
                >
                  <div className="tm-dot" aria-hidden="true" />
                </Liquid.Item>
                <Liquid.Item
                  x={open ? 0 : anchor.dx}
                  y={open ? 0 : anchor.dy}
                  scale={open ? 1 : 0.04}
                  transition={{ duration: ph.dur, ease: EASES[ph.ease] }}
                  delay={open ? st.barDelay : 0}
                  style={{ position: 'absolute', left: anchor.barL, top: anchor.barT }}
                >
                  <div
                    className={`tm-menu ${open ? 'tm-menu-open' : ''}`}
                    role="toolbar"
                    aria-label="Text formatting"
                    aria-hidden={!open}
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
              </>
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
          <Subhead>Open</Subhead>
          <SliderRow label="Duration (ms)" value={st.open.dur} min={80} max={1200} step={10} onChange={setPhase('open')('dur')} />
          <div className="cp-row">
            <span className="cp-label">Easing</span>
            <select className="cp-ease" value={st.open.ease} onChange={e => setPhase('open')('ease')(e.target.value)}>
              {Object.keys(EASES).map(name => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <SliderRow label="Bar delay (ms)" value={st.barDelay} min={0} max={400} step={10} onChange={setShared('barDelay')} />
          {pro && (
            <>
              <SliderRow label="Fade (ms)" value={st.open.fadeDur} min={0} max={600} step={10} onChange={setPhase('open')('fadeDur')} />
              <SliderRow label="Fade delay (ms)" value={st.open.fadeDelay} min={0} max={600} step={10} onChange={setPhase('open')('fadeDelay')} />
            </>
          )}
          <Subhead>Close</Subhead>
          <SliderRow label="Duration (ms)" value={st.close.dur} min={80} max={1200} step={10} onChange={setPhase('close')('dur')} />
          <div className="cp-row">
            <span className="cp-label">Easing</span>
            <select className="cp-ease" value={st.close.ease} onChange={e => setPhase('close')('ease')(e.target.value)}>
              {Object.keys(EASES).map(name => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <SliderRow label="Dot linger (ms)" value={st.dotLinger} min={0} max={500} step={10} onChange={setShared('dotLinger')} />
          {pro && (
            <>
              <SliderRow label="Fade (ms)" value={st.close.fadeDur} min={0} max={600} step={10} onChange={setPhase('close')('fadeDur')} />
              <SliderRow label="Fade delay (ms)" value={st.close.fadeDelay} min={0} max={600} step={10} onChange={setPhase('close')('fadeDelay')} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

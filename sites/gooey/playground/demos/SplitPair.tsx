import { Liquid } from 'liquid-gooey'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DemoProps } from '../App'

/** The plus menu's sibling, stripped to the motion itself: one blank
 *  circle that, on click, divides into two circles side by side — the
 *  liquid necks, stretches and lets go between them — and merges back on
 *  the next click. No icons: the morph is the whole content. Timing is the
 *  plus menu's exactly (bouncy open, snappy close, anticipation nudge on
 *  the way back), so the two read as one family. */

const EASES = {
  open: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  close: 'cubic-bezier(0.22, 1, 0.36, 1)',
}

const DEFAULTS = {
  openDur: 550,
  closeDur: 250,
  /** Half the resting gap between the two circles' centres, px. */
  spread: 34,
  anticipDist: 5,
  anticipDur: 700,
}

export function SplitPair({ blur, contrast, shadow, pro, bare }: DemoProps) {
  const [open, setOpen] = useState(false)
  const [anticipating, setAnticipating] = useState(false)
  const [st, setSt] = useState(DEFAULTS)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const toggle = () => {
    if (open && st.anticipDist > 0) {
      if (timer.current) clearTimeout(timer.current)
      setAnticipating(false)
      requestAnimationFrame(() => setAnticipating(true))
      timer.current = setTimeout(() => setAnticipating(false), st.anticipDur)
    }
    setOpen(o => !o)
  }

  const vars = {
    '--pm-anticip': `${st.anticipDist}px`,
    '--pm-anticip-dur': `${st.anticipDur}ms`,
  } as CSSProperties

  const phase = open
    ? { dur: st.openDur, ease: EASES.open }
    : { dur: st.closeDur, ease: EASES.close }

  const stage = (
    <Liquid
      blur={blur}
      contrast={contrast}
      fill="var(--modal-bg)"
      shadow={shadow}
      className={`pm sp ${open ? 'pm-open' : ''} ${anticipating ? 'pm-anticipating' : ''}`}
      style={vars}
    >
      {/* Two items sharing one resting spot: stacked they are one circle,
          and the symmetric x offsets pull them apart along the horizontal —
          the pair recentres on its own because the offsets are mirrored. */}
      {[-1, 1].map(dir => (
        <Liquid.Item
          key={dir}
          className="pm-slot"
          x={open ? dir * st.spread : 0}
          transition={{ duration: phase.dur, ease: phase.ease }}
        >
          <button
            type="button"
            className="pm-btn sp-btn"
            aria-expanded={open}
            aria-label={open ? 'Merge' : 'Split'}
            onClick={toggle}
          />
        </Liquid.Item>
      ))}
    </Liquid>
  )
  if (bare) return stage

  return (
    <div className="pm-wrap">
      <div className="stage">{stage}</div>
      {pro && (
        <div className="cp-panel">
          <div className="cp-section">
            <div className="cp-section-head">
              <span className="cp-section-title">Split pair</span>
              <span className="cp-actions">
                <button type="button" className="cp-export" onClick={() => setSt(DEFAULTS)}>
                  Reset
                </button>
              </span>
            </div>
            {(
              [
                ['Open (ms)', 'openDur', 80, 1200, 10],
                ['Close (ms)', 'closeDur', 80, 1200, 10],
                ['Spread (px)', 'spread', 12, 80, 1],
                ['Anticipation (px)', 'anticipDist', 0, 24, 1],
              ] as const
            ).map(([label, key, min, max, step]) => (
              <div className="cp-row" key={key}>
                <span className="cp-label">{label}</span>
                <span className="cp-slider">
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={st[key]}
                    onChange={e => setSt(s => ({ ...s, [key]: Number(e.target.value) }))}
                  />
                  <span className="cp-val">{st[key]}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

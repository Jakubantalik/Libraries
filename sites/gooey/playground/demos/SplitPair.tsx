import { Liquid } from 'liquid-gooey'
import { useState } from 'react'
import type { DemoProps } from '../App'

/** The plus menu's sibling, stripped to the motion itself: one blank
 *  circle that, on click, divides into two circles side by side — the
 *  liquid necks, stretches and lets go between them — and merges back on
 *  the next click. No icons: the morph is the whole content. Same curves as
 *  the plus menu (bouncy open, snappy close) at 1.5x its durations, and no
 *  anticipation nudge — the blank pair reads cleanest when the retraction
 *  is just the retraction. Its surface sits 30% brighter than the shared
 *  dark fill, with the inset hairlines lifted by the same 30%: with no
 *  icon to catch the eye, the circle itself has to. */

const EASES = {
  open: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  close: 'cubic-bezier(0.22, 1, 0.36, 1)',
}

const DEFAULTS = {
  // 50% slower than the plus menu's 550 / 250: with nothing inside the
  // circles, the neck stretching and letting go IS the content, and it
  // deserves the extra time to be read.
  openDur: 825,
  closeDur: 375,
  /** Half the resting gap between the two circles' centres, px. */
  spread: 34,
}

/** Dark hairlines x1.3: the two light inset layers (0.04 ring, 0.03 top
 *  highlight) become 0.052 / 0.039. The black outer chain is left alone. */
const brightenHairlines = (shadow: string) =>
  shadow.replace(/0\.04\)/g, '0.052)').replace(/0\.03\)/g, '0.039)')

export function SplitPair({ blur, contrast, shadow, dark, pro, bare }: DemoProps) {
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState(DEFAULTS)
  const toggle = () => setOpen(o => !o)

  const phase = open
    ? { dur: st.openDur, ease: EASES.open }
    : { dur: st.closeDur, ease: EASES.close }

  const stage = (
    <Liquid
      blur={blur}
      contrast={contrast}
      fill="var(--sp-fill, var(--modal-bg))"
      shadow={dark ? brightenHairlines(shadow) : shadow}
      className={`pm sp ${open ? 'pm-open' : ''}`}
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

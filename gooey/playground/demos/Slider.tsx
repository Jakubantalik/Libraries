import { Liquid } from 'liquid-gooey'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { DemoProps } from '../App'

// Track spans 14..226 (240 - 14px insets each side); thumb is 24px, so its
// left offset travels 0..188 to stay flush with the track ends.
const MAX = 188

/** The Figma thumb shadow (outer blur + 1px ring), rendered on the liquid
 *  silhouette so it follows the lagging drop instead of the pointer. Inset
 *  layers from the design are approximated with the outer ring — the goo
 *  shadow chain doesn't support inset. */
const P3 =
  typeof CSS !== 'undefined' && CSS.supports?.('color', 'color(display-p3 0 0 0 / 0.2)')
const c = (rgba: string, p3: string) => (P3 ? p3 : rgba)

const THUMB_SHADOW = {
  light: '0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 5px rgba(0, 0, 0, 0.08)',
  // Decoded from the Logram slider export's own filter chain (dilate 1 @ .06,
  // dy2/blur6 @ .05, dy4/blur42 @ .24, inner dy1 @ .03, inner erode1 @ .04):
  // the thumb wears the same stack as every other Logram surface.
  dark:
    `0 0 0 1px ${c('rgba(255, 255, 255, 0.04)', 'color(display-p3 1 1 1 / 0.04)')} inset, ` +
    `0 1px 0 0 ${c('rgba(255, 255, 255, 0.03)', 'color(display-p3 1 1 1 / 0.03)')} inset, ` +
    `0 0 0 1px ${c('rgba(0, 0, 0, 0.06)', 'color(display-p3 0 0 0 / 0.06)')}, ` +
    `0 2px 6px 0 ${c('rgba(0, 0, 0, 0.05)', 'color(display-p3 0 0 0 / 0.05)')}, ` +
    `0 4px 42px 0 ${c('rgba(0, 0, 0, 0.24)', 'color(display-p3 0 0 0 / 0.24)')}`,
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

export function Slider({ blur, contrast, dark, bare }: DemoProps) {
  const [x, setX] = useState(84)
  const drag = useRef<number | null>(null)
  /** The public Move knobs; defaults reproduce the tuned look. */
  const [mv, setMv] = useState({ springiness: 0.5, stretch: 0.6, trail: 0.35 })

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events have no active pointer */
    }
    drag.current = e.clientX - x
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current == null) return
    setX(Math.min(MAX, Math.max(0, e.clientX - drag.current)))
  }
  const endDrag = () => {
    drag.current = null
  }

  const stage = (
        <Liquid blur={blur} contrast={contrast} fill="var(--sl-thumb)" shadow={dark ? THUMB_SHADOW.dark : THUMB_SHADOW.light} className="sl">
          <div className="sl-track" aria-hidden="true" />
          <Liquid.Item effect="move" move={mv}>
            <div
              className="sl-thumb"
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((x / MAX) * 100)}
              tabIndex={0}
              style={{ transform: `translateX(${x}px)` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </Liquid.Item>
        </Liquid>
  )
  if (bare) return stage

  return (
    <div className="sl-wrap">
      <div className="stage">{stage}</div>

      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">Move</span>
          </div>
          <SliderRow label="Springiness" value={mv.springiness} min={0} max={1} step={0.05} onChange={v => setMv(s => ({ ...s, springiness: v }))} />
          <SliderRow label="Stretch" value={mv.stretch} min={0} max={1} step={0.02} onChange={v => setMv(s => ({ ...s, stretch: v }))} />
          <SliderRow label="Trail" value={mv.trail} min={0} max={1} step={0.025} onChange={v => setMv(s => ({ ...s, trail: v }))} />
        </div>
      </div>
    </div>
  )
}

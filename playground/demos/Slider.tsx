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
const THUMB_SHADOW = '0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 5px rgba(0, 0, 0, 0.08)'

export function Slider({ blur, contrast }: DemoProps) {
  const [x, setX] = useState(84)
  const drag = useRef<number | null>(null)

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

  return (
    <Liquid blur={blur} contrast={contrast} fill="#fff" shadow={THUMB_SHADOW} className="sl">
      <div className="sl-track" aria-hidden="true" />
      <Liquid.Item effect="move">
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
}

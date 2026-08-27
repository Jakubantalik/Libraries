import { Liquid } from 'liquid-gooey'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import meltA from '../assets/melt/bloom.jpg'
import meltB from '../assets/melt/neon.jpg'
import type { DemoProps } from '../App'

/** Hero block for effect="melt": two draggable photos that run molten into
 *  each other. Uses the PUBLIC library effect — the marketing page should
 *  show what someone gets from `npm install`, not the lab's internals. */

const CARD = 84
const STAGE_H = 200

interface Pos {
  x: number
  y: number
}

function Card({
  src,
  pos,
  setPos,
  stageRef,
}: {
  src: string
  pos: Pos
  setPos: (p: Pos) => void
  stageRef: React.RefObject<HTMLDivElement | null>
}) {
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null)
  return (
    <div
      className="mp-card"
      // Size lives here, not in CSS: the melt reads the element's real rect,
      // so the constant and the painted card must not be able to disagree.
      style={{ left: pos.x, top: pos.y, width: CARD, height: CARD }}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        drag.current = { id: e.pointerId, dx: e.clientX - pos.x, dy: e.clientY - pos.y }
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={e => {
        const d = drag.current
        if (!d || e.pointerId !== d.id) return
        // Clamp against the stage's LIVE size: the hero cell squeezes this
        // block well below its nominal width on narrow viewports, so a
        // constant bound would let the cards drag outside the card.
        const box = stageRef.current?.getBoundingClientRect()
        const maxX = Math.max(0, (box?.width ?? CARD * 2) - CARD)
        const maxY = Math.max(0, (box?.height ?? STAGE_H) - CARD)
        setPos({
          x: Math.max(0, Math.min(maxX, e.clientX - d.dx)),
          y: Math.max(0, Math.min(maxY, e.clientY - d.dy)),
        })
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <img src={src} alt="" draggable={false} />
    </div>
  )
}

export function MeltPair({ bare }: DemoProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [a, setA] = useState<Pos>({ x: 0, y: (STAGE_H - CARD) / 2 })
  const [b, setB] = useState<Pos>({ x: CARD + 24, y: (STAGE_H - CARD) / 2 })
  const placed = useRef(false)

  /** Lay the pair out symmetrically once the stage has a measured width,
   *  and again if it changes — the two cards start a hair apart so the goo
   *  is already necking, which is what makes the block read at a glance. */
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const place = () => {
      const w = el.getBoundingClientRect().width
      if (!w) return
      const gap = Math.min(20, Math.max(4, w - CARD * 2 - 8))
      const total = CARD * 2 + gap
      const left = Math.max(0, (w - total) / 2)
      setA({ x: left, y: (STAGE_H - CARD) / 2 })
      setB({ x: left + CARD + gap, y: (STAGE_H - CARD) / 2 })
      placed.current = true
    }
    place()
    const ro = new ResizeObserver(() => {
      if (!placed.current) place()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    placed.current = false
  }, [])

  const content = (
    <Liquid className="mp" style={{ width: '100%', height: STAGE_H }} ref={stageRef}>
      <Liquid.Item effect="melt">
        <Card src={meltA} pos={a} setPos={setA} stageRef={stageRef} />
      </Liquid.Item>
      <Liquid.Item effect="melt">
        <Card src={meltB} pos={b} setPos={setB} stageRef={stageRef} />
      </Liquid.Item>
    </Liquid>
  )
  if (bare) return content
  return <div className="stage">{content}</div>
}

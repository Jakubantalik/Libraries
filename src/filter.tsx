import type { ReactElement } from 'react'
import type { ShadowLayer } from './shadow'

/** Alpha-binarize matrix used before spread dilation: the goo alpha has a soft
 *  fringe past the opaque edge — dilating it directly pushes a spread ring a
 *  pixel out and the fringe reads as a second hairline. */
const BINARIZE = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -29.5'

/** CSS inset emulation on the LIQUID: paint the colour where the silhouette
 *  is NOT covered by a shrunk/offset/blurred copy of itself, clipped back to
 *  the silhouette — an inner ring (spread), inner edge line (offset) or soft
 *  inner shadow (blur) that follows the merged goo through every state. */
function InsetPass({ i, s }: { i: number; s: ShadowLayer }): ReactElement {
  const parts: ReactElement[] = [
    <feColorMatrix key="bin" in="shape" type="matrix" values={BINARIZE} result={`s${i}-bin`} />,
  ]
  let src = `s${i}-bin`
  // A pure edge-line inset (offset only, no spread) still needs a 1px-ish
  // body to subtract; erode by the offset magnitude so the line has width.
  const erode = Math.max(Math.abs(s.spread), s.spread === 0 ? Math.max(Math.abs(s.x), Math.abs(s.y)) : 0)
  if (erode > 0) {
    parts.push(
      <feMorphology key="er" in={src} operator="erode" radius={erode} result={`s${i}-er`} />,
    )
    src = `s${i}-er`
  }
  if (s.x !== 0 || s.y !== 0) {
    parts.push(<feOffset key="o" in={src} dx={s.x} dy={s.y} result={`s${i}-o`} />)
    src = `s${i}-o`
  }
  if (s.blur > 0) {
    parts.push(<feGaussianBlur key="b" in={src} stdDeviation={s.blur / 2} result={`s${i}-b`} />)
    src = `s${i}-b`
  }
  parts.push(
    // The band: silhouette minus its shrunk/offset self.
    <feComposite key="band" in={`s${i}-bin`} in2={src} operator="out" result={`s${i}-band`} />,
    <feFlood key="c" floodColor={s.color} result={`s${i}-c`} />,
    <feComposite key="f" in={`s${i}-c`} in2={`s${i}-band`} operator="in" result={`s${i}`} />,
  )
  return <>{parts}</>
}

function ShadowPass({ i, s }: { i: number; s: ShadowLayer }): ReactElement {
  const parts: ReactElement[] = []
  let src = 'shape'
  if (s.spread !== 0) {
    parts.push(
      <feColorMatrix key="bin" in="shape" type="matrix" values={BINARIZE} result={`s${i}-bin`} />,
      <feMorphology
        key="sp"
        in={`s${i}-bin`}
        operator={s.spread > 0 ? 'dilate' : 'erode'}
        radius={Math.abs(s.spread)}
        result={`s${i}-sp`}
      />,
    )
    src = `s${i}-sp`
  }
  if (s.blur > 0) {
    parts.push(<feGaussianBlur key="b" in={src} stdDeviation={s.blur / 2} result={`s${i}-b`} />)
    src = `s${i}-b`
  }
  if (s.x !== 0 || s.y !== 0) {
    parts.push(<feOffset key="o" in={src} dx={s.x} dy={s.y} result={`s${i}-o`} />)
    src = `s${i}-o`
  }
  parts.push(
    <feFlood key="c" floodColor={s.color} result={`s${i}-c`} />,
    <feComposite key="f" in={`s${i}-c`} in2={src} operator="in" result={`s${i}`} />,
  )
  return <>{parts}</>
}

export function GooFilterPrimitives({
  blur,
  contrast,
  shadows,
}: {
  blur: number
  contrast: number
  shadows: ShadowLayer[]
}): ReactElement {
  // Intercept tracks the slope so the alpha threshold stays near the same
  // crossing as the classic 18/-7 goo pairing.
  const intercept = Math.round((0.5 - contrast * (5 / 12)) * 100) / 100
  return (
    <>
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
      <feColorMatrix
        in="blur"
        type="matrix"
        values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${intercept}`}
        result="goo"
      />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" result="shape" />
      {shadows.map((s, i) =>
        s.inset ? <InsetPass key={i} i={i} s={s} /> : <ShadowPass key={i} i={i} s={s} />,
      )}
      {shadows.length > 0 && (
        <feMerge>
          {/* CSS paints the first shadow of the list on top: outer passes
              merge in reverse (among themselves) BELOW the shape; inset
              passes paint ABOVE it — they live inside the liquid edge. */}
          {shadows
            .map((s, i) => (!s.inset ? i : -1))
            .filter(i => i >= 0)
            .reverse()
            .map(i => (
              <feMergeNode key={i} in={`s${i}`} />
            ))}
          <feMergeNode in="shape" />
          {shadows.map((s, i) => (s.inset ? <feMergeNode key={i} in={`s${i}`} /> : null))}
        </feMerge>
      )}
    </>
  )
}

import type { ReactElement } from 'react'
import type { ShadowLayer } from './shadow'

/** Alpha-binarize matrix used before spread dilation: the goo alpha has a soft
 *  fringe past the opaque edge — dilating it directly pushes a spread ring a
 *  pixel out and the fringe reads as a second hairline. */
const BINARIZE = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -29.5'

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
      {shadows.map((s, i) => (
        <ShadowPass key={i} i={i} s={s} />
      ))}
      {shadows.length > 0 && (
        <feMerge>
          {/* CSS paints the first shadow of the list on top: merge in reverse,
              shape last so the liquid sits above all of its shadows. */}
          {shadows.map((_, i) => (
            <feMergeNode key={i} in={`s${shadows.length - 1 - i}`} />
          ))}
          <feMergeNode in="shape" />
        </feMerge>
      )}
    </>
  )
}

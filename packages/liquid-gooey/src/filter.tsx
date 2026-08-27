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
  const parts: ReactElement[] = []
  // `bin` is computed once for the whole stack (see GooFilterPrimitives) —
  // every full-region pass costs real milliseconds on WebKit's CPU
  // rasterizer, and each pass here used to re-binarize `shape` identically.
  let src = 'bin'
  // Erode by the SPREAD only. An offset-only inset (`inset 0 1px 0 0`) must
  // leave a 1px strip along the TOP edge and nothing else — eroding for it
  // too shrinks the shape all round and paints a spurious ring on the sides
  // and bottom, doubling up with a real inner ring in the same stack.
  if (s.spread !== 0) {
    parts.push(
      <feMorphology
        key="er"
        in={src}
        operator={s.spread > 0 ? 'erode' : 'dilate'}
        radius={Math.abs(s.spread)}
        result={`s${i}-er`}
      />,
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
    <feComposite key="band" in="bin" in2={src} operator="out" result={`s${i}-band`} />,
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
      <feMorphology
        key="sp"
        in="bin"
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
  waviness = 0,
  wavinessFreq = 0.018,
}: {
  blur: number
  contrast: number
  shadows: ShadowLayer[]
  /** Max px the liquid boundary undulates. 0 (default) = calm geometric edge. */
  waviness?: number
  /** Noise frequency of the undulation — lower = longer, lazier waves. */
  wavinessFreq?: number
}): ReactElement {
  const wavy = waviness > 0
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
      <feComposite
        in="SourceGraphic"
        in2="goo"
        operator="atop"
        result={wavy ? 'shape-raw' : 'shape'}
      />
      {/* The liquid boundary itself undulates: the whole silhouette — edges,
          neck, shadow source — runs through one gentle displacement field, so
          the surface reads as fluid even at rest. Shadows consume the
          displaced 'shape', so they hug the wavy edge exactly. */}
      {wavy && (
        <>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={wavinessFreq}
            numOctaves={2}
            seed="7"
            result="wave-noise"
          />
          <feDisplacementMap
            in="shape-raw"
            in2="wave-noise"
            scale={waviness * 2}
            xChannelSelector="R"
            yChannelSelector="G"
            result="shape"
          />
        </>
      )}
      {/* Binarized silhouette, computed ONCE and shared by every pass that
          needs it. Each inset pass and each spread pass used to run this
          identical feColorMatrix themselves — on a 5-layer stack that was
          three redundant full-region passes per repaint. */}
      {shadows.some(s => s.inset || s.spread !== 0) && (
        <feColorMatrix in="shape" type="matrix" values={BINARIZE} result="bin" />
      )}
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

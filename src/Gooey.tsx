import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type Ref,
} from 'react'
import { GooeyContext, type GooeyContextValue } from './context'
import { GooFilterPrimitives } from './filter'
import { useIsoLayoutEffect } from './hooks'
import { ObserveEngine } from './observer'
import { parseShadow } from './shadow'

export interface GooeyProps extends HTMLAttributes<HTMLDivElement> {
  /** Goo blur sigma in px — how far apart pieces start bridging. Default 6. */
  blur?: number
  /** Alpha-contrast slope — how sharp the liquid edge is. Default 18. */
  contrast?: number
  /** Fill of the liquid surface. Any CSS color, `var()` welcome. Default '#fff'. */
  fill?: string
  /** `box-shadow` syntax; rendered on the MERGED silhouette (inset unsupported). */
  shadow?: string
  /** Extra filter-region slack in px for blobs travelling outside the group box. Default 24. */
  filterPadding?: number
}

/** Gooey group: renders the silhouette SVG layer (goo filter + shadow chain)
 *  behind its children. Children stay crisp; <Gooey.Item> mirrors each piece's
 *  geometry into the liquid layer.
 *
 *  Filters run on SVG content — not CSS url() filters on HTML — because that
 *  is the one variant WebKit renders correctly and promotes properly. */
export const GooeyRoot = forwardRef<HTMLDivElement, GooeyProps>(function Gooey(
  {
    blur = 6,
    contrast = 18,
    fill = '#fff',
    shadow,
    filterPadding = 24,
    className,
    style,
    children,
    ...rest
  },
  fwd: Ref<HTMLDivElement>,
) {
  const groupRef = useRef<HTMLDivElement | null>(null)
  const [portal, setPortal] = useState<SVGGElement | null>(null)
  const [meltPortal, setMeltPortal] = useState<SVGGElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      groupRef.current = node
      if (typeof fwd === 'function') fwd(node)
      else if (fwd) (fwd as { current: HTMLDivElement | null }).current = node
    },
    [fwd],
  )

  const filterId = `gooey-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const shadows = useMemo(() => parseShadow(shadow), [shadow])

  useIsoLayoutEffect(() => {
    const el = groupRef.current
    if (!el) return
    const measure = () =>
      setSize(prev =>
        prev.w === el.offsetWidth && prev.h === el.offsetHeight
          ? prev
          : { w: el.offsetWidth, h: el.offsetHeight },
      )
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const engine = useMemo(() => new ObserveEngine(() => groupRef.current), [])
  useEffect(() => () => engine.dispose(), [engine])
  useEffect(() => {
    engine.gooBlur = blur
  }, [engine, blur])

  const ctx = useMemo<GooeyContextValue>(
    () => ({ portal, meltPortal, fill, getGroup: () => groupRef.current, engine }),
    [portal, meltPortal, fill, engine],
  )

  const shadowExtent = shadows.reduce(
    (m, s) => Math.max(m, Math.max(Math.abs(s.x), Math.abs(s.y)) + s.blur * 1.5 + Math.max(0, s.spread)),
    0,
  )
  const pad = Math.ceil(blur * 3 + shadowExtent + filterPadding)

  return (
    <div
      {...rest}
      ref={setRefs}
      className={className}
      style={{ position: 'relative', isolation: 'isolate', ...style }}
    >
      {/* zIndex -1 inside the isolated group: the liquid paints above the
          group's own background but below every child, positioned or not. */}
      <svg
        aria-hidden="true"
        focusable="false"
        data-gooey-svg=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: -1,
          // Promote the filtered layer: WebKit otherwise repaints the goo a
          // frame or two behind the plain-DOM content.
          willChange: 'filter, transform',
        }}
      >
        <defs>
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            x={-pad}
            y={-pad}
            width={size.w + pad * 2}
            height={size.h + pad * 2}
            colorInterpolationFilters="sRGB"
          >
            <GooFilterPrimitives blur={blur} contrast={contrast} shadows={shadows} />
          </filter>
        </defs>
        <g ref={setPortal} filter={`url(#${filterId})`} style={{ fill }} />
      </svg>
      {/* Melt overlay: warped-image copies render here, ABOVE the content
          layer. SVG content so displacement/blur filters work in WebKit. */}
      <svg
        aria-hidden="true"
        focusable="false"
        data-gooey-overlay=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
          // Above the content layer by design, and high enough that an app's
          // own stacking (e.g. a dragged item raised over its neighbours)
          // can't slip in front and hide the melt. Scoped: the group is an
          // isolated stacking context, so this can't escape it.
          zIndex: 9999,
        }}
      >
        <g ref={setMeltPortal} />
      </svg>
      <GooeyContext.Provider value={ctx}>{children}</GooeyContext.Provider>
    </div>
  )
})

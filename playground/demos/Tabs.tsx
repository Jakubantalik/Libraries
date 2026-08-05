import { Liquid } from 'liquid-gooey'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { DemoProps } from '../App'

const TABS = ['Plan', 'Debug', 'Ask']

/** The indicator pill's own elevation, rendered on the liquid silhouette so
 *  it travels (and stretches) with the drop, never detaching from it. */
const PILL_SHADOW = '0 1px 3px rgba(0, 0, 0, 0.11), 0 1px 1px rgba(0, 0, 0, 0.07)'

const EASES: Record<string, string> = {
  Smooth: 'cubic-bezier(0.3, 1.05, 0.4, 1)',
  Snappy: 'cubic-bezier(0.22, 1, 0.36, 1)',
  Bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'Ease in-out': 'ease-in-out',
  Linear: 'linear',
}

interface TabState {
  slideDur: number
  slideEase: string
  stiffness: number
  damping: number
  stretch: number
  tail: number
  gooBlur: number
}

const DEFAULTS: TabState = {
  slideDur: 250,
  slideEase: 'Smooth',
  stiffness: 380,
  damping: 24.5,
  stretch: 0.18,
  tail: 0.46,
  // Goo blur must stay proportional to the feature size: the indicator is only
  // 30px tall, and a large sigma smooths its semicircular end-caps into a
  // shallower curve — the pill stops reading as a pill.
  gooBlur: 3.5,
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

function tabsSnippet(s: TabState): string {
  return [
    '// liquid-gooey — Tabs values',
    `transition: { duration: ${s.slideDur}, easing: '${EASES[s.slideEase]}' },`,
    'move={{',
    `  stiffness: ${s.stiffness}, damping: ${s.damping}, stretch: ${s.stretch}, tail: ${s.tail},`,
    '}}',
    `// goo blur: ${s.gooBlur}`,
  ].join('\n')
}

export function Tabs({ contrast, pro }: DemoProps) {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [ind, setInd] = useState({ x: 3, w: 0 })
  const [st, setSt] = useState<TabState>(DEFAULTS)
  /** Simple mode drives the public slim knobs (defaults = the tuned look). */
  const [slim, setSlim] = useState({ springiness: 0.5, trail: 0.575 })
  const set =
    <K extends keyof TabState>(k: K) =>
    (v: TabState[K]) =>
      setSt(prev => ({ ...prev, [k]: v }))
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  const copyValues = () => {
    navigator.clipboard.writeText(tabsSnippet(st)).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1400)
    })
  }

  useLayoutEffect(() => {
    const el = tabRefs.current[active]
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth })
  }, [active])

  return (
    <div className="tb-wrap">
      <div className="stage">
        <Liquid
          blur={st.gooBlur}
          contrast={contrast}
          fill="#0f0f0f"
          shadow={PILL_SHADOW}
          className="tb"
          style={
            {
              '--tb-dur': `${st.slideDur}ms`,
              '--tb-ease': EASES[st.slideEase],
            } as CSSProperties
          }
        >
          {/* Gray bar under the goo layer (like the slider track): the liquid
              pill must paint over it, not be sliced by it. */}
          <div className="tb-bar" aria-hidden="true" />
          {/* The indicator is the liquid: the element is invisible and only
              carries geometry — CSS slides it, effect="move" makes the surface
              trail as a drop with rubber stretch and a tail. */}
          <Liquid.Item
            effect="move"
            move={
              pro
                ? {
                    advanced: {
                      stiffness: st.stiffness,
                      damping: st.damping,
                      stretch: st.stretch,
                      tail: st.tail,
                    },
                  }
                : { springiness: slim.springiness, trail: slim.trail }
            }
          >
            <div
              className="tb-ind"
              style={{ transform: `translateX(${ind.x}px)`, width: ind.w || 0 }}
            />
          </Liquid.Item>
          <div className="tb-tabs" role="tablist" aria-label="Mode">
            {TABS.map((label, i) => (
              <button
                key={label}
                ref={el => {
                  tabRefs.current[i] = el
                }}
                type="button"
                role="tab"
                className="tb-tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </Liquid>
      </div>

      {!pro && (
        <div className="cp-panel">
          <div className="cp-section">
            <div className="cp-section-head">
              <span className="cp-section-title">Move</span>
            </div>
            <SliderRow label="Springiness" value={slim.springiness} min={0} max={1} step={0.05} onChange={v => setSlim(s => ({ ...s, springiness: v }))} />
            <SliderRow label="Trail" value={slim.trail} min={0} max={1} step={0.025} onChange={v => setSlim(s => ({ ...s, trail: v }))} />
          </div>
        </div>
      )}
      {pro && (
      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">Tabs controls</span>
            <span className="cp-actions">
              <button
                type="button"
                className={`cp-export ${copied ? 'is-copied' : ''}`}
                onClick={copyValues}
              >
                {copied ? 'Copied' : 'Copy values'}
              </button>
              <button type="button" className="cp-export" onClick={() => setSt(DEFAULTS)}>
                Reset
              </button>
            </span>
          </div>
          <Subhead>Slide</Subhead>
          <SliderRow label="Duration (ms)" value={st.slideDur} min={80} max={1200} step={10} onChange={set('slideDur')} />
          <div className="cp-row">
            <span className="cp-label">Easing</span>
            <select
              className="cp-ease"
              value={st.slideEase}
              onChange={e => set('slideEase')(e.target.value)}
            >
              {Object.keys(EASES).map(name => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <Subhead>Liquid trail</Subhead>
          <SliderRow label="Stiffness" value={st.stiffness} min={40} max={1200} step={10} onChange={set('stiffness')} />
          <SliderRow label="Damping" value={st.damping} min={2} max={60} step={0.5} onChange={set('damping')} />
          <SliderRow label="Stretch" value={st.stretch} min={0} max={0.6} step={0.02} onChange={set('stretch')} />
          <SliderRow label="Tail size" value={st.tail} min={0} max={0.8} step={0.02} onChange={set('tail')} />
          <SliderRow label="Goo blur" value={st.gooBlur} min={0} max={8} step={0.5} onChange={set('gooBlur')} />
        </div>
      </div>
      )}
    </div>
  )
}

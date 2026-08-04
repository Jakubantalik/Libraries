import { Liquid } from 'liquid-gooey'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DemoProps } from '../App'

import iconChat from '../assets/icon-chat.svg'
import iconCopy from '../assets/icon-copy.svg'
import iconDots from '../assets/icon-dots.svg'
import iconX from '../assets/icon-x.svg'

const ITEMS = [
  { label: 'Share on X', icon: iconX },
  { label: 'Share via Chat', icon: iconChat },
  { label: 'Share via Chat', icon: iconChat },
  { label: 'Copy link', icon: iconCopy },
]

const EASES: Record<string, string> = {
  Smooth: 'cubic-bezier(0.3, 1.05, 0.4, 1)',
  Snappy: 'cubic-bezier(0.22, 1, 0.36, 1)',
  Bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'Ease in-out': 'ease-in-out',
  Linear: 'linear',
}

interface PhaseState {
  dur: number
  ease: string
  radDur: number
  radDelay: number
  radEase: string
  fadeDur: number
  fadeDelay: number
  stagger: number
}

interface EvolveState {
  open: PhaseState
  close: PhaseState
  massK: number
  massC: number
  sizeK: number
  sizeC: number
  radK: number
  radC: number
  anticipation: number
  travel: number
  roundness: number
  crossBlur: number
  gooBlur: number
  contrast: number
}

const DEFAULTS: EvolveState = {
  open: {
    dur: 460,
    ease: 'Smooth',
    radDur: 820,
    radDelay: 0,
    radEase: 'Smooth',
    fadeDur: 150,
    fadeDelay: 60,
    stagger: 35,
  },
  close: {
    dur: 420,
    ease: 'Smooth',
    radDur: 1080,
    radDelay: 0,
    radEase: 'Smooth',
    fadeDur: 120,
    fadeDelay: 0,
    stagger: 0,
  },
  massK: 320,
  massC: 17,
  sizeK: 380,
  sizeC: 26,
  radK: 900,
  radC: 60,
  anticipation: 40,
  travel: 32,
  roundness: 1,
  crossBlur: 7,
  gooBlur: 6,
  contrast: 18,
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

function EaseRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="cp-row">
      <span className="cp-label">{label}</span>
      <select className="cp-ease" value={value} onChange={e => onChange(e.target.value)}>
        {Object.keys(EASES).map(name => (
          <option key={name}>{name}</option>
        ))}
      </select>
    </div>
  )
}

function Subhead({ children }: { children: ReactNode }) {
  return <div className="cp-subhead">{children}</div>
}

function phaseSnippet(ph: PhaseState): string {
  return (
    `{ duration: ${ph.dur}, easing: '${EASES[ph.ease]}', ` +
    `radius: { duration: ${ph.radDur}, delay: ${ph.radDelay}, easing: '${EASES[ph.radEase]}' }, ` +
    `fade: { duration: ${ph.fadeDur}, delay: ${ph.fadeDelay}, stagger: ${ph.stagger} } }`
  )
}

function stateToSnippet(s: EvolveState): string {
  return [
    '// liquid-gooey — Evolve values',
    `open: ${phaseSnippet(s.open)},`,
    `close: ${phaseSnippet(s.close)},`,
    'evolve={{',
    `  massStiffness: ${s.massK}, massDamping: ${s.massC},`,
    `  sizeStiffness: ${s.sizeK}, sizeDamping: ${s.sizeC},`,
    `  radiusStiffness: ${s.radK}, radiusDamping: ${s.radC},`,
    `  anticipation: ${s.anticipation}, travel: ${s.travel},`,
    `  roundness: ${s.roundness}, contentBlur: ${s.crossBlur},`,
    '}}',
    `// goo: blur ${s.gooBlur}, contrast ${s.contrast}`,
  ].join('\n')
}

function PhaseGroup({
  title,
  ph,
  onChange,
}: {
  title: string
  ph: PhaseState
  onChange: <K extends keyof PhaseState>(k: K, v: PhaseState[K]) => void
}) {
  return (
    <>
      <Subhead>{title}</Subhead>
      <SliderRow label="Size duration (ms)" value={ph.dur} min={60} max={1500} step={20} onChange={v => onChange('dur', v)} />
      <EaseRow label="Size easing" value={ph.ease} onChange={v => onChange('ease', v)} />
      <SliderRow label="Radius duration (ms)" value={ph.radDur} min={60} max={1500} step={20} onChange={v => onChange('radDur', v)} />
      <SliderRow label="Radius delay (ms)" value={ph.radDelay} min={0} max={800} step={10} onChange={v => onChange('radDelay', v)} />
      <EaseRow label="Radius easing" value={ph.radEase} onChange={v => onChange('radEase', v)} />
      <SliderRow label="Fade duration (ms)" value={ph.fadeDur} min={0} max={600} step={10} onChange={v => onChange('fadeDur', v)} />
      <SliderRow label="Fade delay (ms)" value={ph.fadeDelay} min={0} max={600} step={10} onChange={v => onChange('fadeDelay', v)} />
      <SliderRow label="Fade stagger (ms)" value={ph.stagger} min={0} max={200} step={5} onChange={v => onChange('stagger', v)} />
    </>
  )
}

export function Evolve({ shadow, pro }: DemoProps) {
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState<EvolveState>(DEFAULTS)
  /** Simple mode: the two public morph knobs (defaults = the tuned look). */
  const [slim, setSlim] = useState({ speed: 1, bounce: 0.5 })
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  const copyValues = () => {
    navigator.clipboard.writeText(stateToSnippet(st)).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1400)
    })
  }
  const setShared =
    <K extends keyof EvolveState>(k: K) =>
    (v: EvolveState[K]) =>
      setSt(prev => ({ ...prev, [k]: v }))
  const setPhase =
    (phase: 'open' | 'close') =>
    <K extends keyof PhaseState>(k: K, v: PhaseState[K]) =>
      setSt(prev => ({ ...prev, [phase]: { ...prev[phase], [k]: v } }))

  // The vars of the TARGET state apply at the same commit as the class flip,
  // so opening uses the Open group and closing uses the Close group.
  const ph = open ? st.open : st.close
  const vars = {
    '--ev-dur': `${ph.dur}ms`,
    '--ev-ease': EASES[ph.ease],
    '--ev-rad-dur': `${ph.radDur}ms`,
    '--ev-rad-delay': `${ph.radDelay}ms`,
    '--ev-rad-ease': EASES[ph.radEase],
    '--ev-fade-dur': `${ph.fadeDur}ms`,
  } as CSSProperties

  return (
    <div className="ev-wrap">
      <div className="stage">
        <Liquid
          blur={st.gooBlur}
          contrast={st.contrast}
          fill="#fff"
          shadow={shadow}
          className="ev"
          style={vars}
        >
          <Liquid.Item
            morph={{
              shape: true,
              speed: pro ? 1 : slim.speed,
              bounce: pro ? 0.5 : slim.bounce,
              advanced: {
                evolve: {
                  ...(pro
                    ? {
                        massStiffness: st.massK,
                        massDamping: st.massC,
                        sizeStiffness: st.sizeK,
                        sizeDamping: st.sizeC,
                        radiusStiffness: st.radK,
                        radiusDamping: st.radC,
                        anticipation: st.anticipation,
                        travel: st.travel,
                        roundness: st.roundness,
                        contentBlur: st.crossBlur,
                      }
                    : null),
                  // The corner timeline runs off the Radius values of the
                  // target state — the demo's CSS animates the element with
                  // the same numbers, so the liquid and the content agree.
                  cornerDuration: ph.radDur,
                  cornerDelay: ph.radDelay,
                  cornerEase: EASES[ph.radEase],
                },
              },
            }}
          >
            <div className={`dd ${open ? 'dd-open' : ''}`}>
              <button
                type="button"
                className="dd-toggle"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-label={open ? 'Close menu' : 'Open menu'}
              >
                <img src={iconDots} width={16} height={16} alt="" draggable={false} />
              </button>
              <div className="dd-items">
                {ITEMS.map((it, i) => (
                  <button
                    type="button"
                    key={i}
                    className="dd-item"
                    style={{ transitionDelay: `${ph.fadeDelay + i * ph.stagger}ms` }}
                    tabIndex={open ? 0 : -1}
                    onClick={() => setOpen(false)}
                  >
                    <img src={it.icon} width={16} height={16} alt="" draggable={false} />
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          </Liquid.Item>
        </Liquid>
      </div>

      {!pro && (
        <div className="cp-panel">
          <div className="cp-section">
            <div className="cp-section-head">
              <span className="cp-section-title">Morph</span>
            </div>
            <SliderRow label="Speed" value={slim.speed} min={0.25} max={3} step={0.05} onChange={v => setSlim(s => ({ ...s, speed: v }))} />
            <SliderRow label="Bounce" value={slim.bounce} min={0} max={1} step={0.05} onChange={v => setSlim(s => ({ ...s, bounce: v }))} />
          </div>
        </div>
      )}
      {pro && (
      <div className="cp-panel">
        <div className="cp-section">
          <div className="cp-section-head">
            <span className="cp-section-title">Evolve controls</span>
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
          <PhaseGroup title="Open" ph={st.open} onChange={setPhase('open')} />
          <PhaseGroup title="Close" ph={st.close} onChange={setPhase('close')} />
          <Subhead>Liquid springs</Subhead>
          <SliderRow label="Mass stiffness" value={st.massK} min={40} max={1200} step={10} onChange={setShared('massK')} />
          <SliderRow label="Mass damping" value={st.massC} min={2} max={80} step={0.5} onChange={setShared('massC')} />
          <SliderRow label="Size stiffness" value={st.sizeK} min={40} max={1200} step={10} onChange={setShared('sizeK')} />
          <SliderRow label="Size damping" value={st.sizeC} min={2} max={80} step={0.5} onChange={setShared('sizeC')} />
          <SliderRow label="Radius stiffness" value={st.radK} min={40} max={1200} step={10} onChange={setShared('radK')} />
          <SliderRow label="Radius damping" value={st.radC} min={2} max={80} step={0.5} onChange={setShared('radC')} />
          <SliderRow label="Anticipation (ms)" value={st.anticipation} min={0} max={300} step={10} onChange={setShared('anticipation')} />
          <SliderRow label="Travel (px)" value={st.travel} min={0} max={120} step={2} onChange={setShared('travel')} />
          <Subhead>Liquid look</Subhead>
          <SliderRow label="Roundness" value={st.roundness} min={0} max={1} step={0.05} onChange={setShared('roundness')} />
          <SliderRow label="Cross blur (px)" value={st.crossBlur} min={0} max={20} step={0.5} onChange={setShared('crossBlur')} />
          <SliderRow label="Goo blur" value={st.gooBlur} min={0} max={16} step={0.5} onChange={setShared('gooBlur')} />
          <SliderRow label="Goo contrast" value={st.contrast} min={4} max={40} step={1} onChange={setShared('contrast')} />
        </div>
      </div>
      )}
    </div>
  )
}

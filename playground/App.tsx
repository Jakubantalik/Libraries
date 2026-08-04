import { useState } from 'react'
import { Chips } from './demos/Chips'
import { Evolve } from './demos/Evolve'
import { PlusMenu } from './demos/PlusMenu'
import { Slider } from './demos/Slider'
import { Tabs } from './demos/Tabs'

export interface DemoProps {
  blur: number
  contrast: number
  shadow: string
  /** Pro mode (?pro in the URL): full raw-physics control panels. The default
   *  playground shows only the slim public knobs. */
  pro: boolean
}

const SHADOWS: Record<string, string> = {
  'Figma soft':
    '0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.05), 0 4px 42px rgba(0, 0, 0, 0.06)',
  Floating: '0 2px 6px rgba(0, 0, 0, 0.08), 0 12px 32px rgba(0, 0, 0, 0.18)',
  None: '',
}

const PRO = new URLSearchParams(window.location.search).has('pro')

export function App() {
  const [blur, setBlur] = useState(6)
  const [contrast, setContrast] = useState(18)
  const [shadowName, setShadowName] = useState('Figma soft')
  const demo: DemoProps = { blur, contrast, shadow: SHADOWS[shadowName], pro: PRO }

  return (
    <div className="page">
      <header className="header">
        <h1>
          Liquid Gooey <span className="tag">liquid UI for React</span>
        </h1>
        <p>
          Two effects: <strong>Morph</strong> merges, reshapes and dissolves touching pieces;{' '}
          <strong>Move</strong> trails a moving element as liquid rubber. One silhouette layer
          carries the goo and the shadow of the merged liquid; your real UI — text, icons,
          images — rides crisp on top. SVG-content filters, so it renders the same in Chrome,
          Firefox and Safari.
        </p>
      </header>

      <div className="knobs">
        <label className="knob">
          <span>Goo blur</span>
          <input
            type="range"
            min={0}
            max={16}
            step={0.5}
            value={blur}
            onChange={e => setBlur(Number(e.target.value))}
          />
          <code>{blur}</code>
        </label>
        <label className="knob">
          <span>Contrast</span>
          <input
            type="range"
            min={4}
            max={40}
            step={1}
            value={contrast}
            onChange={e => setContrast(Number(e.target.value))}
          />
          <code>{contrast}</code>
        </label>
        <label className="knob">
          <span>Shadow</span>
          <select value={shadowName} onChange={e => setShadowName(e.target.value)}>
            {Object.keys(SHADOWS).map(name => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        {/* The pro panels were previously only reachable by typing ?pro — a
            hidden flag reads as "the controls disappeared". */}
        <a className="knob-link" href={PRO ? '/' : '/?pro'}>
          {PRO ? '← Simple controls' : 'Pro controls →'}
        </a>
      </div>

      <main className="grid">
        <section className="card">
          <p className="card-label">Morph — plus menu</p>
          <PlusMenu {...demo} />
          <p className="card-note">
            The component drives the springs; wrapper and blob share one transition — pixel-perfect
            sync, staggered satellites.
          </p>
        </section>
        <section className="card">
          <p className="card-label">Move — gooey tabs</p>
          <Tabs {...demo} />
          <p className="card-note">
            Switch tabs and the indicator trails as a drop with rubber stretch.{' '}
            <code>effect="move"</code>
          </p>
        </section>
        <section className="card">
          <p className="card-label">Morph — avatar group</p>
          <Chips {...demo} />
          <p className="card-note">
            Drag the avatar into the pill — it dissolves in on contact and the group grows, the
            pill resizing with a liquid follow. <code>morph=&#123;&#123; dissolve &#125;&#125;</code>
          </p>
        </section>
        <section className="card">
          <p className="card-label">Morph — shape change</p>
          <Evolve {...demo} />
          <p className="card-note">
            Click the ⋯ button — it morphs into a dropdown: the liquid mass flows toward the new
            centre first, then size and corner radius adapt.{' '}
            <code>morph=&#123;&#123; shape &#125;&#125;</code>
          </p>
        </section>
        <section className="card">
          <p className="card-label">Move — liquid rubber</p>
          <Slider {...demo} />
          <p className="card-note">
            Drag the thumb — the surface trails as a moving drop with a liquid tail, snapping back
            with a wobble. <code>effect="move"</code>
          </p>
        </section>
      </main>
    </div>
  )
}

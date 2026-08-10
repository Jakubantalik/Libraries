import { useEffect, useState } from 'react'
import { Cards } from './demos/Cards'
import { EmailInput } from './demos/EmailInput'
import { Chips } from './demos/Chips'
import { PlusMenu } from './demos/PlusMenu'
import { Slider } from './demos/Slider'
import { Tabs } from './demos/Tabs'

export type Theme = 'light' | 'dark'

export interface DemoProps {
  blur: number
  contrast: number
  shadow: string
  /** Demos that carry their OWN shadow (tabs pill, slider thumb) need to pick
   *  a variant: the liquid `fill` themes itself through a CSS variable, but
   *  `shadow` is PARSED by the library into filter primitives, so it can't be
   *  a var() — and dark wants different geometry anyway, not a recolour. */
  dark: boolean
  /** Pro mode (?pro in the URL): full raw-physics control panels. The default
   *  playground shows only the slim public knobs. */
  pro: boolean
}

/** Wider-gamut colours when the browser has them, matching how the design's
 *  own CSS ships a `color(display-p3 ...)` variant beside every rgba one.
 *  The library parses this string into filter primitives, so the swap has to
 *  happen here rather than in a stylesheet @supports block. */
const P3 =
  typeof CSS !== 'undefined' && CSS.supports?.('color', 'color(display-p3 0 0 0 / 0.2)')
const p3 = (tpl: string) =>
  tpl
    .replace(/\{w4\}/g, P3 ? 'color(display-p3 1 1 1 / 0.04)' : 'rgba(255, 255, 255, 0.04)')
    .replace(/\{w3\}/g, P3 ? 'color(display-p3 1 1 1 / 0.03)' : 'rgba(255, 255, 255, 0.03)')
    .replace(/\{k6\}/g, P3 ? 'color(display-p3 0 0 0 / 0.06)' : 'rgba(0, 0, 0, 0.06)')
    .replace(/\{k5\}/g, P3 ? 'color(display-p3 0 0 0 / 0.05)' : 'rgba(0, 0, 0, 0.05)')
    .replace(/\{k24\}/g, P3 ? 'color(display-p3 0 0 0 / 0.24)' : 'rgba(0, 0, 0, 0.24)')

/** Light keeps the prototype's Figma elevation. Dark is the Logram spec. */
const SHADOWS: Record<Theme, Record<string, string>> = {
  light: {
    'Figma soft':
      '0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.05), 0 4px 42px rgba(0, 0, 0, 0.06)',
    Floating: '0 2px 6px rgba(0, 0, 0, 0.08), 0 12px 32px rgba(0, 0, 0, 0.18)',
    None: '',
  },
  // Logram dropdown spec (Figma 2572:83262), verbatim and in the design's
  // layer order: two light inset layers (inner hairline + top highlight),
  // then the black outer chain. The engine renders inset passes on the
  // MERGED silhouette, so the inner edge survives every neck and split.
  dark: {
    'Figma soft': p3(
      '0 0 0 1px {w4} inset, 0 1px 0 0 {w3} inset, ' +
        '0 0 0 1px {k6}, 0 2px 6px 0 {k5}, 0 4px 42px 0 {k24}',
    ),
    Floating: '0 2px 6px rgba(0, 0, 0, 0.4), 0 12px 32px rgba(0, 0, 0, 0.55)',
    None: '',
  },
}

const PRO = new URLSearchParams(window.location.search).has('pro')

const STORE_KEY = 'liquid-gooey-theme'
/** Stored choice wins; otherwise follow the OS. */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* private mode / storage disabled */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function App() {
  const [blur, setBlur] = useState(6)
  const [contrast, setContrast] = useState(18)
  const [shadowName, setShadowName] = useState('Figma soft')
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const dark = theme === 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORE_KEY, theme)
    } catch {
      /* private mode / storage disabled */
    }
  }, [theme])

  const demo: DemoProps = {
    blur,
    contrast,
    shadow: SHADOWS[theme][shadowName],
    dark,
    pro: PRO,
  }

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
            {Object.keys(SHADOWS[theme]).map(name => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="knob-link"
          aria-pressed={dark}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {dark ? '☀ Light' : '☾ Dark'}
        </button>
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
            pill resizing with a liquid follow. <code>dissolve</code>
          </p>
        </section>
        <section className="card">
          <p className="card-label">Morph — melting cards</p>
          <Cards {...demo} />
          <p className="card-note">
            Drag either photo — bring them close and the surfaces neck into one
            liquid while the images melt into each other at the seam.{' '}
            <code>dissolve</code>
          </p>
        </section>
        <section className="card">
          <p className="card-label">Morph — email input</p>
          <EmailInput {...demo} />
          <p className="card-note">
            Click the field — the submit button buds out of its end as a
            droplet and fully detaches, the pair recentring symmetrically,
            with a subtle bounce and cross-blur.
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

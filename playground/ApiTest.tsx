/** Consumer torture test: uses ONLY the public library + inline styles.
 *  No playground CSS, no demo components — exactly what someone gets after
 *  `npm install liquid-gooey`. Visit /?test */
import { Liquid } from 'liquid-gooey'
import { forwardRef, useState, type ButtonHTMLAttributes } from 'react'

/** Stand-in for a user's own design-system component: its own class, own
 *  background, own radius, forwards props, wraps its children in extra DOM. */
const DsButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function DsButton({ children, style, ...rest }, ref) {
    return (
      <button
        ref={ref}
        {...rest}
        style={{
          background: '#fff',
          border: 0,
          borderRadius: 12,
          padding: '10px 16px',
          font: 'inherit',
          fontSize: 14,
          cursor: 'pointer',
          ...style,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{children}</span>
      </button>
    )
  },
)

const box: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  background: '#fafafa',
}

export function ApiTest() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)
  const [big, setBig] = useState(false)

  return (
    <div style={{ font: '14px/1.5 system-ui, sans-serif', padding: 32, display: 'grid', gap: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Consumer API test — library only, no demo CSS</h1>

      {/* 1. Arbitrary user component, mirrored morph */}
      <section style={box} data-test="morph-mirrored">
        <p>1. Morph on a user's own component (x/y driven)</p>
        <Liquid blur={6} contrast={18} fill="#fff" shadow="0 2px 8px rgba(0,0,0,.12)"
          style={{ width: 320, height: 160, position: 'relative' }}>
          <Liquid.Item x={open ? -70 : 0} y={open ? -40 : 0} transition="bouncy"
            style={{ position: 'absolute', left: 130, top: 60 }}>
            <DsButton data-role="sat">A</DsButton>
          </Liquid.Item>
          <Liquid.Item x={open ? 70 : 0} y={open ? -40 : 0} transition="bouncy" delay={40}
            style={{ position: 'absolute', left: 130, top: 60 }}>
            <DsButton data-role="sat">B</DsButton>
          </Liquid.Item>
          <Liquid.Item style={{ position: 'absolute', left: 130, top: 60 }}>
            <DsButton data-role="main" onClick={() => setOpen(o => !o)}>Menu</DsButton>
          </Liquid.Item>
        </Liquid>
      </section>

      {/* 2. Layout safety: items inside a plain flex row */}
      <section style={box} data-test="flex-layout">
        <p>2. Items inside a plain flex row (wrapper must not break layout)</p>
        <Liquid blur={5} fill="#fff" shadow="0 1px 4px rgba(0,0,0,.12)"
          style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8 }}>
          <Liquid.Item observe><DsButton>One</DsButton></Liquid.Item>
          <Liquid.Item observe><DsButton>Two</DsButton></Liquid.Item>
          <Liquid.Item observe><DsButton>Three</DsButton></Liquid.Item>
        </Liquid>
      </section>

      {/* 3. Morph shape on a user's own resizable card */}
      <section style={box} data-test="morph-shape">
        <p>3. morph=&#123;&#123; shape &#125;&#125; on a user's own card that resizes via CSS</p>
        <Liquid blur={6} fill="#fff" shadow="0 2px 8px rgba(0,0,0,.12)"
          style={{ width: 340, height: 200, position: 'relative' }}>
          <Liquid.Item morph={{ shape: true }} style={{ position: 'absolute', left: 16, top: 16 }}>
            <div
              data-role="card"
              onClick={() => setBig(b => !b)}
              style={{
                width: big ? 280 : 120,
                height: big ? 150 : 44,
                borderRadius: big ? 20 : 22,
                transition: 'width 420ms cubic-bezier(.3,1.05,.4,1), height 420ms cubic-bezier(.3,1.05,.4,1), border-radius 420ms',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {big ? 'Click to shrink' : 'Expand'}
            </div>
          </Liquid.Item>
        </Liquid>
      </section>

      {/* 4. Move on an arbitrary user element */}
      <section style={box} data-test="move">
        <p>4. effect="move" on a user's own tab indicator</p>
        <Liquid blur={3.5} fill="#fff" shadow="0 1px 3px rgba(0,0,0,.15)"
          style={{ position: 'relative', width: 300, height: 44, background: '#eceef1', borderRadius: 22, padding: 4 }}>
          <Liquid.Item effect="move" move={{ springiness: 0.5, trail: 0.6 }}>
            <div
              data-role="ind"
              style={{
                position: 'absolute', left: 4, top: 4, width: 94, height: 36, borderRadius: 18,
                transform: `translateX(${tab * 96}px)`,
                transition: 'transform 320ms cubic-bezier(.3,1.05,.4,1)',
              }}
            />
          </Liquid.Item>
          <div style={{ position: 'relative', display: 'flex' }}>
            {['One', 'Two', 'Three'].map((t, i) => (
              <button key={t} data-role="tab" onClick={() => setTab(i)}
                style={{ width: 96, height: 36, border: 0, background: 'transparent', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
                {t}
              </button>
            ))}
          </div>
        </Liquid>
      </section>
    </div>
  )
}

import { useState, useCallback, useId, useRef, useLayoutEffect, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BorderBeam, type BorderBeamSize, type BorderBeamColorVariant } from 'border-beam';

function CopyIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" width="15" height="16" viewBox="0 0 1200 1227">
      <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" />
    </svg>
  );
}

function AtSignIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" style={{ transform: 'rotate(90deg)' }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function TaskCircleIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 17.5 17.5" fill="none">
      <circle cx="8.75" cy="8.75" r="8" stroke="#818181" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function HeaderIcon() {
  return (
    <div className="header-icon" aria-hidden="true">
      <img
        className="header-icon-img"
        src={`${import.meta.env.BASE_URL}icon-web.png`}
        alt=""
        width={207}
        height={138}
      />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      className="copy-btn"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : label}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={copied ? 'check' : 'copy'}
          initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          className="copy-btn-icon"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

function MockChatInput() {
  return (
    <div className="mock-chat" role="img" aria-label="Chat input UI example with border beam effect">
      <div className="mock-chat-inner">
        <div className="pill">
          <AtSignIcon />
        </div>
        <div className="placeholder">Build anything...</div>
        <div className="bottom-row">
          <div className="tag">
            Agent
            <ChevronDownIcon />
          </div>
          <div className="tag">
            Auto
            <ChevronDownIcon />
          </div>
          <div className="send-btn">
            <ArrowUpIcon />
          </div>
        </div>
      </div>
    </div>
  );
}

const WORKING_TASKS = [
  'Generate website color palettes',
  'Recommend font pairings',
  'Create layout templates',
  'Build section engine',
  'Generate hero section variants',
  'Produce responsive mobile layouts',
];

function MockWorkingCard() {
  return (
    <div className="mock-working" role="img" aria-label="Agent task list UI example with border beam effect">
      <div className="mock-working-header t-shimmer" data-text="Working...">Working...</div>
      <div className="mock-working-list">
        {WORKING_TASKS.map((task) => (
          <div className="mock-working-row" key={task}>
            <TaskCircleIcon />
            <span>{task}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockSubscribeButton() {
  return (
    <div className="mock-subscribe" role="img" aria-label="Subscribe button UI example with border beam effect">
      Subscribe
    </div>
  );
}

function MockIconButton() {
  return (
    <div className="mock-icon-btn" role="img" aria-label="Icon button UI example with border beam effect">
      <div className="mock-icon-btn-square" />
    </div>
  );
}

function MockSearchBar() {
  return (
    <div className="mock-search" role="img" aria-label="Search bar UI example with border beam effect">
      <div className="mock-search-inner">
        <SearchIcon />
        <span>Search</span>
      </div>
    </div>
  );
}

type BeamFamily = 'rotate' | 'pulse';

const FAMILY_OPTIONS: { value: BeamFamily; label: string }[] = [
  { value: 'rotate', label: 'Rotate' },
  { value: 'pulse', label: 'Pulse' },
];

const ROTATE_SIZE_OPTIONS: { value: BorderBeamSize; label: string }[] = [
  { value: 'md', label: 'Large' },
  { value: 'sm', label: 'Small' },
  { value: 'line', label: 'Line' },
];

const PULSE_SIZE_OPTIONS: { value: BorderBeamSize; label: string }[] = [
  { value: 'pulse-inner', label: 'Pulse Inner' },
  { value: 'pulse-outside', label: 'Pulse Outside' },
];

const SIZE_OPTIONS_BY_FAMILY: Record<BeamFamily, { value: BorderBeamSize; label: string }[]> = {
  rotate: ROTATE_SIZE_OPTIONS,
  pulse: PULSE_SIZE_OPTIONS,
};

const DEFAULT_SIZE_BY_FAMILY: Record<BeamFamily, BorderBeamSize> = {
  rotate: 'md',
  pulse: 'pulse-inner',
};

// URL <-> tab mapping. `/pulse` deep-links to the Pulse tab; everything else
// (including `/`) is Rotate. GitHub Pages serves the SPA fallback (404.html)
// so a direct visit to /pulse resolves before React mounts.
function familyFromPath(pathname: string): BeamFamily {
  return /\/pulse\/?$/i.test(pathname) ? 'pulse' : 'rotate';
}

function pathForFamily(family: BeamFamily): string {
  return family === 'pulse' ? '/pulse' : '/';
}

const COLOR_OPTIONS: { value: BorderBeamColorVariant; label: string }[] = [
  { value: 'colorful', label: 'Colorful' },
  { value: 'mono', label: 'Mono' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'sunset', label: 'Sunset' },
];

export default function App() {
  const [family, setFamily] = useState<BeamFamily>(() => familyFromPath(window.location.pathname));
  const [playgroundActive, setPlaygroundActive] = useState(true);
  const [playgroundSize, setPlaygroundSize] = useState<BorderBeamSize>(
    () => DEFAULT_SIZE_BY_FAMILY[familyFromPath(window.location.pathname)]
  );
  const [playgroundColorVariant, setPlaygroundColorVariant] = useState<BorderBeamColorVariant>('colorful');
  const [playgroundStrength, setPlaygroundStrength] = useState(70);
  const strengthId = useId();

  const sizeOptions = SIZE_OPTIONS_BY_FAMILY[family];
  const isPulse = family === 'pulse';
  const rotateTabActive = family === 'rotate';
  const pulseTabActive = family === 'pulse';

  const handleFamilyChange = useCallback((next: BeamFamily) => {
    setFamily(next);
    setPlaygroundSize(DEFAULT_SIZE_BY_FAMILY[next]);
    const path = pathForFamily(next);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  // Keep the tab in sync with browser back/forward navigation.
  useEffect(() => {
    const onPopState = () => {
      const next = familyFromPath(window.location.pathname);
      setFamily(next);
      setPlaygroundSize(DEFAULT_SIZE_BY_FAMILY[next]);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sliding tab pill (transitions.dev — tabs sliding). animate=false snaps
  // without a transition (first paint / resize); animate=true tweens.
  const tabListRef = useRef<HTMLElement>(null);
  const tabPillRef = useRef<HTMLSpanElement>(null);
  const tabPillReady = useRef(false);

  const moveTabPill = useCallback((animate: boolean) => {
    const pill = tabPillRef.current;
    const list = tabListRef.current;
    if (!pill || !list) return;
    const activeTab = list.querySelector<HTMLButtonElement>('.tab-btn[data-active="true"]');
    if (!activeTab) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = 'none';
      pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
      pill.style.width = `${activeTab.offsetWidth}px`;
      void pill.offsetWidth; // force reflow before restoring
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
      pill.style.width = `${activeTab.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    moveTabPill(tabPillReady.current);
    tabPillReady.current = true;
  }, [family, moveTabPill]);

  useEffect(() => {
    const onResize = () => moveTabPill(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [moveTabPill]);

  const installCmd = 'npm install border-beam';
  const usageCode = `import { BorderBeam } from 'border-beam';

<BorderBeam>
  <YourCard>Content</YourCard>
</BorderBeam>`;
  const playgroundCode = `<BorderBeam size="${playgroundSize}" colorVariant="${playgroundColorVariant}"${playgroundStrength < 100 ? ` strength={${playgroundStrength / 100}}` : ''}>
  <Card>Content</Card>
</BorderBeam>`;

  const rotateExamples = (
    <>
      <div className="example-row-full">
        <BorderBeam size="md" colorVariant="colorful" theme="dark" active={rotateTabActive}>
          <MockChatInput />
        </BorderBeam>
      </div>
      <div className="example-row-split">
        <div className="example-cell">
          <BorderBeam size="sm" colorVariant="colorful" theme="dark" active={rotateTabActive}>
            <MockIconButton />
          </BorderBeam>
        </div>
        <div className="example-cell">
          <BorderBeam
            size="line"
            colorVariant="colorful"
            theme="dark"
            active={rotateTabActive}
            duration={3.1}
            borderRadius={20}
          >
            <MockSearchBar />
          </BorderBeam>
        </div>
      </div>
    </>
  );

  const pulseExamples = (
    <>
      <div className="example-row-full">
        <BorderBeam size="pulse-inner" colorVariant="colorful" theme="dark" active={pulseTabActive}>
          <MockWorkingCard />
        </BorderBeam>
      </div>
      <div className="example-row-split">
        <div className="example-cell">
          <BorderBeam size="pulse-inner" colorVariant="colorful" theme="dark" active={pulseTabActive}>
            <MockSubscribeButton />
          </BorderBeam>
        </div>
        <div className="example-cell">
          <BorderBeam size="pulse-outside" colorVariant="colorful" theme="dark" active={pulseTabActive}>
            <MockChatInput />
          </BorderBeam>
        </div>
      </div>
    </>
  );

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <main id="main-content" className="app">
        <header className="header">
          <nav aria-label="External links" className="top-bar-links">
            <a className="icon-btn" href="https://github.com/Jakubantalik/border-beam" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository">
              <GitHubIcon />
            </a>
            <a className="icon-btn" href="https://x.com/jakubantalik" target="_blank" rel="noopener noreferrer" aria-label="Follow on X (Twitter)">
              <XIcon />
            </a>
          </nav>
          <HeaderIcon />
          <h1 className="title">Border beam</h1>
          <p className="subtitle-sm">Animated border beam component</p>
        </header>

        <nav className="tab-nav" role="tablist" aria-label="Effect family" ref={tabListRef}>
          <span className="tab-nav-pill" aria-hidden="true" ref={tabPillRef} />
          {FAMILY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className="tab-btn"
              role="tab"
              aria-selected={family === value}
              data-active={family === value}
              onClick={() => handleFamilyChange(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section
          className="examples-section t-page-slide"
          data-page={family === 'rotate' ? '1' : '2'}
          aria-label="Effect demonstrations"
        >
          <div
            className="t-page examples-page examples-page--rotate"
            data-page-id="1"
            aria-hidden={family !== 'rotate'}
          >
            {rotateExamples}
          </div>
          <div
            className="t-page examples-page examples-page--pulse"
            data-page-id="2"
            aria-hidden={family !== 'pulse'}
          >
            {pulseExamples}
          </div>
        </section>

        <section className="section" aria-label="Installation">
          <h2 className="section-title">Installation</h2>
          <div className="code-block">
            <code>{installCmd}</code>
            <CopyButton text={installCmd} label="Copy install command" />
          </div>
        </section>

        <section className="section" aria-label="Usage">
          <h2 className="section-title section-title--muted">Usage</h2>
          <div className="code-block code-block--multi">
            <code>{usageCode}</code>
            <CopyButton text={usageCode} label="Copy usage example" />
          </div>
        </section>

        <section className="playground-section" aria-label="Interactive playground">
          <h2 className="section-title">Playground</h2>

          <div className="playground-controls">
            <div className="control-group" role="radiogroup" aria-label="Effect type">
              <span className="control-label">Type</span>
              <div className="control-options">
                {sizeOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    className="tab-btn"
                    role="radio"
                    aria-checked={playgroundSize === value}
                    data-active={playgroundSize === value}
                    onClick={() => setPlaygroundSize(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group" role="radiogroup" aria-label="Color variant">
              <span className="control-label">Color</span>
              <div className="control-options">
                {COLOR_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    className="tab-btn"
                    role="radio"
                    aria-checked={playgroundColorVariant === value}
                    data-active={playgroundColorVariant === value}
                    onClick={() => setPlaygroundColorVariant(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group control-group--strength">
              <span className="control-label">Strength</span>
              <div className="strength-track">
                {playgroundStrength > 0 && (
                  <div
                    className="strength-fill"
                    style={{ width: `${playgroundStrength}%` }}
                  />
                )}
                <span className="strength-value">{playgroundStrength}%</span>
                <input
                  id={strengthId}
                  type="range"
                  className="strength-input"
                  value={playgroundStrength}
                  onChange={(e) => setPlaygroundStrength(parseInt(e.target.value, 10))}
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Effect strength"
                />
              </div>
            </div>
          </div>

          <div
            className={`playground-preview${isPulse ? ' playground-preview--pulse' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={playgroundActive}
            aria-label={playgroundActive ? 'Pause animation' : 'Play animation'}
            onClick={() => setPlaygroundActive(!playgroundActive)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPlaygroundActive(!playgroundActive);
              }
            }}
          >
            <BorderBeam
              size={playgroundSize}
              colorVariant={playgroundColorVariant}
              theme="dark"
              active={playgroundActive}
              strength={playgroundStrength / 100}
            >
              <div className={`card ${playgroundSize === 'sm' ? 'card-sm' : 'card-md'}`}>
                <p className="card-text">
                  {playgroundSize === 'sm' ? '' : 'Build anything...'}
                </p>
              </div>
            </BorderBeam>
          </div>

          <div className="code-block code-block--multi">
            <code>{playgroundCode}</code>
            <CopyButton text={playgroundCode} label="Copy playground code" />
          </div>
        </section>

        <footer className="footer">
          <span className="footer-muted">Made by</span>{' '}
          <a className="footer-name" href="https://x.com/jakubantalik" target="_blank" rel="noopener noreferrer">Jakub Antalik</a>
        </footer>
      </main>
    </>
  );
}

import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThinkingOrb, type OrbSize, type OrbState } from "thinking-orbs";

/* Orb detail page — playground island (stage + controls + live snippet).
   Mirrors the live playground at sites/orbs/components/Playground.tsx:
   nine state tabs, 64/20 size tabs, starts paused. */

const STATES: OrbState[] = [
  "working",
  "searching",
  "solving",
  "listening",
  "connecting",
  "weaving",
  "composing",
  "breathing",
  "shaping",
];
/* Two sizes here; 32px and the speed knob live in the Studio. */
const SIZES: OrbSize[] = [64, 20];


function buildSnippet(state: OrbState, size: OrbSize): string {
  const props = [`state="${state}"`, `size={${size}}`];
  return `import { ThinkingOrb } from 'thinking-orbs';\n\n<ThinkingOrb ${props.join(" ")} />`;
}

function CopyIcon() {
  return (
    <svg className="icon-copy" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="icon-check" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const onClick = () => {
    if (navigator.clipboard) void navigator.clipboard.writeText(getText()).catch(() => {});
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" className="code-copy" data-copied={copied ? "true" : undefined} aria-label={label} onClick={onClick}>
      <CopyIcon />
      <CheckIcon />
    </button>
  );
}

function OrbPlayground() {
  const [state, setState] = useState<OrbState>("listening");
  const [size, setSize] = useState<OrbSize>(64);
  // Starts paused so the page loads quietly (same as the live playground).
  const [paused, setPaused] = useState(true);

  const snippet = buildSnippet(state, size);

  return (
    <>
      {/* The demo page's own examples first: the orb doing its job inside
          the status pills and chips it was drawn for, before any knobs. */}
      <div className="detail-examples">
        <div className="example-row-full">
          <div className="ex-stack">
            <span className="ex-pill">
              <ThinkingOrb state="solving" size={64} theme="dark" paused={paused} />
              Solving…
            </span>
          </div>
        </div>
        <div className="example-row-split">
          <div className="example-cell">
            <div className="ex-stack">
              <span className="ex-chip">
                <ThinkingOrb state="searching" size={20} theme="dark" paused={paused} />
                Searching
              </span>
              <span className="ex-chip">
                <ThinkingOrb state="weaving" size={20} theme="dark" paused={paused} />
                Planning
              </span>
            </div>
          </div>
          <div className="example-cell">
            <div className="ex-stack">
              <span className="ex-pill">
                <ThinkingOrb state="composing" size={64} theme="dark" paused={paused} />
                Thinking…
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="detail-playground-label">Playground</p>

      <div className="pg-stage">
        {/* key remounts the canvas on state/size change, matching the live playground */}
        <ThinkingOrb key={`${state}-${size}`} state={state} size={size} paused={paused} theme="dark" />
        <button
          type="button"
          className="btn-animate pg-play"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={!paused}
        >
          {paused ? "Play" : "Pause"}
        </button>
      </div>

      <div className="pg-controls">
        <div className="pg-field" role="radiogroup" aria-label="Orb state">
          <span className="pg-label">State</span>
          <div className="pg-tabs">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                className="pg-tab"
                role="radio"
                aria-checked={state === s}
                data-active={state === s}
                onClick={() => setState(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-field" role="radiogroup" aria-label="Orb size">
          <span className="pg-label">Size</span>
          <div className="pg-tabs">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className="pg-tab"
                role="radio"
                aria-checked={size === s}
                data-active={size === s}
                onClick={() => setSize(s)}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className="code-block pg-snippet">
        <pre>{snippet}</pre>
        <CopyButton getText={() => snippet} label="Copy playground snippet" />
      </div>
    </>
  );
}

const el = document.getElementById("playground-root");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <OrbPlayground />
    </StrictMode>
  );
}

import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CodeBlock } from "./examples/CodeCopy";
import { StudioTeaser } from "./examples/StudioTeaser";
import { ThinkingOrb, type OrbSize, type OrbState } from "thinking-orbs";

/* Orb detail page — playground island (stage + controls + live snippet).
   Mirrors the live playground at sites/orbs/components/Playground.tsx:
   nine state tabs, 64/20 size tabs, starts paused. */

/* Examples data, mirroring sites/orbs/components/Examples.tsx. */
const HERO_PILLS: Array<{ state: OrbState; label: string }> = [
  { state: "solving", label: "Solving…." },
  { state: "composing", label: "Thinking…." },
];

/* Order matters: with row-major auto-placement over 151px rows, this
   sequence of 1- and 2-row spans tiles five rows with no leftover gaps. */
const CHIP_STATES: OrbState[] = [
  "listening",
  "working",
  "searching",
  "connecting",
  "weaving",
  "breathing",
  "shaping",
];

/* Chip states that render as full large pills (the rest stay compact). */
const LARGE_CHIPS = new Set<OrbState>(["working", "searching", "connecting"]);

/* Small-chip copy that reads better than the literal state name. */
const LABEL_OVERRIDES: Partial<Record<OrbState, string>> = {
  weaving: "planning",
  breathing: "thinking",
  connecting: "solving",
};

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/* Weaving and shaping live in the Studio, not here. */
const STATES: OrbState[] = [
  "working",
  "searching",
  "solving",
  "listening",
  "connecting",
  "composing",
  "breathing",
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
    <svg className="icon-check" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.46889L6.26923 11.58L12.5 4.58" /></svg>
  );
}

function OrbPlayground() {
  const [state, setState] = useState<OrbState>("listening");
  const [size, setSize] = useState<OrbSize>(64);
  // Starts paused so the page loads quietly (same as the live playground).
  /* The stage starts paused — Play opts in. The examples above run on
     their own: they are the library introducing itself. */
  const [paused, setPaused] = useState(true);

  const snippet = buildSnippet(state, size);

  return (
    <>
      {/* The demo page's own examples first (sites/orbs/components/
          Examples.tsx), showing all nine states: two hero pills, then the
          seven-state grid where working / searching / connecting take the
          large pill and the rest stay compact chips. */}
      <div className="detail-examples">
        <div className="ex-orb-heroes">
          {HERO_PILLS.map(({ state, label }) => (
            <div className="ex-orb-cell ex-orb-cell--hero" key={state}>
              <span className="ex-pill">
                <ThinkingOrb state={state} size={64} theme="dark" style={{ width: 56, height: 56 }} />
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Row-major auto-placement over 151px rows: this order of 1- and
            2-row spans tiles without leaving gaps. */}
        <div className="ex-orb-grid">
          {CHIP_STATES.map((state) => {
            const large = LARGE_CHIPS.has(state);
            const copy = LABEL_OVERRIDES[state] ?? state;
            return (
              <div
                className={`ex-orb-cell${large ? " ex-orb-cell--lg" : ""}`}
                key={state}
              >
                {large ? (
                  <span className="ex-pill">
                    <ThinkingOrb state={state} size={64} theme="dark" style={{ width: 56, height: 56 }} />
                    {cap(copy)}….
                  </span>
                ) : (
                  <span className="ex-chip">
                    <ThinkingOrb state={state} size={20} theme="dark" />
                    Agent {copy}…
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="detail-playground-label">Playground</p>

      <div className="pg">
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

        <StudioTeaser
          rows={[
            { kind: "tabs", label: "Color", options: ["Ink", "Sky", "Mint"] },
            { kind: "slider", label: "Dots", value: "1\u00d7", fill: 43 },
            { kind: "slider", label: "Speed", value: "1\u00d7", fill: 31 },
          ]}
        />
      </div>

      </div>

      <CodeBlock code={snippet} label="Copy playground snippet" className="pg-snippet" />
      {/* Credit line, orbs only. The handle is the one the orbs demo site's
          own footer links to. */}
      <p className="detail-credit">
        Made as a collaboration with{" "}
        <a href="https://x.com/a_brinza" target="_blank" rel="noopener noreferrer">Alexandr Brinza</a>
      </p>
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

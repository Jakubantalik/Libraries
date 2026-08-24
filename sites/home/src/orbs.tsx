import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThinkingOrb, type OrbSize, type OrbState } from "thinking-orbs";

/* Orb detail page — playground island (stage + controls + live snippet).
   Mirrors the live playground at sites/orbs/components/Playground.tsx:
   nine state tabs, 64/20 size tabs, 25–300% speed slider, starts paused. */

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
const SIZES: OrbSize[] = [64, 20];

const SPEED_MIN = 25;
const SPEED_MAX = 300;

function buildSnippet(state: OrbState, size: OrbSize, speed: number): string {
  const props = [`state="${state}"`, `size={${size}}`];
  if (speed !== 100) props.push(`speed={${(speed / 100).toFixed(2)}}`);
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

function Slider({
  min,
  max,
  step,
  value,
  onChange,
  format,
  ariaLabel,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="pg-slider-row">
      <div className="pg-slider">
        <div className="pg-slider-track">
          <div className="pg-slider-fill" style={{ width: `${pct}%` }} />
          <div className="pg-slider-thumb" style={{ left: `${pct}%` }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={ariaLabel}
        />
      </div>
      <span className="pg-slider-value">{format(value)}</span>
    </div>
  );
}

function OrbPlayground() {
  const [state, setState] = useState<OrbState>("listening");
  const [size, setSize] = useState<OrbSize>(64);
  const [speed, setSpeed] = useState(100);
  // Starts paused so the page loads quietly (same as the live playground).
  const [paused, setPaused] = useState(true);

  const snippet = buildSnippet(state, size, speed);

  return (
    <>
      <div className="pg-stage">
        {/* key remounts the canvas on state/size change, matching the live playground */}
        <ThinkingOrb key={`${state}-${size}`} state={state} size={size} speed={speed / 100} paused={paused} theme="dark" />
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

        <div className="pg-field">
          <span className="pg-label">Speed</span>
          <Slider
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={5}
            value={speed}
            onChange={setSpeed}
            format={(v) => `${(v / 100).toFixed(2)}×`}
            ariaLabel="Animation speed"
          />
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

import { StrictMode, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { BorderBeam, type BorderBeamSize, type BorderBeamColorVariant } from "border-beam";

/* Beam detail page — one React island rendering the whole playground grid
   (stage + controls) plus the live-updating snippet below it. Controls
   mirror the live beam site (sites/beam/src/App.tsx): family tabs, type,
   color, strength, play/pause. The preview starts ACTIVE (beam convention). */

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

/* Same markup as the static blocks' copy buttons; wired in React because
   the page-level script only binds [data-copy-static] buttons that exist
   before the island mounts. */
function CodeCopy({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const handleClick = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }, [text]);
  return (
    <button
      type="button"
      className="code-copy"
      onClick={handleClick}
      data-copied={copied ? "true" : undefined}
      aria-label={copied ? "Copied" : label}
    >
      <CopyIcon />
      <CheckIcon />
    </button>
  );
}

function PgTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="pg-field" role="radiogroup" aria-label={label}>
      <span className="pg-label">{label}</span>
      <div className="pg-tabs">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="pg-tab"
            role="radio"
            aria-checked={value === o.value}
            data-active={value === o.value ? "true" : undefined}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Filled-track slider from playground.css: visual track + invisible native
   range on top for pointer + keyboard + screen readers. */
function PgSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="pg-field">
      <span className="pg-label">{label}</span>
      <div className="pg-slider-row">
        <div className="pg-slider">
          <div className="pg-slider-track">
            {pct > 0 && <div className="pg-slider-fill" style={{ width: `${pct}%` }} />}
            <div className="pg-slider-thumb" style={{ left: `${pct}%` }} />
          </div>
          <input
            type="range"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            aria-label={label}
          />
        </div>
        <span className="pg-slider-value">{display}</span>
      </div>
    </div>
  );
}

type BeamFamily = "rotate" | "pulse";

const FAMILY_OPTIONS = [
  { value: "rotate", label: "Rotate" },
  { value: "pulse", label: "Pulse" },
] as const;

const SIZE_OPTIONS_BY_FAMILY: Record<BeamFamily, ReadonlyArray<{ value: BorderBeamSize; label: string }>> = {
  rotate: [
    { value: "md", label: "Large" },
    { value: "sm", label: "Small" },
    { value: "line", label: "Line" },
  ],
  pulse: [
    { value: "pulse-inner", label: "Pulse Inner" },
    { value: "pulse-outside", label: "Pulse Outside" },
  ],
};

const DEFAULT_SIZE_BY_FAMILY: Record<BeamFamily, BorderBeamSize> = {
  rotate: "md",
  pulse: "pulse-inner",
};

const COLOR_OPTIONS = [
  { value: "colorful", label: "Colorful" },
  { value: "mono", label: "Mono" },
  { value: "ocean", label: "Ocean" },
  { value: "sunset", label: "Sunset" },
  { value: "forest", label: "Forest" },
  { value: "candy", label: "Candy" },
  { value: "ice", label: "Ice" },
  { value: "gold", label: "Gold" },
] as const;

/* Tuned CSS vars for the pulse-outside preview — same values the live beam
   site applies so the outward bloom reads right on a dark stage. */
const PULSE_OUTSIDE_TUNED_VARS = {
  "--sub-glow-offset-x": "1px",
  "--sub-glow-offset-y": "0px",
  "--sub-core-blur": "10px",
  "--sub-bloom-blur": "19px",
  "--sub-glow-opacity-mul": 1.71,
} as CSSProperties;

function DemoCard({ size }: { size: BorderBeamSize }) {
  if (size === "sm") {
    return (
      <div className="beam-card beam-card--sm">
        <div className="beam-card-dot" />
      </div>
    );
  }
  return (
    <div className="beam-card">
      <div className="beam-card-line beam-card-line--title" />
      <div className="beam-card-line" />
      <div className="beam-card-line beam-card-line--short" />
    </div>
  );
}

function BeamPlayground() {
  const [family, setFamily] = useState<BeamFamily>("rotate");
  const [size, setSize] = useState<BorderBeamSize>("md");
  const [colorVariant, setColorVariant] = useState<BorderBeamColorVariant>("colorful");
  const [strength, setStrength] = useState(70);
  const [active, setActive] = useState(true);

  const handleFamilyChange = useCallback((next: BeamFamily) => {
    setFamily(next);
    setSize(DEFAULT_SIZE_BY_FAMILY[next]);
  }, []);

  const isPulseOutside = size === "pulse-outside";

  /* Live snippet: current control state, props at their defaults omitted. */
  const props: string[] = [];
  if (size !== "md") props.push(` size="${size}"`);
  if (colorVariant !== "colorful") props.push(` colorVariant="${colorVariant}"`);
  if (strength !== 100) props.push(` strength={${strength / 100}}`);
  if (!active) props.push(" active={false}");
  const snippet = `<BorderBeam${props.join("")}>
  <Card>Content</Card>
</BorderBeam>`;

  return (
    <>
      <div className="pg">
        <div className="pg-stage" id="playground-stage">
          <BorderBeam
            size={size}
            colorVariant={colorVariant}
            theme="dark"
            active={active}
            strength={strength / 100}
            style={isPulseOutside ? PULSE_OUTSIDE_TUNED_VARS : undefined}
          >
            <DemoCard size={size} />
          </BorderBeam>
          <button
            type="button"
            className="btn-animate pg-play"
            onClick={() => setActive((a) => !a)}
            aria-pressed={active}
          >
            {active ? "Pause" : "Play"}
          </button>
        </div>

        <div className="pg-controls" id="playground-controls">
          <PgTabs label="Family" options={FAMILY_OPTIONS} value={family} onChange={handleFamilyChange} />
          <PgTabs label="Type" options={SIZE_OPTIONS_BY_FAMILY[family]} value={size} onChange={setSize} />
          <PgTabs label="Color" options={COLOR_OPTIONS} value={colorVariant} onChange={setColorVariant} />
          <PgSlider
            label="Strength"
            value={strength}
            min={0}
            max={100}
            step={1}
            display={`${strength}%`}
            onChange={setStrength}
          />
        </div>
      </div>

      <div className="code-block pg-snippet">
        <pre>{snippet}</pre>
        <CodeCopy text={snippet} label="Copy playground code" />
      </div>
    </>
  );
}

const rootEl = document.getElementById("playground-root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <BeamPlayground />
    </StrictMode>
  );
}

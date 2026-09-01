import { StrictMode, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { BorderBeam, type BorderBeamSize, type BorderBeamColorVariant } from "border-beam";
import {
  MockChatInput,
  MockIconButton,
  MockSearchBar,
} from "./examples/beam-mocks";
import { CodeCopy } from "./examples/CodeCopy";

/* Beam detail page — one React island rendering the whole playground grid
   (stage + controls) plus the live-updating snippet below it. Controls
   mirror the live beam site (sites/beam/src/App.tsx): family tabs, type,
   color, play/pause. The preview starts ACTIVE (beam convention). */

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

/* Two palettes here; the rest of the set lives in the Studio. */
const COLOR_OPTIONS = [
  { value: "colorful", label: "Colorful" },
  { value: "mono", label: "Mono" },
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
  if (!active) props.push(" active={false}");
  const snippet = `<BorderBeam${props.join("")}>
  <Card>Content</Card>
</BorderBeam>`;

  return (
    <>
      {/* The demo page's own examples come first: real UI wearing the
          effect, before any knobs. The playground below is for trying a
          setting, not for meeting the library. */}
      <div className="detail-examples">
        <div className="example-row-full">
          <BorderBeam className="beam-host" size="md" colorVariant="colorful" theme="dark" active={active}>
            <MockChatInput />
          </BorderBeam>
        </div>
        <div className="example-row-split">
          <div className="example-cell">
            <BorderBeam className="beam-host" size="sm" colorVariant="colorful" theme="dark" active={active}>
              <MockIconButton />
            </BorderBeam>
          </div>
          <div className="example-cell">
            <BorderBeam
              className="beam-host"
              size="line"
              colorVariant="colorful"
              theme="dark"
              active={active}
              duration={3.1}
              borderRadius={20}
            >
              <MockSearchBar />
            </BorderBeam>
          </div>
        </div>
      </div>

      <p className="detail-playground-label">Playground</p>

      <div className="pg">
        <div className="pg-stage" id="playground-stage">
          <BorderBeam
            size={size}
            colorVariant={colorVariant}
            theme="dark"
            active={active}
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

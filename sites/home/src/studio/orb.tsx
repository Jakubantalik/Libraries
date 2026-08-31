import { useState } from "react";
import { ThinkingOrb, type OrbSize, type OrbState } from "thinking-orbs";
import { ControlsPanel, PgTabs, PgSlider, PgSwatches, PanelTitle, PanelSep, Snippet, num } from "./controls";

/* Studio — Orb workbench: all nine states, both tuned sizes, speed, plus
   the ink tint and dot-density knobs. The orb ships exactly two hand-tuned
   size presets, so the size control stays tabs. */

/* Empty value = the stock grayscale ink (no `color` prop emitted). */
const INK_OPTIONS = [
  { value: "#ededed", label: "Ink (default)" },
  { value: "#7cd4ff", label: "Sky" },
  { value: "#ffd28f", label: "Amber" },
  { value: "#ff9ec9", label: "Pink" },
  { value: "#9fe8a8", label: "Mint" },
] as const;
const INK_DEFAULT = "#ededed";

const STATE_OPTIONS: ReadonlyArray<{ value: OrbState; label: string }> = [
  "working",
  "searching",
  "solving",
  "listening",
  "connecting",
  "weaving",
  "composing",
  "breathing",
  "shaping",
].map((s) => ({ value: s as OrbState, label: s.charAt(0).toUpperCase() + s.slice(1) }));

const SIZE_OPTIONS = [
  { value: "64", label: "64px" },
  { value: "32", label: "32px" },
  { value: "20", label: "20px" },
] as const;

export function OrbStudio({ visible = true }: { visible?: boolean }) {
  const [state, setState] = useState<OrbState>("listening");
  const [size, setSize] = useState<OrbSize>(64);
  const [speed, setSpeed] = useState(100);
  const [ink, setInk] = useState<string>(INK_DEFAULT);
  const [dots, setDots] = useState(1);
  const [paused, setPaused] = useState(false);

  const tinted = ink !== INK_DEFAULT;
  const props = [`state="${state}"`, `size={${size}}`];
  if (speed !== 100) props.push(`speed={${num(speed / 100)}}`);
  if (tinted) props.push(`color="${ink}"`);
  if (dots !== 1) props.push(`dots={${num(dots)}}`);
  const snippet = `import { ThinkingOrb } from 'thinking-orbs';\n\n<ThinkingOrb ${props.join(" ")} />`;

  return (
    <div className="pg">
      <div className="pg-stage">
        {/* key remounts the canvas on state/size change, matching the live playground */}
        {visible && (
          <ThinkingOrb
            key={`${state}-${size}`}
            state={state}
            size={size}
            speed={speed / 100}
            color={tinted ? ink : undefined}
            dots={dots}
            paused={paused}
            theme="dark"
          />
        )}
        <button
          type="button"
          className="btn-animate pg-play"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={!paused}
        >
          {paused ? "Play" : "Pause"}
        </button>
      </div>

      <ControlsPanel library="Thinking orbs">
        <PanelTitle>Thinking orbs</PanelTitle>
        <PgTabs label="State" options={STATE_OPTIONS} value={state} onChange={setState} />
        <PgTabs
          label="Size"
          options={SIZE_OPTIONS}
          value={String(size) as "64" | "32" | "20"}
          onChange={(v) => setSize(Number(v) as OrbSize)}
        />
        <PgSlider
          label="Speed"
          value={speed}
          min={25}
          max={300}
          step={5}
          display={`${num(speed / 100)}×`}
          onChange={setSpeed}
        />
        <PanelSep />
        <PanelTitle>Ink</PanelTitle>
        <PgSwatches label="Color" options={INK_OPTIONS} value={ink} onChange={setInk} />
        <PgSlider
          label="Dots"
          value={dots}
          min={0.4}
          max={2}
          step={0.05}
          display={`${num(dots)}×`}
          onChange={setDots}
        />
      </ControlsPanel>

      <Snippet code={snippet} />
    </div>
  );
}

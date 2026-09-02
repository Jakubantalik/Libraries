import { useCallback, useState } from "react";
import {
  ThinkingOrb,
  countDots,
  resolvePreset,
  scaleCounts,
  type OrbSize,
  type OrbState,
} from "thinking-orbs";
import { ControlsPanel, PgTabs, PgSlider, PgSwatches, PanelSep, Snippet, num, StageBar, PgGroup } from "./controls";

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

/* Param key -> the knob's own label, for the agent's applied-change line. */
const ORB_PARAM_LABELS: Record<string, string> = {
  state: "State",
  size: "Size",
  speed: "Speed",
  ink: "Color",
  dots: "Dots amount",
  paused: "Paused",
};

export function OrbStudio({ visible = true, theme = "dark" }: { visible?: boolean; theme?: "dark" | "light" }) {
  const [state, setState] = useState<OrbState>("listening");
  const [size, setSize] = useState<OrbSize>(64);
  const [speed, setSpeed] = useState(100);
  const [ink, setInk] = useState<string>(INK_DEFAULT);
  const [dots, setDots] = useState(1);
  const [paused, setPaused] = useState(false);

  const dotTotal = countDots(scaleCounts(resolvePreset(state, size).opts, Math.max(0.1, dots)));


  /* Agent wiring — keys match the Worker's spec, which owns the ranges and
     rejects anything outside them. `size` arrives as a string, since the
     library only offers two hand-tuned presets rather than a range. */
  const agentParams: Record<string, unknown> = {
    state, size: String(size), speed, ink, dots, paused,
  };

  const applyAgentParams = useCallback((patch: Record<string, unknown>) => {
    if (typeof patch.state === "string") setState(patch.state as OrbState);
    if (typeof patch.size === "string") setSize(Number(patch.size) as OrbSize);
    if (typeof patch.speed === "number") setSpeed(patch.speed);
    if (typeof patch.ink === "string") setInk(patch.ink);
    if (typeof patch.dots === "number") setDots(patch.dots);
    if (typeof patch.paused === "boolean") setPaused(patch.paused);
  }, []);

  const tinted = ink !== INK_DEFAULT;
  const props = [`state="${state}"`, `size={${size}}`];
  if (speed !== 100) props.push(`speed={${num(speed / 100)}}`);
  if (tinted) props.push(`color="${ink}"`);
  if (dots !== 1) props.push(`dots={${num(dots)}}`);
  const snippet = `import { ThinkingOrb } from 'thinking-orbs';\n\n<ThinkingOrb ${props.join(" ")} />`;

  /* The ports take state / size / theme / speed / paused only
     (thinking-orbs-native/src/types.ts, ThinkingOrbsKit/ThinkingOrb.swift):
     the web-only color tint and dot-count multiplier are left out, and
     size 32 has no port preset — the tuned presets are 64 and 20 — so the
     snippet falls back to 64 and says so. Both ports default to theme
     auto, so no theme is written. */
  const portSize: 64 | 20 = size === 20 ? 20 : 64;
  const sizeNote = size === 32 ? "// size 32 is web-only; the ports ship the 64 and 20 presets\n" : "";
  const rn: string[] = [`state="${state}"`, `size={${portSize}}`];
  if (speed !== 100) rn.push(`speed={${num(speed / 100)}}`);
  if (paused) rn.push("paused");
  const rnSnippet = `import { ThinkingOrb } from 'thinking-orbs-native';\n\n${sizeNote}<ThinkingOrb ${rn.join(" ")} />`;
  const sw: string[] = [`state: .${state}`, `size: .px${portSize}`];
  if (speed !== 100) sw.push(`speed: ${num(speed / 100)}`);
  if (paused) sw.push("paused: true");
  const swiftSnippet = `import ThinkingOrbsKit\n\n${sizeNote}ThinkingOrb(${sw.join(", ")})`;

  const platforms = [
    {
      id: "rn",
      label: "React Native",
      installTitle: "Install thinking-orbs-native with Skia and Reanimated",
      install: "npm install thinking-orbs-native @shopify/react-native-skia react-native-reanimated",
      note: "thinking-orbs-native is not on npm yet — it lives in this repo at packages/thinking-orbs/ports/react-native/thinking-orbs-native. Expo needs expo run:ios / run:android (native modules).",
      usage: rnSnippet,
    },
    {
      id: "swift",
      label: "Swift",
      installTitle: "Add ThinkingOrbsKit as a local Swift package (iOS 15+, no dependencies)",
      install: `// Package.swift — or Xcode: File › Add Package Dependencies… › Add Local…\n.package(path: "packages/thinking-orbs/ports/ios/ThinkingOrbsKit")`,
      usage: swiftSnippet,
    },
  ];

  return (
    <div className="pg">
      <StageBar library="Thinking orbs" prompt={{ pkg: "thinking-orbs", docsPath: "/orbs.html", snippet, platforms }} agent={{ libraryId: "orb", params: agentParams, labels: ORB_PARAM_LABELS, onApply: applyAgentParams }} />
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
            theme={theme}
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

      <ControlsPanel
        library="Thinking orbs"
        agent={{
          libraryId: "orb",
          params: agentParams,
          labels: ORB_PARAM_LABELS,
          onApply: applyAgentParams,
        }}
      >
        <PgTabs label="State" options={STATE_OPTIONS} value={state} onChange={setState} />
        <PgTabs
          label="Size"
          options={SIZE_OPTIONS}
          value={String(size) as "64" | "32" | "20"}
          onChange={(v) => setSize(Number(v) as OrbSize)}
        />
        <PgGroup label="Motion">
          <PgSlider
            label="Speed"
            value={speed}
            min={25}
            max={300}
            step={5}
            display={`${num(speed / 100)}×`}
            onChange={setSpeed}
          />
        </PgGroup>
        <PanelSep />
        <PgGroup label="Dots">
          <PgSwatches label="Color" options={INK_OPTIONS} value={ink} onChange={setInk} allowCustom hideLabel />
        {/* The library scales every count knob of a state together, so the
            prop is a multiplier — but a multiplier is a poor thing to aim
            with. The slider reads out the dots the current state and size
            will actually draw, recomputed as either of those changes. */}
          <PgSlider
            label="Dots amount"
            value={dots}
            min={0.4}
            max={2}
            step={0.05}
            display={`${dotTotal}`}
            onChange={setDots}
          />
        </PgGroup>
      </ControlsPanel>

      <Snippet code={snippet} />
    </div>
  );
}

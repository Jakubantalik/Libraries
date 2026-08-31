import { useCallback, useState, type CSSProperties } from "react";
import { BorderBeam, type BorderBeamSize, type BorderBeamColorVariant } from "border-beam";
import { ControlsPanel, PgTabs, PgSlider, PgToggles, PanelTitle, PanelSep, Snippet, num } from "./controls";

/* Studio — Beam workbench. The public playground exposes family/type/color/
   strength; the Studio adds the rest of the prop surface (duration,
   brightness, saturation, hue range, static colors, corner radius) plus the
   overridable CSS hooks: --beam-hue-base (palette hue shift),
   --beam-spike-mul (line-type spike prominence) and the --pulse-glow-*
   glow-shaping vars of the pulse family. */

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

const DEFAULT_DURATION: Record<string, number> = { line: 2.4 };

type CardScale = "s" | "m" | "l";
const CARD_SCALE_OPTIONS = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
] as const;
const CARD_WIDTH: Record<CardScale, number> = { s: 180, m: 250, l: 330 };

function DemoCard({ size, width }: { size: BorderBeamSize; width: number }) {
  if (size === "sm") {
    return (
      <div className="beam-card beam-card--sm">
        <div className="beam-card-dot" />
      </div>
    );
  }
  return (
    <div className="beam-card" style={{ width }}>
      <div className="beam-card-line beam-card-line--title" />
      <div className="beam-card-line" />
      <div className="beam-card-line beam-card-line--short" />
    </div>
  );
}

export function BeamStudio({ visible = true }: { visible?: boolean }) {
  const [family, setFamily] = useState<BeamFamily>("rotate");
  const [size, setSize] = useState<BorderBeamSize>("md");
  const [colorVariant, setColorVariant] = useState<BorderBeamColorVariant>("colorful");
  const [strength, setStrength] = useState(100);
  const [duration, setDuration] = useState(1.96);
  const [brightness, setBrightness] = useState(1.3);
  const [saturation, setSaturation] = useState(1.2);
  const [hueRange, setHueRange] = useState(30);
  const [hueShift, setHueShift] = useState(0);
  const [staticColors, setStaticColors] = useState(false);
  const [radius, setRadius] = useState(16);
  const [spikes, setSpikes] = useState(1);
  const [glowSize, setGlowSize] = useState(1);
  const [glowSx, setGlowSx] = useState(1);
  const [glowSy, setGlowSy] = useState(1);
  const [glowBoost, setGlowBoost] = useState(1);
  const [cardScale, setCardScale] = useState<CardScale>("m");
  const [active, setActive] = useState(true);

  /* An untouched duration follows the type's own default across switches
     (md 1.96s vs line 2.4s), so the snippet never emits a duration the
     user didn't set. */
  const handleSizeChange = useCallback((next: BorderBeamSize) => {
    setSize((prev) => {
      setDuration((d) =>
        d === (DEFAULT_DURATION[prev] ?? 1.96) ? (DEFAULT_DURATION[next] ?? 1.96) : d
      );
      return next;
    });
  }, []);

  const handleFamilyChange = useCallback(
    (next: BeamFamily) => {
      setFamily(next);
      handleSizeChange(DEFAULT_SIZE_BY_FAMILY[next]);
    },
    [handleSizeChange]
  );

  const isPulse = family === "pulse";
  const isPulseOutside = size === "pulse-outside";
  const isLine = size === "line";
  const defaultDuration = DEFAULT_DURATION[size] ?? 1.96;

  /* CSS hooks the library reads with fallbacks — only emit touched ones. */
  const varStyle: Record<string, string | number> = {};
  if (hueShift !== 0 && !staticColors) varStyle["--beam-hue-base"] = `${hueShift}deg`;
  if (isLine && spikes !== 1) varStyle["--beam-spike-mul"] = num(spikes);
  if (isPulse && glowSx !== 1) varStyle["--pulse-glow-sx"] = num(glowSx);
  if (isPulse && glowSy !== 1) varStyle["--pulse-glow-sy"] = num(glowSy);
  if (isPulse && glowBoost !== 1) varStyle["--pulse-glow-boost"] = num(glowBoost);
  const hasVars = Object.keys(varStyle).length > 0;
  const beamStyle: CSSProperties | undefined = isPulseOutside
    ? ({ ...PULSE_OUTSIDE_TUNED_VARS, ...varStyle } as CSSProperties)
    : hasVars
      ? (varStyle as CSSProperties)
      : undefined;

  /* Live snippet: only non-default props survive. */
  const props: string[] = [];
  if (size !== "md") props.push(`size="${size}"`);
  if (colorVariant !== "colorful") props.push(`colorVariant="${colorVariant}"`);
  if (strength !== 100) props.push(`strength={${num(strength / 100)}}`);
  if (duration !== defaultDuration) props.push(`duration={${num(duration)}}`);
  if (glowSize !== 1) props.push(`glowSize={${num(glowSize)}}`);
  if (brightness !== 1.3) props.push(`brightness={${num(brightness)}}`);
  if (saturation !== 1.2) props.push(`saturation={${num(saturation)}}`);
  if (hueRange !== 30) props.push(`hueRange={${num(hueRange)}}`);
  if (radius !== 16) props.push(`borderRadius={${num(radius)}}`);
  if (staticColors) props.push("staticColors");
  if (!active) props.push("active={false}");
  if (hasVars) {
    const varLines = Object.entries(varStyle)
      .map(([k, v]) => `'${k}': ${typeof v === "string" ? `'${v}'` : v}`)
      .join(", ");
    props.push(`style={{ ${varLines} }}`);
  }
  const attrs = props.length ? "\n  " + props.join("\n  ") + "\n" : "";
  const snippet = `import { BorderBeam } from 'border-beam';\n\n<BorderBeam${attrs}>\n  <Card>Content</Card>\n</BorderBeam>`;

  return (
    <>
      <div className="pg">
        <div className="pg-stage">
          {visible && (
          <BorderBeam
            size={size}
            colorVariant={colorVariant}
            theme="dark"
            active={active}
            strength={strength / 100}
            duration={duration}
            glowSize={glowSize}
            brightness={brightness}
            saturation={saturation}
            hueRange={hueRange}
            borderRadius={radius !== 16 ? radius : undefined}
            staticColors={staticColors}
            style={beamStyle}
          >
            <DemoCard size={size} width={CARD_WIDTH[cardScale]} />
          </BorderBeam>
          )}
          <button
            type="button"
            className="btn-animate pg-play"
            onClick={() => setActive((a) => !a)}
            aria-pressed={active}
          >
            {active ? "Pause" : "Play"}
          </button>
        </div>

        <ControlsPanel library="Beam">
          <PanelTitle>Beam</PanelTitle>
          <PgTabs label="Family" options={FAMILY_OPTIONS} value={family} onChange={handleFamilyChange} />
          <PgTabs label="Type" options={SIZE_OPTIONS_BY_FAMILY[family]} value={size} onChange={handleSizeChange} />
          <PgTabs label="Color" options={COLOR_OPTIONS} value={colorVariant} onChange={setColorVariant} />
          <PgSlider label="Strength" value={strength} min={0} max={100} step={1} display={`${strength}%`} onChange={setStrength} />
          <PanelSep />
          <PanelTitle>Size</PanelTitle>
          {size !== "sm" && (
            <PgTabs label="Card size" options={CARD_SCALE_OPTIONS} value={cardScale} onChange={setCardScale} />
          )}
          <PgSlider label="Corner radius" value={radius} min={0} max={32} step={1} display={`${radius}px`} onChange={setRadius} />
          <PanelSep />
          <PanelTitle>Motion</PanelTitle>
          <PgSlider label="Duration" value={duration} min={0.5} max={6} step={0.02} display={`${num(duration)}s`} onChange={setDuration} />
          <PgToggles
            label="Colors"
            options={[{ label: "Static colors", active: staticColors, onToggle: () => setStaticColors((v) => !v) }]}
          />
          <PanelSep />
          <PanelTitle>Glow</PanelTitle>
          <PgSlider label="Size" value={glowSize} min={0.25} max={3} step={0.05} display={`${num(glowSize)}×`} onChange={setGlowSize} />
          <PgSlider label="Brightness" value={brightness} min={0.5} max={2.2} step={0.05} display={`${num(brightness)}×`} onChange={setBrightness} />
          <PgSlider label="Saturation" value={saturation} min={0.4} max={2.2} step={0.05} display={`${num(saturation)}×`} onChange={setSaturation} />
          {!staticColors && (
            <>
              <PgSlider label="Hue range" value={hueRange} min={0} max={120} step={1} display={`${hueRange}°`} onChange={setHueRange} />
              <PgSlider label="Hue shift" value={hueShift} min={-180} max={180} step={5} display={`${hueShift}°`} onChange={setHueShift} />
            </>
          )}
          {isLine && (
            <PgSlider label="Spikes" value={spikes} min={0} max={2} step={0.05} display={`${num(spikes)}×`} onChange={setSpikes} />
          )}
          {isPulse && (
            <>
              <PgSlider label="Glow spread X" value={glowSx} min={0.5} max={2} step={0.05} display={`${num(glowSx)}×`} onChange={setGlowSx} />
              <PgSlider label="Glow spread Y" value={glowSy} min={0.5} max={2} step={0.05} display={`${num(glowSy)}×`} onChange={setGlowSy} />
              <PgSlider label="Glow boost" value={glowBoost} min={0.5} max={2} step={0.05} display={`${num(glowBoost)}×`} onChange={setGlowBoost} />
            </>
          )}
        </ControlsPanel>

        <Snippet code={snippet} />
      </div>
    </>
  );
}

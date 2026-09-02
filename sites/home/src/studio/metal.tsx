import { useCallback, useRef, useState } from "react";
import { MetalFx, type MetalFxPreset, type MetalFxVariant } from "metal-fx-v1";
import { ControlsPanel, PgTabs, PgSlider, PgToggles, PanelSep, Snippet, num, StageBar, PgGroup } from "./controls";

/* Studio — Metal workbench. Public playground: variant/preset/strength/
   toggles. The Studio adds the engine surface: shader scale and ring width.

   Renders the published metal-fx v1 — the same package the detail page
   ships — so the Studio preview matches what users install. v1 has no
   glowStrength knob, so glow is only the on/off toggle. */

const PRESET_OPTIONS = [
  { value: "chromatic", label: "Chromatic" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
] as const;

const VARIANT_OPTIONS = [
  { value: "button", label: "Button" },
  { value: "circle", label: "Circle" },
] as const;

/* Variant baselines — shaderScale / ringCssPx defaults per the metal-fx docs. */
const BASE_SHADER_SCALE: Record<MetalFxVariant, number> = { button: 1.6, circle: 1.3 };
const BASE_RING: Record<MetalFxVariant, number> = { button: 1, circle: 2 };

/* Param key -> the knob's own label, for the agent's applied-change line. */
const METAL_PARAM_LABELS: Record<string, string> = {
  variant: "Type",
  preset: "Color",
  strength: "Strength",
  shaderScale: "Shader scale",
  ring: "Ring width",
  disableGlow: "No Glow",
  disableReflection: "No Reflection",
  paused: "Paused",
};

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 18 18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="m16 16-3.5-3.5" />
    </svg>
  );
}

export function MetalStudio({ visible = true, theme = "dark" }: { visible?: boolean; theme?: "dark" | "light" }) {
  const [variant, setVariant] = useState<MetalFxVariant>("button");
  const [preset, setPreset] = useState<MetalFxPreset>("chromatic");
  const [strength, setStrength] = useState(90);
  const [shaderScale, setShaderScale] = useState(BASE_SHADER_SCALE.button);
  const [ring, setRing] = useState(BASE_RING.button);
  const [paused, setPaused] = useState(false);
  const [disableGlow, setDisableGlow] = useState(false);
  const [disableReflection, setDisableReflection] = useState(false);
  const playPauseRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLLabelElement>(null);

  const handleVariant = (v: MetalFxVariant) => {
    setVariant(v);
    setShaderScale(BASE_SHADER_SCALE[v]);
    setRing(BASE_RING[v]);
  };

  /* Agent wiring — keys match the Worker's spec, which owns the ranges. */
  const agentParams: Record<string, unknown> = {
    variant, preset, strength, shaderScale, ring,
    disableGlow, disableReflection, paused,
  };

  const applyAgentParams = useCallback((patch: Record<string, unknown>) => {
    /* Variant first, and through handleVariant so the shape's tuned
       shaderScale/ring baselines land — then any explicit values in the
       same patch overwrite them, rather than being reset by the switch. */
    if (typeof patch.variant === "string") handleVariant(patch.variant as MetalFxVariant);
    if (typeof patch.preset === "string") setPreset(patch.preset as MetalFxPreset);
    if (typeof patch.strength === "number") setStrength(patch.strength);
    if (typeof patch.shaderScale === "number") setShaderScale(patch.shaderScale);
    if (typeof patch.ring === "number") setRing(patch.ring);
    if (typeof patch.disableGlow === "boolean") setDisableGlow(patch.disableGlow);
    if (typeof patch.disableReflection === "boolean") setDisableReflection(patch.disableReflection);
    if (typeof patch.paused === "boolean") setPaused(patch.paused);
  }, []);

  const scaleTouched = shaderScale !== BASE_SHADER_SCALE[variant];
  const ringTouched = ring !== BASE_RING[variant];
  const reflectionTargets = disableReflection ? undefined : [searchRef, playPauseRef];

  const props = [`preset="${preset}"`];
  if (variant !== "button") props.push(`variant="${variant}"`);
  if (strength !== 100) props.push(`strength={${num(strength / 100)}}`);
  if (scaleTouched) props.push(`shaderScale={${num(shaderScale)}}`);
  if (ringTouched) props.push(`ringCssPx={${num(ring)}}`);
  if (disableGlow) props.push("disableGlow");
  if (!disableReflection) props.push("reflectionTargets={[siblingRef]}");
  const child =
    variant === "circle"
      ? `  <button aria-label="Send"><ArrowUpIcon /></button>`
      : `  <button>Upgrade to Pro</button>`;
  const snippet = `import { MetalFx } from 'metal-fx';\n\n<MetalFx ${props.join(" ")}>\n${child}\n</MetalFx>`;

  return (
    <div className="pg">
      <StageBar library="Metal" prompt={{ pkg: "metal-fx", docsPath: "/metal.html", snippet }} agent={{ libraryId: "metal", params: agentParams, labels: METAL_PARAM_LABELS, onApply: applyAgentParams }} />
      <div className="pg-stage">
        <div className="metal-stage-row">
          <label ref={searchRef} className="metal-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search"
              spellCheck={false}
              tabIndex={-1}
              aria-label="Search"
            />
          </label>

          {/* key remounts the WebGL instance on variant/preset change */}
          {visible && (
          <MetalFx
            key={`${variant}-${preset}`}
            preset={preset}
            variant={variant}
            theme={theme}
            strength={strength / 100}
            paused={paused}
            disableGlow={disableGlow}
            shaderScale={scaleTouched ? shaderScale : undefined}
            ringCssPx={ringTouched ? ring : undefined}
            reflectionTargets={reflectionTargets}
          >
            {variant === "circle" ? (
              <button type="button" className="metal-pill metal-pill--circle" aria-label="Send">
                <ArrowUpIcon />
              </button>
            ) : (
              <button type="button" className="metal-pill">
                Upgrade to Pro
              </button>
            )}
          </MetalFx>
          )}
        </div>

        <button
          ref={playPauseRef}
          type="button"
          className="btn-animate pg-play"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={!paused}
        >
          {paused ? "Play" : "Pause"}
        </button>
      </div>

      <ControlsPanel
        library="Metal"
        agent={{
          libraryId: "metal",
          params: agentParams,
          labels: METAL_PARAM_LABELS,
          onApply: applyAgentParams,
        }}
      >
        <PgTabs label="Type" options={VARIANT_OPTIONS} value={variant} onChange={handleVariant} />
        <PgTabs label="Color" options={PRESET_OPTIONS} value={preset} onChange={setPreset} />
        <PanelSep />
        <PgGroup label="Metal effect styling">
          <PgSlider label="Strength" value={strength} min={0} max={100} step={1} display={`${strength}%`} onChange={setStrength} />
          <PgSlider label="Shader scale" value={shaderScale} min={0.6} max={3} step={0.05} display={`${num(shaderScale)}×`} onChange={setShaderScale} />
          <PgSlider label="Ring width" value={ring} min={0.5} max={4} step={0.25} display={`${num(ring)}px`} onChange={setRing} />
        </PgGroup>
        <PgToggles
          label="Options"
          options={[
            { label: "No Glow", active: disableGlow, onToggle: () => setDisableGlow((g) => !g) },
            { label: "No Reflection", active: disableReflection, onToggle: () => setDisableReflection((r) => !r) },
          ]}
        />
      </ControlsPanel>

      <Snippet code={snippet} />
    </div>
  );
}

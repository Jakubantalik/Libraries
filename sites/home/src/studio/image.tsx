import { useCallback, useRef, useState } from "react";
import {
  ImageGeneration,
  type ImageGenerationCycleEvent,
  type ImageGenerationHandle,
  type ImageGenerationPreset,
} from "img-fx";
import { ControlsPanel, PgTabs, PgSlider, PgSwatches, PanelTitle, PanelSep, Snippet, num } from "./controls";

/* Studio — Image workbench. Public playground: preset + strength. The Studio
   adds pixel-cell scale and the card background the shader reasons against,
   plus the imperative reveal / regenerate actions. */

const PRESET_OPTIONS: Array<{ value: ImageGenerationPreset; label: string }> = [
  { value: "pixels-organic", label: "Pixel Organic" },
  { value: "pixels-mechanic", label: "Pixel Mechanic" },
  { value: "sweep-gradient", label: "Gradient Sweep" },
];

const CARD_BG_OPTIONS = [
  { value: "#1B1B1B", label: "Charcoal" },
  { value: "#101018", label: "Ink" },
  { value: "#1a2330", label: "Navy" },
  { value: "#241a2e", label: "Plum" },
] as const;

/* Palette overrides for the 7 shader slots (the `colors` prop). "preset"
   keeps the preset's own palette. */
type PaletteKey = "preset" | "ocean" | "ember" | "mono";
const PALETTE_OPTIONS: ReadonlyArray<{ value: PaletteKey; label: string }> = [
  { value: "preset", label: "Preset" },
  { value: "ocean", label: "Ocean" },
  { value: "ember", label: "Ember" },
  { value: "mono", label: "Mono" },
];
const PALETTES: Record<Exclude<PaletteKey, "preset">, string[]> = {
  ocean: ["#8ecbff", "#4aa8ff", "#2b6cb0", "#63e2ff", "#1a4a7a", "#a8d8ff", "#0f2f52"],
  ember: ["#ffd29b", "#ff9d5c", "#e2572b", "#ffb37a", "#8a2f10", "#ffe3c2", "#5c1d08"],
  mono: ["#e8e8e8", "#bdbdbd", "#8a8a8a", "#d4d4d4", "#5c5c5c", "#f4f4f4", "#3a3a3a"],
};

const IMAGE_POOL = ["/images/gen-1.jpg", "/images/gen-2.jpg", "/images/gen-3.jpg"];

/* Param key -> the knob's own label, for the agent's applied-change line. */
const IMAGE_PARAM_LABELS: Record<string, string> = {
  preset: "Type",
  strength: "Strength",
  speed: "Speed",
  palette: "Palette",
  cardBg: "Card background",
  pixelScale: "Pixel scale",
  paused: "Paused",
};

export function ImageStudio({ visible = true }: { visible?: boolean }) {
  const [preset, setPreset] = useState<ImageGenerationPreset>("pixels-organic");
  /* Strength slider maps 0–100% onto the library's 0..2 range: 50% is the
     preset default (today's look), 100% is the full intensity boost. */
  const [strength, setStrength] = useState(50);
  const [speed, setSpeed] = useState(100);
  const [pixelScale, setPixelScale] = useState(1);
  const [palette, setPalette] = useState<PaletteKey>("preset");
  const [cardBg, setCardBg] = useState<string>("#1B1B1B");
  const [paused, setPaused] = useState(false);
  const [imageRevealed, setImageRevealed] = useState(false);
  const handleRef = useRef<ImageGenerationHandle | null>(null);

  const onCycle = (e: ImageGenerationCycleEvent) => {
    if (e.phase === "reveal" || e.phase === "visible") setImageRevealed(true);
    else if (e.phase === "idle") setImageRevealed(false);
  };

  const onToggleReveal = () => {
    const h = handleRef.current;
    if (!h) return;
    if (h.isImageActive()) h.triggerHide();
    else h.triggerReveal({ hold: "manual" });
  };

  const onRegenerate = () => {
    handleRef.current?.triggerRegenerate({ durationMs: 3000 });
  };

  /* Agent wiring — keys match the Worker's spec, which owns the ranges. */
  const agentParams: Record<string, unknown> = {
    preset, strength, speed, palette, cardBg, pixelScale, paused,
  };

  const applyAgentParams = useCallback((patch: Record<string, unknown>) => {
    if (typeof patch.preset === "string") setPreset(patch.preset as ImageGenerationPreset);
    if (typeof patch.strength === "number") setStrength(patch.strength);
    if (typeof patch.speed === "number") setSpeed(patch.speed);
    if (typeof patch.palette === "string") setPalette(patch.palette as PaletteKey);
    if (typeof patch.cardBg === "string") setCardBg(patch.cardBg);
    if (typeof patch.pixelScale === "number") setPixelScale(patch.pixelScale);
    if (typeof patch.paused === "boolean") setPaused(patch.paused);
  }, []);

  const colors = palette !== "preset" ? PALETTES[palette] : undefined;

  const lines = ["import { ImageGeneration } from 'img-fx';", "", "<ImageGeneration", `  preset="${preset}"`];
  if (strength !== 50) lines.push(`  strength={${num(strength / 50)}}`);
  if (speed !== 100) lines.push(`  speed={${num(speed / 100)}}`);
  if (pixelScale !== 1) lines.push(`  pixelScale={${num(pixelScale)}}`);
  if (cardBg !== "#1B1B1B") lines.push(`  cardBg="${cardBg}"`);
  if (colors) lines.push(`  colors={[${colors.map((c) => `'${c}'`).join(", ")}]}`);
  lines.push(
    "  images={['/images/gen-1.jpg', '/images/gen-2.jpg']}",
    ">",
    "  <div style={{ width: 200, height: 200, borderRadius: 20 }} />",
    "</ImageGeneration>"
  );
  const snippet = lines.join("\n");

  return (
    <div className="pg">
      <div className="pg-stage">
        {visible && (
        <ImageGeneration
          ref={handleRef}
          preset={preset}
          theme="dark"
          cardBg={cardBg}
          strength={strength / 50}
          speed={speed / 100}
          colors={colors}
          pixelScale={pixelScale}
          images={IMAGE_POOL}
          paused={paused}
          onCycle={onCycle}
        >
          <div style={{ width: 200, height: 200, borderRadius: 20 }} />
        </ImageGeneration>
        )}

        <div className="pg-toolbar">
          <button
            type="button"
            className="btn-animate"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={!paused}
          >
            {paused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            className="btn-animate"
            onClick={onToggleReveal}
            aria-pressed={imageRevealed}
            disabled={paused}
            aria-disabled={paused}
            title={paused ? "Press Play to enable" : undefined}
          >
            {imageRevealed ? "Hide image" : "Reveal image"}
          </button>
          <button
            type="button"
            className="btn-animate"
            onClick={onRegenerate}
            disabled={paused || !imageRevealed}
            aria-disabled={paused || !imageRevealed}
            title={
              paused
                ? "Press Play to enable"
                : !imageRevealed
                  ? "Reveal an image first"
                  : undefined
            }
          >
            Regenerate
          </button>
        </div>
      </div>

      <ControlsPanel
        library="Image"
        agent={{
          libraryId: "image",
          params: agentParams,
          labels: IMAGE_PARAM_LABELS,
          onApply: applyAgentParams,
        }}
        prompt={{ pkg: "img-fx", docsPath: "/image.html", snippet }}
      >
        <PanelTitle>Main</PanelTitle>
        <PgTabs label="Type" options={PRESET_OPTIONS} value={preset} onChange={setPreset} />
        <PgSlider label="Strength" value={strength} min={0} max={100} step={1} display={`${strength}%`} onChange={setStrength} />
        <PgSlider label="Speed" value={speed} min={25} max={300} step={5} display={`${num(speed / 100)}×`} onChange={setSpeed} />
        <PanelSep />
        <PanelTitle>Color</PanelTitle>
        <PgTabs label="Palette" options={PALETTE_OPTIONS} value={palette} onChange={setPalette} />
        <PgSwatches label="Card background" options={CARD_BG_OPTIONS} value={cardBg} onChange={setCardBg} />
        <PanelSep />
        <PanelTitle>Grid</PanelTitle>
        <PgSlider label="Pixel scale" value={pixelScale} min={0.5} max={2} step={0.05} display={`${num(pixelScale)}×`} onChange={setPixelScale} />
      </ControlsPanel>

      <Snippet code={snippet} />
    </div>
  );
}

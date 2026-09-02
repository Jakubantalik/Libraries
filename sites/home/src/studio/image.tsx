import { PRESETS } from "img-fx";
import { useCallback, useRef, useState } from "react";
import {
  ImageGeneration,
  type ImageGenerationCycleEvent,
  type ImageGenerationHandle,
  type ImageGenerationPreset,
} from "img-fx";
import { ControlsPanel, PgTabs, PgSlider, PgSwatches, PgGroup, PanelSep, Snippet, num, StageBar } from "./controls";

/* Studio — Image workbench. Public playground: preset + strength. The Studio
   adds pixel-cell scale and the card background the shader reasons against,
   plus the imperative reveal / regenerate actions. */

const PRESET_OPTIONS: Array<{ value: ImageGenerationPreset; label: string }> = [
  { value: "pixels-organic", label: "Organic" },
  { value: "pixels-mechanic", label: "Mechanic" },
  { value: "sweep-gradient", label: "Gradient Sweep" },
];

/* "default" follows the live demo page's per-theme card surface (dark
   #1B1B1B, light #EEEEEF) — the swatch itself repaints with the theme so
   the row always shows the fill the card actually has. */
const CARD_BG_DEFAULT = "default";
const CARD_BG_DEFAULTS = { dark: "#242424", light: "#EEEEEF" } as const;
const CARD_BG_REST = [
  { value: "#1b1b24", label: "Ink" },
  { value: "#1a2330", label: "Navy" },
  { value: "#241a2e", label: "Plum" },
] as const;

/* Palette overrides for the 7 shader slots (the `colors` prop). "preset"
   keeps the preset's own palette.

   A palette re-HUES the preset rather than replacing it: each slot keeps its
   own lightness, and the slots that carry the card surface (the ones the
   preset paints at its own cardBg) are passed through as null so the engine
   keeps them. Replacing all seven with saturated colors filled every cell
   and flattened the grid — the effect's structure lives in the contrast
   between ink slots and background slots. */
type PaletteKey = "preset" | "ocean" | "ember" | "mono";
const PALETTE_OPTIONS: ReadonlyArray<{ value: PaletteKey; label: string }> = [
  { value: "preset", label: "Preset" },
  { value: "ocean", label: "Ocean" },
  { value: "ember", label: "Ember" },
  { value: "mono", label: "Mono" },
];
/** Hue (deg) + saturation the ink slots are re-tinted to. */
const PALETTE_TINTS: Record<Exclude<PaletteKey, "preset">, { h: number; s: number }> = {
  ocean: { h: 205, s: 0.62 },
  ember: { h: 20, s: 0.72 },
  mono: { h: 0, s: 0 },
};

function hexLum(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** HSL -> #rrggbb, keeping the slot's own lightness. */
function tint(h: number, sat: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const table: Array<[number, number, number]> = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ];
  const rgb = table[seg];
  return (
    "#" +
    rgb
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function paletteColors(
  presetName: ImageGenerationPreset,
  theme: "dark" | "light",
  key: PaletteKey
): (string | null)[] | undefined {
  if (key === "preset") return undefined;
  const mode = PRESETS[presetName]?.modes[theme];
  if (!mode) return undefined;
  const { h, s } = PALETTE_TINTS[key];
  const bgLum = hexLum(mode.cardBg);
  return mode.colors.map((c) => {
    const l = hexLum(c);
    /* Slots sitting on the card surface are the background — keep them. */
    if (Math.abs(l - bgLum) < 0.08) return null;
    return tint(h, s, l);
  });
}

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

export function ImageStudio({ visible = true, theme = "dark" }: { visible?: boolean; theme?: "dark" | "light" }) {
  const [preset, setPreset] = useState<ImageGenerationPreset>("pixels-organic");
  /* Strength slider maps 0–100% onto the library's 0..2 range: 50% is the
     preset default (today's look), 100% is the full intensity boost. */
  const [strength, setStrength] = useState(50);
  const [speed, setSpeed] = useState(100);
  const [pixelScale, setPixelScale] = useState(1);
  const [palette, setPalette] = useState<PaletteKey>("preset");
  const [cardBg, setCardBg] = useState<string>(CARD_BG_DEFAULT);
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

  const colors = paletteColors(preset, theme, palette);

  const lines = ["import { ImageGeneration } from 'img-fx';", "", "<ImageGeneration", `  preset="${preset}"`];
  if (strength !== 50) lines.push(`  strength={${num(strength / 50)}}`);
  if (speed !== 100) lines.push(`  speed={${num(speed / 100)}}`);
  if (pixelScale !== 1) lines.push(`  pixelScale={${num(pixelScale)}}`);
  if (cardBg !== CARD_BG_DEFAULT) lines.push(`  cardBg="${cardBg}"`);
  /* null keeps the preset's own color for that slot — emit it as a bare
     null, not the string "null". */
  if (colors)
    lines.push(`  colors={[${colors.map((c) => (c === null ? "null" : `'${c}'`)).join(", ")}]}`);
  lines.push(
    "  images={['/images/gen-1.jpg', '/images/gen-2.jpg']}",
    ">",
    "  <div style={{ width: 200, height: 200, borderRadius: 20 }} />",
    "</ImageGeneration>"
  );
  const snippet = lines.join("\n");

  const effCardBg = cardBg === CARD_BG_DEFAULT ? CARD_BG_DEFAULTS[theme] : cardBg;
  const cardBgOptions = [
    { value: CARD_BG_DEFAULT, label: "Surface (default)", swatch: CARD_BG_DEFAULTS[theme] },
    ...CARD_BG_REST,
  ];

  return (
    <div className="pg">
      <StageBar library="Image" prompt={{ pkg: "img-fx", docsPath: "/image.html", snippet }} agent={{ libraryId: "image", params: agentParams, labels: IMAGE_PARAM_LABELS, onApply: applyAgentParams }} />
      <div className="pg-stage pg-stage--image">
        {visible && (
        <ImageGeneration
          ref={handleRef}
          preset={preset}
          theme={theme}
          cardBg={effCardBg}
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
      >
        <PgTabs label="Type" options={PRESET_OPTIONS} value={preset} onChange={setPreset} />
        <PanelSep />
        <PgGroup label="Effect settings">
          <PgSlider label="Strength" value={strength} min={0} max={100} step={1} display={`${strength}%`} onChange={setStrength} />
          <PgSlider label="Speed" value={speed} min={25} max={300} step={5} display={`${num(speed / 100)}×`} onChange={setSpeed} />
          <PgSlider label="Pixel scale" value={pixelScale} min={0.5} max={2} step={0.05} display={`${num(pixelScale)}×`} onChange={setPixelScale} />
        </PgGroup>
        <PanelSep />
        <PgTabs label="Palette" options={PALETTE_OPTIONS} value={palette} onChange={setPalette} />
        <PgSwatches label="Card background" options={cardBgOptions} value={cardBg} onChange={setCardBg} allowCustom />
      </ControlsPanel>

      <Snippet code={snippet} />
    </div>
  );
}

import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ImageGeneration,
  type ImageGenerationCycleEvent,
  type ImageGenerationHandle,
  type ImageGenerationPreset,
} from "img-fx";

/* Image detail page — playground island (stage + controls + live snippet).
   Mirrors the live demo playground at packages/img-fx/demo/src/App.tsx:
   preset tabs, 0–100 strength slider, play/pause (starts paused),
   Reveal/Hide image and Regenerate via the imperative ref handle.
   Note: unlike the original playgrounds (which intentionally swapped the
   labels to match visual character), labels here map directly to values. */

const PRESET_OPTIONS: Array<{ value: ImageGenerationPreset; label: string }> = [
  { value: "pixels-organic", label: "Pixel Organic" },
  { value: "pixels-mechanic", label: "Pixel Mechanic" },
  { value: "sweep-gradient", label: "Gradient Sweep" },
];

const IMAGE_POOL = ["/images/gen-1.jpg", "/images/gen-2.jpg", "/images/gen-3.jpg"];

function buildSnippet(preset: ImageGenerationPreset, strength: number): string {
  const lines = [
    "import { ImageGeneration } from 'img-fx';",
    "",
    "<ImageGeneration",
    `  preset="${preset}"`,
  ];
  if (strength !== 100) lines.push(`  strength={${(strength / 100).toFixed(2)}}`);
  lines.push(
    "  images={['/images/gen-1.jpg', '/images/gen-2.jpg']}",
    ">",
    "  <div style={{ width: 280, height: 280, borderRadius: 20 }} />",
    "</ImageGeneration>"
  );
  return lines.join("\n");
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
    <div className="pg-vslider">
      <div className="pg-vslider-fill" style={{ width: `${pct}%` }} />
      <span className="pg-vslider-label">{ariaLabel}</span>
      <span className="pg-vslider-value">{format(value)}</span>
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
  );
}

function ImagePlayground() {
  const [preset, setPreset] = useState<ImageGenerationPreset>("pixels-organic");
  const [strength, setStrength] = useState(100);
  // Starts paused so the page loads quietly (same as the live demo playground).
  const [paused, setPaused] = useState(true);
  const [imageRevealed, setImageRevealed] = useState(false);
  const handleRef = useRef<ImageGenerationHandle | null>(null);

  const snippet = buildSnippet(preset, strength);

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

  return (
    <>
      {/* The demo page's own examples first: the loader resolving into real
          images at the card sizes it was drawn for, before any knobs. */}
      <div className="detail-examples">
        <div className="example-row-full">
          <ImageGeneration preset="pixels-organic" theme="dark" cardBg="#1B1B1B" images={IMAGE_POOL} autoReveal>
            <div className="ex-image-card" />
          </ImageGeneration>
        </div>
        <div className="example-row-split">
          <div className="example-cell">
            <ImageGeneration preset="pixels-mechanic" theme="dark" cardBg="#1B1B1B" images={IMAGE_POOL} autoReveal>
              <div className="ex-image-card ex-image-card--sm" />
            </ImageGeneration>
          </div>
          <div className="example-cell">
            <ImageGeneration preset="sweep-gradient" theme="dark" cardBg="#1B1B1B" images={IMAGE_POOL} autoReveal>
              <div className="ex-image-card ex-image-card--sm" />
            </ImageGeneration>
          </div>
        </div>
      </div>

      <p className="detail-playground-label">Playground</p>

      <div className="pg">
      <div className="pg-stage">
        <ImageGeneration
          ref={handleRef}
          preset={preset}
          theme="dark"
          cardBg="#1B1B1B"
          strength={strength / 100}
          images={IMAGE_POOL}
          paused={paused}
          onCycle={onCycle}
        >
          <div style={{ width: 280, height: 280, borderRadius: 20 }} />
        </ImageGeneration>

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

      <div className="pg-controls">
        <div className="pg-field" role="radiogroup" aria-label="Shader preset">
          <span className="pg-label">Type</span>
          <div className="pg-tabs">
            {PRESET_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="pg-tab"
                role="radio"
                aria-checked={preset === value}
                data-active={preset === value}
                onClick={() => setPreset(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-field">
          <Slider
            min={0}
            max={100}
            step={1}
            value={strength}
            onChange={setStrength}
            format={(v) => `${v}%`}
            ariaLabel="Strength"
          />
        </div>
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
      <ImagePlayground />
    </StrictMode>
  );
}

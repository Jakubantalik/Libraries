import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CodeCopy } from "./examples/CodeCopy";
import { MetalExamples } from "./examples/metal-examples";
import { StudioTeaser } from "./examples/StudioTeaser";
import { MetalFx, type MetalFxPreset, type MetalFxVariant } from "metal-fx-v1";

/* Metal detail page — playground island (stage + controls + live snippet).
   Button/circle type tabs and the No Glow / No Reflection toggles; the
   preset and strength stay at the demo's own baseline (chromatic at 90%)
   rather than being exposed here, since the Studio tunes them in full.
   The preview pairs a search-input pill (reflection target) with the
   MetalFx-wrapped button, like the live demo. */

/* The demo's baseline, fixed for this page. */
const PRESET: MetalFxPreset = "chromatic";
const STRENGTH = 90;

const VARIANTS: MetalFxVariant[] = ["button", "circle"];

function buildSnippet(
  variant: MetalFxVariant,
  preset: MetalFxPreset,
  strength: number,
  disableGlow: boolean,
  disableReflection: boolean
): string {
  const props = [`preset="${preset}"`];
  if (variant !== "button") props.push(`variant="${variant}"`);
  if (strength !== 1) props.push(`strength={${strength.toFixed(2)}}`);
  if (disableGlow) props.push("disableGlow");
  if (!disableReflection) props.push("reflectionTargets={[siblingRef]}");
  const child = variant === "circle"
    ? `  <button aria-label="Send"><ArrowUpIcon /></button>`
    : `  <button>Upgrade to Pro</button>`;
  return `import { MetalFx } from 'metal-fx';\n\n<MetalFx ${props.join(" ")}>\n${child}\n</MetalFx>`;
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

function MetalPlayground() {
  const [variant, setVariant] = useState<MetalFxVariant>("button");
  // Starts paused so the page loads quietly (same as the live playground).
  const [paused, setPaused] = useState(true);
  const [disableGlow, setDisableGlow] = useState(false);
  const [disableReflection, setDisableReflection] = useState(false);
  const playPauseRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLLabelElement>(null);

  const snippet = buildSnippet(variant, PRESET, STRENGTH / 100, disableGlow, disableReflection);
  const reflectionTargets = disableReflection ? undefined : [searchRef, playPauseRef];

  return (
    <>
      <MetalExamples strength={STRENGTH / 100} />

      <p className="detail-playground-label">Playground</p>

      <div className="pg">
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

          {/* key remounts the WebGL instance on variant change, matching the live demo */}
          <MetalFx
            key={variant}
            preset={PRESET}
            variant={variant}
            theme="dark"
            strength={STRENGTH / 100}
            paused={paused}
            disableGlow={disableGlow}
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

      <div className="pg-controls">
        <div className="pg-field" role="radiogroup" aria-label="Component type">
          <span className="pg-label">Type</span>
          <div className="pg-tabs">
            {VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                className="pg-tab"
                role="radio"
                aria-checked={variant === v}
                data-active={variant === v}
                onClick={() => setVariant(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-field">
          <span className="pg-label">Options</span>
          <div className="pg-tabs">
            <button
              type="button"
              className="pg-toggle"
              aria-pressed={disableGlow}
              data-active={disableGlow}
              onClick={() => setDisableGlow((g) => !g)}
            >
              No Glow
            </button>
            <button
              type="button"
              className="pg-toggle"
              aria-pressed={disableReflection}
              data-active={disableReflection}
              onClick={() => setDisableReflection((r) => !r)}
            >
              No Reflection
            </button>
          </div>
        </div>
        <StudioTeaser
          rows={[
            { kind: "tabs", label: "Color", options: ["Chromatic", "Silver", "Gold"] },
            { kind: "slider", label: "Strength", value: "90%", fill: 90 },
            { kind: "slider", label: "Glow strength", value: "100%", fill: 100 },
            { kind: "slider", label: "Shader scale", value: "1.6\u00d7", fill: 42 },
          ]}
        />
      </div>

      </div>

      <div className="code-block pg-snippet">
        <pre>{snippet}</pre>
        <CodeCopy text={snippet} label="Copy playground snippet" />
      </div>
    </>
  );
}

const el = document.getElementById("playground-root");
if (el) {
  createRoot(el).render(
    /* No StrictMode: metal-fx v1 keeps one shared renderer, and the
       simulated double-mount destroys it in a state its loop never
       recovers from — everything paints one frame and freezes. The
       library's own demo mounts without StrictMode too. */
    <MetalPlayground />
  );
}

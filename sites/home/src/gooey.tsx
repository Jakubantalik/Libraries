import {
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createRoot } from "react-dom/client";
import { Liquid } from "liquid-gooey";

/* Gooey detail page — one React island rendering the whole playground grid
   (stage + controls) plus the live-updating snippet below it. Controls
   mirror the live gooey site (sites/gooey/playground/DemoPage.tsx): Type
   tabs (Morph / Move), Goo blur and Contrast sliders. The demo runs its
   own interaction loop; the play/pause pill on the stage toggles it, and
   touching the demo directly pauses the loop. */

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

function PgSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const handleChange = useCallback(
    (raw: number) => {
      /* Re-round after parse: 0.5-steps accumulate float dust that would
         render as "6.000000000000001" in the value label + snippet. */
      const snapped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, Math.round(snapped * 100) / 100)));
    },
    [max, min, onChange, step]
  );
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
            onChange={(e) => handleChange(parseFloat(e.target.value))}
            aria-label={label}
          />
        </div>
        <span className="pg-slider-value">{value}</span>
      </div>
    </div>
  );
}

type EffectType = "morph" | "move";

const TYPE_OPTIONS = [
  { value: "morph", label: "Morph" },
  { value: "move", label: "Move" },
] as const;

/* Demo surface on the dark stage: light liquid, dark icons — the same
   look the homepage card preview uses. */
const LIQUID_FILL = "#e9e9e9";
const LIQUID_SHADOW = "0 2px 6px rgba(0,0,0,.35)";

/* ── Morph demo: plus button expanding three satellites ───────── */

const SATELLITES = [
  {
    label: "New file",
    x: -54,
    y: -34,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V6z" />
        <path d="M9 1.5V6h4.5" />
      </svg>
    ),
  },
  {
    label: "Add image",
    x: 0,
    y: -64,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
        <circle cx="5.5" cy="5.5" r="1.25" />
        <path d="M14.5 10.5L11 7l-7.5 7.5" />
      </svg>
    ),
  },
  {
    label: "New folder",
    x: 54,
    y: -34,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 12.5A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5h3L7.5 4H13a1.5 1.5 0 0 1 1.5 1.5z" />
      </svg>
    ),
  },
];

function PlusMenuDemo({
  blur,
  contrast,
  open,
  onToggle,
}: {
  blur: number;
  contrast: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Liquid
      blur={blur}
      contrast={contrast}
      fill={LIQUID_FILL}
      shadow={LIQUID_SHADOW}
      className={`gd-menu${open ? " gd-open" : ""}`}
    >
      {SATELLITES.map((s, i) => (
        <Liquid.Item
          key={s.label}
          className="gd-slot"
          x={open ? s.x : 0}
          y={open ? s.y : 0}
          transition="bouncy"
          delay={i * 40}
        >
          <button
            type="button"
            className="gd-btn gd-sat"
            aria-label={s.label}
            tabIndex={open ? 0 : -1}
            onClick={onToggle}
          >
            <span className="gd-sat-icon">{s.icon}</span>
          </button>
        </Liquid.Item>
      ))}
      <Liquid.Item className="gd-slot">
        <button
          type="button"
          className="gd-btn gd-main"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={onToggle}
        >
          <span className="gd-plus">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M10 4V16M4 10H16" />
            </svg>
          </span>
        </button>
      </Liquid.Item>
    </Liquid>
  );
}

/* ── Move demo: liquid slider thumb trailing along a track ───────
   Track spans 14..226 (240 − 14px insets each side); the 24px thumb's
   offset travels 0..188 to stay flush with the track ends. */
const THUMB_MAX = 188;

function MoveSliderDemo({
  blur,
  contrast,
  x,
  dragging,
  onThumbDown,
  onThumbMove,
  onThumbEnd,
}: {
  blur: number;
  contrast: number;
  x: number;
  dragging: boolean;
  onThumbDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onThumbMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onThumbEnd: () => void;
}) {
  return (
    <Liquid blur={blur} contrast={contrast} fill={LIQUID_FILL} shadow={LIQUID_SHADOW} className="gd-sl">
      <div className="gd-sl-track" aria-hidden="true" />
      <Liquid.Item effect="move" move={{ springiness: 0.5, trail: 0.35 }}>
        <div
          className="gd-sl-thumb"
          role="slider"
          aria-label="Demo slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((x / THUMB_MAX) * 100)}
          tabIndex={0}
          style={{
            transform: `translateX(${x}px)`,
            /* The loop eases the element itself; the liquid trails it.
               While dragging, position must follow the pointer 1:1. */
            transition: dragging ? "none" : "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          onPointerDown={onThumbDown}
          onPointerMove={onThumbMove}
          onPointerUp={onThumbEnd}
          onPointerCancel={onThumbEnd}
        />
      </Liquid.Item>
    </Liquid>
  );
}

function GooeyPlayground() {
  const [effect, setEffect] = useState<EffectType>("morph");
  const [blur, setBlur] = useState(6);
  const [contrast, setContrast] = useState(18);
  const [playing, setPlaying] = useState(true);

  const [open, setOpen] = useState(false);
  const [thumbX, setThumbX] = useState(84);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<number | null>(null);

  /* The interaction loop: the morph menu opens/closes, the move thumb
     glides end to end. Interacting with a demo directly pauses it. */
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      if (effect === "morph") setOpen((o) => !o);
      else setThumbX((prev) => (prev < THUMB_MAX / 2 ? THUMB_MAX : 0));
    };
    const t = window.setInterval(tick, effect === "morph" ? 2400 : 1600);
    return () => window.clearInterval(t);
  }, [playing, effect]);

  const handleToggleMenu = useCallback(() => {
    setPlaying(false);
    setOpen((o) => !o);
  }, []);

  const handleThumbDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      setPlaying(false);
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events have no active pointer */
      }
      dragOffset.current = e.clientX - thumbX;
    },
    [thumbX]
  );

  const handleThumbMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragOffset.current == null) return;
    setThumbX(Math.min(THUMB_MAX, Math.max(0, e.clientX - dragOffset.current)));
  }, []);

  const handleThumbEnd = useCallback(() => {
    dragOffset.current = null;
    setDragging(false);
  }, []);

  /* Live snippet: current control state, props at their defaults omitted
     (blur 6 and contrast 18 are the library defaults). */
  const liquidProps = `${blur !== 6 ? ` blur={${blur}}` : ""}${contrast !== 18 ? ` contrast={${contrast}}` : ""}`;
  const snippet =
    effect === "morph"
      ? `import { Liquid } from 'liquid-gooey'

<Liquid${liquidProps} fill="#fff">
  <Liquid.Item x={open ? -54 : 0} y={open ? -34 : 0} transition="bouncy">
    <button className="round-btn">…</button>
  </Liquid.Item>
  <Liquid.Item x={0} y={open ? -64 : 0} transition="bouncy" delay={40}>
    <button className="round-btn">…</button>
  </Liquid.Item>
  <Liquid.Item>
    <button className="round-btn">+</button>
  </Liquid.Item>
</Liquid>`
      : `import { Liquid } from 'liquid-gooey'

<Liquid${liquidProps} fill="#fff">
  <Liquid.Item effect="move" move={{ springiness: 0.5, trail: 0.35 }}>
    <div className="thumb" style={{ transform: \`translateX(\${x}px)\` }} />
  </Liquid.Item>
</Liquid>`;

  return (
    <>
      <div className="pg">
        <div className="pg-stage" id="playground-stage">
          {effect === "morph" ? (
            <PlusMenuDemo blur={blur} contrast={contrast} open={open} onToggle={handleToggleMenu} />
          ) : (
            <MoveSliderDemo
              blur={blur}
              contrast={contrast}
              x={thumbX}
              dragging={dragging}
              onThumbDown={handleThumbDown}
              onThumbMove={handleThumbMove}
              onThumbEnd={handleThumbEnd}
            />
          )}
          <button
            type="button"
            className="btn-animate pg-play"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? "Pause" : "Play"}
          </button>
        </div>

        <div className="pg-controls" id="playground-controls">
          <PgTabs label="Type" options={TYPE_OPTIONS} value={effect} onChange={setEffect} />
          <PgSlider label="Goo blur" value={blur} min={0} max={16} step={0.5} onChange={setBlur} />
          <PgSlider label="Contrast" value={contrast} min={4} max={40} step={1} onChange={setContrast} />
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
      <GooeyPlayground />
    </StrictMode>
  );
}

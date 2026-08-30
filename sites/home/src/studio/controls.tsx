import { useCallback, useEffect, useRef, useState } from "react";

/* Studio — shared control components. Same pg-* conventions the detail-page
   playgrounds use (playground.css), plus Studio-only pieces: section titles,
   separators and color swatches (styled in studio/app.html). */

export function CopyIcon() {
  return (
    <svg className="icon-copy" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg className="icon-check" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function CodeCopy({ text, label }: { text: string; label: string }) {
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

/** Live-updating snippet block, full playground width. */
export function Snippet({ code }: { code: string }) {
  return (
    <div className="code-block pg-snippet">
      <pre>{code}</pre>
      <CodeCopy text={code} label="Copy Studio code" />
    </div>
  );
}

/** Uppercase section title inside the controls column. */
export function PanelTitle({ children }: { children: string }) {
  return <div className="pg-controls-title">{children}</div>;
}

export function PanelSep() {
  return <div className="pg-controls-sep" aria-hidden="true" />;
}

export function PgTabs<T extends string>({
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

/** Filled-track slider (visual track + invisible native range for a11y).
    Values re-round after parse so float dust never reaches the label. */
export function PgSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const handleChange = useCallback(
    (raw: number) => {
      const snapped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, Math.round(snapped * 1000) / 1000)));
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
        <span className="pg-slider-value">{display ?? value}</span>
      </div>
    </div>
  );
}

/** Row of toggle pills (multi-select options). */
export function PgToggles({
  label,
  options,
}: {
  label: string;
  options: ReadonlyArray<{ label: string; active: boolean; onToggle: () => void }>;
}) {
  return (
    <div className="pg-field">
      <span className="pg-label">{label}</span>
      <div className="pg-tabs">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            className="pg-toggle"
            aria-pressed={o.active}
            data-active={o.active ? "true" : undefined}
            onClick={o.onToggle}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Round color swatch picker. `swatch` overrides the painted color when the
    option's value is a sentinel rather than a CSS color. */
export function PgSwatches({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string; swatch?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="pg-field" role="radiogroup" aria-label={label}>
      <span className="pg-label">{label}</span>
      <div className="pg-swatches">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="pg-swatch"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.label}
            data-active={value === o.value ? "true" : undefined}
            style={{ background: o.swatch ?? o.value }}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  );
}

/** Formats a number for a JSX snippet: trims trailing zeros. */
export function num(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

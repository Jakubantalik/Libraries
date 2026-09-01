import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { describePatch, streamAgentTurn, type ChatTurn } from "./agent";

/* App-level theme plumbing: the Studio shell provides it, and every
   ControlsPanel renders the dark/light toggle in its own top-right corner.
   Null (detail pages, tests) simply renders no toggle. */
export const StudioThemeContext = createContext<{
  theme: "dark" | "light";
  toggle: () => void;
} | null>(null);

function PanelThemeToggle() {
  const ctx = useContext(StudioThemeContext);
  if (!ctx) return null;
  const dark = ctx.theme === "dark";
  return (
    <button
      type="button"
      className="icon-btn st-theme-btn st-theme-btn--panel"
      onClick={ctx.toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={!dark}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.1 6.1 4.6 4.6M19.4 19.4l-1.5-1.5M17.9 6.1l1.5-1.5M4.6 19.4l1.5-1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
        </svg>
      )}
    </button>
  );
}

/* Studio — shared control components. Same pg-* conventions the detail-page
   playgrounds use (playground.css), plus Studio-only pieces: section titles,
   separators and color swatches. */

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
  const swapRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  /* The detail pages' copy tooltip (site.js .card-copy wiring): the label
     tail cross-blurs "y code" -> "ied" and the pill tweens between the two
     measured widths. Hidden libraries measure 0, so re-measure when the
     button becomes visible and never write a 0. */
  useLayoutEffect(() => {
    const swap = swapRef.current;
    if (!swap) return;
    const a = swap.querySelector<HTMLElement>(".tt-a");
    const b = swap.querySelector<HTMLElement>(".tt-b");
    if (!a || !b) return;
    const measure = () => {
      const wa = a.getBoundingClientRect().width;
      if (!wa) return;
      const prevPos = b.style.position;
      b.style.position = "static";
      a.style.display = "none";
      const wb = b.getBoundingClientRect().width;
      a.style.display = "";
      b.style.position = prevPos;
      swap.style.setProperty("--tt-w-a", `${wa}px`);
      swap.style.setProperty("--tt-w-b", `${wb}px`);
    };
    const raf = requestAnimationFrame(measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(swap);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

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
      <span className="card-copy-tooltip" aria-hidden="true">
        <span className="tt-text">
          Cop
          <span className="tt-swap" ref={swapRef} data-state={copied ? "copied" : undefined}>
            <span className="tt-label tt-a">y code</span>
            <span className="tt-label tt-b">ied</span>
          </span>
        </span>
      </span>
    </button>
  );
}

/** Live-updating snippet block, full playground width. */
export function Snippet({ code }: { code: string }) {
  const preRef = useRef<HTMLPreElement | null>(null);

  /* The right-edge fade (playground.css) is masked off once the snippet is
     scrolled to its end, or when it doesn't overflow at all — so the hint
     only shows while there IS more code to the right. */
  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    const update = () => {
      const atEnd = pre.scrollLeft + pre.clientWidth >= pre.scrollWidth - 1;
      if (atEnd) pre.setAttribute("data-scroll-end", "true");
      else pre.removeAttribute("data-scroll-end");
    };
    update();
    pre.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(pre);
    return () => {
      pre.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [code]);

  return (
    <div className="code-block pg-snippet">
      <pre ref={preRef}>{code}</pre>
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

/** Titled group: gives a section its own label (and so the hairline above
    it) when the controls inside carry their own inline labels — e.g. a lone
    slider that would otherwise sit under the previous section's title. */
export function PgGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pg-field pg-group" role="group" aria-label={label}>
      <span className="pg-label">{label}</span>
      {children}
    </div>
  );
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

/** Value slider + input (Figma 1418:38136): the fill grows inside a 32px
    block, the label rides the fill, the value sits at the right. The
    invisible native range stays on top for pointer + keyboard + readers.
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
      <div className="pg-vslider">
        <div className="pg-vslider-fill" style={{ width: `${pct}%` }} />
        <span className="pg-vslider-label">{label}</span>
        <span className="pg-vslider-value">{display ?? value}</span>
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
/* ── Custom color picker ───────────────────────────────────────
   Ported from jakubantalik.com's text-color picker (spectrum canvas +
   hue strip + hex field), restyled onto the Studio panel tokens. */

function cpHsvToRgb(h: number, sat: number, v: number): [number, number, number] {
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const pC = v * (1 - sat);
  const q = v * (1 - f * sat);
  const t = v * (1 - (1 - f) * sat);
  const pick: Array<[number, number, number]> = [
    [v, t, pC], [q, v, pC], [pC, v, t], [pC, q, v], [t, pC, v], [v, pC, q],
  ];
  const [r, g, b] = pick[i];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function cpRgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const sat = max === 0 ? 0 : d / max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s: sat, v: max };
}

function cpHex(h: number, sat: number, v: number): string {
  const [r, g, b] = cpHsvToRgb(h, sat, v);
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function cpParseHex(raw: string): { h: number; s: number; v: number } | null {
  const m = raw.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(m)) return null;
  const n = parseInt(m, 16);
  return cpRgbToHsv((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function ColorPickerPanel({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const init = cpParseHex(value) ?? { h: 0, s: 1, v: 1 };
  const hsvRef = useRef(init);
  const [, force] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const specRef = useRef<HTMLCanvasElement | null>(null);
  const hueRef = useRef<HTMLCanvasElement | null>(null);
  const [hexText, setHexText] = useState(value.replace("#", "").toUpperCase());

  const drawSpectrum = useCallback(() => {
    const c = specRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { width: w, height: hh } = c;
    ctx.fillStyle = `hsl(${hsvRef.current.h}, 100%, 50%)`;
    ctx.fillRect(0, 0, w, hh);
    const white = ctx.createLinearGradient(0, 0, w, 0);
    white.addColorStop(0, "rgba(255,255,255,1)");
    white.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, w, hh);
    const black = ctx.createLinearGradient(0, 0, 0, hh);
    black.addColorStop(0, "rgba(0,0,0,0)");
    black.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, w, hh);
  }, []);

  useLayoutEffect(() => {
    drawSpectrum();
    const c = hueRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const grad = ctx.createLinearGradient(0, 0, c.width, 0);
    for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${i * 60}, 100%, 50%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
  }, [drawSpectrum]);

  /* Outside click + Esc close, same contract as the site's panel. */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const apply = useCallback(() => {
    const hex = cpHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v);
    setHexText(hex.replace("#", "").toUpperCase());
    onChange(hex);
    force((n) => n + 1);
  }, [onChange]);

  const dragTrack = (
    pick: (e: PointerEvent | ReactPointerEvent) => void
  ) => (e: ReactPointerEvent) => {
    e.preventDefault();
    pick(e);
    const move = (ev: PointerEvent) => pick(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pickSpectrum = (e: PointerEvent | ReactPointerEvent) => {
    const wrap = specRef.current?.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    hsvRef.current.s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    hsvRef.current.v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    apply();
  };

  const pickHue = (e: PointerEvent | ReactPointerEvent) => {
    const wrap = hueRef.current?.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    hsvRef.current.h = Math.max(0, Math.min(359.9, ((e.clientX - r.left) / r.width) * 360));
    drawSpectrum();
    apply();
  };

  const commitHex = () => {
    const parsed = cpParseHex(hexText);
    if (!parsed) return;
    hsvRef.current = parsed;
    drawSpectrum();
    apply();
  };

  const { h, s: sat, v } = hsvRef.current;
  return (
    <div className="cp-panel" ref={rootRef}>
      <div className="cp-spectrum-wrap" onPointerDown={dragTrack(pickSpectrum)}>
        <canvas ref={specRef} className="cp-spectrum" width={196} height={140} />
        <div className="cp-cursor" style={{ left: `${sat * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <div className="cp-hue-wrap" onPointerDown={dragTrack(pickHue)}>
        <canvas ref={hueRef} className="cp-hue" width={196} height={14} />
        <div className="cp-hue-cursor" style={{ left: `${(h / 360) * 100}%` }} />
      </div>
      <div className="cp-hex-row">
        <span className="cp-hex-label" aria-hidden="true">#</span>
        <input
          className="cp-hex-input"
          value={hexText}
          maxLength={6}
          spellCheck={false}
          aria-label="Hex color"
          onChange={(e) => setHexText(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commitHex(); onClose(); }
          }}
        />
      </div>
    </div>
  );
}

export function PgSwatches({
  label,
  options,
  value,
  onChange,
  allowCustom,
  hideLabel,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string; swatch?: string }>;
  value: string;
  onChange: (v: string) => void;
  /** Append a rainbow swatch that opens the picker, so any value outside
      the presets can be chosen; it shows (and stays selected on) the
      current custom color. */
  allowCustom?: boolean;
  /** Drop the visible label — for a row inside a titled PgGroup, where the
      group's title already names it. The aria-label stays either way. */
  hideLabel?: boolean;
}) {
  const isCustom = allowCustom && !options.some((o) => o.value === value);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="pg-field" role="radiogroup" aria-label={label} style={{ position: "relative" }}>
      {!hideLabel && <span className="pg-label">{label}</span>}
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
        {allowCustom && (
          <button
            type="button"
            className="pg-swatch pg-swatch--custom"
            data-active={isCustom ? "true" : undefined}
            style={isCustom ? { background: value } : undefined}
            title="Custom color"
            aria-label="Custom color"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((o) => !o)}
          />
        )}
      </div>
      {allowCustom && pickerOpen && (
        <ColorPickerPanel
          value={isCustom ? value : "#ededed"}
          onChange={onChange}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/** Formats a number for a JSX snippet: trims trailing zeros. */
export function num(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/* ── Controls panel: Manual control / Agent ────────────────────────
 * Every library's knob column sits behind two tabs. "Manual control"
 * is the knob stack itself; "Agent" is a chat where the same tuning is
 * described in words instead of dragged. The pill indicator measures
 * the selected tab so the two labels' different widths stay correct. */

type PanelTab = "manual" | "agent";

interface ChatMessage {
  /* Stable identity, because deltas stream into a bubble that already
     exists. Updating by index would break the moment an applied-change
     line lands between two halves of the same sentence. */
  id: number;
  role: "user" | "agent" | "applied" | "error";
  text: string;
}

/** What a library must hand over for its Agent tab to actually tune. */
export interface AgentWiring {
  /** Key the Worker's spec table is keyed by — "beam", not "Beam". */
  libraryId: string;
  /** Live values, sent every turn so the model reasons from real state. */
  params: Record<string, unknown>;
  /** Param key -> the knob's own label, for the applied-change line. */
  labels: Record<string, string>;
  onApply: (patch: Record<string, unknown>) => void;
}

/* A library whose controls aren't wired to the agent yet says so plainly
   rather than faking a reply that looks like tuning happened, and keeps
   the transcript so the phrasing someone tried is not lost. */
const AGENT_UNAVAILABLE =
  "The agent doesn't reach this library's controls yet. " +
  "Your message is kept here. Switch to Manual control to tune by hand, or use " +
  "Copy prompt on the library page to hand the whole library to your own coding agent.";

function AgentChat({ library, wiring }: { library: string; wiring?: AgentWiring }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /* Distinct from `busy`: the thinking dots stand in only until the first
     token lands, after which the streaming text is its own progress. */
  const [streaming, setStreaming] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const seq = useRef(0);
  const nextId = () => ++seq.current;

  /* The send closure outlives the render it was made in — a turn takes
     seconds and the panel re-renders on every applied patch — so both the
     transcript and the live params are read through refs. */
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const wiringRef = useRef(wiring);
  wiringRef.current = wiring;

  // Pin to the newest message as the reply streams in.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  /* Abort an in-flight turn if the panel goes away mid-stream. */
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");

    const userMsg: ChatMessage = { id: nextId(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    const active = wiringRef.current;
    if (!active) {
      const reply: ChatMessage = { id: nextId(), role: "agent", text: AGENT_UNAVAILABLE };
      setMessages((prev) => [...prev, reply]);
      return;
    }

    /* Only the prose turns go to the model. Applied-change lines are a UI
       affordance, and the parameter state they describe is sent separately
       and authoritatively as `params`. */
    const turns: ChatTurn[] = [
      ...messagesRef.current
        .filter((m): m is ChatMessage & { role: "user" | "agent" } =>
          m.role === "user" || m.role === "agent"
        )
        .map((m) => ({ role: m.role, text: m.text })),
      { role: "user", text },
    ];

    /* Snapshot of the values this turn started from, advanced as patches
       land so a second change in the same turn reads "3.2 → 4", not
       "1.96 → 4". */
    const before = { ...active.params };

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStreaming(false);

    /* Prose arrives as deltas but is written back as the whole accumulated
       string, so a double-invoked updater (StrictMode) is a no-op rather
       than a doubled sentence. */
    let bubbleId: number | null = null;
    let bubbleText = "";

    streamAgentTurn(
      {
        library: active.libraryId,
        params: before,
        messages: turns,
        signal: controller.signal,
      },
      {
        onText: (delta) => {
          setStreaming(true);
          if (bubbleId === null) {
            const opened: ChatMessage = { id: nextId(), role: "agent", text: "" };
            bubbleId = opened.id;
            bubbleText = "";
            setMessages((prev) =>
              prev.some((m) => m.id === opened.id) ? prev : [...prev, opened]
            );
          }
          bubbleText += delta;
          const id = bubbleId;
          const snapshot = bubbleText;
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: snapshot } : m)));
        },
        onParams: (patch) => {
          wiringRef.current?.onApply(patch);
          const line: ChatMessage = {
            id: nextId(),
            role: "applied",
            text: describePatch(patch, before, wiringRef.current?.labels ?? {}),
          };
          Object.assign(before, patch);
          setMessages((prev) => (prev.some((m) => m.id === line.id) ? prev : [...prev, line]));
          // Any prose after a change starts a fresh bubble below that line.
          bubbleId = null;
        },
      }
    )
      .catch((err: unknown) => {
        if ((err as Error)?.name === "AbortError") return;
        const line: ChatMessage = {
          id: nextId(),
          role: "error",
          text: err instanceof Error ? err.message : "The agent hit an error.",
        };
        setMessages((prev) => (prev.some((m) => m.id === line.id) ? prev : [...prev, line]));
      })
      .finally(() => {
        if (abortRef.current === controller) abortRef.current = null;
        setBusy(false);
        setStreaming(false);
      });
  }, [draft, busy]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter keeps the newline, as in every chat composer.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="st-chat">
      <div className="st-chat-log" ref={logRef} role="log" aria-label="Agent conversation">
        {messages.length === 0 ? (
          <p className="st-chat-empty">
            Describe the look you want and the agent tunes {library} for you: “make the
            glow slower and cooler”, “tighter corners”, “calmer motion”.
          </p>
        ) : (
          messages.map((m) => (
            <div className="st-chat-msg" data-role={m.role} key={m.id}>
              {m.text}
            </div>
          ))
        )}
        {busy && !streaming && (
          <div className="st-chat-thinking" role="status">
            <span /><span /><span />
          </div>
        )}
      </div>

      <div className="st-chat-composer">
        <textarea
          className="st-chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={`Ask for a change to ${library}…`}
          aria-label={`Ask the agent to change ${library}`}
        />
        <button
          type="button"
          className="st-chat-send"
          onClick={send}
          disabled={!draft.trim() || busy}
          aria-label="Send message"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 13V3M4 6.5 8 2.5l4 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Presets, reset, copy prompt ───────────────────────────────────
 * The agent wiring already carries exactly what these need: the full
 * live parameter record and a callback that applies a patch. A preset
 * is a saved copy of the former fed back through the latter; reset is
 * the mount-time snapshot fed through it.
 *
 * Presets live in localStorage for now — the account backend
 * (api.libraries.dev) does not exist yet, the same gap GATE_ENABLED
 * papers over. The stored shape {name, params, savedAt} is what an
 * account sync would upload verbatim, so when that Worker exists this
 * becomes a fetch and nothing here changes shape. */

interface StoredPreset {
  name: string;
  params: Record<string, unknown>;
  savedAt: number;
}

function presetKey(libraryId: string): string {
  return `ldev:studio:presets:${libraryId}`;
}

function readPresets(libraryId: string): StoredPreset[] {
  try {
    const raw = localStorage.getItem(presetKey(libraryId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePresets(libraryId: string, presets: StoredPreset[]) {
  try {
    localStorage.setItem(presetKey(libraryId), JSON.stringify(presets));
  } catch {
    /* Storage full or blocked — the Save button simply won't persist. */
  }
}

/** The coding-agent prompt, same shape as the detail pages' hidden
    #agent-prompt block, but the Usage section is the live tuned snippet. */
export interface PromptMeta {
  /** npm package name, e.g. "border-beam". */
  pkg: string;
  /** Docs path on libraries.dev, e.g. "/beam.html". */
  docsPath: string;
  /** The live snippet string the studio already renders. */
  snippet: string;
}

function buildAgentPrompt(library: string, meta: PromptMeta): string {
  return [
    `Add the ${library} effect from Libraries.dev to my React app.`,
    "",
    "Install:",
    `npm install ${meta.pkg}`,
    "",
    "Use exactly this configuration — it was tuned by hand in the Libraries.dev Studio:",
    "",
    meta.snippet,
    "",
    "Keep the prop values exactly as given; adapt only the child content to my app.",
    `Needs React 18 or newer. Docs: https://libraries.dev${meta.docsPath}`,
  ].join("\n");
}

type StageView = "preview" | "install" | "usage";

/** Bar above the stage: the detail pages' Preview / Install / Usage tabs
    (same .detail-tabs / .proto-modal-tabs pill bar) on the left, and their
    .detail-prompt Copy-prompt pill on the right. Install and Usage swap the
    stage + live snippet for the matching code block, exactly like the
    detail pages' data-detail-panel switch. */
export function StageBar({ library, prompt }: { library: string; prompt?: PromptMeta }) {
  const [view, setView] = useState<StageView>("preview");
  const barRef2 = useRef<HTMLDivElement | null>(null);
  const indRef = useRef<HTMLSpanElement | null>(null);
  const viewRef = useRef<StageView>("preview");

  /* Indicator measured off the selected button, same as site.js's
     detail-tabs wiring and the panel-tabs pill above. */
  const moveInd = useCallback((animate: boolean) => {
    const bar = barRef2.current;
    const ind = indRef.current;
    if (!bar || !ind) return;
    const btn = bar.querySelector<HTMLElement>(`[data-detail-tab="${viewRef.current}"]`);
    if (!btn || !btn.offsetWidth) return;
    if (!animate) {
      const prev = ind.style.transition;
      ind.style.transition = "none";
      ind.style.width = `${btn.offsetWidth}px`;
      ind.style.transform = `translateX(${btn.offsetLeft}px)`;
      void ind.offsetWidth;
      ind.style.transition = prev;
      return;
    }
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, []);

  const selectView = useCallback(
    (next: StageView) => {
      setView(next);
      viewRef.current = next;
      moveInd(true);
    },
    [moveInd]
  );

  useLayoutEffect(() => {
    const snap = () => moveInd(false);
    snap();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(snap);
    window.addEventListener("resize", snap);
    const ro = new ResizeObserver(snap);
    if (barRef2.current) ro.observe(barRef2.current);
    return () => {
      window.removeEventListener("resize", snap);
      ro.disconnect();
    };
  }, [moveInd]);

  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(() => {
    if (!prompt) return;
    const text = buildAgentPrompt(library, prompt);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }, [library, prompt]);

  return (
    <>
    <div className="st-stage-bar" data-view={view}>
      <div className="detail-tabs proto-modal-tabs" ref={barRef2} role="tablist" aria-label="View">
        <span className="proto-modal-tabs-indicator" ref={indRef} aria-hidden="true" />
        {(["preview", "install", "usage"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className="proto-modal-tab"
            role="tab"
            data-detail-tab={v}
            aria-selected={view === v}
            onClick={() => selectView(v)}
          >
            {v === "preview" ? "Preview" : v === "install" ? "Install" : "Usage"}
          </button>
        ))}
      </div>
      {prompt && (
        <button
          type="button"
          className="detail-prompt"
          onClick={copy}
          data-copied={copied ? "true" : undefined}
          aria-label="Copy agent prompt"
        >
          <span className="detail-prompt-ico" aria-hidden="true">
            <svg className="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <svg className="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="detail-prompt-label">Copy prompt</span>
        </button>
      )}
    </div>
    {prompt && view === "install" && (
      <div className="code-block st-stage-panel">
        <pre>{`npm install ${prompt.pkg}`}</pre>
        <CodeCopy text={`npm install ${prompt.pkg}`} label="Copy install command" />
      </div>
    )}
    {prompt && view === "usage" && (
      <div className="code-block st-stage-panel">
        <pre>{prompt.snippet}</pre>
        <CodeCopy text={prompt.snippet} label="Copy usage example" />
      </div>
    )}
    </>
  );
}

function StudioActions({
  library,
  libraryId,
  agent,
  prompt,
}: {
  /** Display name for the prompt text ("Beam"); libraryId keys storage. */
  library: string;
  libraryId: string;
  agent: AgentWiring;
  prompt?: PromptMeta;
}) {
  const [presets, setPresets] = useState<StoredPreset[]>(() => readPresets(libraryId));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  /* The values the studio mounted with ARE its defaults — every knob's
     useState starts there — so reset needs no per-library default table. */
  const defaultsRef = useRef<Record<string, unknown>>({ ...agent.params });
  const agentRef = useRef(agent);
  agentRef.current = agent;

  const saveCurrent = useCallback(() => {
    const trimmed = name.trim() || `Preset ${presets.length + 1}`;
    const next: StoredPreset[] = [
      ...presets.filter((p) => p.name !== trimmed),
      { name: trimmed, params: { ...agentRef.current.params }, savedAt: Date.now() },
    ];
    setPresets(next);
    writePresets(libraryId, next);
    setNaming(false);
    setName("");
  }, [name, presets, libraryId]);

  const removePreset = useCallback(
    (presetName: string) => {
      const next = presets.filter((p) => p.name !== presetName);
      setPresets(next);
      writePresets(libraryId, next);
    },
    [presets, libraryId]
  );

  const copyPrompt = useCallback(() => {
    if (!prompt) return;
    const text = buildAgentPrompt(library, prompt);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  }, [prompt]);

  return (
    <div className="st-actions">
      <div className="st-actions-row">
        {naming ? (
          <input
            className="st-actions-name"
            autoFocus
            value={name}
            placeholder={`Preset ${presets.length + 1}`}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveCurrent();
              if (e.key === "Escape") { setNaming(false); setName(""); }
            }}
            onBlur={() => { setNaming(false); setName(""); }}
            aria-label="Preset name"
          />
        ) : (
          <button type="button" className="st-actions-btn" onClick={() => setNaming(true)}>
            Save preset
          </button>
        )}
        <button
          type="button"
          className="st-actions-btn"
          onClick={() => agentRef.current.onApply({ ...defaultsRef.current })}
        >
          Reset
        </button>
        {prompt && (
          <button
            type="button"
            className="st-actions-btn"
            onClick={copyPrompt}
            data-copied={copied ? "true" : undefined}
          >
            {copied ? "Copied" : "Copy prompt"}
          </button>
        )}
      </div>
      {presets.length > 0 && (
        <div className="st-actions-presets" role="list" aria-label="Saved presets">
          {presets.map((p) => (
            <span className="st-preset-chip" role="listitem" key={p.name}>
              <button
                type="button"
                className="st-preset-apply"
                onClick={() => agentRef.current.onApply({ ...p.params })}
                title={`Apply ${p.name}`}
              >
                {p.name}
              </button>
              <button
                type="button"
                className="st-preset-remove"
                onClick={() => removePreset(p.name)}
                aria-label={`Delete preset ${p.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The knob column, wrapped in the Manual control / Agent tab pair.
    `agent` is optional: a library that hasn't been wired up yet still gets
    the tab, and the chat says so instead of pretending. */
export function ControlsPanel({
  library,
  agent,
  prompt,
  children,
}: {
  library: string;
  agent?: AgentWiring;
  prompt?: PromptMeta;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<PanelTab>("manual");
  const barRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  /* move() reads the current tab from a ref so the measure effect does not
     have to re-subscribe its observer every time the tab changes. */
  const tabRef = useRef<PanelTab>("manual");

  /* Measure from the selected button rather than assuming equal widths —
     "Manual controls" is far wider than "Agent".

     Following the tabs-sliding recipe, the pill only tweens when a tab is
     clicked. First paint and resize write the same values with the
     transition suspended, so it snaps into place instead of animating out
     of nothing. */
  const move = useCallback((animate: boolean) => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const btn = bar.querySelector<HTMLElement>(`[data-tab="${tabRef.current}"]`);
    if (!btn || !btn.offsetWidth) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${btn.offsetLeft}px)`;
      pill.style.width = `${btn.offsetWidth}px`;
      void pill.offsetWidth; // flush, so restoring the transition cannot tween
      pill.style.transition = prev;
      return;
    }
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
    pill.style.width = `${btn.offsetWidth}px`;
  }, []);

  const select = useCallback(
    (next: PanelTab) => {
      setTab(next);
      tabRef.current = next;
      move(true);
    },
    [move]
  );

  useLayoutEffect(() => {
    const snap = () => move(false);
    snap();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(snap);
    window.addEventListener("resize", snap);
    /* The Studio keeps every library's panel mounted and hides the ones it
       is not showing, and a hidden element measures 0 — so without this the
       indicator stays collapsed until the window happens to resize. The
       observer fires when the bar gets its width on becoming visible. */
    const ro = new ResizeObserver(snap);
    if (barRef.current) ro.observe(barRef.current);
    return () => {
      window.removeEventListener("resize", snap);
      ro.disconnect();
    };
  }, [move]);

  return (
    <div className="pg-controls">
      <div className="st-panel-head">
      <div className="st-panel-tabs" ref={barRef} role="tablist" aria-label="Control mode">
        <span className="st-panel-tabs-indicator" ref={pillRef} aria-hidden="true" />
        <button
          type="button"
          className="st-panel-tab"
          role="tab"
          data-tab="manual"
          aria-selected={tab === "manual"}
          onClick={() => select("manual")}
        >
          Manual controls
        </button>
        <button
          type="button"
          className="st-panel-tab"
          role="tab"
          data-tab="agent"
          aria-selected={tab === "agent"}
          onClick={() => select("agent")}
        >
          Agent
        </button>
      </div>
      <PanelThemeToggle />
      </div>

      {/* Both halves stay mounted whichever tab is open, so switching back
          resets neither what the user tuned nor the conversation that
          tuned it. */}
      <div className="st-panel-body" hidden={tab !== "manual"}>
        {children}
      </div>
      <div className="st-panel-body st-panel-body--chat" hidden={tab !== "agent"}>
        <AgentChat library={library} wiring={agent} />
      </div>

      {/* Presets / reset / copy prompt sit under both tabs — a preset saved
          from a manual tuning session and one saved from an agent session
          are the same thing. */}
      {agent && (
        <StudioActions library={library} libraryId={agent.libraryId} agent={agent} prompt={prompt} />
      )}
    </div>
  );
}

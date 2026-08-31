import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

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

/* ── Controls panel: Manual control / Agent ────────────────────────
 * Every library's knob column sits behind two tabs. "Manual control"
 * is the knob stack itself; "Agent" is a chat where the same tuning is
 * described in words instead of dragged. The pill indicator measures
 * the selected tab so the two labels' different widths stay correct. */

type PanelTab = "manual" | "agent";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
}

/* No model is wired to the Studio yet. Rather than fake a reply that
   looks like tuning happened, the agent says plainly that it cannot
   reach the controls, and the composer keeps the transcript so the
   phrasing someone tried is not lost. */
const AGENT_UNAVAILABLE =
  "The Studio agent is not connected yet, so I can't move the controls for you. " +
  "Your message is kept here. Switch to Manual control to tune by hand, or use " +
  "Copy prompt on the library page to hand the whole library to your own coding agent.";

function AgentChat({ library }: { library: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  // Pin to the newest message after each send.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "user", text }, { role: "agent", text: AGENT_UNAVAILABLE }]);
    setDraft("");
  }, [draft]);

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
          messages.map((m, i) => (
            <div className="st-chat-msg" data-role={m.role} key={i}>
              {m.text}
            </div>
          ))
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
          disabled={!draft.trim()}
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

/** The knob column, wrapped in the Manual control / Agent tab pair. */
export function ControlsPanel({ library, children }: { library: string; children: ReactNode }) {
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

      {/* The knob stack stays mounted while the Agent tab is open, so
          switching back does not reset anything the user tuned. */}
      <div className="st-panel-body" hidden={tab !== "manual"}>
        {children}
      </div>
      {tab === "agent" && <AgentChat library={library} />}
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { describePatch, streamAgentTurn, type ChatTurn } from "./agent";

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

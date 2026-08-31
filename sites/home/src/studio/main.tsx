import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BeamStudio } from "./beam";
import { OrbStudio } from "./orb";
import { GooeyStudio } from "./gooey";
import { MetalStudio } from "./metal";
import { ImageStudio } from "./image";

/* Studio app — Pro-gated workbench for all five libraries.

   Gate: three states driven by the Pro client (same contract as
   /studio.html): (a) auth unresolved -> skeleton, (b) resolved without
   entitlement -> locked hero, (c) entitled -> the workbench.
   pro-client.js dispatches "pro:me" after every /me resolution and once
   early from its optimistic cache. `?dev` unlocks locally so the app can
   be developed without the API Worker.

   GATE_ENABLED is the switch: it's off while the Studio is open to
   everyone (the API Worker that answers /me isn't deployed yet). Flip it
   to true to make the Studio Pro-only — the gate below is otherwise
   complete, and /me entitlement still drives the "Get Pro" chip either
   way, so nothing else has to change. */

const GATE_ENABLED = false;

type GateState = "pending" | "locked" | "open";

interface ProState {
  authenticated?: boolean;
  email?: string | null;
  pro?: boolean;
  resolved?: boolean;
}

declare global {
  interface Window {
    LibrariesPro?: {
      state: ProState;
      signIn?: () => void;
      refresh?: () => void;
    };
  }
}

const DEV_UNLOCK = new URLSearchParams(window.location.search).has("dev");

function useProGate(): { gate: GateState; email: string | null; entitled: boolean } {
  const gateOff = !GATE_ENABLED || DEV_UNLOCK;
  const [gate, setGate] = useState<GateState>(gateOff ? "open" : "pending");
  const [email, setEmail] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);

  useEffect(() => {
    /* Sticky gate: once we've left the skeleton, an unresolved /me
       re-dispatch (network retry, tab un-freeze) must not drop the app
       back to the skeleton. */
    let settled = false;
    const render = (s: ProState | undefined) => {
      const isPro = !!(s && s.pro);
      const resolved = !!(s && s.resolved);
      if (s && typeof s.email === "string") setEmail(s.email);
      setEntitled(isPro);
      /* With the gate off the workbench is already showing — /me still
         runs, but only to fill in the email and the "Get Pro" chip. */
      if (gateOff) return;
      if (!resolved && !isPro && settled) return;
      if (resolved || isPro) settled = true;
      if (isPro) setGate("open");
      else if (resolved) setGate("locked");
    };

    const onMe = (e: Event) => render((e as CustomEvent<ProState>).detail);
    document.addEventListener("pro:me", onMe);
    render(window.LibrariesPro?.state);

    /* /me unreachable (e.g. the API Worker isn't deployed): don't strand
       visitors on the skeleton — fall through to the locked hero. */
    const fallback = window.setTimeout(() => {
      const s = window.LibrariesPro?.state;
      if (!(s && (s.resolved || s.pro))) render({ resolved: true, pro: false });
    }, 4000);

    return () => {
      document.removeEventListener("pro:me", onMe);
      window.clearTimeout(fallback);
    };
  }, [gateOff]);

  return { gate, email, entitled };
}

/* ── Chrome pieces ─────────────────────────────────────────────── */

function TopBar({ email, pro }: { email: string | null; pro: boolean }) {
  return (
    <div className="st-top">
      <div className="st-top-left">
        <a className="brand" href="/studio.html" aria-label="Back to the Studio page">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 22.6705 14.6705" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* brand-draw + pathLength drive the hover redraw in site.css —
                  without them the mark is inert here but animates elsewhere. */}
              <path className="brand-draw" d="M21.3352 10.3354L6.89079 13.3354L18.0019 7.33536L1.33524 9.33536L19.3352 1.33536L1.33524 4.33536L9.33524 1.33536" stroke="currentColor" strokeWidth="2.67" strokeLinecap="round" strokeLinejoin="round" pathLength={100} />
            </svg>
          </span>
          <span className="brand-word"><span className="brand-word-strong">Libraries</span><span className="brand-word-dim">.dev</span></span>
        </a>
        <span className="st-top-sep" aria-hidden="true" />
        <span className="st-top-name">
          Studio <span className="st-top-chip">Pro</span>
        </span>
      </div>
      <div className="st-top-right">
        {email && <span className="st-top-email">{email}</span>}
      </div>
    </div>
  );
}

const LIBS = [
  { id: "beam", label: "Border beam", icon: "/assets/icons/tile-beam.png" },
  { id: "orb", label: "Thinking orbs", icon: "/assets/icons/tile-orbs.png" },
  { id: "gooey", label: "Gooey", icon: "/assets/icons/tile-gooey.png" },
  { id: "metal", label: "Metal", icon: "/assets/icons/tile-metal.png" },
  { id: "image", label: "Image", icon: "/assets/icons/tile-image.png" },
] as const;

type LibId = (typeof LIBS)[number]["id"];

function Workbench() {
  const [lib, setLib] = useState<LibId>(() => {
    const wanted = window.location.hash.replace("#", "");
    return (LIBS.some((l) => l.id === wanted) ? wanted : "gooey") as LibId;
  });

  /* Deep-linkable: #beam .. #image select the library. */
  useEffect(() => {
    const onHash = () => {
      const wanted = window.location.hash.replace("#", "");
      if (LIBS.some((l) => l.id === wanted)) setLib(wanted as LibId);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const select = (id: LibId) => {
    setLib(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="st-body">
      <nav className="st-side" aria-label="Libraries">
        <span className="st-side-label">Libraries</span>
        {LIBS.map((l) => (
          <button
            key={l.id}
            type="button"
            className="st-lib"
            data-active={lib === l.id ? "true" : undefined}
            aria-pressed={lib === l.id}
            onClick={() => select(l.id)}
          >
            <span className="st-lib-ico" aria-hidden="true">
              <img src={l.icon} alt="" draggable={false} data-pad={l.id === "image" ? "" : undefined} />
            </span>
            {l.label}
          </button>
        ))}
      </nav>

      {/* All five stay mounted so tuning survives switching; the hidden
          ones render no stage content (WebGL / canvas / rAF all stop). */}
      <div className="st-main">
        <div hidden={lib !== "beam"}><BeamStudio visible={lib === "beam"} /></div>
        <div hidden={lib !== "orb"}><OrbStudio visible={lib === "orb"} /></div>
        <div hidden={lib !== "gooey"}><GooeyStudio visible={lib === "gooey"} /></div>
        <div hidden={lib !== "metal"}><MetalStudio visible={lib === "metal"} /></div>
        <div hidden={lib !== "image"}><ImageStudio visible={lib === "image"} /></div>
      </div>
    </div>
  );
}

/* ── Gate screens ──────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="st-gate">
      <div className="st-skeleton" aria-hidden="true">
        <span className="sk-line" />
        <span className="sk-line" />
        <span className="sk-line" />
        <span className="sk-block" />
      </div>
    </div>
  );
}

function Locked() {
  const onSignIn = () => {
    const LP = window.LibrariesPro;
    if (LP && typeof LP.signIn === "function") LP.signIn();
    else window.location.href = "/pro.html";
  };
  return (
    <div className="st-gate">
      <div className="st-locked">
        <span className="st-lock-glyph" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10.5" width="16" height="10" rx="3" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className="st-locked-title">The Studio is a Pro feature</h1>
        <p className="st-locked-sub">
          Deep customization of all five libraries — Beam, Orb, Gooey, Metal
          and Image. Tune every parameter live, preview the result, and export
          the exact configuration for your project. Get Libraries Pro to
          unlock it, or sign in if you already have access.
        </p>
        <div className="skill-cta-row">
          <a className="skill-btn skill-btn--primary" href="/pro.html">Get Pro</a>
          <button type="button" className="skill-btn skill-btn--secondary" onClick={onSignIn}>Sign in</button>
        </div>
      </div>
    </div>
  );
}

function StudioApp() {
  const { gate, email, entitled } = useProGate();
  return (
    <div className="st-app">
      <TopBar email={email} pro={entitled} />
      {gate === "pending" && <Skeleton />}
      {gate === "locked" && <Locked />}
      {gate === "open" && <Workbench />}
    </div>
  );
}

const rootEl = document.getElementById("studio-root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <StudioApp />
    </StrictMode>
  );
}

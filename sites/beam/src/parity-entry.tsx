/**
 * Parity capture page (dev-only; not a build input — Vite serves it by URL).
 *
 * Renders ONE beam combination frozen at the exact timestamp the iOS snapshot
 * harness uses (SnapshotTests.swift), on the same scene geometry: 60px padding
 * around a 348x122 card, radius 20. A Playwright script screenshots #stage at
 * deviceScaleFactor 2, producing PNGs directly comparable to
 * ports/ios/BorderBeamKit/snapshots/*.png.
 *
 * Query params: ?size=md&variant=colorful&theme=dark
 * Readiness: window.__parityReady === true once the freeze is applied.
 */

// ── Freeze the pulse driver's clock BEFORE the library mounts ────────────────
// The pulse breathing is driven by a shared rAF loop (src/pulseDriver.ts) whose
// oscillators read the rAF timestamp. Feeding it a constant timestamp makes it
// write every CSS var once, at exactly the frozen time, then go quiet (its
// internal frame-interval check skips identical timestamps).
const params = new URLSearchParams(window.location.search);
const sizeParam = (params.get('size') ?? 'md') as BorderBeamSize;
const variantParam = (params.get('variant') ?? 'colorful') as BorderBeamColorVariant;
const themeParam = (params.get('theme') ?? 'dark') as 'dark' | 'light';

/** Same per-family freeze times as SnapshotTests.swift. */
const FROZEN_TIME: Record<string, number> = {
  sm: 0.49,
  md: 0.49,
  line: 3.1 * 0.5,
  'pulse-outside': 0.8,
  'pulse-inner': 0.8,
};
const frozenT = FROZEN_TIME[sizeParam] ?? 0.49;

if (sizeParam.startsWith('pulse')) {
  const frozenMs = frozenT * 1000;
  window.requestAnimationFrame = (cb: FrameRequestCallback): number =>
    window.setTimeout(() => cb(frozenMs), 16);
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
}

import { createRoot } from 'react-dom/client';
import {
  BorderBeam,
  sizeThemePresets,
  type BorderBeamSize,
  type BorderBeamColorVariant,
} from 'border-beam';
import { useEffect } from 'react';
import spec from '../../spec/beam-spec.json';

const isDark = themeParam === 'dark';

// Scene constants — keep in lockstep with SnapshotTests.swift.
const CARD_W = 348;
const CARD_H = 122;
const RADIUS = 20;
const PAD = 60;
const grey = (v: number) => `rgb(${Math.round(v * 255)}, ${Math.round(v * 255)}, ${Math.round(v * 255)})`;
const BG = isDark ? grey(0.027) : grey(1.0);
const CARD_FILL = isDark ? grey(0.094) : grey(0.97);
const CARD_BORDER = isDark ? grey(0.24) : grey(0.85);

// ── Freeze math (mirrors BeamAnimation.swift / lineDriver.ts) ────────────────

const pingPong = (phase: number) => (1 - Math.cos(2 * Math.PI * phase)) / 2;

function cssEaseInOut(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 12; i++) {
    const mt = 1 - t;
    const bx = 3 * mt * mt * t * 0.42 + 3 * mt * t * t * 0.58 + t * t * t;
    if (bx < x) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  const mt = 1 - t;
  return 3 * mt * t * t + t * t * t;
}

function sampleKeyframes(table: number[][], p: number, ease: boolean): number {
  const pct = p * 100;
  if (pct <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [p0, v0] = table[i - 1];
    const [p1, v1] = table[i];
    if (pct <= p1) {
      const f = p1 > p0 ? (pct - p0) / (p1 - p0) : 1;
      return v0 + (v1 - v0) * (ease ? cssEaseInOut(f) : f);
    }
  }
  return table[table.length - 1][1];
}

function applyFreeze() {
  const el = document.querySelector<HTMLElement>('[data-beam]');
  if (!el) return false;
  const id = el.dataset.beam!;
  const themeCfg = (sizeThemePresets as any)[sizeParam][themeParam];
  const B = (themeCfg.brightness ?? 1.3).toFixed(2);
  const S = themeCfg.saturation.toFixed(2);
  const isMono = variantParam === 'mono'; // mono ⇒ staticColors ⇒ no filter

  const st = document.createElement('style');
  let css = `
[data-beam="${id}"], [data-beam="${id}"]::before, [data-beam="${id}"]::after,
[data-beam="${id}"] [data-beam-bloom] { animation: none !important; }`;

  el.style.setProperty(`--beam-opacity-${id}`, '1');

  if (sizeParam === 'sm' || sizeParam === 'md') {
    const angle = ((frozenT / 1.96) % 1) * 360;
    el.style.setProperty(`--beam-angle-${id}`, `${angle}deg`);
    if (!isMono) {
      const hue = -30 + 60 * pingPong(frozenT / 12);
      css += `
[data-beam="${id}"][data-active]::after,
[data-beam="${id}"][data-active]::before {
  filter: hue-rotate(${hue.toFixed(2)}deg) brightness(${B}) saturate(${S}) !important;
}`;
    }
  } else if (sizeParam === 'line') {
    const k = (spec as any).line.keyframes;
    const dur = 3.1;
    const cyc = (period: number) => (frozenT / period) % 1;
    const v = {
      x: sampleKeyframes(k.travel.x, cyc(dur * k.durationScale.travel), false),
      w: sampleKeyframes(k.travel.w, cyc(dur * k.durationScale.travel), false),
      h: sampleKeyframes(k.breathe, cyc(dur * k.durationScale.breathe), true),
      spike: sampleKeyframes(k.spike, cyc(dur * k.durationScale.spike), true),
      spike2: sampleKeyframes(k.spike2, cyc(dur * k.durationScale.spike2), true),
      edge: sampleKeyframes(k.edgeFade, cyc(dur * k.durationScale.edgeFade), false),
    };
    el.style.setProperty(`--beam-x-${id}`, v.x.toFixed(4));
    el.style.setProperty(`--beam-w-${id}`, v.w.toFixed(4));
    el.style.setProperty(`--beam-h-${id}`, v.h.toFixed(4));
    el.style.setProperty(`--beam-spike-${id}`, v.spike.toFixed(4));
    el.style.setProperty(`--beam-spike2-${id}`, v.spike2.toFixed(4));
    el.style.setProperty(`--beam-edge-${id}`, v.edge.toFixed(4));
    if (!isMono) {
      const range = 13;
      const hue = -range + 2 * range * pingPong(frozenT / 12);
      const bloomRange = range + 10;
      const bloomHue = -bloomRange + 2 * bloomRange * pingPong(frozenT / 8);
      css += `
[data-beam="${id}"][data-active]::after,
[data-beam="${id}"][data-active]::before {
  filter: hue-rotate(${hue.toFixed(2)}deg) brightness(${B}) saturate(${S}) !important;
}
[data-beam="${id}"][data-active] [data-beam-bloom] {
  filter: blur(8px) hue-rotate(${bloomHue.toFixed(2)}deg) brightness(${B}) saturate(${S}) !important;
}`;
    }
  }
  // Pulse: nothing to pin — the frozen rAF clock made the JS driver write every
  // var (sizes, drifts, quadrant opacities, hue) at exactly frozenT.

  st.textContent = css;
  document.head.appendChild(st);
  return true;
}

function Scene() {
  useEffect(() => {
    // Let the beam mount, the pulse driver tick once, and styles settle.
    const timer = window.setTimeout(() => {
      if (applyFreeze()) {
        window.setTimeout(() => {
          (window as any).__parityReady = true;
        }, 250);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      id="stage"
      style={{
        width: CARD_W + PAD * 2,
        height: CARD_H + PAD * 2,
        background: BG,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: PAD, top: PAD }}>
        <BorderBeam
          size={sizeParam}
          colorVariant={variantParam}
          theme={themeParam}
          borderRadius={RADIUS}
        >
          <div
            style={{
              width: CARD_W,
              height: CARD_H,
              borderRadius: RADIUS,
              background: CARD_FILL,
              boxSizing: 'border-box',
              border: `1px solid ${CARD_BORDER}`,
            }}
          />
        </BorderBeam>
      </div>
    </div>
  );
}

document.body.style.background = BG;
createRoot(document.getElementById('root')!).render(<Scene />);

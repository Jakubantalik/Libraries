import React, { useState } from 'react';
import { Examples } from './Examples';
import { useTheme } from '../hooks/useTheme';

/**
 * Renders the hero <Examples /> at 200% scale for retina QA / press
 * screenshots.
 *
 * How the scaling works:
 *   1. CSS `zoom: 2` on the wrapper doubles the LAYOUT dimensions of every
 *      child (text, padding, widths) — getBoundingClientRect on the inner
 *      MetalFx hosts therefore returns 2x values, so each instance's canvas
 *      backing buffer is allocated at the proper retina density (no browser
 *      bilinear blur on the canvas itself).
 *   2. `scaleFactor={2}` on Examples is forwarded into each <MetalFx> as
 *      `shaderScale = baseline × 2` and `ringCssPx = baseline × 2`. Without
 *      this the engine would just sample more shader area into the larger
 *      destination — the pattern features would stay the same physical size,
 *      and the metallic ring would look thinner relative to the bigger button.
 *      Doubling shaderScale zooms into the shared shader so blob features grow
 *      proportionally; doubling ringCssPx keeps the rim visually consistent.
 *
 * The result is "the same composition as 1x, just twice as big" — both the
 * UI chrome AND the metal effect scale together.
 */
export function Hero2x() {
  const [theme, toggleTheme] = useTheme();
  const [showRuler, setShowRuler] = useState(false);

  return (
    <main className="min-h-screen w-full bg-(--page-bg) text-(--text)">
      <div className="sticky top-0 z-50 flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-sm border-b border-white/10 text-xs text-white/80">
        <span className="font-mono font-semibold tracking-wide text-amber-400">2× HERO</span>
        <span className="opacity-70">layout + shader scaled to 200%</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowRuler((v) => !v)}
          className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 cursor-pointer"
        >
          {showRuler ? 'Hide ruler' : 'Show ruler'}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 cursor-pointer"
        >
          Theme: {theme}
        </button>
        <a
          href="/"
          className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 no-underline text-white/80"
        >
          ← 1× demo
        </a>
      </div>

      {/* The 2x stage. zoom: 2 is supported in all modern browsers (Chrome,
          Safari, Edge, and Firefox 126+). It doubles layout dimensions natively
          so getBoundingClientRect inside MetalFx returns the larger size and
          the canvas allocates a crisp retina backing buffer. */}
      <div className="w-full flex justify-center px-6 pt-8 pb-16">
        <div
          style={{ zoom: 2 } as React.CSSProperties}
          className="origin-top max-w-[883px] w-full"
        >
          <Examples theme={theme} scaleFactor={2} />
        </div>
      </div>

      {showRuler && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-12 mx-auto"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, rgba(255,255,255,0.18) 0 1px, transparent 1px 100px), repeating-linear-gradient(to right, rgba(255,255,255,0.08) 0 1px, transparent 1px 20px)',
            height: 'calc(100vh - 3rem)',
            width: '100%',
          }}
        />
      )}
    </main>
  );
}

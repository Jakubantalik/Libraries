import {
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  ImageGeneration,
  type ImageGenerationCycleEvent,
  type ImageGenerationHandle,
  type ImageGenerationPreset
} from 'img-fx';
import './showcase.css';

// Same pool as the main demo page (mirrors demo/public/images).
const IMAGE_POOL = [
  '/images/Screenshot 2026-05-13 at 17.22.03.png',
  '/images/Screenshot 2026-05-13 at 17.34.13.png',
  '/images/Screenshot 2026-05-13 at 17.36.02.png',
  '/images/Screenshot 2026-05-13 at 17.36.38.png',
  '/images/Screenshot 2026-05-13 at 17.37.11.png',
  '/images/Screenshot 2026-05-13 at 17.37.37.png',
  '/images/Screenshot 2026-05-13 at 17.37.43.png',
  '/images/Screenshot 2026-05-13 at 17.37.49.png',
  '/images/Screenshot 2026-05-16 at 12.50.03.png',
  '/images/Screenshot 2026-05-16 at 12.51.21.png',
  '/images/Screenshot 2026-05-16 at 12.52.16.png',
  '/images/Screenshot 2026-05-16 at 12.53.21.png',
  '/images/Screenshot 2026-05-16 at 12.55.02.png',
  '/images/Screenshot 2026-05-17 at 19.52.25.png',
  '/images/Screenshot 2026-05-17 at 19.52.55.png',
  '/images/Screenshot 2026-05-17 at 19.53.15.png',
  '/images/Screenshot 2026-05-17 at 19.58.27.png',
  '/images/Screenshot 2026-05-17 at 19.59.07.png',
  '/images/Screenshot 2026-05-17 at 20.01.38.png',
  '/images/Untitled.jpg',
  '/images/Untitled2.jpg',
  '/images/Untitled4.jpg',
  '/images/photo-1773236759289-251d9687b6e3.avif'
];

const ALL_PRESETS: ImageGenerationPreset[] = ['pixels-organic', 'pixels-mechanic', 'sweep-gradient'];

/** Regenerate churn only ever looks right on the pixel-mosaic presets, so
 *  regen picks draw from this pool (never `sweep-gradient`). */
const PIXEL_PRESETS: ImageGenerationPreset[] = ['pixels-organic', 'pixels-mechanic'];

/** Card geometry lifted 1:1 from Figma node 2085:34969. */
interface CardSpec {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  bg: string;
  /** When set, this card always uses this preset instead of a random pick. */
  fixedPreset?: ImageGenerationPreset;
  /** When true, the card reveals an image immediately on mount instead of
   *  starting at the flat idle state — so the page loads with a photo
   *  already showing (and the Regenerate pill available). */
  startRevealed?: boolean;
}

const CARDS: CardSpec[] = [
  { left: 37, top: 228, width: 179, height: 141, radius: 8, bg: '#f5f5f5', fixedPreset: 'sweep-gradient' },
  { left: 485, top: 161, width: 145, height: 145, radius: 12, bg: '#f5f5f5', fixedPreset: 'pixels-mechanic' },
  { left: 240, top: 55, width: 224, height: 252, radius: 8, bg: '#f5f5f5', fixedPreset: 'pixels-organic', startRevealed: true },
  { left: 35, top: 55, width: 182, height: 150, radius: 12, bg: '#f5f5f5', fixedPreset: 'pixels-mechanic' },
  { left: 414, top: 328, width: 182, height: 170, radius: 12, bg: '#f5f5f5', fixedPreset: 'pixels-mechanic', startRevealed: true },
  { left: 240, top: 328, width: 156, height: 156, radius: 12, bg: '#f5f5f5', fixedPreset: 'sweep-gradient' },
];

function defaultCardPositions(): CardPos[] {
  return CARDS.map((c) => ({ left: c.left, top: c.top }));
}

/**
 * Two behavior modes, both sharing the exact same Figma card layout:
 *
 * - `click` (default): card starts as a flat gray rectangle (idle). First
 *   click starts a random effect playing continuously; second click reveals
 *   the image (manual hold); third click hides it back to flat gray idle.
 * - `always-on`: the effect runs continuously from mount (never flat gray); a
 *   click reveals the image immediately, and clicking a revealed card returns
 *   to the continuously-playing effect.
 *
 * The two modes share the same playing→reveal→hide interaction; they differ
 * only in their resting state: `click` starts and returns to flat gray idle,
 * while `always-on` starts and returns to the running effect.
 *
 * - `stack`: a single centered card auto-plays its effect and reveals after
 *   2-3 s. A "Generate new" button pushes a fresh card on top of the pile;
 *   older cards scale down and peek out above it, Figma node 2093:34991.
 *
 * - `burst`: an empty frame with a single gray "Generate new image" button in
 *   the middle. Clicking it makes the tab-1 card layout appear around the
 *   button, each card fading in with its effect running and then resolving
 *   into an image on its own staggered timeline.
 */
type BehaviorMode = 'click' | 'always-on' | 'stack' | 'burst';

/**
 * Card phases (shared by both modes):
 *   idle      — flat gray rectangle (click mode only; shader paused, strength 0)
 *   playing   — shader running (always-on: from mount; click: after a click)
 *   revealing — reveal animation in flight
 *   revealed  — image visible, held until the next click
 *   hiding    — cross-fade back to the shader
 */
type CardPhase = 'idle' | 'playing' | 'revealing' | 'revealed' | 'hiding';

function pickPreset(previous: ImageGenerationPreset | null): ImageGenerationPreset {
  // Random across all types, but never the same one twice in a row so
  // repeated clicks on a card visibly cycle through the effects.
  const pool = previous == null ? ALL_PRESETS : ALL_PRESETS.filter((p) => p !== previous);
  return pool[Math.floor(Math.random() * pool.length)];
}

function resolvePreset(spec: CardSpec, previous: ImageGenerationPreset | null): ImageGenerationPreset {
  return spec.fixedPreset ?? pickPreset(previous);
}

/** Random pixel preset for a regenerate, avoiding the current one when possible. */
function pickPixelPreset(previous: ImageGenerationPreset | null): ImageGenerationPreset {
  const pool = PIXEL_PRESETS.filter((p) => p !== previous);
  return pool[Math.floor(Math.random() * pool.length)];
}

interface CardPos {
  left: number;
  top: number;
}

function ShowcaseCard({
  spec,
  mode,
  pos,
  onMove
}: {
  spec: CardSpec;
  mode: BehaviorMode;
  /** Live card position (lifted to the parent so drags survive tab switches). */
  pos: CardPos;
  onMove: (pos: CardPos) => void;
}): JSX.Element {
  const handleRef = useRef<ImageGenerationHandle | null>(null);
  // always-on starts already playing; click starts idle (preset unused until
  // play) — unless the spec asks to boot straight into a revealed image.
  const [phase, setPhase] = useState<CardPhase>(() =>
    mode === 'always-on' ? 'playing' : spec.startRevealed ? 'revealing' : 'idle'
  );
  const [preset, setPreset] = useState<ImageGenerationPreset>(() =>
    mode === 'always-on' ? resolvePreset(spec, null) : spec.fixedPreset ?? 'pixels-organic'
  );
  // True from the Regenerate click until the fresh image is fully visible.
  // Keeps the card in the `playing` phase through the churn (no flat-gray
  // idle stop) and suppresses the local auto-reveal timer — the library's
  // triggerRegenerate schedules the reveal itself.
  const regeneratingRef = useRef(false);

  // Drag-to-reposition. A press only becomes a drag after the pointer moves
  // past a small threshold, so ordinary clicks (generate / reveal / hide)
  // keep working; once a drag happens the trailing click event is swallowed.
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseLeft: number;
    baseTop: number;
    dragging: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);
  /** True (once) if the gesture that produced the current click was a drag. */
  const consumeDrag = (): boolean => {
    const was = justDraggedRef.current;
    justDraggedRef.current = false;
    return was;
  };

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        baseLeft: pos.left,
        baseTop: pos.top,
        dragging: false
      };
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.dragging) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        d.dragging = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      onMove({ left: d.baseLeft + dx, top: d.baseTop + dy });
    },
    [onMove]
  );

  const onPointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.dragging) {
      justDraggedRef.current = true;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
    dragRef.current = null;
  }, []);

  // Click mode: a "Generate" pill (shown on hover over the flat idle card)
  // starts the effect, which then auto-reveals after a random 6-9 s hold.
  // Clicking a revealed card hides it back to the flat idle state.
  const onClick = useCallback(() => {
    if (consumeDrag()) return;
    if (mode === 'always-on') {
      if (phase === 'playing') {
        setPhase('revealing');
        handleRef.current?.triggerReveal({ hold: 'manual' });
        return;
      }
      if (phase === 'revealed') {
        setPhase('hiding');
        handleRef.current?.triggerHide();
      }
      return;
    }
    // click mode: only a revealed card responds to a plain card click (hide).
    if (phase === 'revealed') {
      setPhase('hiding');
      handleRef.current?.triggerHide();
    }
    // Clicks during in-flight reveal/hide transitions are ignored.
  }, [phase, mode]);

  // The hover pill: kick off a fresh effect from the idle flat card.
  const onGenerate = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (consumeDrag()) return;
      setPreset((prev) => resolvePreset(spec, prev));
      setPhase('playing');
    },
    [spec]
  );

  // The hover pill on a revealed image: regenerate in place. One library
  // call does the whole flow — samples the image's palette (so the churn
  // wears the image's colors), breaks the image into the churning cell grid,
  // and dissolves the next image in after the 4 s churn. The churn always
  // runs on a pixel preset: free cards hop to a fresh one here, while
  // fixed-preset cards keep their authored preset (the library switches to a
  // pixel preset internally and restores it once the new image is visible).
  const onRegenerate = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (consumeDrag()) return;
      // Allowed mid-reveal too (the pill mounts during `revealing`): the
      // engine's boil accepts reveal/hold phases, so this is safe.
      if (phase !== 'revealed' && phase !== 'revealing') return;
      regeneratingRef.current = true;
      if (!spec.fixedPreset) setPreset(pickPixelPreset(preset));
      handleRef.current?.triggerRegenerate({ durationMs: 4000 });
    },
    [phase, spec, preset]
  );

  // Boot-with-image: reveal straight away on mount so the card loads showing
  // a photo (with the Regenerate pill ready) instead of the flat idle state.
  useEffect(() => {
    if (mode !== 'click' || !spec.startRevealed) return;
    handleRef.current?.triggerReveal({ hold: 'manual' });
    // Mount-only by design: `mode` and `spec` are fixed for a card's lifetime
    // (the parent remounts cards on tab switch via the key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click mode auto-reveal: once the effect starts playing, reveal the image
  // after a random 6-9 s so each card "generates" on its own timeline.
  // (Regeneration is excluded — triggerRegenerate reveals by itself.)
  useEffect(() => {
    if (mode !== 'click' || phase !== 'playing') return;
    if (regeneratingRef.current) return;
    const delay = 6000 + Math.random() * 3000;
    const t = window.setTimeout(() => {
      setPhase('revealing');
      handleRef.current?.triggerReveal({ hold: 'manual' });
    }, delay);
    return () => window.clearTimeout(t);
  }, [phase, mode]);

  const onCycle = useCallback(
    (e: ImageGenerationCycleEvent) => {
      // Regeneration's built-in reveal starts inside the library — mirror it
      // in the card phase so the pill/interaction state stays in sync.
      if (e.phase === 'reveal') setPhase('revealing');
      if (e.phase === 'visible') {
        setPhase('revealed');
        regeneratingRef.current = false;
      }
      // 'idle' fires when the hide cross-fade completes AND when a regenerate
      // churn starts. In click mode a hide means back to a flat card — unless
      // we're regenerating, in which case the effect keeps playing until the
      // built-in auto-reveal. Always-on always returns to the running effect.
      if (e.phase === 'idle') {
        if (regeneratingRef.current) {
          setPhase('playing');
          return;
        }
        setPhase(mode === 'always-on' ? 'playing' : 'idle');
      }
    },
    [mode]
  );

  // Only click-mode's idle phase shows the flat gray card (paused, no shader).
  const flatGray = mode === 'click' && phase === 'idle';

  return (
    <ImageGeneration
      ref={handleRef}
      className="showcase-card"
      preset={preset}
      theme="light"
      cardBg={spec.bg}
      images={IMAGE_POOL}
      strength={flatGray ? 0 : 1}
      pixelScale={0.6}
      paused={flatGray}
      borderRadius={spec.radius}
      revealHoldMs={2000}
      onCycle={onCycle}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{ left: pos.left, top: pos.top, borderRadius: spec.radius }}
      role="button"
      aria-label="Generate image"
    >
      <div
        style={{
          position: 'relative',
          width: spec.width,
          height: spec.height,
          borderRadius: spec.radius
        }}
      >
        {flatGray ? (
          <button type="button" className="showcase-gen-pill" onClick={onGenerate}>
            Generate
          </button>
        ) : null}
        {/* Mounted during `revealing` too — the image looks loaded well
            before the reveal easing formally completes, and the pill must be
            hoverable the moment it does. */}
        {mode === 'click' && (phase === 'revealed' || phase === 'revealing') ? (
          <button type="button" className="showcase-gen-pill showcase-regen-pill" onClick={onRegenerate}>
            Regenerate
          </button>
        ) : null}
      </div>
    </ImageGeneration>
  );
}

/**
 * Card-stack tab (Figma node 2093:34991). One centered card auto-plays its
 * effect and reveals after 2-3 s; each "Generate new" push demotes the pile:
 * older cards scale down behind the front card, peeking out at the top.
 * Geometry from Figma: front 283x277 @ top 66; depth 1 is 253 wide, 13px
 * higher; depth 2 is 233 wide, 24px higher. Depth 3 fades out and is pruned.
 */
const STACK_CARD = { width: 283, height: 277, top: 66, radius: 20 };

interface StackAnimConfig {
  durationMs: number;
  enterDurationMs: number;
  enterOffsetY: number;
  enterStartScale: number;
  /** Per-depth delay before a demoted card starts moving back in the stack. */
  staggerMs: number;
  depth1Y: number;
  depth2Y: number;
  depth1Scale: number;
  depth2Scale: number;
  depth1Opacity: number;
  depth2Opacity: number;
  easing: string;
}

const DEFAULT_STACK_ANIM: StackAnimConfig = {
  durationMs: 600,
  enterDurationMs: 600,
  enterOffsetY: 20,
  enterStartScale: 0.97,
  staggerMs: 120,
  depth1Y: -13,
  depth2Y: -24,
  depth1Scale: 253 / 283,
  depth2Scale: 233 / 283,
  depth1Opacity: 0.7,
  depth2Opacity: 0.4,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};

const STACK_EASING_PRESETS: Array<{ id: string; label: string; value: string }> = [
  { id: 'smooth', label: 'Smooth', value: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { id: 'snappy', label: 'Snappy', value: 'cubic-bezier(0.33, 1, 0.68, 1)' },
  { id: 'ease-out', label: 'Ease out', value: 'cubic-bezier(0, 0, 0.2, 1)' },
  { id: 'springy', label: 'Springy', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
];

function stackDepthFromAnim(anim: StackAnimConfig, depth: number): { y: number; scale: number; opacity: number } {
  if (depth <= 0) return { y: 0, scale: 1, opacity: 1 };
  if (depth === 1) return { y: anim.depth1Y, scale: anim.depth1Scale, opacity: anim.depth1Opacity };
  if (depth === 2) return { y: anim.depth2Y, scale: anim.depth2Scale, opacity: anim.depth2Opacity };
  return { y: anim.depth2Y, scale: anim.depth2Scale, opacity: 0 };
}

function StackCard({
  depth,
  preset,
  anim
}: {
  depth: number;
  preset: ImageGenerationPreset;
  anim: StackAnimConfig;
}): JSX.Element {
  const handleRef = useRef<ImageGenerationHandle | null>(null);
  const revealRequested = useRef(false);
  const [isGenerating, setIsGenerating] = useState(true);

  // Auto-reveal 2-3 s after the card lands on top of the stack.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!revealRequested.current) {
        revealRequested.current = true;
        handleRef.current?.triggerReveal({ hold: 'manual' });
      }
    }, 2000 + Math.random() * 1000);
    return () => window.clearTimeout(t);
  }, []);

  // Demoted before its auto-reveal fired ("Generate new" clicked early) —
  // reveal immediately so the card behind always shows a settled photo.
  useEffect(() => {
    if (depth > 0 && !revealRequested.current) {
      revealRequested.current = true;
      handleRef.current?.triggerReveal({ hold: 'manual' });
    }
  }, [depth]);

  // Keep the frosted "generating" look through the reveal dissolve; drop it
  // only once the photo is fully visible so there's no background pop.
  const onCycle = useCallback((e: ImageGenerationCycleEvent) => {
    if (e.phase === 'visible') setIsGenerating(false);
  }, []);

  const d = stackDepthFromAnim(anim, depth);
  const shouldFrost = depth === 0 && isGenerating;
  // Stagger: the deeper a card sits, the later it starts moving back, so a
  // "Generate new" push ripples through the stack instead of moving as one.
  const delay = depth > 0 ? (depth - 1) * anim.staggerMs : 0;
  const transition = `transform ${anim.durationMs}ms ${anim.easing} ${delay}ms, opacity ${anim.durationMs}ms ease ${delay}ms`;
  const enterAnim = `stack-card-enter ${anim.enterDurationMs}ms ${anim.easing}`;
  return (
    <ImageGeneration
      ref={handleRef}
      className={['stack-card', shouldFrost ? 'is-generating' : ''].filter(Boolean).join(' ')}
      preset={preset}
      theme="light"
      cardBg="#f5f5f5"
      images={IMAGE_POOL}
      strength={1}
      pixelScale={0.6}
      borderRadius={STACK_CARD.radius}
      style={{
        transform: `translate(-50%, ${d.y}px) scale(${d.scale})`,
        opacity: d.opacity,
        zIndex: 30 - depth,
        transition,
        animation: depth === 0 ? enterAnim : undefined,
        borderRadius: STACK_CARD.radius,
        // While frosted the card's own bg must be transparent: the backdrop
        // blur has to reach the photo cards behind it in the stack (Figma
        // 2093:35000 — the 80% fill lives on the frost overlay instead).
        ...(shouldFrost && { background: 'transparent' }),
        // CSS vars drive the enter keyframes (set inline so sliders can tweak them).
        ['--stack-enter-y' as string]: `${anim.enterOffsetY}px`,
        ['--stack-enter-scale' as string]: String(anim.enterStartScale)
      }}
    >
      <div
        style={{
          width: STACK_CARD.width,
          height: STACK_CARD.height,
          borderRadius: STACK_CARD.radius
        }}
      />
    </ImageGeneration>
  );
}

function StackControls({
  anim,
  onChange
}: {
  anim: StackAnimConfig;
  onChange: (next: StackAnimConfig) => void;
}): JSX.Element {
  const patch = (partial: Partial<StackAnimConfig>) => onChange({ ...anim, ...partial });

  return (
    <div className="stack-controls">
      <p className="stack-controls-title">Stack animation</p>
      <div className="stack-controls-grid">
        <label className="stack-control">
          <span>Move duration</span>
          <input
            type="range"
            min={120}
            max={1200}
            step={10}
            value={anim.durationMs}
            onChange={(e) => patch({ durationMs: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.durationMs}ms</span>
        </label>
        <label className="stack-control">
          <span>Enter duration</span>
          <input
            type="range"
            min={120}
            max={1200}
            step={10}
            value={anim.enterDurationMs}
            onChange={(e) => patch({ enterDurationMs: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.enterDurationMs}ms</span>
        </label>
        <label className="stack-control">
          <span>Enter offset Y</span>
          <input
            type="range"
            min={-60}
            max={60}
            step={1}
            value={anim.enterOffsetY}
            onChange={(e) => patch({ enterOffsetY: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.enterOffsetY}px</span>
        </label>
        <label className="stack-control">
          <span>Enter start scale</span>
          <input
            type="range"
            min={0.85}
            max={1}
            step={0.01}
            value={anim.enterStartScale}
            onChange={(e) => patch({ enterStartScale: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.enterStartScale.toFixed(2)}</span>
        </label>
        <label className="stack-control">
          <span>Stagger</span>
          <input
            type="range"
            min={0}
            max={300}
            step={10}
            value={anim.staggerMs}
            onChange={(e) => patch({ staggerMs: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.staggerMs}ms</span>
        </label>
        <label className="stack-control">
          <span>Depth 1 offset Y</span>
          <input
            type="range"
            min={-40}
            max={0}
            step={1}
            value={anim.depth1Y}
            onChange={(e) => patch({ depth1Y: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.depth1Y}px</span>
        </label>
        <label className="stack-control">
          <span>Depth 2 offset Y</span>
          <input
            type="range"
            min={-60}
            max={0}
            step={1}
            value={anim.depth2Y}
            onChange={(e) => patch({ depth2Y: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.depth2Y}px</span>
        </label>
        <label className="stack-control">
          <span>Depth 1 scale</span>
          <input
            type="range"
            min={0.7}
            max={1}
            step={0.01}
            value={anim.depth1Scale}
            onChange={(e) => patch({ depth1Scale: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.depth1Scale.toFixed(2)}</span>
        </label>
        <label className="stack-control">
          <span>Depth 2 scale</span>
          <input
            type="range"
            min={0.6}
            max={1}
            step={0.01}
            value={anim.depth2Scale}
            onChange={(e) => patch({ depth2Scale: Number(e.target.value) })}
          />
          <span className="stack-control-value">{anim.depth2Scale.toFixed(2)}</span>
        </label>
        <label className="stack-control">
          <span>Depth 1 opacity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={anim.depth1Opacity}
            onChange={(e) => patch({ depth1Opacity: Number(e.target.value) })}
          />
          <span className="stack-control-value">{Math.round(anim.depth1Opacity * 100)}%</span>
        </label>
        <label className="stack-control">
          <span>Depth 2 opacity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={anim.depth2Opacity}
            onChange={(e) => patch({ depth2Opacity: Number(e.target.value) })}
          />
          <span className="stack-control-value">{Math.round(anim.depth2Opacity * 100)}%</span>
        </label>
        <label className="stack-control stack-control-select">
          <span>Easing</span>
          <select
            value={STACK_EASING_PRESETS.find((p) => p.value === anim.easing)?.id ?? 'custom'}
            onChange={(e) => {
              const preset = STACK_EASING_PRESETS.find((p) => p.id === e.target.value);
              if (preset) patch({ easing: preset.value });
            }}
          >
            {STACK_EASING_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function StackDemo({ anim }: { anim: StackAnimConfig }): JSX.Element {
  const nextId = useRef(1);
  const lastPreset = useRef<ImageGenerationPreset | null>(null);
  const [stack, setStack] = useState<Array<{ id: number; preset: ImageGenerationPreset }>>(() => {
    const preset = pickPreset(null);
    lastPreset.current = preset;
    return [{ id: 0, preset }];
  });

  const generate = useCallback(() => {
    const preset = pickPreset(lastPreset.current);
    lastPreset.current = preset;
    // Newest first (depth 0 = front). Cap at 4: the 4th is already fully
    // faded (STACK_DEPTHS[3]), so dropping it frees its WebGL instance
    // without a visible pop.
    setStack((s) => [{ id: nextId.current++, preset }, ...s].slice(0, 4));
  }, []);

  return (
    <>
      {stack.map((card, depth) => (
        <StackCard key={card.id} depth={depth} preset={card.preset} anim={anim} />
      ))}
      <button type="button" className="stack-generate" onClick={generate}>
        Generate new
      </button>
    </>
  );
}

/**
 * Burst tab: a lone gray "Generate new image" button in the middle of the
 * empty frame. Each click spawns ONE card into the next free slot of a layout
 * arranged AROUND the button (same card sizes/radii as tab 1, repositioned so
 * nothing covers the button). Once every slot is filled, the next click
 * replaces the oldest card with a fresh generation. Each card enters with a
 * modal-style open transition (scale/fade/blur, no position travel), runs its
 * effect and resolves into a photo on its own 2.5-4.5 s timeline.
 */
const BURST_FRAME = { width: 659, height: 458 };

/** Tab-1 card sizes/radii rearranged around the centered button: the button
 *  (~160x40 at frame center) keeps >=20px clearance from every slot. */
const BURST_SLOTS: CardSpec[] = [
  { left: -10, top: 60, width: 179, height: 202, radius: 8, bg: '#f5f5f5', fixedPreset: 'sweep-gradient' },
  { left: 292, top: 25, width: 145, height: 145, radius: 12, bg: '#f5f5f5', fixedPreset: 'pixels-mechanic' },
  { left: 460, top: 40, width: 179, height: 141, radius: 8, bg: '#f5f5f5', fixedPreset: 'sweep-gradient' },
  { left: 495, top: 250, width: 182, height: 170, radius: 12, bg: '#f5f5f5', fixedPreset: 'pixels-organic' },
  { left: 245, top: 330, width: 182, height: 150, radius: 12, bg: '#f5f5f5', fixedPreset: 'pixels-mechanic' },
  { left: 30, top: 345, width: 156, height: 156, radius: 12, bg: '#f5f5f5', fixedPreset: 'sweep-gradient' }
];

function BurstCard({ spec }: { spec: CardSpec }): JSX.Element {
  const handleRef = useRef<ImageGenerationHandle | null>(null);
  const [preset, setPreset] = useState<ImageGenerationPreset>(() => resolvePreset(spec, null));
  const [phase, setPhase] = useState<CardPhase>('playing');
  // True from the Regenerate click until the fresh image is fully visible —
  // suppresses the local auto-reveal timer (triggerRegenerate reveals itself).
  const regeneratingRef = useRef(false);

  // Resolve into an image after a random wait so each card finishes
  // "generating" on its own timeline.
  useEffect(() => {
    if (phase !== 'playing') return;
    if (regeneratingRef.current) return;
    const delay = 2500 + Math.random() * 2000;
    const t = window.setTimeout(() => {
      setPhase('revealing');
      handleRef.current?.triggerReveal({ hold: 'manual' });
    }, delay);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Regenerate churn always runs on a pixel preset: free cards hop to a
  // fresh one here, while fixed-preset cards keep their authored preset (the
  // library switches to a pixel preset internally and restores it once the
  // new image is visible).
  const onRegenerate = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (phase !== 'revealed' && phase !== 'revealing') return;
      regeneratingRef.current = true;
      if (!spec.fixedPreset) setPreset(pickPixelPreset(preset));
      handleRef.current?.triggerRegenerate({ durationMs: 4000 });
    },
    [phase, preset, spec]
  );

  const onCycle = useCallback((e: ImageGenerationCycleEvent) => {
    if (e.phase === 'reveal') setPhase('revealing');
    if (e.phase === 'visible') {
      setPhase('revealed');
      regeneratingRef.current = false;
    }
    if (e.phase === 'idle') setPhase('playing');
  }, []);

  return (
    <ImageGeneration
      ref={handleRef}
      className="burst-card"
      preset={preset}
      theme="light"
      cardBg={spec.bg}
      images={IMAGE_POOL}
      strength={1}
      pixelScale={0.6}
      borderRadius={spec.radius}
      revealHoldMs={2000}
      onCycle={onCycle}
      style={{
        left: spec.left,
        top: spec.top,
        borderRadius: spec.radius
      }}
    >
      <div style={{ position: 'relative', width: spec.width, height: spec.height, borderRadius: spec.radius }}>
        {phase === 'revealed' || phase === 'revealing' ? (
          <button type="button" className="showcase-gen-pill showcase-regen-pill" onClick={onRegenerate}>
            Regenerate
          </button>
        ) : null}
      </div>
    </ImageGeneration>
  );
}

function BurstDemo(): JSX.Element {
  const nextId = useRef(1);
  // Oldest-first list of spawned cards; `id` in the key remounts a slot's
  // card when it gets recycled, restarting preset/image/enter animation.
  const [entries, setEntries] = useState<Array<{ id: number; slot: number }>>([]);

  const generate = useCallback(() => {
    setEntries((prev) => {
      const id = nextId.current++;
      if (prev.length < BURST_SLOTS.length) {
        const used = new Set(prev.map((e) => e.slot));
        const slot = BURST_SLOTS.findIndex((_, i) => !used.has(i));
        return [...prev, { id, slot }];
      }
      // All slots full: recycle the oldest card's slot with a fresh card.
      const [oldest, ...rest] = prev;
      return [...rest, { id, slot: oldest.slot }];
    });
  }, []);

  return (
    <>
      {entries.map((e) => (
        <BurstCard key={e.id} spec={BURST_SLOTS[e.slot]} />
      ))}
      <button type="button" className="burst-generate" onClick={generate}>
        Generate new image
      </button>
    </>
  );
}

const MODE_TABS: Array<{ id: BehaviorMode; label: string }> = [
  { id: 'click', label: 'Click to generate' },
  { id: 'always-on', label: 'Always on' },
  { id: 'stack', label: 'Card stack' },
  { id: 'burst', label: 'Generate around' }
];

function Showcase(): JSX.Element {
  const [mode, setMode] = useState<BehaviorMode>('click');
  const [stackAnim, setStackAnim] = useState<StackAnimConfig>(DEFAULT_STACK_ANIM);
  // Card positions live here (not in each card) so drag repositions survive
  // the remount-on-tab-switch below.
  const [positions, setPositions] = useState<CardPos[]>(defaultCardPositions);
  const resetLayout = useCallback(() => setPositions(defaultCardPositions()), []);

  return (
    <main className="showcase-page">
      <div className="showcase-frame-wrap">
        {mode === 'click' || mode === 'always-on' ? (
          <button
            type="button"
            className="showcase-reset-layout"
            onClick={resetLayout}
            aria-label="Reset card layout to default positions"
          >
            Reset layout
          </button>
        ) : null}
        <div className="showcase-frame">
        {mode === 'stack' ? (
          // `key` remounts the stack on tab switch so it resets cleanly.
          <StackDemo key={mode} anim={stackAnim} />
        ) : mode === 'burst' ? (
          <BurstDemo key={mode} />
        ) : (
          CARDS.map((spec, i) => (
            // `mode` in the key remounts every card on tab switch so it resets
            // cleanly to that mode's initial state.
            <ShowcaseCard
              key={`${mode}:${spec.left}:${spec.top}`}
              spec={spec}
              mode={mode}
              pos={positions[i]}
              onMove={(p) =>
                setPositions((prev) => prev.map((old, j) => (j === i ? p : old)))
              }
            />
          ))
        )}
        </div>
      </div>

      <div className="showcase-tabs" role="tablist" aria-label="Card behavior mode">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            className={['showcase-tab', mode === tab.id ? 'is-active' : ''].filter(Boolean).join(' ')}
            onClick={() => setMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'stack' ? <StackControls anim={stackAnim} onChange={setStackAnim} /> : null}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('root not found');
createRoot(root).render(
  <StrictMode>
    <Showcase />
  </StrictMode>
);

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import {
  createCycle,
  createInstance,
  createReveal,
  destroyInstance,
  renderInstanceOnce,
  samplePaletteFromCanvas,
  setInstanceCardBg,
  setInstanceColors,
  setInstancePaused,
  setInstancePixelScale,
  setInstancePreset,
  setInstanceStrength,
  setInstanceVisible,
  updateInstanceSize,
  type Cycle,
  type Instance,
  type RevealState,
  type SampledPalette
} from './engine';
import { PRESETS } from './presets';
import { ensureStylesInjected } from './styles';
import type {
  ImageGenerationHandle,
  ImageGenerationPreset,
  ImageGenerationProps,
  ImageGenerationTheme
} from './types';

ensureStylesInjected();

/**
 * Resolve `'auto'` to a concrete `'dark' | 'light'` value, checking sources in
 * priority order so the library plays nicely with the most common app-side
 * theme conventions (not just the OS-level media query):
 *
 *   1. `<html data-theme="dark|light">`          — shadcn / many SSR apps
 *   2. `<html class="dark">` / `class="light">`  — Tailwind v3 darkMode: class
 *   3. `<html style="color-scheme: dark">`       — CSS-only theme toggles
 *   4. `matchMedia('(prefers-color-scheme: dark)')` — OS / browser preference
 *   5. Default `'dark'`                          — SSR-safe fallback
 *
 * Live updates: subscribed to both the matchMedia change event AND a
 * MutationObserver on `<html>` for `class` / `style` / `data-theme` changes,
 * so toggling a theme-class via JS reflects in the shader without remount.
 */
function detectTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  const html = document.documentElement;

  const dataTheme = html.getAttribute('data-theme');
  if (dataTheme === 'dark' || dataTheme === 'light') return dataTheme;

  if (html.classList.contains('dark')) return 'dark';
  if (html.classList.contains('light')) return 'light';

  const colorScheme = html.style.colorScheme || getComputedStyle(html).colorScheme;
  if (colorScheme === 'dark') return 'dark';
  if (colorScheme === 'light') return 'light';

  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function useResolvedTheme(theme: ImageGenerationTheme): 'dark' | 'light' {
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => {
    if (theme !== 'auto') return theme;
    return detectTheme();
  });

  useEffect(() => {
    if (theme !== 'auto') {
      setResolved(theme);
      return;
    }
    if (typeof window === 'undefined') return;

    const update = (): void => setResolved(detectTheme());
    update();

    const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    mql?.addEventListener('change', update);

    let mo: MutationObserver | null = null;
    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(update);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme']
      });
    }

    return () => {
      mql?.removeEventListener('change', update);
      mo?.disconnect();
    };
  }, [theme]);

  return resolved;
}

function normaliseImages(input: string | string[] | undefined): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  return input.slice();
}

/** The regenerate churn always runs on one of these pixel-mosaic presets. */
const PIXEL_CHURN_PRESETS = ['pixels-mechanic', 'pixels-organic'] as const;

type PixelChurnPreset = (typeof PIXEL_CHURN_PRESETS)[number];

function isPixelChurnPreset(name: ImageGenerationPreset): name is PixelChurnPreset {
  return (PIXEL_CHURN_PRESETS as readonly string[]).includes(name);
}

export const ImageGeneration = forwardRef<ImageGenerationHandle, ImageGenerationProps>(function ImageGeneration(
  {
    children,
    preset = 'pixels-organic',
    theme = 'auto',
    strength = 1,
    pixelScale = 1,
    cardBg: cardBgProp,
    colors,
    images,
    autoReveal = false,
    revealDelayRange = [2, 4],
    revealInitialDelay,
    revealHoldMs = 2000,
    revealFadeOutMs = 300,
    borderRadius,
    paused = false,
    onCycle,
    excludeSrcs,
    className,
    style,
    ...rest
  },
  forwardedRef
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const shaderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Instance | null>(null);
  const revealRef = useRef<RevealState | null>(null);
  const cycleRef = useRef<Cycle | null>(null);
  const onCycleRef = useRef(onCycle);
  const excludeSrcsRef = useRef(excludeSrcs);

  // Transient image-derived recolor for the regenerate churn. While set, it
  // overrides the palette + card surface (shader uniforms AND the wrapper's
  // CSS background) so the effect wears the outgoing image's colors; cleared
  // automatically when the next image reaches `visible`.
  const [regenTint, setRegenTint] = useState<SampledPalette | null>(null);

  // Transient preset override for the regenerate churn. The churn must always
  // run on a pixel-mosaic preset (`pixels-mechanic` / `pixels-organic`): when
  // the active preset is not one of those (e.g. `sweep-gradient`), a random
  // pixel preset is swapped onto the instance for the churn's duration and
  // the authored preset is restored once the next image is fully visible.
  const [regenPresetName, setRegenPresetName] = useState<ImageGenerationPreset | null>(null);

  useImperativeHandle(
    forwardedRef,
    () => ({
      get element() {
        return rootRef.current;
      },
      triggerReveal(opts) {
        cycleRef.current?.triggerOnce(opts);
      },
      triggerHide() {
        cycleRef.current?.triggerHide();
      },
      triggerRegenerate(opts) {
        const cycle = cycleRef.current;
        if (!cycle || pausedRef.current) return;
        const phase = cycle.getPhase();
        if (phase !== 'reveal' && phase !== 'visible') return;
        // The churn always runs on a pixel-mosaic preset: keep the active
        // preset when it's already one, otherwise (e.g. sweep-gradient)
        // temporarily switch the instance to a random pixel preset. The
        // authored preset is restored when the next image reaches `visible`.
        const activePreset = presetRef.current;
        const churnName = isPixelChurnPreset(activePreset)
          ? null
          : PIXEL_CHURN_PRESETS[Math.floor(Math.random() * PIXEL_CHURN_PRESETS.length)];
        // Recolor the effect from the visible image (overlay canvas) so the
        // churn showing through the dropped cells reads as pixelation born
        // from that image rather than the preset's stock palette. The sample
        // maps onto the CHURN preset's palette slots (the preset actually
        // rendering during the churn), not the outgoing preset's.
        if (opts?.tintFromImage ?? true) {
          const overlay = overlayCanvasRef.current;
          if (overlay) {
            const churnColors = churnName
              ? PRESETS[churnName].modes[resolvedThemeRef.current].colors
              : presetModeRef.current.colors;
            const sampled = samplePaletteFromCanvas(overlay, churnColors);
            if (sampled) setRegenTint(sampled);
          }
        }
        if (churnName) setRegenPresetName(churnName);
        const autoReveal = opts?.autoReveal ?? true;
        cycle.triggerBoil(
          autoReveal ? { autoRevealAfterMs: opts?.durationMs ?? 4000 } : undefined
        );
      },
      isImageActive() {
        const phase = cycleRef.current?.getPhase() ?? 'idle';
        return phase === 'reveal' || phase === 'visible' || phase === 'hide';
      }
    }),
    []
  );
  useLayoutEffect(() => {
    ensureStylesInjected();
  }, []);

  // Keep the latest callbacks live without re-subscribing the cycle.
  useEffect(() => {
    onCycleRef.current = onCycle;
  }, [onCycle]);
  useEffect(() => {
    excludeSrcsRef.current = excludeSrcs;
  }, [excludeSrcs]);

  const resolvedTheme = useResolvedTheme(theme);
  const presetMode = useMemo(() => PRESETS[preset].modes[resolvedTheme], [preset, resolvedTheme]);
  // Effective background colour (override > preset). Drives both the wrapper's
  // CSS background and the shader's `u_cardBg` uniform so contrast logic in
  // the shader stays in sync with the actual host card surface.
  const cardBg = cardBgProp ?? presetMode.cardBg;

  // Live refs for the imperative `triggerRegenerate` (its handle is created
  // once with empty deps, so it must read current values through refs).
  const presetModeRef = useRef(presetMode);
  presetModeRef.current = presetMode;
  const presetRef = useRef(preset);
  presetRef.current = preset;
  const resolvedThemeRef = useRef(resolvedTheme);
  resolvedThemeRef.current = resolvedTheme;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Normalised image pool + refs holding the latest cycle inputs so the
  // mount-only lifecycle effect can read them when constructing the cycle.
  // (The cycle itself is created in the lifecycle effect so manual
  // `triggerReveal()` works regardless of the `autoReveal` flag.)
  const imagesArr = useMemo(() => normaliseImages(images), [images]);
  const imagesArrRef = useRef(imagesArr);
  const revealDelayRangeRef = useRef(revealDelayRange);
  const revealHoldMsRef = useRef(revealHoldMs);
  const revealFadeOutMsRef = useRef(revealFadeOutMs);
  imagesArrRef.current = imagesArr;
  revealDelayRangeRef.current = revealDelayRange;
  revealHoldMsRef.current = revealHoldMs;
  revealFadeOutMsRef.current = revealFadeOutMs;

  // Resolve `revealInitialDelay` into a stable ms value at mount time.
  // Range tuples randomise ONCE here so re-renders never reseed the value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot resolution at mount
  const initialDelayMsRef = useRef<number | undefined>(
    useMemo(() => {
      if (revealInitialDelay == null) return undefined;
      if (typeof revealInitialDelay === 'number') {
        return Math.max(0, revealInitialDelay) * 1000;
      }
      const [min, max] = revealInitialDelay;
      const lo = Math.max(0, Math.min(min, max));
      const hi = Math.max(0, Math.max(min, max));
      return (lo + Math.random() * (hi - lo)) * 1000;
    }, [])
  );

  // Lifecycle: create instance + reveal on mount, destroy on unmount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable lifecycle effect; preset / theme syncs handled separately
  useLayoutEffect(() => {
    const root = rootRef.current;
    const shader = shaderCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!root || !shader || !overlay) return;

    // Dynamic measure: size from the root's bounding box and corner radius
    // from the wrapped child's computed style (falls back to the root if the
    // child has none). The shader can only render a single uniform corner
    // radius, so we sample `borderTopLeftRadius` and apply it on all four
    // corners — matches how the canvases inherit border-radius from the root.
    const measure = (): { w: number; h: number; r: number } => {
      const rect = root.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      let r = 0;
      if (typeof borderRadius === 'number') {
        r = borderRadius;
      } else {
        const childEl = contentRef.current?.firstElementChild as HTMLElement | null;
        if (childEl) {
          const parsed = parseFloat(getComputedStyle(childEl).borderTopLeftRadius);
          if (Number.isFinite(parsed) && parsed > 0) r = parsed;
        }
        if (r === 0) {
          const parsed = parseFloat(getComputedStyle(root).borderTopLeftRadius);
          if (Number.isFinite(parsed) && parsed > 0) r = parsed;
        }
      }
      return { w, h, r };
    };

    const initial = measure();
    const inst = createInstance({
      canvas: shader,
      cssWidth: initial.w,
      cssHeight: initial.h,
      preset: presetMode,
      strength,
      cardBg: cardBgProp ?? null,
      pixelScale
    });
    instanceRef.current = inst;
    inst.canvas.style.opacity = String(Math.max(0, Math.min(1, strength)));

    const reveal = createReveal({
      canvas: overlay,
      cssWidth: initial.w,
      cssHeight: initial.h,
      shaderCanvas: shader
    });
    inst.reveal = reveal;
    revealRef.current = reveal;

    // Cycle is created up-front (independent of `autoReveal`) so that the
    // imperative `triggerReveal()` works for manual user-driven reveals too.
    // `start()` is only called when `autoReveal` is true (separate effect).
    const cycle = createCycle({
      reveal,
      images: imagesArrRef.current,
      delayRange: revealDelayRangeRef.current,
      holdMs: revealHoldMsRef.current,
      fadeOutMs: revealFadeOutMsRef.current,
      initialDelayMs: initialDelayMsRef.current,
      onPhase: (e) => {
        // A fully-visible image ends any regenerate churn — restore the
        // preset palette / consumer-provided colors and the authored preset.
        // (No-op re-set when nothing is active; React bails on identical
        // state.)
        if (e.phase === 'visible') {
          setRegenTint(null);
          setRegenPresetName(null);
        }
        onCycleRef.current?.(e);
      },
      excludeSrcs: () => excludeSrcsRef.current?.() ?? null
    });
    cycleRef.current = cycle;
    if (paused) cycle.setPaused(true);

    root.style.setProperty('--image-gen-radius', `${initial.r}px`);
    root.style.borderRadius = `${initial.r}px`;

    // Sync the wrapper's dimensions + corner radius to the host card.
    //
    // The radius must follow the wrapped child dynamically so the effect
    // always matches whatever the consumer's card looks like — even if they
    // toggle a class, adjust an inline style, or swap the child entirely.
    //
    // Three observers handle the three change vectors:
    //   1. ResizeObserver on root  -> wrapper resized (window resize, parent
    //      flex/grid change, container query, etc.)
    //   2. ResizeObserver on child -> child intrinsic size changed (text
    //      reflow, image load), which can also imply a CSS recalc that
    //      affects radius.
    //   3. MutationObserver on child -> class / style / data-* attribute
    //      changes that may swap border-radius without touching size (theme
    //      toggle, hover/active class flip from parent, etc.).
    //
    // All three coalesce through a single rAF so the canvas isn't resized
    // more than once per frame.
    let resizeRaf = 0;
    let lastW = -1;
    let lastH = -1;
    let lastR = -1;
    const applyMeasure = (): void => {
      resizeRaf = 0;
      const i = instanceRef.current;
      if (!i) return;
      const next = measure();
      // Skip GL resize if dimensions didn't actually change; still re-apply
      // border-radius because that's the cheap part and may have moved.
      if (next.w !== lastW || next.h !== lastH) {
        updateInstanceSize(i, next.w, next.h);
        lastW = next.w;
        lastH = next.h;
      }
      if (next.r !== lastR) {
        root.style.setProperty('--image-gen-radius', `${next.r}px`);
        root.style.borderRadius = `${next.r}px`;
        lastR = next.r;
      }
    };
    const scheduleMeasure = (): void => {
      if (resizeRaf !== 0) return;
      resizeRaf = requestAnimationFrame(applyMeasure);
    };

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(root);
    const childEl = contentRef.current?.firstElementChild as HTMLElement | null;
    if (childEl) ro.observe(childEl);

    // Watch for CSS-affecting attribute changes on the child so radius
    // updates that don't trigger a resize (e.g. swapping a `rounded-lg`
    // class with `rounded-xl`) are still reflected immediately.
    let mo: MutationObserver | null = null;
    if (childEl && typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(scheduleMeasure);
      mo.observe(childEl, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }
    // Initialise cached dimensions from the first measure so the guard
    // above doesn't spuriously re-apply identical values on the next tick.
    lastW = initial.w;
    lastH = initial.h;
    lastR = initial.r;

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const i = instanceRef.current;
          if (!i) return;
          for (const e of entries) setInstanceVisible(i, e.isIntersecting);
        },
        { rootMargin: '64px' }
      );
      io.observe(root);
    }

    return () => {
      ro.disconnect();
      mo?.disconnect();
      io?.disconnect();
      if (resizeRaf !== 0) cancelAnimationFrame(resizeRaf);
      cycleRef.current?.dispose();
      cycleRef.current = null;
      reveal.dispose();
      revealRef.current = null;
      const i = instanceRef.current;
      if (i) destroyInstance(i);
      instanceRef.current = null;
    };
  }, []);

  // Sync preset/theme to the instance + force a one-shot repaint so paused
  // instances reflect the prop change live (rAF tick is gated on `!paused`).
  // An active regenerate churn preset override takes precedence over the prop.
  useEffect(() => {
    const i = instanceRef.current;
    if (!i) return;
    const effectiveMode = regenPresetName
      ? PRESETS[regenPresetName].modes[resolvedTheme]
      : presetMode;
    setInstancePreset(i, effectiveMode);
    renderInstanceOnce(i);
  }, [presetMode, regenPresetName, resolvedTheme]);

  // Sync cardBg override to the instance (shader uniform + reveal helper),
  // then repaint once so the change shows immediately even while paused.
  // An active regenerate tint takes precedence over the prop.
  useEffect(() => {
    const i = instanceRef.current;
    if (!i) return;
    setInstanceCardBg(i, regenTint?.cardBg ?? cardBgProp ?? null);
    renderInstanceOnce(i);
  }, [cardBgProp, regenTint]);

  // Sync the palette override (per-slot colors, e.g. sampled from an image).
  // An active regenerate tint takes precedence over the prop.
  useEffect(() => {
    const i = instanceRef.current;
    if (!i) return;
    setInstanceColors(i, regenTint?.colors ?? colors ?? null);
    renderInstanceOnce(i);
  }, [colors, regenTint]);

  // Sync strength via the visible canvas opacity (no shader recompile).
  // The `opacity` style change is purely DOM and applies even while paused;
  // no GL repaint needed.
  useEffect(() => {
    const i = instanceRef.current;
    if (!i) return;
    setInstanceStrength(i, strength);
    if (i.canvas) {
      i.canvas.style.opacity = String(Math.max(0, Math.min(1, strength)));
    }
  }, [strength]);

  // Sync pixelScale (recomputes the mosaic grid density) and repaint once so
  // the change is visible immediately even while paused.
  useEffect(() => {
    const i = instanceRef.current;
    if (!i) return;
    setInstancePixelScale(i, pixelScale);
    renderInstanceOnce(i);
  }, [pixelScale]);

  // Sync paused.
  useEffect(() => {
    const i = instanceRef.current;
    if (i) setInstancePaused(i, paused);
    cycleRef.current?.setPaused(paused);
  }, [paused]);

  // Patch live updates to the always-on cycle (avoid recreating per prop change).
  useEffect(() => {
    cycleRef.current?.setImages(imagesArr);
  }, [imagesArr]);
  useEffect(() => {
    cycleRef.current?.setOptions({
      delayRange: revealDelayRange,
      holdMs: revealHoldMs,
      fadeOutMs: revealFadeOutMs
    });
  }, [revealDelayRange, revealHoldMs, revealFadeOutMs]);

  // Start/stop the auto-loop in response to the `autoReveal` flag. The cycle
  // itself is created in the lifecycle effect so manual `triggerReveal()` works
  // even when `autoReveal === false`.
  useEffect(() => {
    const cycle = cycleRef.current;
    if (!cycle) return;
    if (autoReveal) {
      cycle.start();
      return () => cycle.stop();
    }
    cycle.stop();
    return undefined;
  }, [autoReveal]);

  const wrapperStyle = useMemo<CSSProperties>(() => {
    return {
      // During a regenerate churn the card surface wears the outgoing
      // image's average color so the dropped cells read as image pixels.
      background: regenTint?.cardBg ?? cardBg,
      ...style
    };
  }, [cardBg, regenTint, style]);

  return (
    <div
      {...rest}
      ref={rootRef}
      className={['image-gen-root', className].filter(Boolean).join(' ')}
      data-preset={preset}
      data-theme={resolvedTheme}
      data-paused={paused ? 'true' : undefined}
      style={wrapperStyle}
    >
      <canvas ref={shaderCanvasRef} className="image-gen-shader" aria-hidden="true" />
      <canvas ref={overlayCanvasRef} className="image-gen-overlay" aria-hidden="true" />
      <div ref={contentRef} className="image-gen-child">
        {children}
      </div>
    </div>
  );
});

ImageGeneration.displayName = 'ImageGeneration';

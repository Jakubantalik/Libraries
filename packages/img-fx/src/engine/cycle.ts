/**
 * Auto-loop reveal scheduler.
 *
 * Each <ImageGeneration autoReveal> mounts a Cycle that drives the four
 * phases:
 *
 *   idle    -> wait random(min..max) seconds (just shader running)
 *   reveal  -> trigger reveal animation in reveal.ts (preset.revealConfig.duration)
 *   visible -> hold image visible for `revealHoldMs`
 *   hide    -> 300 ms cross-fade back to shader
 *   -> idle
 *
 * `paused` clears the pending timer; resuming re-enters the same phase with a
 * fresh delay. `onCycle` fires on every phase change so consumers can wire
 * analytics or sync external state.
 */
import { loadImage, pickRandomImage, type RevealState } from './reveal';

export type CyclePhase = 'idle' | 'reveal' | 'visible' | 'hide';

export interface CycleEvent {
  phase: CyclePhase;
  src: string | null;
}

export interface CycleOptions {
  reveal: RevealState;
  /** Image pool. Random pick per cycle, never same as previous. */
  images: string[];
  /** Random seconds in `idle` phase (shader-only). */
  delayRange: [number, number];
  /**
   * Time the image stays visible after the reveal completes.
   * - `number` — fixed ms.
   * - `[min, max]` — random ms per cycle, re-rolled each reveal.
   */
  holdMs: number | [number, number];
  /** ms cross-fade back to shader. */
  fadeOutMs: number;
  /** Random initial delay seed so multiple cycles don't sync. */
  initialDelayMs?: number;
  /** Cycle event hook. */
  onPhase?: (event: CycleEvent) => void;
  /**
   * Optional callback invoked just before each pick that returns a list of
   * src strings the cycle MUST avoid this round (in addition to its own
   * "no immediate repeat" rule). Use this to coordinate multiple cycles so
   * they never display the same image at the same time. If every candidate
   * is excluded the cycle falls back to the standard random pick.
   */
  excludeSrcs?: () => string[] | Set<string> | null | undefined;
}

export interface Cycle {
  start: () => void;
  stop: () => void;
  /** Replace the `excludeSrcs` callback (or clear it by passing `null`). */
  setExcludeSrcs: (fn: CycleOptions['excludeSrcs'] | null) => void;
  /**
   * Fire a single reveal pass *now*, regardless of whether the cycle is
   * currently auto-running. No-op if a reveal is already in progress
   * (`reveal`/`visible`/`hide` phases).
   *
   * `hold: 'auto'` (default) — runs reveal -> hold (`holdMs`) -> hide
   * automatically. When auto-running this re-enters the auto-loop afterwards;
   * otherwise the cycle returns to a stopped idle state.
   *
   * `hold: 'manual'` — runs reveal then stays in the `visible` phase
   * indefinitely. Call `triggerHide()` to fade out.
   */
  triggerOnce: (opts?: { hold?: 'auto' | 'manual' }) => void;
  /**
   * Manually trigger the hide fade if currently in `reveal` or `visible`
   * phase. No-op otherwise. Useful for "Hide image" buttons that complement
   * a `triggerOnce({ hold: 'manual' })` call.
   */
  triggerHide: () => void;
  /**
   * Dissolve the currently revealed image into a sustained "regenerating"
   * pixel churn: the image breaks into the effect's cell grid, cells pop
   * in/out with the preset's flicker clock, and the shader plays through the
   * gaps (see `RevealState.startBoil`). The cycle returns to a stopped
   * `idle` state so the consumer can end the churn with `triggerOnce()`
   * (reveals the next image over it) or `stop()`. No-op unless currently in
   * `reveal`/`visible`.
   *
   * `autoRevealAfterMs` — when set, the churn ends by itself: after that many
   * ms the cycle fires `triggerOnce({ hold: 'manual' })`, dissolving the next
   * image in over the churn. Any manual `triggerOnce()` / `stop()` before the
   * timer fires cancels it.
   */
  triggerBoil: (opts?: { autoRevealAfterMs?: number }) => void;
  /** Current phase of the cycle. Useful for syncing UI button state. */
  getPhase: () => CyclePhase;
  setPaused: (paused: boolean) => void;
  setImages: (images: string[]) => void;
  setOptions: (opts: Partial<Pick<CycleOptions, 'delayRange' | 'holdMs' | 'fadeOutMs' | 'onPhase'>>) => void;
  isRunning: () => boolean;
  dispose: () => void;
}

export function createCycle(opts: CycleOptions): Cycle {
  let images = opts.images.slice();
  let delayRange = opts.delayRange;
  let holdMs = opts.holdMs;
  let fadeOutMs = opts.fadeOutMs;
  let onPhase = opts.onPhase;
  let excludeSrcs = opts.excludeSrcs;

  let phase: CyclePhase = 'idle';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastIdx = -1;
  let running = false;
  let paused = false;
  let currentSrc: string | null = null;
  // Captured at the start of each reveal so that the hide tail can decide
  // whether to re-enter the auto-loop (`scheduleIdle()`) or come to a stopped
  // idle. Avoids needing to inspect mutable state at the moment of hide.
  let activeReschedule = false;
  // Hold mode for the currently-active reveal. `manual` means we stay in the
  // `visible` phase indefinitely until `triggerHide()` is called — so resume
  // from pause must NOT re-arm the auto-hide timer.
  let activeHoldMode: 'auto' | 'manual' = 'auto';

  function emit(p: CyclePhase): void {
    phase = p;
    onPhase?.({ phase: p, src: currentSrc });
  }

  function clearTimer(): void {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Resolve `holdMs` to a concrete millisecond value. Tuples re-roll on
   *  every reveal so consecutive cycles never hold for the same duration. */
  function pickHoldMs(): number {
    if (typeof holdMs === 'number') return Math.max(0, holdMs);
    const [min, max] = holdMs;
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(0, Math.max(min, max));
    return lo + Math.random() * (hi - lo);
  }

  function scheduleIdle(initialMs?: number): void {
    if (!running || paused) return;
    emit('idle');
    const [min, max] = delayRange;
    const delaySec = min + Math.random() * Math.max(0, max - min);
    const ms = initialMs ?? delaySec * 1000;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      runReveal(true, 'auto');
    }, ms);
  }

  function performHide(): void {
    if (paused) return;
    emit('hide');
    opts.reveal.startHide(fadeOutMs);
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      if (paused) return;
      currentSrc = null;
      if (activeReschedule) {
        scheduleIdle();
      } else {
        running = false;
        emit('idle');
      }
    }, fadeOutMs);
  }

  function pickAvoidingExcluded(): { src: string; idx: number } | null {
    if (images.length === 0) return null;
    const raw = excludeSrcs?.();
    const exclSet =
      raw == null
        ? null
        : raw instanceof Set
          ? raw
          : new Set(raw);
    if (!exclSet || exclSet.size === 0) {
      return pickRandomImage(images, lastIdx);
    }
    // Build a candidate list: exclude srcs in `exclSet` AND the immediately
    // previous pick (so the same card never repeats consecutively either).
    const lastSrc = lastIdx >= 0 && lastIdx < images.length ? images[lastIdx] : null;
    const candidates: number[] = [];
    for (let i = 0; i < images.length; i++) {
      const src = images[i];
      if (exclSet.has(src)) continue;
      if (src === lastSrc && images.length > exclSet.size + 1) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) {
      // Pool fully exhausted by exclusions — fall back to a regular random
      // pick so we never deadlock the auto-loop.
      return pickRandomImage(images, lastIdx);
    }
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    return { src: images[idx], idx };
  }

  function runReveal(reschedule: boolean, holdMode: 'auto' | 'manual'): void {
    if (!running || paused) return;
    if (images.length === 0) {
      if (reschedule) scheduleIdle(500);
      else running = false;
      return;
    }
    const pick = pickAvoidingExcluded();
    if (!pick) {
      if (reschedule) scheduleIdle(500);
      else running = false;
      return;
    }
    lastIdx = pick.idx;
    currentSrc = pick.src;
    activeReschedule = reschedule;
    activeHoldMode = holdMode;
    loadImage(pick.src)
      .then((img) => {
        if (!running || paused) return;
        emit('reveal');
        opts.reveal.startReveal({
          image: img,
          cssWidth: opts.reveal.canvas.clientWidth || opts.reveal.canvas.width,
          cssHeight: opts.reveal.canvas.clientHeight || opts.reveal.canvas.height,
          onRevealComplete: () => {
            if (!running || paused) return;
            emit('visible');
            if (holdMode === 'manual') {
              // Stay in `visible` indefinitely; consumer will call triggerHide()
              // to fade back to the shader.
              clearTimer();
              return;
            }
            clearTimer();
            const thisHoldMs = pickHoldMs();
            timer = setTimeout(() => {
              timer = null;
              if (!running || paused) return;
              performHide();
            }, thisHoldMs);
          }
        });
      })
      .catch(() => {
        currentSrc = null;
        if (reschedule) scheduleIdle(500);
        else running = false;
      });
  }

  function triggerOnceImpl(triggerOpts?: { hold?: 'auto' | 'manual' }): void {
    if (paused) return;
    // Don't interrupt an in-flight reveal/hold/hide.
    if (phase === 'reveal' || phase === 'visible' || phase === 'hide') return;
    const wasRunning = running;
    clearTimer();
    if (!wasRunning) {
      // Spin up just enough state for runReveal to proceed; mark as running
      // so the bail guards inside runReveal pass. `reschedule=false` makes
      // runReveal return us to a stopped idle state once hide completes.
      running = true;
    }
    runReveal(wasRunning, triggerOpts?.hold ?? 'auto');
  }

  return {
    start() {
      if (running) return;
      running = true;
      paused = false;
      const initial = opts.initialDelayMs ?? Math.random() * 1500;
      scheduleIdle(initial);
    },
    stop() {
      running = false;
      clearTimer();
      opts.reveal.clear();
      currentSrc = null;
      phase = 'idle';
    },
    triggerOnce(triggerOpts) {
      triggerOnceImpl(triggerOpts);
    },
    triggerHide() {
      if (paused) return;
      if (phase !== 'reveal' && phase !== 'visible') return;
      performHide();
    },
    triggerBoil(boilOpts) {
      if (paused) return;
      if (phase !== 'reveal' && phase !== 'visible') return;
      clearTimer();
      opts.reveal.startBoil();
      currentSrc = null;
      // Come to a stopped idle (like a completed manual hide) so a later
      // triggerOnce() runs a single non-rescheduling reveal over the churn.
      running = false;
      emit('idle');
      // Optional self-ending churn: reveal the next image over the boil
      // after the requested duration. Uses the shared timer slot, so any
      // manual triggerOnce()/stop() in the meantime cancels it.
      const afterMs = boilOpts?.autoRevealAfterMs;
      if (afterMs != null && Number.isFinite(afterMs)) {
        timer = setTimeout(() => {
          timer = null;
          triggerOnceImpl({ hold: 'manual' });
        }, Math.max(0, afterMs));
      }
    },
    getPhase() {
      return phase;
    },
    setPaused(p) {
      if (paused === p) return;
      paused = p;
      if (paused) {
        clearTimer();
      } else if (running) {
        // Resume — re-enter idle with a small randomised delay so we don't
        // immediately fire a reveal mid-hold/hide.
        if (phase === 'visible') {
          if (activeHoldMode === 'manual') {
            // Manual hold: stay visible indefinitely; `triggerHide()` will
            // fade it out on demand. Don't re-arm any auto-hide timer.
            return;
          }
          // Re-arm hold timer with a short cap (max 500 ms) so a resume
          // doesn't tack a fresh full hold onto whatever was already shown.
          clearTimer();
          timer = setTimeout(() => {
            timer = null;
            performHide();
          }, Math.min(pickHoldMs(), 500));
        } else if (phase === 'hide') {
          // Already animating; let it complete.
          clearTimer();
          timer = setTimeout(() => {
            timer = null;
            currentSrc = null;
            scheduleIdle();
          }, fadeOutMs);
        } else {
          scheduleIdle();
        }
      }
    },
    setImages(next) {
      images = next.slice();
      lastIdx = -1;
    },
    setExcludeSrcs(fn) {
      excludeSrcs = fn ?? undefined;
    },
    setOptions(next) {
      if (next.delayRange) delayRange = next.delayRange;
      if (next.holdMs != null) holdMs = next.holdMs;
      if (next.fadeOutMs != null) fadeOutMs = next.fadeOutMs;
      if (next.onPhase) onPhase = next.onPhase;
    },
    isRunning() {
      return running && !paused;
    },
    dispose() {
      running = false;
      clearTimer();
    }
  };
}

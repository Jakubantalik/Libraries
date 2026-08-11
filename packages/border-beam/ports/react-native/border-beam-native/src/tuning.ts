/**
 * Consumer tuning hooks — the React Native equivalent of the web library's CSS
 * custom properties (`--pulse-glow-boost`, `--beam-stroke-opacity`,
 * `--beam-core-blur`, `--beam-glow-brightness`, …), added in border-beam 1.3.0.
 * Mirrors BorderBeamKit's `BeamTuning` — keep the two in sync.
 *
 * They dial a beam's prominence up or down *proportionally* without replacing
 * the effect's internals. The web demo's `pulse-outside` preset runs
 * `glowBoost 1.05` with `1.71x` layer opacity, which is why an untuned beam
 * looks noticeably softer than the demo.
 */
export interface BeamTuning {
  /**
   * Proportional multiplier on the measured per-element glow scale
   * (`--pulse-glow-boost`). Affects the pulse family's blob geometry.
   * @default 1
   */
  glowBoost?: number;

  /**
   * Multipliers on the stroke / inner / bloom layer opacity
   * (`--beam-stroke-opacity` and friends). The final opacity is still clamped
   * to 1, exactly as the CSS `opacity` property clamps.
   * @default 1
   */
  strokeOpacity?: number;
  innerOpacity?: number;
  bloomOpacity?: number;

  /**
   * Blur radius overrides for the pulse-outside core and bloom layers
   * (`--beam-core-blur` / `--beam-bloom-blur`). Omit to keep the preset.
   */
  coreBlur?: number;
  bloomBlur?: number;

  /**
   * Brightness / saturation overrides for the outward glow layers only
   * (`--beam-glow-brightness` / `--beam-glow-saturate`). Omit to keep the
   * preset. These deliberately do not touch the stroke ring, so the tight ring
   * and the wide halo stay color-synced.
   */
  glowBrightness?: number;
  glowSaturate?: number;
}

/** Tuning with every hook resolved to a concrete value. */
export interface ResolvedTuning {
  glowBoost: number;
  strokeOpacity: number;
  innerOpacity: number;
  bloomOpacity: number;
  coreBlur?: number;
  bloomBlur?: number;
  glowBrightness?: number;
  glowSaturate?: number;
}

export const NO_TUNING: ResolvedTuning = {
  glowBoost: 1,
  strokeOpacity: 1,
  innerOpacity: 1,
  bloomOpacity: 1,
};

export function resolveTuning(t?: BeamTuning): ResolvedTuning {
  if (!t) return NO_TUNING;
  return {
    glowBoost: t.glowBoost ?? 1,
    strokeOpacity: t.strokeOpacity ?? 1,
    innerOpacity: t.innerOpacity ?? 1,
    bloomOpacity: t.bloomOpacity ?? 1,
    coreBlur: t.coreBlur,
    bloomBlur: t.bloomBlur,
    glowBrightness: t.glowBrightness,
    glowSaturate: t.glowSaturate,
  };
}

/**
 * The tuning the web demo applies to its `pulse-outside` card
 * (`.beam-host--pulse-outside-tuned` in demo/src/styles.css). Exported so
 * consumers can reproduce the demo's look, which is *not* the library default.
 */
export const WEB_DEMO_PULSE_PRESET: BeamTuning = {
  glowBoost: 1.05,
  strokeOpacity: 1.71,
  innerOpacity: 1.71,
  bloomOpacity: 1.71,
  glowBrightness: 1.3 * 1.71,
  glowSaturate: 1.2 * 1.71,
};

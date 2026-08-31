/* Studio agent — the parameter surface the agent is allowed to touch.
 *
 * One spec per library. It is the single source of truth for three things
 * that must never drift apart: the JSON Schema handed to the model, the
 * server-side validation of what comes back, and the prose the model reads
 * to know what a prop *means* ("duration" is not self-explanatory when the
 * request is "calmer").
 *
 * Ranges here mirror the Studio's own sliders exactly (see
 * sites/home/src/studio/beam.tsx). A range that drifts wider than the knob
 * lets the agent set a value the user cannot then nudge by hand.
 */

export type ParamSpec =
  | {
      kind: "number";
      /** Inclusive bounds, matching the knob. */
      min: number;
      max: number;
      /** Knob step. Applied values are snapped to it. */
      step: number;
      /** What this prop does, in the vocabulary a designer would use. */
      describe: string;
      /** Only meaningful while this predicate holds; see `relevant`. */
      when?: string;
    }
  | { kind: "enum"; values: readonly string[]; describe: string; when?: string }
  | { kind: "boolean"; describe: string; when?: string };

export interface LibrarySpec {
  /** Display name, used in the system prompt. */
  label: string;
  /** One paragraph on what the library renders, so the model can reason
      about which props serve a mood word. */
  about: string;
  params: Record<string, ParamSpec>;
  /** Which params actually do something given the current settings. A prop
      that is inert right now is dropped from the schema entirely, so the
      model never spends a turn setting something with no visible effect. */
  relevant: (params: Record<string, unknown>) => string[];
}

export const BEAM_SPEC: LibrarySpec = {
  label: "Beam",
  about:
    "BorderBeam draws an animated light beam travelling around a card's border. " +
    "The 'rotate' family (types md, sm, line) sweeps a gradient around the edge; " +
    "the 'pulse' family (pulse-inner, pulse-outside) breathes a glow in or out from it. " +
    "Perceived calm comes mostly from duration (longer is calmer) and strength; " +
    "perceived warmth or coolness comes from hueShift and colorVariant; " +
    "perceived weight comes from brightness, saturation and the glow spreads.",
  params: {
    size: {
      kind: "enum",
      values: ["md", "sm", "line", "pulse-inner", "pulse-outside"],
      describe:
        "Beam type. md = large rotating sweep, sm = small dot-lit card, line = thin travelling line, " +
        "pulse-inner = glow breathing inward, pulse-outside = glow blooming outward. " +
        "Changing this also switches family, so pick it first when the request is about the effect's character.",
    },
    colorVariant: {
      kind: "enum",
      values: ["colorful", "mono", "ocean", "sunset"],
      describe:
        "Palette. colorful = full spectrum, mono = single neutral, ocean = blues/teals (reads cool), " +
        "sunset = oranges/pinks (reads warm).",
    },
    strength: {
      kind: "number",
      min: 0,
      max: 100,
      step: 1,
      describe: "Overall intensity of the beam, in percent. Lower reads subtler and calmer.",
    },
    duration: {
      kind: "number",
      min: 0.5,
      max: 6,
      step: 0.02,
      describe:
        "Seconds for one full travel. This is the strongest lever on how frantic or calm the effect feels — " +
        "raise it for 'calmer', 'slower', 'more relaxed'; lower it for 'snappier', 'more urgent'.",
    },
    brightness: {
      kind: "number",
      min: 0.5,
      max: 2.2,
      step: 0.05,
      describe: "Glow brightness multiplier. Above ~1.6 reads hot and attention-grabbing.",
    },
    saturation: {
      kind: "number",
      min: 0.4,
      max: 2.2,
      step: 0.05,
      describe: "Colour saturation multiplier. Low values read muted and expensive; high values read neon.",
    },
    hueRange: {
      kind: "number",
      min: 0,
      max: 120,
      step: 1,
      describe:
        "Degrees of hue the gradient spans. Narrow (under ~20) reads as one considered colour; " +
        "wide reads rainbow.",
      when: "staticColors is false",
    },
    hueShift: {
      kind: "number",
      min: -180,
      max: 180,
      step: 5,
      describe:
        "Rotates the whole palette, in degrees. Negative shifts toward cool blues/violets, " +
        "positive toward warm oranges/reds. The main lever for 'cooler' or 'warmer'.",
      when: "staticColors is false",
    },
    staticColors: {
      kind: "boolean",
      describe: "Freeze the palette instead of cycling hues. Reads calmer and more restrained.",
    },
    radius: {
      kind: "number",
      min: 0,
      max: 32,
      step: 1,
      describe: "Card corner radius in px. Higher reads softer and friendlier; 0 reads technical.",
    },
    spikes: {
      kind: "number",
      min: 0,
      max: 2,
      step: 0.05,
      describe: "How pronounced the line's leading spike is. 0 is a flat line, 2 is a sharp comet head.",
      when: "size is line",
    },
    glowSx: {
      kind: "number",
      min: 0.5,
      max: 2,
      step: 0.05,
      describe: "Horizontal spread of the pulse glow.",
      when: "size is pulse-inner or pulse-outside",
    },
    glowSy: {
      kind: "number",
      min: 0.5,
      max: 2,
      step: 0.05,
      describe: "Vertical spread of the pulse glow.",
      when: "size is pulse-inner or pulse-outside",
    },
    glowBoost: {
      kind: "number",
      min: 0.5,
      max: 2,
      step: 0.05,
      describe: "Overall gain on the pulse glow.",
      when: "size is pulse-inner or pulse-outside",
    },
    cardScale: {
      kind: "enum",
      values: ["s", "m", "l"],
      describe: "Preview card size. Cosmetic to the preview only — it is not a library prop.",
      when: "size is not sm",
    },
    active: {
      kind: "boolean",
      describe: "Whether the animation is running. Set false only if the user asks to pause or freeze it.",
    },
  },
  relevant(params) {
    const size = String(params.size ?? "md");
    const isPulse = size === "pulse-inner" || size === "pulse-outside";
    const staticColors = params.staticColors === true;
    const keys: string[] = [
      "size",
      "colorVariant",
      "strength",
      "duration",
      "brightness",
      "saturation",
      "staticColors",
      "radius",
      "active",
    ];
    if (!staticColors) keys.push("hueRange", "hueShift");
    if (size === "line") keys.push("spikes");
    if (isPulse) keys.push("glowSx", "glowSy", "glowBoost");
    if (size !== "sm") keys.push("cardScale");
    return keys;
  },
};

export const SPECS: Record<string, LibrarySpec> = { beam: BEAM_SPEC };

/* JSON Schema for the set_params tool.
 *
 * Deliberately covers the *whole* parameter surface rather than only the
 * props that are live right now. Tools render at the very front of the
 * prompt-cache prefix, so a schema that narrowed itself as the user toggled
 * staticColors would invalidate the cache on every such turn and triple the
 * input cost. Which props are currently inert is told to the model in the
 * user turn instead — after the cache breakpoint, where it is free to vary —
 * and enforced by validate(). */
export function toolSchema(spec: LibrarySpec) {
  const properties: Record<string, unknown> = {};
  for (const [key, p] of Object.entries(spec.params)) {
    const description = p.when ? `${p.describe} (Only applies while ${p.when}.)` : p.describe;
    if (p.kind === "number") {
      properties[key] = { type: "number", minimum: p.min, maximum: p.max, description };
    } else if (p.kind === "enum") {
      properties[key] = { type: "string", enum: [...p.values], description };
    } else {
      properties[key] = { type: "boolean", description };
    }
  }
  /* Not `strict: true` either. Strict mode requires every property in
     `required`, which would force the model to restate all fifteen props on
     a turn that only moves duration — more tokens, and a far higher chance
     of it clobbering something the user tuned by hand. Correctness comes
     from validate() below instead, which also enforces the conditional
     rules ("spikes only on line") that JSON Schema cannot express here. */
  return { type: "object", properties, additionalProperties: false };
}

export interface Validated {
  applied: Record<string, unknown>;
  rejected: Array<{ key: string; reason: string }>;
}

/** Clamp, snap and drop. Never throws — the model gets told what was refused
    and can correct on the next turn. */
export function validate(
  spec: LibrarySpec,
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): Validated {
  const live = new Set(spec.relevant(current));
  const applied: Record<string, unknown> = {};
  const rejected: Array<{ key: string; reason: string }> = [];

  for (const [key, raw] of Object.entries(patch)) {
    const p = spec.params[key];
    if (!p) {
      rejected.push({ key, reason: "not a parameter of this library" });
      continue;
    }
    if (!live.has(key)) {
      rejected.push({ key, reason: `inert with the current settings (${p.when ?? "unavailable"})` });
      continue;
    }
    if (p.kind === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) {
        rejected.push({ key, reason: "not a number" });
        continue;
      }
      const clamped = Math.min(p.max, Math.max(p.min, n));
      /* Snap to the knob's step so the slider lands on a real detent and the
         emitted snippet matches what the user sees. */
      const snapped = Math.round(clamped / p.step) * p.step;
      applied[key] = Number(snapped.toFixed(4));
    } else if (p.kind === "enum") {
      if (typeof raw !== "string" || !p.values.includes(raw)) {
        rejected.push({ key, reason: `must be one of ${p.values.join(", ")}` });
        continue;
      }
      applied[key] = raw;
    } else {
      if (typeof raw !== "boolean") {
        rejected.push({ key, reason: "must be true or false" });
        continue;
      }
      applied[key] = raw;
    }
  }
  return { applied, rejected };
}

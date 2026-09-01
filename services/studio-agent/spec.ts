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

export const ORB_SPEC: LibrarySpec = {
  label: "Orb",
  about:
    "ThinkingOrb is the small animated blob an assistant shows while it is working. " +
    "Nine hand-authored states each have their own character — the state is the effect, " +
    "not a parameter of it, so a request about what the orb is 'doing' usually means changing state. " +
    "Speed governs urgency, ink governs mood, dots governs how dense and busy it reads.",
  params: {
    state: {
      kind: "enum",
      values: [
        "working", "searching", "solving", "listening",
        "connecting", "weaving", "composing", "breathing", "shaping",
      ],
      describe:
        "The orb's animation. breathing is the calmest and most idle; listening is attentive and gentle; " +
        "working and solving read busy and effortful; searching and connecting sweep outward; " +
        "weaving, composing and shaping are the more intricate, crafted-looking ones. " +
        "Pick the state first when the request describes a mood or an activity.",
    },
    size: {
      kind: "enum",
      values: ["64", "20"],
      describe:
        "Pixel size. Only these two exist — each is hand-tuned, so there is no in-between. " +
        "64 is the standalone orb, 20 is the inline-with-text size.",
    },
    speed: {
      kind: "number",
      min: 25,
      max: 300,
      step: 5,
      describe:
        "Animation speed as a percentage of normal. Below ~70 reads calm and deliberate, " +
        "above ~150 reads urgent or frantic. The main lever for 'calmer' and 'more energetic'.",
    },
    ink: {
      kind: "enum",
      values: ["#ededed", "#7cd4ff", "#ffd28f", "#ff9ec9", "#9fe8a8"],
      describe:
        "Colour. #ededed is the stock neutral grey (most restrained), #7cd4ff sky blue (cool, technical), " +
        "#ffd28f amber (warm), #ff9ec9 pink (playful), #9fe8a8 mint (fresh, calm). " +
        "Use the hex value, not the name.",
    },
    dots: {
      kind: "number",
      min: 0.4,
      max: 2,
      step: 0.05,
      describe:
        "Density multiplier for the particles. Below 1 reads sparse and minimal; above 1 reads dense and busy.",
    },
    paused: {
      kind: "boolean",
      describe: "Freeze the animation. Set true only if the user asks to pause or stop it.",
    },
  },
  relevant() {
    // Every orb control is live in every combination.
    return ["state", "size", "speed", "ink", "dots", "paused"];
  },
};

export const METAL_SPEC: LibrarySpec = {
  label: "Metal",
  about:
    "MetalFx renders a liquid-metal shader behind a button or a circular icon button, with a glow and " +
    "a reflection of nearby elements. Perceived expense comes from restraint — lower strength and glow " +
    "read more premium than the maximum, which reads like a demo.",
  params: {
    variant: {
      kind: "enum",
      values: ["button", "circle"],
      describe:
        "Shape. button is a wide pill with a label; circle is a round icon button. " +
        "Changing this resets shaderScale and ringCssPx to that shape's tuned baseline, so if you are " +
        "changing both, send the variant and the values you want in the same call.",
    },
    preset: {
      kind: "enum",
      values: ["chromatic", "silver", "gold"],
      describe:
        "Metal colour. chromatic is iridescent and colourful, silver is neutral and restrained (the most " +
        "'premium' of the three), gold is warm and showy.",
    },
    strength: {
      kind: "number",
      min: 0,
      max: 100,
      step: 1,
      describe:
        "Intensity of the metal effect, in percent. The single strongest lever on how loud the whole thing " +
        "reads — drop it for 'subtler', 'calmer', 'more premium'.",
    },
    glow: {
      kind: "number",
      min: 0,
      max: 100,
      step: 1,
      describe: "Glow intensity in percent. High values read hot and attention-seeking.",
      when: "disableGlow is false",
    },
    shaderScale: {
      kind: "number",
      min: 0.6,
      max: 3,
      step: 0.05,
      describe:
        "Zoom on the shader pattern. Low values give large, slow, liquid shapes; high values give a fine, " +
        "busy, metallic grain. Baselines are 1.6 for button and 1.3 for circle.",
    },
    ring: {
      kind: "number",
      min: 0.5,
      max: 4,
      step: 0.25,
      describe:
        "Width of the bright rim around the edge, in px. Thicker reads chunkier and more toy-like; " +
        "thinner reads sharper. Baselines are 1 for button and 2 for circle.",
    },
    disableGlow: {
      kind: "boolean",
      describe: "Turn the glow off entirely. Reads flatter and more restrained than merely lowering it.",
    },
    disableReflection: {
      kind: "boolean",
      describe:
        "Stop reflecting nearby elements. The reflection is what sells the material, so turning it off " +
        "makes it read more like flat colour — only do this if asked.",
    },
    paused: {
      kind: "boolean",
      describe: "Freeze the shader. Set true only if the user asks to pause or stop it.",
    },
  },
  relevant(params) {
    const keys = [
      "variant", "preset", "strength", "shaderScale", "ring",
      "disableGlow", "disableReflection", "paused",
    ];
    if (params.disableGlow !== true) keys.push("glow");
    return keys;
  },
};

export const IMAGE_SPEC: LibrarySpec = {
  label: "Image",
  about:
    "ImageGeneration is the shader that plays while an image is being generated, then reveals it. " +
    "The preset is the effect's whole character; strength, speed and pixelScale tune it. " +
    "The card background is the colour the shader reasons against, so it changes the mood of the whole tile.",
  params: {
    preset: {
      kind: "enum",
      values: ["pixels-organic", "pixels-mechanic", "sweep-gradient"],
      describe:
        "The effect. pixels-organic is soft and cloud-like, pixels-mechanic is sharp and grid-locked " +
        "(reads technical), sweep-gradient is a smooth wash with no pixel structure (the calmest). " +
        "Pick this first when the request is about the effect's character rather than its intensity.",
    },
    strength: {
      kind: "number",
      min: 0,
      max: 100,
      step: 1,
      describe:
        "Effect intensity in percent, where 50 is the preset's own default look and 100 is its full boost. " +
        "Below 50 is subtler than the preset intends.",
    },
    speed: {
      kind: "number",
      min: 25,
      max: 300,
      step: 5,
      describe:
        "Animation speed as a percentage of normal. Lower reads calmer and more considered; " +
        "higher reads urgent.",
    },
    palette: {
      kind: "enum",
      values: ["preset", "ocean", "ember", "mono"],
      describe:
        "Colour override. preset keeps the effect's own palette; ocean is cool blues; ember is warm " +
        "oranges and reds; mono is greyscale (the most restrained). The lever for 'warmer' and 'cooler'.",
    },
    cardBg: {
      kind: "enum",
      values: ["#1B1B1B", "#101018", "#1a2330", "#241a2e"],
      describe:
        "Card background the shader sits on. #1B1B1B is neutral charcoal, #101018 near-black ink (deepest), " +
        "#1a2330 navy (cool), #241a2e plum (warm). Use the hex value, not the name.",
    },
    pixelScale: {
      kind: "number",
      min: 0.5,
      max: 2,
      step: 0.05,
      describe:
        "Size of the pixel cells. Below 1 gives finer, denser cells; above 1 gives chunkier, more obvious " +
        "blocks. Barely visible on sweep-gradient, which has no pixel structure.",
    },
    paused: {
      kind: "boolean",
      describe: "Freeze the animation. Set true only if the user asks to pause or stop it.",
    },
  },
  relevant(params) {
    const keys = ["preset", "strength", "speed", "palette", "cardBg", "paused"];
    // The gradient preset has no pixel grid for this to act on.
    if (params.preset !== "sweep-gradient") keys.push("pixelScale");
    return keys;
  },
};

export const GOOEY_SPEC: LibrarySpec = {
  label: "Gooey",
  about:
    "liquid-gooey makes elements behave like drops of liquid that merge and stretch. It has four distinct " +
    "effects and the effect decides which knobs exist at all: morph (a menu blooming out of a button), " +
    "move (a slider thumb that stretches and trails), bend (a card that bows as it is dragged), and " +
    "melt (two cards that fuse into one another). Surface knobs — blur, contrast, waviness, fill — are " +
    "shared by morph, move and bend; melt carries its own complete set instead. " +
    "Gooiness is blur and contrast together: more blur with less contrast reads soft and syrupy, " +
    "less blur with more contrast reads tight and beady.",
  params: {
    effect: {
      kind: "enum",
      values: ["morph", "move", "bend", "melt"],
      describe:
        "Which of the four effects is shown. This changes the entire knob set, so change it only when the " +
        "user is asking for a different effect, not merely a different feel.",
    },
    blur: {
      kind: "number",
      min: 0,
      max: 16,
      step: 0.5,
      describe: "Goo blur. Higher fuses shapes together sooner and reads softer and more liquid.",
      when: "effect is morph, move or bend",
    },
    contrast: {
      kind: "number",
      min: 4,
      max: 40,
      step: 1,
      describe:
        "Threshold sharpness of the goo. Higher gives crisp, defined edges; lower lets shapes stay hazy.",
      when: "effect is morph, move or bend",
    },
    waviness: {
      kind: "number",
      min: 0,
      max: 8,
      step: 0.5,
      describe: "Ripple along the liquid's edge. 0 is a clean contour; higher reads unstable and organic.",
      when: "effect is morph, move or bend",
    },
    fill: {
      kind: "enum",
      values: ["default", "#e9e9e9", "#7cd4ff", "#ffd28f"],
      describe:
        "Liquid colour. default is the effect's own dark surface, #e9e9e9 light grey, #7cd4ff sky (cool), " +
        "#ffd28f amber (warm). Use the literal value, not the name.",
      when: "effect is morph, move or bend",
    },
    morphDuration: {
      kind: "number",
      min: 80,
      max: 1200,
      step: 10,
      describe: "Milliseconds for the menu to open. Longer reads calmer and more deliberate.",
      when: "effect is morph",
    },
    morphEasing: {
      kind: "enum",
      values: ["Bouncy", "Smooth", "Snappy"],
      describe:
        "Opening curve. Bouncy overshoots and reads playful; Smooth is even and neutral; " +
        "Snappy decelerates hard and reads precise and expensive.",
      when: "effect is morph",
    },
    morphStagger: {
      kind: "number",
      min: 0,
      max: 200,
      step: 5,
      describe:
        "Milliseconds between each item appearing. 0 makes them arrive together; higher reads more " +
        "choreographed and unhurried.",
      when: "effect is morph",
    },
    morphSpread: {
      kind: "number",
      min: 0.4,
      max: 2,
      step: 0.05,
      describe: "How far the items travel from the button. Lower is tighter and more compact.",
      when: "effect is morph",
    },
    morphAnticipation: {
      kind: "number",
      min: 0,
      max: 24,
      step: 1,
      describe:
        "Pixels the items pull back before launching. Anticipation is what makes motion read " +
        "characterful rather than mechanical; 0 removes it entirely.",
      when: "effect is morph",
    },
    moveSpringiness: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.05,
      describe: "How much the thumb springs toward the cursor. Higher reads bouncier and more alive.",
      when: "effect is move",
    },
    moveWobble: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.05,
      describe: "Residual wobble after it settles. 0 stops dead; higher keeps jiggling.",
      when: "effect is move",
    },
    moveStretch: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.02,
      describe: "How far the liquid stretches while moving. The main lever on how gooey the drag feels.",
      when: "effect is move",
    },
    moveTrail: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.025,
      describe: "How much liquid is left trailing behind the thumb. Higher reads thicker and more viscous.",
      when: "effect is move",
    },
    bendVertical: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.05,
      describe: "How much the card bows along its vertical axis as it is dragged. Higher reads floppier.",
      when: "effect is bend",
    },
    bendHorizontal: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.05,
      describe: "How much the left and right edges curve. Higher reads rubbery.",
      when: "effect is bend",
    },
    bendContent: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.05,
      describe:
        "How much the content inside bends with the card. 0 keeps text flat and readable while the card " +
        "deforms around it.",
      when: "effect is bend",
    },
    meltBlur: {
      kind: "number",
      min: 0,
      max: 20,
      step: 0.5,
      describe: "Goo blur for melt. Higher makes the two cards fuse from further apart.",
      when: "effect is melt",
    },
    meltContrast: {
      kind: "number",
      min: 10,
      max: 80,
      step: 1,
      describe: "Edge sharpness of the melt. Higher gives a crisp boundary as they merge.",
      when: "effect is melt",
    },
    meltReach: {
      kind: "number",
      min: 0,
      max: 2,
      step: 0.05,
      describe: "Distance at which the cards start reaching for each other. Higher fuses them sooner.",
      when: "effect is melt",
    },
    meltFade: {
      kind: "number",
      min: 0,
      max: 40,
      step: 1,
      describe: "How softly the merged edge fades out. Higher reads more vaporous.",
      when: "effect is melt",
    },
    meltWarp: {
      kind: "number",
      min: 0,
      max: 40,
      step: 1,
      describe: "Distortion of the surfaces as they meet. 0 keeps them undistorted; higher reads molten.",
      when: "effect is melt",
    },
    meltMarbling: {
      kind: "number",
      min: 0,
      max: 1,
      step: 0.05,
      describe: "How much the two cards' contents swirl into each other rather than simply overlapping.",
      when: "effect is melt",
    },
    meltGravity: {
      kind: "number",
      min: 0,
      max: 4,
      step: 0.1,
      describe: "Downward pull on the liquid. Higher makes it sag and drip; 0 leaves it weightless.",
      when: "effect is melt",
    },
  },
  relevant(params) {
    const effect = String(params.effect ?? "morph");
    const keys = ["effect"];
    if (effect !== "melt") keys.push("blur", "contrast", "waviness", "fill");
    if (effect === "morph") {
      keys.push("morphDuration", "morphEasing", "morphStagger", "morphSpread", "morphAnticipation");
    }
    if (effect === "move") keys.push("moveSpringiness", "moveWobble", "moveStretch", "moveTrail");
    if (effect === "bend") keys.push("bendVertical", "bendHorizontal", "bendContent");
    if (effect === "melt") {
      keys.push("meltBlur", "meltContrast", "meltReach", "meltFade", "meltWarp", "meltMarbling", "meltGravity");
    }
    return keys;
  },
};

export const SPECS: Record<string, LibrarySpec> = {
  beam: BEAM_SPEC,
  orb: ORB_SPEC,
  gooey: GOOEY_SPEC,
  metal: METAL_SPEC,
  image: IMAGE_SPEC,
};

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

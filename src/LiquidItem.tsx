import type { CSSProperties, ReactNode } from 'react'
import type { CornerRadii } from './geometry'
import { GooeyItem, type DissolveOptions } from './GooeyItem'
import {
  EVOLVE_DEFAULTS,
  MOVE_DEFAULTS,
  type EvolveOptions,
  type MoveOptions,
} from './observer'
import type { Transition } from './spring'

/** The two public liquid behaviors:
 *  - 'morph' (default): pieces merge gooily, change shape like jelly, and can
 *    dissolve into each other on contact — menus, avatar groups, morphing
 *    panels.
 *  - 'move': the surface trails a moving element as liquid rubber with a
 *    droplet tail — sliders, tab indicators, dragged things. */
export type LiquidEffect = 'morph' | 'move'

/** Simple tuning for effect="morph". All knobs are normalized; defaults are
 *  the library's tuned look. Raw physics live under `advanced`. */
export interface MorphTuning {
  /** Liquid shape-change physics: the surface springs behind size changes,
   *  travels as a droplet and settles like jelly. Off by default — plain
   *  merge needs no engine. */
  shape?: boolean
  /** Melt the item's imagery into a touching neighbour. `true` for the full
   *  tuned look, or 0..1 to scale the intensity. */
  dissolve?: boolean | number
  /** Speed multiplier for the shape physics. 1 = default, 2 = twice as fast. */
  speed?: number
  /** 0..1 — how much the shape physics overshoot and wobble. 0 = calm and
   *  critically damped, 1 = very springy. Default 0.5. */
  bounce?: number
  /** Max px your CONTENT cross-blurs by while the liquid is in motion,
   *  sharpening as the shape settles — the content half of the effect, not
   *  just the surface. Applies with `shape`. Default 7, `0` disables. */
  contentBlur?: number
  /** Full escape hatch: raw engine options, merged over the mapped values. */
  advanced?: {
    evolve?: EvolveOptions
    dissolve?: DissolveOptions
    /** Shrink the blob by px per side so opaque content fully covers its own
     *  liquid (e.g. round photos). */
    blobInset?: number
    /** Px the blob swells back out near a neighbour — a visible liquid coat
     *  that necks into the other surface. */
    bridgeGrow?: number
  }
}

/** Simple tuning for effect="move". All knobs are 0..1; defaults are the
 *  library's tuned look. Raw physics live under `advanced`. */
export interface MoveTuning {
  /** How tightly the liquid chases the element. 0 = heavy syrup lag,
   *  1 = near-instant. Default 0.5. */
  springiness?: number
  /** How much the surface overshoots and wobbles on arrival. Default 0.5. */
  wobble?: number
  /** Velocity stretch of the drop. 0 = rigid. Default 0.36. */
  stretch?: number
  /** Trailing droplet size. 0 disables the tail. Default 0.575. */
  trail?: number
  /** Full escape hatch: raw spring values, merged over the mapped values. */
  advanced?: MoveOptions
}

export interface LiquidItemProps {
  /** 'morph' (default) or 'move'. */
  effect?: LiquidEffect
  /** Tuning for effect="morph". */
  morph?: MorphTuning
  /** Tuning for effect="move". */
  move?: MoveTuning
  /** Component-driven position: the library animates both the element and its
   *  liquid in perfect sync. Omit x/y and animate the child yourself (CSS,
   *  Framer Motion, …) — the liquid follows automatically when the effect
   *  needs it, or with `observe` for plain merge. */
  x?: number
  y?: number
  scale?: number
  /** Spring preset/config or `{ duration, ease }` for x/y. Default 'smooth'. */
  transition?: Transition
  /** Transition delay in ms (stagger). */
  delay?: number
  /** Plain-merge items animated by YOUR code: makes the liquid follow the
   *  child's rendered rect. Implied by morph.shape / morph.dissolve /
   *  effect="move". */
  observe?: boolean
  /** Override the measured border-radius for the liquid (px). */
  radius?: number | CornerRadii
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/** Damping ratio from a 0..1 bounciness knob. 0.5 lands exactly on the tuned
 *  defaults' ratio (≈0.45); 0 is critically damped; 1 is very springy. */
function zeta(bounce: number): number {
  return Math.max(0.12, 1 - 1.1 * Math.min(1, Math.max(0, bounce)))
}

function mapMorphSprings(t: MorphTuning | undefined): EvolveOptions {
  const s = Math.max(0.25, t?.speed ?? 1)
  // Damping scales with ζ(bounce)/ζ(0.5) so (speed 1, bounce 0.5) reproduces
  // EVOLVE_DEFAULTS exactly; stiffness × s² + damping × s keeps the ratio, so
  // `speed` changes tempo without changing character.
  const k = zeta(t?.bounce ?? 0.5) / zeta(0.5)
  return {
    massStiffness: EVOLVE_DEFAULTS.massStiffness * s * s,
    massDamping: EVOLVE_DEFAULTS.massDamping * s * k,
    sizeStiffness: EVOLVE_DEFAULTS.sizeStiffness * s * s,
    sizeDamping: EVOLVE_DEFAULTS.sizeDamping * s * k,
    // The radius spring stays critically damped at every bounce setting — the
    // roundness envelope supplies the liquid look; a bouncing radius reads as
    // flicker, not jelly.
    radiusStiffness: EVOLVE_DEFAULTS.radiusStiffness * s * s,
    radiusDamping: EVOLVE_DEFAULTS.radiusDamping * s,
    cornerDuration: EVOLVE_DEFAULTS.cornerDuration / s,
    contentBlur: t?.contentBlur ?? EVOLVE_DEFAULTS.contentBlur,
  }
}

function mapDissolve(d: boolean | number): DissolveOptions {
  const k = typeof d === 'number' ? Math.min(1, Math.max(0, d)) : 1
  // k scales the strength axes; geometry (zone/range) and motion character
  // (taper/churn) stay at the tuned values so a weak dissolve still looks
  // like the same liquid, just shallower.
  return {
    warp: 26 * k,
    blur: 8 * k,
    mix: 0.7 * k,
    gravity: 60 * k,
    taper: 1,
    warpFreq: 1.7,
    flowSpeed: 22,
    detail: 2,
    zone: 18,
    range: 49,
    releaseMs: 110,
  }
}

function mapMove(t: MoveTuning | undefined): MoveOptions {
  const p = Math.min(1, Math.max(0, t?.springiness ?? 0.5))
  // Exponential feel curve centred on the default: 0 → ~120, 0.5 → 380,
  // 1 → ~1200. Damping rescales with √stiffness and ζ(wobble) so the default
  // knob positions reproduce MOVE_DEFAULTS exactly.
  const stiffness = MOVE_DEFAULTS.stiffness * Math.pow(10, p - 0.5)
  const damping =
    MOVE_DEFAULTS.damping *
    Math.sqrt(stiffness / MOVE_DEFAULTS.stiffness) *
    (zeta(t?.wobble ?? 0.5) / zeta(0.5))
  return {
    stiffness,
    damping,
    stretch: 0.5 * Math.min(1, Math.max(0, t?.stretch ?? 0.36)),
    tail: 0.8 * Math.min(1, Math.max(0, t?.trail ?? 0.575)),
    ...t?.advanced,
  }
}

/** The public item: two effects, simple normalized knobs, `advanced` escape
 *  hatches into the raw engine options. */
export function LiquidItem(props: LiquidItemProps) {
  const { effect = 'morph', morph, move, observe, ...rest } = props

  if (effect === 'move') {
    return <GooeyItem {...rest} observe effect="move" move={mapMove(move)} />
  }

  const adv = morph?.advanced
  const shape = !!morph?.shape
  const dissolve = morph?.dissolve
  const wantsDissolve = dissolve !== undefined && dissolve !== false
  const contactBlur = wantsDissolve
    ? { ...mapDissolve(dissolve!), ...adv?.dissolve }
    : adv?.dissolve
  const evolve = shape ? { ...mapMorphSprings(morph), ...adv?.evolve } : undefined

  return (
    <GooeyItem
      {...rest}
      observe={observe || shape || !!contactBlur || undefined}
      effect={shape ? 'evolve' : undefined}
      evolve={evolve}
      contactBlur={contactBlur}
      blobInset={adv?.blobInset}
      bridgeGrow={adv?.bridgeGrow}
    />
  )
}

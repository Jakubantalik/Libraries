import { GooeyRoot } from './Gooey'
import { LiquidItem } from './LiquidItem'

/** The liquid group: renders the merged silhouette (goo + real shadows) behind
 *  your crisp content. Put `Liquid.Item`s inside. */
export const Liquid = Object.assign(GooeyRoot, { Item: LiquidItem })

export type { GooeyProps as LiquidProps } from './Gooey'
export type {
  BendTuning,
  LiquidEffect,
  LiquidItemProps,
  MorphTuning,
  MoveTuning,
} from './LiquidItem'
export { IMAGE_MELT_DEFAULTS } from './imageMelt'
export type { ImageMeltOptions } from './imageMelt'

// ---- advanced escape hatch (raw engine options + defaults) ----
export type { DissolveOptions } from './GooeyItem'
export { EVOLVE_DEFAULTS, MOVE_DEFAULTS } from './observer'
export type { EvolveOptions, MoveOptions } from './observer'
export { easingFunction, presets } from './spring'
export type { SpringConfig, Transition, TransitionPreset } from './spring'
export type { CornerRadii } from './geometry'

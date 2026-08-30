/** Public engine surface — exposes the renderer/reveal/cycle primitives so
 *  power users can drive the pipeline without React. */

export {
  createInstance,
  destroyInstance,
  effectiveCardBg,
  effectiveCellSize,
  getFrameRate,
  getMaxDpr,
  renderInstanceOnce,
  setFrameRate,
  setInstanceCardBg,
  setInstanceColors,
  setInstancePaused,
  setInstancePixelScale,
  setInstancePreset,
  setInstanceStrength,
  setInstanceVisible,
  setMaxDpr,
  updateInstanceSize,
  type CreateInstanceOptions,
  type Instance
} from './renderer';

export {
  createReveal,
  loadImage,
  pickRandomImage,
  type CreateRevealOptions,
  type RevealState,
  type RevealStartOptions
} from './reveal';

export {
  createCycle,
  type Cycle,
  type CycleEvent,
  type CycleOptions,
  type CyclePhase
} from './cycle';

export { samplePaletteFromCanvas, type SampledPalette } from './palette';

export { ease, EASING_FNS, type EaseFn } from './tween';

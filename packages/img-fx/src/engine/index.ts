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
  setInstanceSpeed,
  setInstanceStrength,
  setInstanceVisible,
  setMaxDpr,
  setSharedFragmentShader,
  updateInstanceSize,
  type CreateInstanceOptions,
  type Instance
} from './renderer';

export { FRAG_SRC as IMAGE_FRAGMENT_SHADER } from './shaders';

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

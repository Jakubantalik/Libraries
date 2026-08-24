export { ImageGeneration } from './ImageGeneration';

export type {
  ImageGenerationCycleEvent,
  ImageGenerationHandle,
  ImageGenerationPreset,
  ImageGenerationProps,
  ImageGenerationTheme
} from './types';

export {
  PRESETS,
  hexToRgb,
  parseCssColor,
  type EasingKey,
  type MaskShape,
  type MosaicConfig,
  type Preset,
  type PresetMode,
  type PresetName,
  type PresetTheme,
  type RevealConfig
} from './presets';

// Power-user surface: expose the engine primitives so consumers can drive the
// renderer + reveal pipeline without React.
export {
  createCycle,
  createInstance,
  createReveal,
  destroyInstance,
  ease,
  effectiveCardBg,
  getFrameRate,
  getMaxDpr,
  loadImage,
  pickRandomImage,
  samplePaletteFromCanvas,
  setFrameRate,
  setInstanceCardBg,
  setInstanceColors,
  setInstancePaused,
  setInstancePreset,
  setInstanceStrength,
  setInstanceVisible,
  setMaxDpr,
  updateInstanceSize,
  type CreateInstanceOptions,
  type CreateRevealOptions,
  type Cycle,
  type CycleEvent,
  type CycleOptions,
  type CyclePhase,
  type EaseFn,
  type Instance,
  type RevealState,
  type RevealStartOptions,
  type SampledPalette
} from './engine';

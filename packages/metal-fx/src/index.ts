export { MetalFx } from './MetalFx';

export type {
  MetalFxProps,
  MetalFxVariant,
  MetalFxTheme,
  MetalFxPreset,
} from './types';

// Power-user surface: expose the engine primitives so consumers building
// non-React integrations can drive the same renderer.
export {
  PRESETS,
  SHAPE_NONE,
  SHAPE_CIRCLE,
  SHAPE_DAISY,
  SHAPE_DIAMOND,
  SHAPE_METABALLS,
  FIT_NONE,
  FIT_CONTAIN,
  FIT_COVER,
  hexToRgb,
  hexToRgba,
  type Preset,
  type PresetMode,
  type PresetName,
  type PresetTheme,
} from './engine/presets';

export {
  createInstance,
  destroyInstance,
  updateInstance,
  setSharedPreset,
  setSharedPresetMode,
  pauseShared,
  resumeShared,
} from './engine/renderer/loop';

export type { MetalFxInstance } from './engine/renderer/core';

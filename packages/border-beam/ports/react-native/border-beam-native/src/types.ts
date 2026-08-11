import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { BeamTuning } from './tuning';

/**
 * Size/type preset for the border beam effect.
 *
 * Rotate family (traveling/spinning beam): 'sm' | 'md' | 'line'.
 * Pulse family (breathing glow, no rotation): 'pulse-outside' | 'pulse-inner'.
 */
export type BorderBeamSize = 'sm' | 'md' | 'line' | 'pulse-outside' | 'pulse-inner';

/** Theme mode — 'auto' follows the system color scheme. */
export type BorderBeamTheme = 'dark' | 'light' | 'auto';

/** Color variant for the beam effect. */
export type BorderBeamColorVariant = 'colorful' | 'mono' | 'ocean' | 'sunset';

/**
 * Props for the BorderBeam component — mirrors the web library's
 * `BorderBeamProps` minus DOM-specific fields.
 */
export interface BorderBeamProps {
  /** Content to wrap with the border beam effect. */
  children: ReactNode;

  /** @default 'md' */
  size?: BorderBeamSize;

  /** @default 'colorful' */
  colorVariant?: BorderBeamColorVariant;

  /** @default 'dark' */
  theme?: BorderBeamTheme;

  /** Disable the hue-shift animation for static colors. @default false */
  staticColors?: boolean;

  /** Rotation/travel duration in seconds. @default 1.96 (rotate) / 3.1 (line) / 2.3 (pulse) */
  duration?: number;

  /** Whether the animation is active. @default true */
  active?: boolean;

  /**
   * Border radius in pixels. Unlike the web version there is no auto-detection
   * from the child — pass the wrapped component's radius explicitly.
   * Falls back to the size preset default.
   */
  borderRadius?: number;

  /** Brightness multiplier. Falls back to the type's preset default. */
  brightness?: number;

  /** Saturation multiplier. Falls back to the theme preset. */
  saturation?: number;

  /** Hue rotation range in degrees for the hue-shift animation. @default 30 */
  hueRange?: number;

  /** Overall strength/opacity of the effect (0-1). @default 1 */
  strength?: number;

  /**
   * Consumer tuning hooks (border-beam 1.3.0) — proportionally boost or soften
   * the effect. Currently applied by the pulse family. Note the web demo's
   * pulse-outside card uses `WEB_DEMO_PULSE_PRESET`, so stock output is
   * intentionally softer than the demo.
   */
  tuning?: BeamTuning;

  /** Style for the wrapping View. */
  style?: StyleProp<ViewStyle>;

  /** Called when the fade-in completes. */
  onActivate?: () => void;

  /** Called when the fade-out completes. */
  onDeactivate?: () => void;
}

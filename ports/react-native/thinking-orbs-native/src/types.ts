import type { ViewStyle } from 'react-native';
import type { OrbSize, OrbState } from 'thinking-orbs/engine';

export type { OrbSize, OrbState };

/**
 * Theme mode. `auto` follows the OS appearance via `useColorScheme()`.
 *
 * The web build additionally walks up the DOM for a `data-theme` attribute
 * (the Tailwind / shadcn convention). React Native has no equivalent
 * ambient signal, so a host app that themes independently of the OS should
 * pass `theme` explicitly from its own context.
 */
export type OrbTheme = 'auto' | 'dark' | 'light';

export interface ThinkingOrbProps {
  /** Which animation to show. @default 'working' */
  state?: OrbState;
  /** Tuned size preset — 64 or 20 dp. @default 64 */
  size?: OrbSize;
  /** Theme mode; `auto` follows the OS appearance. @default 'auto' */
  theme?: OrbTheme;
  /** Speed multiplier on top of the preset's baked speed. @default 1 */
  speed?: number;
  /** Freeze on the current frame. @default false */
  paused?: boolean;
  /**
   * Render the orb at this many dp instead of `size`.
   *
   * The GEOMETRY still comes from the `size` preset — these are two tuned
   * designs, not one design at two scales — but the Skia canvas is sized to
   * `displaySize` and the drawing is scaled into it. Because the frame is a
   * list of vector circles, that stays crisp at any factor, unlike putting a
   * transform on the view (which upscales an already-rasterised 64dp canvas).
   *
   * Use it when a layout needs the 64 design at, say, 133dp.
   */
  displaySize?: number;
  /** Overrides the per-state default. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

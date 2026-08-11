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
  /** Overrides the per-state default. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

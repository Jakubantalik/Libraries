/**
 * Typed access to the platform-neutral `beam-spec.json`, generated from the
 * web library (`npm run spec` in the repo root). To sync after a web update:
 * `npm run spec && cp spec/beam-spec.json ports/react-native/border-beam-native/src/`.
 */
import spec from './beam-spec.json';
import type { BorderBeamColorVariant, BorderBeamSize } from './types';

export interface GradientBlob {
  color: string;
  pos: string;
  size: string;
}

export interface ThemeColors {
  strokeOpacity: number;
  innerOpacity: number;
  bloomOpacity: number;
  innerShadow: string;
  saturation: number;
  brightness?: number;
  hairlineOpacity?: number;
}

export interface Oscillator {
  prop: string;
  a: number;
  b: number;
  period: number;
  delay: number;
  unit: string;
}

export const beamSpec = spec;

export function themePreset(size: BorderBeamSize, theme: 'dark' | 'light'): ThemeColors {
  return (spec.sizeThemePresets as Record<string, Record<string, ThemeColors>>)[size][theme];
}

export function sizePreset(size: BorderBeamSize): { borderRadius: number; borderWidth: number } {
  return (spec.sizePresets as Record<string, { borderRadius: number; borderWidth: number }>)[size];
}

export function borderPalette(variant: BorderBeamColorVariant): GradientBlob[] {
  return (spec.palettes.border as Record<string, { border: GradientBlob[] }>)[variant].border;
}

export function smallPalette(variant: BorderBeamColorVariant): { border: GradientBlob[]; inner: GradientBlob[] } {
  return (spec.palettes.small as Record<string, { border: GradientBlob[]; inner: GradientBlob[] }>)[variant];
}

// ── CSS value parsing (same semantics as BorderBeamKit/BeamSpec.swift) ──

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parses "rgb(r, g, b)" / "rgba(r, g, b, a)" / "transparent" (0-1 channels). */
export function parseCssColor(css: string): RGBA | null {
  const s = css.trim();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!m) return null;
  return {
    r: parseFloat(m[1]) / 255,
    g: parseFloat(m[2]) / 255,
    b: parseFloat(m[3]) / 255,
    a: m[4] != null ? parseFloat(m[4]) : 1,
  };
}

/** Parses "33% -7.4%" → { x: 0.33, y: -0.074 }. */
export function parsePercentPair(value: string): { x: number; y: number } {
  const parts = value.split(' ');
  const pct = (p: string) => parseFloat(p.replace('%', '')) / 100;
  return { x: pct(parts[0] ?? '0'), y: pct(parts[1] ?? '0') };
}

/** Parses "70px 40px" → { w: 70, h: 40 } (CSS explicit-size gradient RADII). */
export function parsePixelPair(value: string): { w: number; h: number } {
  const parts = value.split(' ');
  const px = (p: string) => parseFloat(p.replace('px', ''));
  return { w: px(parts[0] ?? '0'), h: px(parts[1] ?? '0') };
}

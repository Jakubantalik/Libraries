import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Fill,
  Shader,
  Skia,
  Blur,
  Group,
  Paint,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  beamSpec,
  borderPalette,
  smallPalette,
  parseCssColor,
  parsePercentPair,
  parsePixelPair,
  themePreset,
  sizePreset,
  type GradientBlob,
} from './spec';
import { composedFilterMatrix } from './colorMatrix';
import {
  ROTATE_LAYER_SKSL,
  MAX_BLOBS,
  MAX_BG_STOPS,
  MAX_MASK_STOPS,
  padTo,
} from './rotateShader';
import { pingPong } from './pulseDriver';
import type { BorderBeamColorVariant } from './types';

function makeRotateEffect() {
  const effect = Skia.RuntimeEffect.Make(ROTATE_LAYER_SKSL);
  if (!effect) {
    throw new Error('border-beam-native: failed to compile rotate SkSL effect');
  }
  return effect;
}

const rotateEffect = makeRotateEffect();

function blobFloats(
  blobs: GradientBlob[],
  sizeScale = 1,
  alphaOverride?: number
): number[] {
  const out: number[] = [];
  for (const blob of blobs) {
    const color = parseCssColor(blob.color);
    if (!color) continue;
    const pos = parsePercentPair(blob.pos);
    const radii = parsePixelPair(blob.size);
    // Web derivation rounds scaled sizes to whole px.
    const rx = sizeScale === 1 ? radii.w : Math.round(radii.w * sizeScale);
    const ry = sizeScale === 1 ? radii.h : Math.round(radii.h * sizeScale);
    out.push(rx, ry, pos.x, pos.y, color.r, color.g, color.b, alphaOverride ?? color.a);
  }
  return out;
}

function flattenStops(stops: number[][]): number[] {
  return stops.flatMap(([pos, alpha]) => [pos / 100, alpha]);
}

export interface RotateBeamProps {
  size: 'sm' | 'md';
  variant: BorderBeamColorVariant;
  theme: 'dark' | 'light';
  staticColors: boolean;
  duration: number;
  borderRadius: number;
  brightness: number;
  saturation: number;
  hueRange: number;
  strength: number;
  width: number;
  height: number;
  /** Milliseconds clock (Skia useClock). */
  clock: SharedValue<number>;
  /** 0..1 fade shared value (activate/deactivate). */
  fade: SharedValue<number>;
}

/**
 * The three rotate-family layers, mirroring the web z-order: inner glow (1),
 * stroke ring (2), blurred bloom ring (3).
 */
export function RotateBeam({
  size,
  variant,
  theme,
  staticColors,
  duration,
  borderRadius,
  brightness,
  saturation,
  hueRange,
  strength,
  width,
  height,
  clock,
  fade,
}: RotateBeamProps) {
  const rotate = beamSpec.rotate;
  const preset = sizePreset(size);
  const colors = themePreset(size, theme);
  const monoMul = variant === 'mono' ? beamSpec.defaults.monoOpacityMultiplier : 1;
  const isDark = theme === 'dark';

  const staticUniforms = useMemo(() => {
    const strokeBlobs =
      size === 'sm' ? blobFloats(smallPalette(variant).border) : blobFloats(borderPalette(variant));
    const innerBlobs =
      size === 'sm'
        ? blobFloats(smallPalette(variant).inner)
        : blobFloats(
            borderPalette(variant),
            rotate.innerGradientDerivation.sizeScale,
            variant === 'mono'
              ? rotate.innerGradientDerivation.monoAlpha
              : rotate.innerGradientDerivation.alpha
          );

    const themeKey = theme as 'dark' | 'light';
    const whiteStops = flattenStops(
      (rotate.whiteGradientStops as Record<string, number[][]>)[themeKey]
    );
    const bloomStops = flattenStops(
      (rotate.bloomGradientStops as Record<string, number[][]>)[themeKey]
    );
    const beamMask = flattenStops(rotate.beamMaskStops as number[][]);
    const smallMask = flattenStops(rotate.smallMaskStops as number[][]);
    const shadow = parseCssColor(colors.innerShadow) ?? { r: 0, g: 0, b: 0, a: 0 };

    return {
      strokeBlobs: padTo(strokeBlobs, MAX_BLOBS * 8),
      strokeBlobCount: strokeBlobs.length / 8,
      innerBlobs: padTo(innerBlobs, MAX_BLOBS * 8),
      innerBlobCount: innerBlobs.length / 8,
      whiteStops: padTo(whiteStops, MAX_BG_STOPS * 2),
      whiteStopCount: whiteStops.length,
      bloomStops: padTo(bloomStops, MAX_BG_STOPS * 2),
      bloomStopCount: bloomStops.length,
      beamMask: padTo(beamMask, MAX_MASK_STOPS * 2),
      beamMaskCount: beamMask.length,
      smallMask: padTo(smallMask, MAX_MASK_STOPS * 2),
      smallMaskCount: smallMask.length,
      shadow: [shadow.r, shadow.g, shadow.b, shadow.a],
      shadowBlur: size === 'sm' ? rotate.innerShadowBlur.sm : rotate.innerShadowBlur.md,
      emptyBlobs: padTo([], MAX_BLOBS * 8),
      emptyStops: padTo([], MAX_BG_STOPS * 2),
      emptyMask: padTo([], MAX_MASK_STOPS * 2),
    };
  }, [size, variant, theme, colors.innerShadow, rotate]);

  const hueShiftPeriod = beamSpec.defaults.rotateHueShiftPeriod;

  // Per-frame values, computed on the UI thread.
  const angle = useDerivedValue(() => {
    'worklet';
    return ((clock.value / 1000) / duration) % 1;
  }, [duration]);

  const filterMatrix = useDerivedValue(() => {
    'worklet';
    // Web parity: with staticColors the CSS stroke/inner layers have NO filter
    // at all — brightness/saturate exist only inside the hue-shift keyframes.
    if (staticColors) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const t = clock.value / 1000;
    const hue = -hueRange + 2 * hueRange * pingPong(t / hueShiftPeriod);
    return composedFilterMatrix(hue, brightness, saturation);
  }, [staticColors, hueRange, brightness, saturation, hueShiftPeriod]);

  // Bloom filter has no hue-rotate on the web (static brightness/saturate).
  const bloomMatrix = useMemo(
    () => composedFilterMatrix(0, brightness, saturation),
    [brightness, saturation]
  );

  const baseLayer = useMemo(
    () => ({
      uSize: [width, height],
      uRadius: borderRadius,
      uBorderWidth: preset.borderWidth,
    }),
    [width, height, borderRadius, preset.borderWidth]
  );

  const s = staticUniforms;

  const innerUniforms = useDerivedValue(() => {
    'worklet';
    return {
      ...baseLayer,
      uAngle: angle.value,
      uKind: 1,
      uEdgeMaskPx: size === 'md' ? rotate.innerEdgeMaskPx : 0,
      uBlobs: s.innerBlobs,
      uBlobCount: s.innerBlobCount,
      uBg: s.emptyStops,
      uBgCount: 0,
      uBgIsBlack: 0,
      uMask: size === 'sm' ? s.smallMask : s.beamMask,
      uMaskCount: size === 'sm' ? s.smallMaskCount : s.beamMaskCount,
      uCM: filterMatrix.value,
      uOpacity: fade.value * strength * monoMul * colors.innerOpacity,
      uShadowColor: s.shadow,
      uShadowBlur: s.shadowBlur,
    };
  }, [baseLayer, size, s, strength, monoMul, colors.innerOpacity]);

  const strokeUniforms = useDerivedValue(() => {
    'worklet';
    return {
      ...baseLayer,
      uAngle: angle.value,
      uKind: 0,
      uEdgeMaskPx: 0,
      uBlobs: s.strokeBlobs,
      uBlobCount: s.strokeBlobCount,
      uBg: s.whiteStops,
      uBgCount: s.whiteStopCount,
      uBgIsBlack: isDark ? 0 : 1,
      uMask: s.beamMask,
      uMaskCount: s.beamMaskCount,
      uCM: filterMatrix.value,
      uOpacity: fade.value * strength * monoMul * colors.strokeOpacity,
      uShadowColor: [0, 0, 0, 0],
      uShadowBlur: 0,
    };
  }, [baseLayer, s, isDark, strength, monoMul, colors.strokeOpacity]);

  const bloomUniforms = useDerivedValue(() => {
    'worklet';
    return {
      ...baseLayer,
      uAngle: angle.value,
      uKind: 2,
      uEdgeMaskPx: 0,
      uBlobs: s.emptyBlobs,
      uBlobCount: 0,
      uBg: s.bloomStops,
      uBgCount: s.bloomStopCount,
      uBgIsBlack: isDark ? 0 : 1,
      uMask: s.emptyMask,
      uMaskCount: 0,
      uCM: bloomMatrix,
      uOpacity: fade.value * strength * monoMul * colors.bloomOpacity,
      uShadowColor: [0, 0, 0, 0],
      uShadowBlur: 0,
    };
  }, [baseLayer, s, isDark, strength, monoMul, colors.bloomOpacity, bloomMatrix]);

  if (width <= 0 || height <= 0) return null;

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Inner glow (z1) */}
      <Fill>
        <Shader source={rotateEffect} uniforms={innerUniforms} />
      </Fill>
      {/* Stroke ring (z2) */}
      <Fill>
        <Shader source={rotateEffect} uniforms={strokeUniforms} />
      </Fill>
      {/* Bloom ring (z3) — CSS blur(8px) is a Gaussian with stdDev 8, which is
          what Skia's Blur sigma expects, so the value maps 1:1. */}
      <Group
        layer={
          <Paint>
            <Blur blur={rotate.bloomBlurPx} />
          </Paint>
        }
      >
        <Fill>
          <Shader source={rotateEffect} uniforms={bloomUniforms} />
        </Fill>
      </Group>
    </Canvas>
  );
}

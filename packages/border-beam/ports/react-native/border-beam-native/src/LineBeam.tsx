import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Shader, Skia, Blur, Group, Paint } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { beamSpec, parseCssColor, sizePreset, themePreset } from './spec';
import { composedFilterMatrix } from './colorMatrix';
import {
  BLOB_LAYER_SKSL,
  BLOB_FLOATS,
  MAX_LAYER_BLOBS,
  NO_RADIAL,
  simpleBlob,
  stopsBlob,
} from './blobShader';
import { padTo } from './rotateShader';
import { lineFrameValues, multValue, pingPongWorklet, type LineKeyframeTables } from './lineDriver';
import type { BorderBeamColorVariant } from './types';

function makeBlobEffect() {
  const effect = Skia.RuntimeEffect.Make(BLOB_LAYER_SKSL);
  if (!effect) {
    throw new Error('border-beam-native: failed to compile blob SkSL effect');
  }
  return effect;
}

export const blobEffect = makeBlobEffect();

interface LineBlobDef {
  color: { r: number; g: number; b: number; a: number };
  sizeW: number;
  sizeH: number;
  offsetX: number;
  offsetY: number;
}

interface BloomGradientDef {
  xPct: number | null;
  yOffPx: number;
  w: { base: number; mult: string };
  h: { base: number; mult: string };
  stops: { r: number; g: number; b: number; a: number; pos: number }[];
}

export interface LineBeamProps {
  variant: BorderBeamColorVariant;
  theme: 'dark' | 'light';
  staticColors: boolean;
  duration: number;
  borderRadius: number;
  brightness: number;
  saturation: number;
  hueRange: number; // already capped at 13 by BorderBeam
  strength: number;
  width: number;
  height: number;
  clock: SharedValue<number>;
  fade: SharedValue<number>;
}

/**
 * The `line` family: bottom traveling glow with breathe and spike animations.
 * Layers mirror the web z-order: inner (1), stroke band (2), bloom (3).
 */
export function LineBeam({
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
}: LineBeamProps) {
  const spec = beamSpec;
  const preset = sizePreset('line');
  const colors = themePreset('line', theme);
  const isDark = theme === 'dark';

  const tables = spec.line.keyframes as unknown as LineKeyframeTables;

  const staticData = useMemo(() => {
    const linePalette = (spec.palettes.line as Record<string, Record<string, Omit<LineBlobDef, 'color'>[] & { color?: string }[]>>)[
      variant
    ][theme] as unknown as { color: string; sizeW: number; sizeH: number; offsetX: number; offsetY: number }[];
    const innerPalette = (spec.palettes.lineInner as Record<string, { color: string; sizeW: number; sizeH: number; offsetX: number; offsetY: number }[]>)[
      variant
    ];
    const bloom = (spec.line.bloomGradients as unknown as Record<string, Record<string, BloomGradientDef[]>>)[
      variant
    ][theme];

    const parse = (arr: { color: string; sizeW: number; sizeH: number; offsetX: number; offsetY: number }[]): LineBlobDef[] =>
      arr.map(e => ({
        color: parseCssColor(e.color) ?? { r: 1, g: 1, b: 1, a: 1 },
        sizeW: e.sizeW,
        sizeH: e.sizeH,
        offsetX: e.offsetX,
        offsetY: e.offsetY,
      }));

    const wh = (spec.line.whiteHighlight as Record<string, { w: number; h: number; yOffset: number; stops: number[][]; onBlack?: boolean }>)[
      theme
    ];

    return {
      strokeBlobDefs: parse(linePalette),
      innerBlobDefs: parse(innerPalette),
      bloomDefs: bloom,
      whiteHighlight: wh,
      shadow: parseCssColor(colors.innerShadow) ?? { r: 0, g: 0, b: 0, a: 0 },
    };
  }, [spec, variant, theme, colors.innerShadow]);

  const mask = spec.line.beamMaskEllipse as { w: number; h: number; softStop: number[] };
  const bloomMask = spec.line.bloomMaskEllipse as { w: number; h: number; softStop: number[] };
  const hueShiftPeriod = spec.defaults.rotateHueShiftPeriod;
  const bloomHuePeriod = spec.defaults.lineBloomHueShiftPeriod;
  const bloomHueBonus = spec.defaults.lineBloomHueRangeBonus;

  const s = staticData;

  // ── Per-frame uniforms (UI thread) ──

  const base = useMemo(
    () => ({
      uSize: [width, height],
      uRectOrigin: [0, 0],
      uRectSize: [width, height],
      uRadius: borderRadius,
      uBorderWidth: preset.borderWidth,
    }),
    [width, height, borderRadius, preset.borderWidth]
  );

  const strokeUniforms = useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000;
    const v = lineFrameValues(tables, t, duration);
    // Web parity: staticColors ⇒ no filter on the line layers at all.
    const cm = staticColors
      ? [1, 0, 0, 0, 1, 0, 0, 0, 1]
      : composedFilterMatrix(
          -hueRange + 2 * hueRange * pingPongWorklet(t / hueShiftPeriod),
          brightness,
          saturation
        );
    const bx = v.x * width;

    const blobs: number[] = [];
    // White traveling highlight is the FIRST background (on top).
    const wh = s.whiteHighlight;
    const whColor = wh.onBlack ? 0 : 1;
    blobs.push(
      ...stopsBlob(
        wh.w * v.w,
        wh.h * v.h,
        bx,
        height + wh.yOffset,
        wh.stops.map(([pos, a]) => ({
          r: whColor * 255, g: whColor * 255, b: whColor * 255, a, pos: pos / 100,
        }))
      )
    );
    for (const e of s.strokeBlobDefs) {
      blobs.push(
        ...simpleBlob(
          e.sizeW * v.w, e.sizeH * v.h,
          bx + e.offsetX, height + e.offsetY,
          e.color.r, e.color.g, e.color.b, e.color.a
        )
      );
    }

    return {
      ...base,
      uGeomKind: 0,
      uEdgeMaskPx: 0,
      uRadial: [bx, height, mask.w * v.w, mask.h * v.h, mask.softStop[0] / 100, mask.softStop[1], 1],
      uBlobs: padTo(blobs, MAX_LAYER_BLOBS * BLOB_FLOATS),
      uBlobCount: blobs.length / BLOB_FLOATS,
      uCM: cm,
      uOpacity: fade.value * v.edge * strength * colors.strokeOpacity,
    };
  }, [base, s, tables, duration, staticColors, hueRange, brightness, saturation, strength, colors.strokeOpacity, width, height]);

  const innerUniforms = useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000;
    const v = lineFrameValues(tables, t, duration);
    // Web parity: staticColors ⇒ no filter on the line layers at all.
    const cm = staticColors
      ? [1, 0, 0, 0, 1, 0, 0, 0, 1]
      : composedFilterMatrix(
          -hueRange + 2 * hueRange * pingPongWorklet(t / hueShiftPeriod),
          brightness,
          saturation
        );
    const bx = v.x * width;

    const blobs: number[] = [];
    for (const e of s.innerBlobDefs) {
      blobs.push(
        ...simpleBlob(
          e.sizeW * v.w, e.sizeH * v.h,
          bx + e.offsetX, height - Math.abs(e.offsetY),
          e.color.r, e.color.g, e.color.b, e.color.a
        )
      );
    }

    return {
      ...base,
      uGeomKind: 1,
      uEdgeMaskPx: beamSpec.rotate.innerEdgeMaskPx,
      uRadial: [bx, height, mask.w * v.w, mask.h * v.h, mask.softStop[0] / 100, mask.softStop[1], 1],
      uBlobs: padTo(blobs, MAX_LAYER_BLOBS * BLOB_FLOATS),
      uBlobCount: blobs.length / BLOB_FLOATS,
      uCM: cm,
      uOpacity: fade.value * v.edge * strength * colors.innerOpacity,
    };
  }, [base, s, tables, duration, staticColors, hueRange, brightness, saturation, strength, colors.innerOpacity, width, height]);

  const bloomUniforms = useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000;
    const v = lineFrameValues(tables, t, duration);
    // Bloom hue swings ±(hueRange+10) over 8 s on the web; staticColors ⇒ no
    // filter (mono keeps only its 6px blur, applied at the layer level).
    const cm = staticColors
      ? [1, 0, 0, 0, 1, 0, 0, 0, 1]
      : composedFilterMatrix(
          -(hueRange + bloomHueBonus) + 2 * (hueRange + bloomHueBonus) * pingPongWorklet(t / bloomHuePeriod),
          brightness,
          saturation
        );
    const bx = v.x * width;

    const blobs: number[] = [];
    for (const g of s.bloomDefs) {
      const cx = g.xPct != null ? (g.xPct / 100) * width : bx;
      blobs.push(
        ...stopsBlob(
          g.w.base * multValue(g.w.mult, v),
          g.h.base * multValue(g.h.mult, v),
          cx,
          height + g.yOffPx,
          g.stops
        )
      );
    }

    return {
      ...base,
      uGeomKind: 1,
      uEdgeMaskPx: 0,
      uRadial: [bx, height, bloomMask.w * v.w, bloomMask.h * v.h, bloomMask.softStop[0] / 100, bloomMask.softStop[1], 1],
      uBlobs: padTo(blobs, MAX_LAYER_BLOBS * BLOB_FLOATS),
      uBlobCount: blobs.length / BLOB_FLOATS,
      uCM: cm,
      uOpacity: fade.value * v.edge * strength * colors.bloomOpacity,
    };
  }, [base, s, tables, duration, staticColors, hueRange, brightness, saturation, strength, colors.bloomOpacity, width, height]);

  // Web parity: the animated bloom filter includes blur(8px); mono-with-static
  // colors gets a base blur(6px); colorful static colors gets no blur.
  const bloomBlur = staticColors
    ? variant === 'mono'
      ? (spec.line.monoBloomExtraBlurPx as number)
      : 0
    : (spec.line.bloomBlurPx as number);

  if (width <= 0 || height <= 0) return null;

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Inner glow (z1) */}
      <Fill>
        <Shader source={blobEffect} uniforms={innerUniforms} />
      </Fill>
      {/* Stroke band (z2) */}
      <Fill>
        <Shader source={blobEffect} uniforms={strokeUniforms} />
      </Fill>
      {/* Bloom (z3) */}
      {bloomBlur > 0 ? (
        <Group
          layer={
            <Paint>
              <Blur blur={bloomBlur} />
            </Paint>
          }
        >
          <Fill>
            <Shader source={blobEffect} uniforms={bloomUniforms} />
          </Fill>
        </Group>
      ) : (
        <Fill>
          <Shader source={blobEffect} uniforms={bloomUniforms} />
        </Fill>
      )}
    </Canvas>
  );
}

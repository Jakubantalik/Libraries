import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Shader, Blur, Group, Paint } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  beamSpec,
  borderPalette,
  parseCssColor,
  parsePercentPair,
  parsePixelPair,
  sizePreset,
  themePreset,
  type Oscillator,
} from './spec';
import { composedFilterMatrix } from './colorMatrix';
import { BLOB_FLOATS, MAX_LAYER_BLOBS, NO_RADIAL } from './blobShader';
import { padTo } from './rotateShader';
import { blobEffect } from './LineBeam';
import { oscillatorValue, pulseHueDegrees } from './pulseDriver';
import type { BorderBeamColorVariant } from './types';
import { NO_TUNING, type ResolvedTuning } from './tuning';

interface PulseTableEntry {
  ci: number;
  region: number;
  quad: string;
  w: number;
  h: number;
  x?: string;
  y?: string;
}

/** Static description of one pulse blob, resolved per-frame with oscillators. */
interface PulseBlobDef {
  region: number; // 1-3 size/drift region; 0 = static (corner accents)
  quad: string;   // opacity quadrant
  w: number;      // base radius x (reference geometry px)
  h: number;
  xFrac: number;  // position, fraction of the layer box
  yFrac: number;
  r: number; g: number; b: number; // 0..1
  a: number;      // base alpha (corners); ring/table blobs use the quad opacity
  fadeEnd: number;
}

const DEFAULT_PULSE_DURATION = 2.3;

function defsFromRing(variant: BorderBeamColorVariant): PulseBlobDef[] {
  const ringMap = beamSpec.pulse.ringMap as { region: number; quad: string }[];
  return borderPalette(variant).map((blob, i) => {
    const c = parseCssColor(blob.color) ?? { r: 1, g: 1, b: 1, a: 1 };
    const pos = parsePercentPair(blob.pos);
    const size = parsePixelPair(blob.size);
    return {
      region: ringMap[i].region,
      quad: ringMap[i].quad,
      w: size.w,
      h: size.h,
      xFrac: pos.x,
      yFrac: pos.y,
      r: c.r, g: c.g, b: c.b, a: c.a,
      fadeEnd: 1,
    };
  });
}

function defsFromTable(variant: BorderBeamColorVariant, table: PulseTableEntry[]): PulseBlobDef[] {
  const palette = borderPalette(variant);
  return table.map(e => {
    const src = palette[e.ci];
    const c = parseCssColor(src.color) ?? { r: 1, g: 1, b: 1, a: 1 };
    const srcPos = parsePercentPair(src.pos);
    return {
      region: e.region,
      quad: e.quad,
      w: e.w,
      h: e.h,
      xFrac: e.x != null ? parseFloat(e.x) / 100 : srcPos.x,
      yFrac: e.y != null ? parseFloat(e.y) / 100 : srcPos.y,
      r: c.r, g: c.g, b: c.b, a: c.a,
      fadeEnd: 1,
    };
  });
}

/** pulse-inner ::before: ring gradients at reduced sizes + 4 corner accents. */
function innerLayerDefs(variant: BorderBeamColorVariant, isDark: boolean): PulseBlobDef[] {
  const innerSizes = beamSpec.pulse.innerSizes as number[][];
  const ring = defsFromRing(variant).map((d, i) => ({
    ...d,
    w: innerSizes[i][0],
    h: innerSizes[i][1],
  }));
  const accent = beamSpec.pulse.innerCornerAccent as {
    sizePx: number;
    alpha: { dark: number; light: number };
    fadeStop: number;
  };
  const cornerColor = isDark ? 1 : 0;
  const cornerAlpha = isDark ? accent.alpha.dark : accent.alpha.light;
  const corners: [number, number, string][] = [
    [0, 0, 'tl'], [1, 0, 'tr'], [0, 1, 'bl'], [1, 1, 'br'],
  ];
  const cornerDefs: PulseBlobDef[] = corners.map(([x, y, quad]) => ({
    region: 0,
    quad,
    w: accent.sizePx,
    h: accent.sizePx,
    xFrac: x,
    yFrac: y,
    r: cornerColor, g: cornerColor, b: cornerColor,
    a: cornerAlpha,
    fadeEnd: accent.fadeStop / 100,
  }));
  return [...ring, ...cornerDefs];
}

/** Geometry of one layer's box within the canvas. */
interface LayerBox {
  originX: number;
  originY: number;
  w: number;
  h: number;
  radius: number;
  geomKind: number; // 0 ring band, 1 fill, 2 none
  borderWidth: number;
  edgeMaskPx: number;
}

export interface PulseBeamProps {
  size: 'pulse-inner' | 'pulse-outside';
  variant: BorderBeamColorVariant;
  theme: 'dark' | 'light';
  staticColors: boolean;
  duration: number;
  borderRadius: number;
  brightness: number;
  saturation: number;
  strength: number;
  width: number;
  height: number;
  clock: SharedValue<number>;
  fade: SharedValue<number>;
  reduceMotion: boolean;
  tuning?: ResolvedTuning;
}

/**
 * Pulse family — breathing glow, no rotation.
 *
 * `pulse-inner`: everything clipped inside the element (one overlay canvas).
 * `pulse-outside`: core + bloom bloom OUTWARD behind the element (a canvas
 * extended `bloomInsetPx` on each side at zIndex -1 — the wrapped child must
 * be opaque, same requirement as the web version), plus a 1px stroke ring
 * overlay above the content.
 */
export function PulseBeam(props: PulseBeamProps) {
  const { size, variant, theme, width, height } = props;
  const isOutside = size === 'pulse-outside';
  const isDark = theme === 'dark';
  const spec = beamSpec;
  const preset = sizePreset(size);

  const oc = spec.pulse.outsideConstants as {
    glowScale: { x: number; y: number };
    glowBlurPx: { dark: number; light: number };
    bloomBlurPx: { dark: number; light: number };
    coreInsetPx: number;
    bloomInsetPx: number;
    referenceSize: { w: number; h: number };
    scaleClamp: { min: number; max: number };
  };

  const tuning = props.tuning ?? NO_TUNING;
  // The web clamps the *measured* ratio and applies --pulse-glow-boost on top,
  // so the boost is deliberately outside the clamp.
  const clampScale = (v: number) => Math.min(oc.scaleClamp.max, Math.max(oc.scaleClamp.min, v));
  const glowSx = isOutside ? clampScale(width / oc.referenceSize.w) * tuning.glowBoost : 1;
  const glowSy = isOutside ? clampScale(height / oc.referenceSize.h) * tuning.glowBoost : 1;

  const pad = isOutside ? oc.bloomInsetPx : 0;
  const canvasW = width + pad * 2;
  const canvasH = height + pad * 2;

  const defs = useMemo(
    () => ({
      stroke: isOutside
        ? defsFromTable(variant, spec.pulse.outerCore as PulseTableEntry[])
        : defsFromRing(variant),
      inner: isOutside
        ? defsFromTable(variant, spec.pulse.outerCore as PulseTableEntry[])
        : innerLayerDefs(variant, isDark),
      bloom: defsFromTable(
        variant,
        (isOutside ? spec.pulse.outerBloom : spec.pulse.innerBloom) as PulseTableEntry[]
      ),
    }),
    [spec, variant, isOutside, isDark]
  );

  const boxes: Record<'stroke' | 'inner' | 'bloom', LayerBox> = {
    // ::after — 1px ring band on the element edge.
    stroke: {
      originX: pad, originY: pad, w: width, h: height,
      radius: props.borderRadius, geomKind: 0,
      borderWidth: isOutside ? 1 : preset.borderWidth,
      edgeMaskPx: 0,
    },
    // ::before — element box (inner) or the +10px core box (outside).
    inner: isOutside
      ? {
          originX: pad - oc.coreInsetPx, originY: pad - oc.coreInsetPx,
          w: width + oc.coreInsetPx * 2, h: height + oc.coreInsetPx * 2,
          radius: props.borderRadius + oc.coreInsetPx, geomKind: 1,
          borderWidth: 1, edgeMaskPx: 0,
        }
      : {
          originX: 0, originY: 0, w: width, h: height,
          radius: props.borderRadius, geomKind: 1,
          borderWidth: preset.borderWidth,
          edgeMaskPx: spec.rotate.innerEdgeMaskPx,
        },
    // bloom — +30px box fill (outside) or 1px ring band (inner).
    bloom: isOutside
      ? {
          originX: 0, originY: 0, w: canvasW, h: canvasH,
          radius: props.borderRadius + oc.bloomInsetPx, geomKind: 1,
          borderWidth: 1, edgeMaskPx: 0,
        }
      : {
          originX: 0, originY: 0, w: width, h: height,
          radius: props.borderRadius, geomKind: 0,
          borderWidth: preset.borderWidth, edgeMaskPx: 0,
        },
  };

  const uniforms = usePulseUniforms(props, defs, boxes, { glowSx, glowSy, canvasW, canvasH }, tuning);

  const glowBlur =
    tuning.coreBlur ?? (isOutside ? (isDark ? oc.glowBlurPx.dark : oc.glowBlurPx.light) : 0);
  const bloomBlur =
    tuning.bloomBlur ??
    (isOutside
      ? isDark
        ? oc.bloomBlurPx.dark
        : oc.bloomBlurPx.light
      : (spec.pulse.innerBloomBlurPx as number));

  // pulse-outside core/bloom carry `transform: scale(0.95, 0.9)` about center.
  const glowTransform = [
    { translateX: canvasW / 2 },
    { translateY: canvasH / 2 },
    { scaleX: oc.glowScale.x },
    { scaleY: oc.glowScale.y },
    { translateX: -canvasW / 2 },
    { translateY: -canvasH / 2 },
  ];

  if (width <= 0 || height <= 0) return null;

  if (!isOutside) {
    return (
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={blobEffect} uniforms={uniforms.inner} />
        </Fill>
        <Fill>
          <Shader source={blobEffect} uniforms={uniforms.stroke} />
        </Fill>
        <Group layer={<Paint><Blur blur={bloomBlur} /></Paint>}>
          <Fill>
            <Shader source={blobEffect} uniforms={uniforms.bloom} />
          </Fill>
        </Group>
      </Canvas>
    );
  }

  return (
    <>
      {/* Glow behind the content (web z-index -1). Child must be opaque. */}
      <Canvas
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -pad,
          top: -pad,
          width: canvasW,
          height: canvasH,
          zIndex: -1,
        }}
      >
        <Group transform={glowTransform} layer={<Paint><Blur blur={bloomBlur} /></Paint>}>
          <Fill>
            <Shader source={blobEffect} uniforms={uniforms.bloom} />
          </Fill>
        </Group>
        <Group transform={glowTransform} layer={<Paint><Blur blur={glowBlur} /></Paint>}>
          <Fill>
            <Shader source={blobEffect} uniforms={uniforms.inner} />
          </Fill>
        </Group>
      </Canvas>
      {/* 1px stroke ring above the content. */}
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={blobEffect} uniforms={uniforms.stroke} />
        </Fill>
      </Canvas>
    </>
  );
}

// ── Per-frame uniform derivation ─────────────────────────────────────────────

function usePulseUniforms(
  props: PulseBeamProps,
  defs: { stroke: PulseBlobDef[]; inner: PulseBlobDef[]; bloom: PulseBlobDef[] },
  boxes: Record<'stroke' | 'inner' | 'bloom', LayerBox>,
  geo: { glowSx: number; glowSy: number; canvasW: number; canvasH: number },
  tuning: ResolvedTuning
) {
  const {
    size, variant, theme, staticColors, duration,
    brightness, saturation, strength, clock, fade, reduceMotion,
  } = props;
  const spec = beamSpec;
  const isOutside = size === 'pulse-outside';
  const colors = themePreset(size, theme);
  const monoMul = variant === 'mono' ? spec.defaults.monoOpacityMultiplier : 1;

  const section = (isOutside ? spec.pulse.outside : spec.pulse.inner) as Record<
    string,
    { oscillators: Oscillator[]; frozenBloomAlpha: number }
  >;
  const themeSection = section[theme];
  const oscillators = themeSection.oscillators;
  const durationScale = duration / DEFAULT_PULSE_DURATION;
  const huePeriod = (spec.pulse.huePeriod as Record<string, number>)[size];
  const sx = isOutside ? geo.glowSx : 1;
  const sy = isOutside ? geo.glowSy : 1;

  const makeLayer = (
    layerDefs: PulseBlobDef[],
    box: LayerBox,
    layerOpacity: number,
    frozenAlpha: number | null,
    opacityMul: number,
    isGlowLayer: boolean
  ) =>
    useDerivedValue(() => {
      'worklet';
      const t = reduceMotion ? 0 : clock.value / 1000;
      const osc: Record<string, number> = {};
      for (let i = 0; i < oscillators.length; i++) {
        osc[oscillators[i].prop] = reduceMotion
          ? oscillators[i].a
          : oscillatorValue(oscillators[i], t, durationScale);
      }
      const hue = staticColors || reduceMotion ? 0 : pulseHueDegrees(t, huePeriod);
      // Glow layers take their own brightness/saturate overrides but keep the
      // shared hue rotation, so halo and ring stay color-synced.
      const cm = composedFilterMatrix(
        hue,
        isGlowLayer && tuning.glowBrightness != null ? tuning.glowBrightness : brightness,
        isGlowLayer && tuning.glowSaturate != null ? tuning.glowSaturate : saturation
      );

      const blobs: number[] = [];
      for (const d of layerDefs) {
        let rx: number;
        let ry: number;
        let cx: number;
        let cy: number;
        let alpha: number;
        if (frozenAlpha != null) {
          // Frozen bloom: literal geometry, time-averaged alpha (web parity —
          // the blurred bloom bitmap never re-rasterizes per frame).
          rx = d.w * sx;
          ry = d.h * sy;
          cx = box.originX + d.xFrac * box.w;
          cy = box.originY + d.yFrac * box.h;
          alpha = frozenAlpha;
        } else {
          const bw = d.region > 0 ? osc[`bw${d.region}`] ?? 1 : 1;
          const bh = d.region > 0 ? (osc[`bh${d.region}`] ?? 1) * (osc.bgh ?? 1) : 1;
          const dx = d.region > 0 ? osc[`bx${d.region}`] ?? 0 : 0;
          const dy = d.region > 0 ? osc[`by${d.region}`] ?? 0 : 0;
          const bop = osc[`bop-${d.quad}`] ?? 1;
          // Ring/table blobs replace their alpha with the quadrant opacity
          // (web withAlphaVar); static corner accents multiply their base.
          alpha = d.region === 0 ? d.a * bop : bop;
          rx = d.w * bw * sx;
          ry = d.h * bh * sy;
          cx = box.originX + d.xFrac * box.w + dx;
          cy = box.originY + d.yFrac * box.h + dy;
        }
        const end = d.fadeEnd;
        blobs.push(
          rx, ry, cx, cy, d.r, d.g, d.b, alpha,
          end / 3, alpha * (2 / 3), (2 * end) / 3, alpha / 3, end, 0
        );
      }

      return {
        uSize: [geo.canvasW, geo.canvasH],
        uRectOrigin: [box.originX, box.originY],
        uRectSize: [box.w, box.h],
        uRadius: box.radius,
        uBorderWidth: box.borderWidth,
        uGeomKind: box.geomKind,
        uEdgeMaskPx: box.edgeMaskPx,
        uRadial: NO_RADIAL,
        uBlobs: padTo(blobs, MAX_LAYER_BLOBS * BLOB_FLOATS),
        uBlobCount: blobs.length / BLOB_FLOATS,
        uCM: cm,
        uOpacity: fade.value * strength * monoMul * layerOpacity * opacityMul,
      };
    }, [layerDefs, box, oscillators, durationScale, staticColors, reduceMotion, brightness, saturation, strength, monoMul, layerOpacity, frozenAlpha, sx, sy, geo]);

  // On pulse-outside the inner/bloom layers are the outward glow; on
  // pulse-inner they are contained and keep the base filter.
  return {
    stroke: makeLayer(defs.stroke, boxes.stroke, colors.strokeOpacity, null, tuning.strokeOpacity, false),
    inner: makeLayer(defs.inner, boxes.inner, colors.innerOpacity, null, tuning.innerOpacity, isOutside),
    bloom: makeLayer(
      defs.bloom, boxes.bloom, colors.bloomOpacity,
      themeSection.frozenBloomAlpha, tuning.bloomOpacity, isOutside
    ),
  };
}

// transitions.dev "Shimmer text" (15-shimmer-text.md) translated to Skia,
// plus the "Texts reveal" (18) treatment as OPTIONAL reveal props.
//
// Why the reveal lives here and not in an animated View style: RN's
// `filter: [{blur}]` on a transparent View rasterises it against an opaque
// backdrop — the lines rendered inside solid white boxes on device. Skia
// blurs the GLYPHS themselves (a layer paint with an ImageFilter), so the
// texts-reveal cross-blur works with no backdrop at all. CSS blur(4px) is a
// Gaussian with sigma = radius/2, so blurMax 4 runs sigma 0..2.

import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  Blur,
  Canvas,
  Group,
  LinearGradient,
  Paint,
  Text as SkText,
  matchFont,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const SHIMMER_DUR = 2000; // --shimmer-dur
const BAND = 4; // --shimmer-band: 400%

/** Texts-reveal drive, shared by ShimmerText and RevealLines. */
export interface Reveal {
  /** 0..1 progress for the whole text block */
  progress: SharedValue<number>;
  /** the window of `progress` this element reads (per-line stagger) */
  window: [number, number];
  /** --stagger-distance */
  rise: number;
  /** cross-blur in CSS px (sigma = px/2) */
  blurPx: number;
}

/**
 * Padding the reveal needs around the glyphs.
 *
 * A Skia canvas CLIPS: sized to the text, a 12px rise starts the glyphs
 * entirely below the canvas and the blur's spread is cut off at every edge,
 * so the reveal reads as a hard pop instead of a rise. The canvas is grown
 * by the rise plus the blur's reach and pulled back with negative margins,
 * so the resting layout position is unchanged.
 */
function revealPad(reveal: Reveal | undefined) {
  if (!reveal) return { x: 0, top: 0, bottom: 0 };
  const halo = Math.ceil(reveal.blurPx * 2);
  return { x: halo, top: halo, bottom: halo + Math.ceil(reveal.rise) };
}

function useRevealTransforms(reveal: Reveal | undefined, width: number) {
  const p = useDerivedValue(() => {
    if (!reveal) return 1;
    const [w0, w1] = reveal.window;
    return interpolate(reveal.progress.value, [w0, w1], [0, 1], 'clamp');
  });
  const transform = useDerivedValue(() => [
    { translateY: reveal ? (1 - p.value) * reveal.rise : 0 },
  ]);
  const opacity = useDerivedValue(() => p.value);
  const blur = useDerivedValue(() => (reveal ? ((1 - p.value) * reveal.blurPx) / 2 : 0));
  return { transform, opacity, blur, width };
}

function useAppFont(fontSize: number) {
  return useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
        fontSize,
      }),
    [fontSize]
  );
}

interface ShimmerProps {
  text: string;
  fontSize: number;
  /** --shimmer-base — demo dark theme: rgba(251,251,251,0.5) */
  color?: string;
  /** --shimmer-highlight — demo dark theme: #ffffff */
  highlight?: string;
  reveal?: Reveal;
}

export function ShimmerText({
  text,
  fontSize,
  color = 'rgba(251,251,251,0.5)',
  highlight = '#ffffff',
  reveal,
}: ShimmerProps) {
  const font = useAppFont(fontSize);
  const width = useMemo(() => font.measureText(text).width, [font, text]);
  const height = fontSize * 1.4;
  const baseline = fontSize * 1.1;
  const pad = revealPad(reveal);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    // the recipe's prefers-reduced-motion guard
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!reduced) {
        progress.value = withRepeat(
          withTiming(1, { duration: SHIMMER_DUR, easing: Easing.linear }),
          -1
        );
      }
    });
    return () => cancelAnimation(progress);
  }, [progress]);

  // background-position 100% -> 0% with background-size 400%: the gradient's
  // origin travels from -(band-1)*width to 0, exactly the demo's keyframes
  const padX = revealPad(reveal).x;
  const start = useDerivedValue(() => vec(padX - (BAND - 1) * width * (1 - progress.value), 0));
  const end = useDerivedValue(() => vec(start.value.x + width * BAND, 0));

  const r = useRevealTransforms(reveal, width);

  return (
    <Canvas
      style={{
        width: width + pad.x * 2,
        height: height + pad.top + pad.bottom,
        marginHorizontal: -pad.x,
        marginTop: -pad.top,
        marginBottom: -pad.bottom,
      }}
    >
      <Group
        transform={r.transform}
        opacity={r.opacity}
        layer={
          <Paint>
            <Blur blur={r.blur} />
          </Paint>
        }
      >
        <SkText x={pad.x} y={baseline + pad.top} text={text} font={font} color={color} />
        <SkText x={pad.x} y={baseline + pad.top} text={text} font={font}>
          <LinearGradient
            start={start}
            end={end}
            colors={['transparent', 'transparent', highlight, 'transparent', 'transparent']}
            positions={[0, 0.4, 0.5, 0.6, 1]}
          />
        </SkText>
      </Group>
    </Canvas>
  );
}

interface RevealLinesProps {
  /** pre-wrapped lines — Skia's plain Text does not wrap */
  lines: string[];
  fontSize: number;
  lineHeight: number;
  color: string;
  /** the canvas width; lines are centred within it */
  width: number;
  reveal?: Reveal;
}

/** Static multi-line text with the same texts-reveal treatment. */
export function RevealLines({ lines, fontSize, lineHeight, color, width, reveal }: RevealLinesProps) {
  const font = useAppFont(fontSize);
  const r = useRevealTransforms(reveal, width);
  const height = lineHeight * lines.length + fontSize * 0.4;
  const pad = revealPad(reveal);

  return (
    <Canvas
      style={{
        width: width + pad.x * 2,
        height: height + pad.top + pad.bottom,
        marginHorizontal: -pad.x,
        marginTop: -pad.top,
        marginBottom: -pad.bottom,
      }}
    >
      <Group
        transform={r.transform}
        opacity={r.opacity}
        layer={
          <Paint>
            <Blur blur={r.blur} />
          </Paint>
        }
      >
        {lines.map((line, i) => {
          const w = font.measureText(line).width;
          return (
            <SkText
              key={line}
              x={pad.x + (width - w) / 2}
              y={pad.top + fontSize * 1.05 + i * lineHeight}
              text={line}
              font={font}
              color={color}
            />
          );
        })}
      </Group>
    </Canvas>
  );
}

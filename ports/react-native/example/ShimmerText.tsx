// transitions.dev "Shimmer text" (15-shimmer-text.md), translated to
// React Native. The web recipe clips a moving gradient to the glyphs with
// background-clip: text; RN has no equivalent, but Skia can shade the
// glyphs themselves: base text in the muted colour, plus the same text
// painted with a transparent → highlight → transparent LinearGradient whose
// position a Reanimated clock sweeps. Timing kept verbatim from the
// recipe: 2000ms, linear, infinite; band 4x the text width.

import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { Canvas, Text as SkText, LinearGradient, matchFont, vec } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SHIMMER_DUR = 2000; // --shimmer-dur
const BAND = 4; // --shimmer-band: 400%

interface Props {
  text: string;
  fontSize: number;
  /** --shimmer-base — demo dark theme: rgba(251,251,251,0.5) */
  color?: string;
  /** --shimmer-highlight — demo dark theme: #ffffff */
  highlight?: string;
}

export function ShimmerText({
  text,
  fontSize,
  color = 'rgba(251,251,251,0.5)',
  highlight = '#ffffff',
}: Props) {
  const font = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
        fontSize,
      }),
    [fontSize]
  );

  const width = useMemo(() => font.measureText(text).width, [font, text]);
  // breathing room so antialiased glyph edges are not clipped
  const height = fontSize * 1.4;
  const baseline = fontSize * 1.1;

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
  // origin travels from -(band-1)*width to 0, exactly the demo's keyframes —
  // NOT a full ±band sweep, which crosses the text ~2.7x too fast
  const start = useDerivedValue(() => vec(-(BAND - 1) * width * (1 - progress.value), 0));
  const end = useDerivedValue(() => vec(start.value.x + width * BAND, 0));

  return (
    <Canvas style={{ width, height }}>
      <SkText x={0} y={baseline} text={text} font={font} color={color} />
      <SkText x={0} y={baseline} text={text} font={font}>
        <LinearGradient
          start={start}
          end={end}
          colors={['transparent', 'transparent', highlight, 'transparent', 'transparent']}
          positions={[0, 0.4, 0.5, 0.6, 1]}
        />
      </SkText>
    </Canvas>
  );
}

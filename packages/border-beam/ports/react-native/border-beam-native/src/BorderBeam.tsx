import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View, useColorScheme, type LayoutChangeEvent } from 'react-native';
import { useClock } from '@shopify/react-native-skia';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { beamSpec, sizePreset, themePreset } from './spec';
import { RotateBeam } from './RotateBeam';
import { LineBeam } from './LineBeam';
import { PulseBeam } from './PulseBeam';
import type { BorderBeamProps } from './types';
import { resolveTuning } from './tuning';

// CSS `ease` timing curve (web fade-in/out parity).
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * BorderBeam — animated border beam effect for React Native (Skia).
 *
 * ```tsx
 * <BorderBeam size="md" colorVariant="ocean" borderRadius={16}>
 *   <Card />
 * </BorderBeam>
 * ```
 */
export function BorderBeam({
  children,
  size = 'md',
  colorVariant = 'colorful',
  theme = 'dark',
  staticColors = false,
  duration,
  active = true,
  borderRadius,
  brightness,
  saturation,
  hueRange = 30,
  strength = 1,
  tuning,
  style,
  onActivate,
  onDeactivate,
}: BorderBeamProps) {
  const systemScheme = useColorScheme();
  const resolvedTheme: 'dark' | 'light' =
    theme === 'auto' ? (systemScheme === 'light' ? 'light' : 'dark') : theme;

  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [mounted, setMounted] = useState(active);
  const [reduceMotion, setReduceMotion] = useState(false);
  const fade = useSharedValue(0);
  const clock = useClock();
  const prevActive = useRef<boolean | null>(null);

  // Web parity: only the pulse family honors prefers-reduced-motion.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (alive) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // Fade in/out with completion callbacks (web: 0.6 s in / 0.5 s out, ease).
  useEffect(() => {
    if (prevActive.current === active) return;
    prevActive.current = active;

    if (active) {
      setMounted(true);
      fade.value = withTiming(
        1,
        { duration: beamSpec.defaults.fadeInSeconds * 1000, easing: CSS_EASE },
        finished => {
          'worklet';
          if (finished && onActivate) runOnJS(onActivate)();
        }
      );
    } else {
      const unmount = () => {
        setMounted(false);
        onDeactivate?.();
      };
      fade.value = withTiming(
        0,
        { duration: beamSpec.defaults.fadeOutSeconds * 1000, easing: CSS_EASE },
        finished => {
          'worklet';
          if (finished) runOnJS(unmount)();
        }
      );
    }
  }, [active, fade, onActivate, onDeactivate]);

  const preset = sizePreset(size);
  const colors = themePreset(size, resolvedTheme);
  const isPulse = size === 'pulse-inner' || size === 'pulse-outside';
  const finalRadius = borderRadius ?? preset.borderRadius;
  const finalDuration =
    duration ??
    (size === 'line'
      ? beamSpec.defaults.duration.line
      : isPulse
        ? beamSpec.defaults.duration.pulse
        : beamSpec.defaults.duration.rotate);
  const finalBrightness = brightness ?? colors.brightness ?? beamSpec.defaults.brightnessFallback;
  const finalSaturation = saturation ?? colors.saturation;
  const finalStatic = colorVariant === 'mono' ? true : staticColors;
  const clampedStrength = Math.max(0, Math.min(1, strength));
  const resolvedTuning = useMemo(() => resolveTuning(tuning), [tuning]);
  // The line family caps the hue range at 13° (web parity).
  const finalHueRange = size === 'line' ? Math.min(hueRange, beamSpec.defaults.lineHueRangeCap) : hueRange;

  const hasSize = layout.width > 0 && layout.height > 0;

  return (
    <View style={style} onLayout={handleLayout}>
      {children}
      {mounted && hasSize && (size === 'sm' || size === 'md') && (
        <RotateBeam
          size={size}
          variant={colorVariant}
          theme={resolvedTheme}
          staticColors={finalStatic}
          duration={finalDuration}
          borderRadius={finalRadius}
          brightness={finalBrightness}
          saturation={finalSaturation}
          hueRange={finalHueRange}
          strength={clampedStrength}
          width={layout.width}
          height={layout.height}
          clock={clock}
          fade={fade}
        />
      )}
      {mounted && hasSize && size === 'line' && (
        <LineBeam
          variant={colorVariant}
          theme={resolvedTheme}
          staticColors={finalStatic}
          duration={finalDuration}
          borderRadius={finalRadius}
          brightness={finalBrightness}
          saturation={finalSaturation}
          hueRange={finalHueRange}
          strength={clampedStrength}
          width={layout.width}
          height={layout.height}
          clock={clock}
          fade={fade}
        />
      )}
      {mounted && hasSize && isPulse && (
        <PulseBeam
          size={size as 'pulse-inner' | 'pulse-outside'}
          variant={colorVariant}
          theme={resolvedTheme}
          staticColors={finalStatic}
          duration={finalDuration}
          borderRadius={finalRadius}
          brightness={finalBrightness}
          saturation={finalSaturation}
          strength={clampedStrength}
          width={layout.width}
          height={layout.height}
          clock={clock}
          fade={fade}
          reduceMotion={reduceMotion}
          tuning={resolvedTuning}
        />
      )}
    </View>
  );
}

export default BorderBeam;

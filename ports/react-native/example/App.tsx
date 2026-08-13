// Logram-style agent status pill, implemented from the Figma reference
// (Logram-.App, node 2584:83673).
//
// One component, three behaviours:
//   - resting: a glass pill bottom-centre — orb + "Thinking...." label
//   - swipe horizontally: pages through the nine orb states, each with its
//     own verb, in a new copy of the same pill
//   - tap: the pill MORPHS into the modal sheet (same glass, 354x366,
//     r42.5) — big orb, title, subtitle, close button. Tapping X morphs
//     back down to the pill.
//
// The morph is one animated container whose width/height/radius/offset
// interpolate between the two Figma geometries; pill content fades out on
// the way up, sheet content fades in near the top. Both orbs share the
// engine clock, so the crossfade never visibly resets the animation.
//
// Figma geometry (402-wide frame), used verbatim below:
//   pill:  213x64  r52.535  bottom 46  orb 48 @ x13  label x71.3  #a8a8a8
//   sheet: (W-48)x366  r42.54  bottom 24  orb ~133 @ y72  title y244
//          subtitle y277 w271 #898989  close 36x36 r100 @ 24/24, bg white/9%

import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageSVG, useSVG } from '@shopify/react-native-skia';
import { Canvas as SkiaCanvas } from '@shopify/react-native-skia';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ThinkingOrb } from 'thinking-orbs-native';
import type { OrbState } from 'thinking-orbs-native';

// swipe order; starts on `breathing`, whose label the design shows
const STATES: OrbState[] = [
  'breathing',
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'shaping',
];

const VERBS: Record<OrbState, string> = {
  breathing: 'Thinking',
  working: 'Working',
  searching: 'Searching',
  solving: 'Solving',
  listening: 'Listening',
  connecting: 'Connecting',
  weaving: 'Weaving',
  composing: 'Composing',
  shaping: 'Shaping',
};

// Figma constants
const PILL_W = 213;
const PILL_H = 64;
const PILL_R = 52.535;
const PILL_BOTTOM = 46;
const SHEET_H = 366;
const SHEET_R = 42.54;
const SHEET_BOTTOM = 24;
const SHEET_MARGIN = 24;

const SWIPE_THRESHOLD = 56;

const SPRING = { damping: 26, stiffness: 260, mass: 1 };

export default function App() {
  const { width: screenW } = useWindowDimensions();
  const sheetW = screenW - SHEET_MARGIN * 2;

  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // 0 = pill, 1 = sheet
  const morph = useSharedValue(0);
  // horizontal swipe offset of the pill content while paging
  const swipeX = useSharedValue(0);

  const state = STATES[index];
  const closeSvg = useSVG(require('./assets/close.svg'));

  const advance = useCallback((dir: number) => {
    setIndex((i) => (i + dir + STATES.length) % STATES.length);
  }, []);

  // Swipe = pan on the pill; page on release past threshold. The content
  // slides out the way the finger went, swaps state off-screen, slides back
  // in from the other side.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          !expandedRef.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          !expandedRef.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => {
          swipeX.value = g.dx;
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
            const dir = g.dx < 0 ? 1 : -1; // swipe left → next
            swipeX.value = withTiming(-dir * PILL_W, { duration: 110 }, () => {
              runOnJS(advance)(dir);
              swipeX.value = dir * PILL_W;
              swipeX.value = withTiming(0, { duration: 150 });
            });
          } else {
            swipeX.value = withSpring(0, SPRING);
          }
        },
        onPanResponderTerminate: () => {
          swipeX.value = withSpring(0, SPRING);
        },
      }),
    [advance, swipeX]
  );

  const open = useCallback(() => {
    setExpanded(true);
    morph.value = withSpring(1, SPRING);
  }, [morph]);

  const close = useCallback(() => {
    setExpanded(false);
    morph.value = withSpring(0, SPRING);
  }, [morph]);

  // ---- animated styles ----------------------------------------------------

  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(morph.value, [0, 1], [PILL_W, sheetW]),
    height: interpolate(morph.value, [0, 1], [PILL_H, SHEET_H]),
    borderRadius: interpolate(morph.value, [0, 1], [PILL_R, SHEET_R]),
    bottom: interpolate(morph.value, [0, 1], [PILL_BOTTOM, SHEET_BOTTOM]),
  }));

  // pill's gradient glass fades into the sheet's solid glass
  const pillGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const sheetGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
  }));

  const pillContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: swipeX.value }],
  }));

  const sheetContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // rim highlight must track the container's radius, or the hairline gets
  // clipped away at the corners while the shape is mid-morph
  const rimStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(morph.value, [0, 1], [PILL_R, SHEET_R]),
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <Animated.View style={[styles.container, containerStyle]} {...pan.panHandlers}>
        {/* glass backgrounds */}
        <Animated.View style={[StyleSheet.absoluteFill, pillGlassStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.16)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.sheetGlass, sheetGlassStyle]}
          pointerEvents="none"
        />
        {/* rim highlight, shared by both shapes */}
        <Animated.View style={[styles.rim, rimStyle]} pointerEvents="none" />

        {/* pill content */}
        <Animated.View style={[styles.pillContent, pillContentStyle]} pointerEvents={expanded ? 'none' : 'auto'}>
          <Pressable style={styles.pillPress} onPress={open}>
            <View style={styles.pillOrb}>
              <ThinkingOrb state={state} size={64} theme="dark" />
            </View>
            <Text style={styles.pillLabel}>{VERBS[state]}....</Text>
          </Pressable>
        </Animated.View>

        {/* sheet content */}
        <Animated.View
          style={[StyleSheet.absoluteFill, sheetContentStyle]}
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          <View style={styles.sheetOrb}>
            <ThinkingOrb state={state} size={64} theme="dark" style={styles.sheetOrbScale} />
          </View>
          <Text style={styles.sheetTitle}>{VERBS[state]}....</Text>
          <Text style={styles.sheetSubtitle}>
            Agent is processing your request. Please wait, it might take a few seconds.
          </Text>
          <Pressable style={styles.close} onPress={close} hitSlop={10}>
            {closeSvg && (
              <SkiaCanvas style={styles.closeIcon}>
                <ImageSVG svg={closeSvg} x={0} y={0} width={11.17} height={11.17} />
              </SkiaCanvas>
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#3b3b3b',
    alignItems: 'center',
  },
  container: {
    position: 'absolute',
    overflow: 'hidden',
    // Figma: 0 12 26 rgba(0,0,0,0.24)
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  sheetGlass: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  pillContent: {
    ...StyleSheet.absoluteFillObject,
  },
  pillPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillOrb: {
    marginLeft: 13,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 48 / 64 }],
  },
  pillLabel: {
    position: 'absolute',
    left: 71.3,
    fontSize: 16,
    color: '#a8a8a8',
  },
  sheetOrb: {
    position: 'absolute',
    top: 72,
    alignSelf: 'center',
    width: 133,
    height: 133,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOrbScale: {
    transform: [{ scale: 133 / 64 }],
  },
  sheetTitle: {
    position: 'absolute',
    top: 244,
    alignSelf: 'center',
    fontSize: 16,
    color: '#f2f2f2',
  },
  sheetSubtitle: {
    position: 'absolute',
    top: 277,
    alignSelf: 'center',
    width: 271,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: '#898989',
  },
  close: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 11.17,
    height: 11.17,
  },
});

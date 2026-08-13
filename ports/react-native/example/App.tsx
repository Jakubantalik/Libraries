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
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageSVG, useSVG } from '@shopify/react-native-skia';
import { Canvas as SkiaCanvas } from '@shopify/react-native-skia';
import Animated, {
  Easing,
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
import { ShimmerText } from './ShimmerText';

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

// transitions.dev "Card resize" (01-card-resize.md): the morph between the
// pill and sheet geometries tweens with the recipe's exact timing —
// --resize-dur 300ms, --resize-ease cubic-bezier(0.22, 1, 0.36, 1).
const RESIZE = { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) };

export default function App() {
  const { width: screenW, height: screenH } = useWindowDimensions();
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

  // One responder owns the pill: it claims every touch while collapsed, so
  // drag = swipe and a release that never moved = tap. A Pressable child
  // under a PanResponder parent silently loses presses on the new
  // architecture (Fabric) — verified on-device: swipes fired, presses never
  // did — so the tap must live here, not in a Pressable.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => {
          // Hit-testing must be done here, in page coordinates, because the
          // ANIMATED view cannot be the touch target at all: Reanimated
          // layout-prop animation on Fabric repaints the view but leaves the
          // shadow tree's hit-test frame at the previous geometry — verified
          // on-device (sheet taps landed nowhere after the morph). So a
          // static wrapper spanning the SHEET frame owns every touch, and
          // this filter decides what a touch means by where it starts.
          const g2 = geomRef.current;
          if (expandedRef.current) return true;
          const { pageX, pageY } = e.nativeEvent;
          const pillLeft = (g2.screenW - PILL_W) / 2;
          const pillTop = g2.screenH - PILL_BOTTOM - PILL_H;
          return (
            pageX > pillLeft - 8 &&
            pageX < pillLeft + PILL_W + 8 &&
            pageY > pillTop - 8 &&
            pageY < pillTop + PILL_H + 8
          );
        },
        onPanResponderMove: (_e, g) => {
          if (!expandedRef.current) swipeX.value = g.dx;
        },
        onPanResponderRelease: (e, g) => {
          const isTap = Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8;
          if (expandedRef.current) {
            // Sheet: the X closes; so does a tap anywhere outside the sheet.
            // Page coordinates against the sheet's absolute frame — location
            // coords are relative to whichever child got hit, so they are
            // useless for this.
            const { pageX, pageY } = e.nativeEvent;
            const g2 = geomRef.current;
            const sheetTop = g2.screenH - SHEET_BOTTOM - SHEET_H;
            const right = g2.screenW - SHEET_MARGIN;
            const onClose =
              pageX > right - 24 - 36 - 10 &&
              pageX < right - 24 + 10 &&
              pageY > sheetTop + 24 - 10 &&
              pageY < sheetTop + 24 + 36 + 10;
            const outsideSheet =
              pageX < SHEET_MARGIN || pageX > right || pageY < sheetTop;
            if (isTap && (onClose || outsideSheet)) closeRef.current();
            return;
          }
          if (isTap) {
            swipeX.value = withSpring(0, SPRING);
            openRef.current();
          } else if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
            const dir = g.dx < 0 ? 1 : -1; // swipe left → next
            // the WHOLE pill exits the way the finger went, the state swaps
            // off-screen, and a fresh pill slides in from the other side
            const off = screenW / 2 + PILL_W / 2 + 30;
            swipeX.value = withTiming(-dir * off, { duration: 140 }, () => {
              runOnJS(advance)(dir);
              swipeX.value = dir * off;
              swipeX.value = withTiming(0, { duration: 180, easing: Easing.bezier(0.22, 1, 0.36, 1) });
            });
          } else {
            swipeX.value = withSpring(0, SPRING);
          }
        },
        onPanResponderTerminate: () => {
          swipeX.value = withSpring(0, SPRING);
        },
      }),
    [advance, swipeX, screenW]
  );

  const open = useCallback(() => {
    setExpanded(true);
    morph.value = withTiming(1, RESIZE);
  }, [morph]);
  const openRef = useRef(open);
  openRef.current = open;

  const close = useCallback(() => {
    setExpanded(false);
    morph.value = withTiming(0, RESIZE);
  }, [morph]);
  const closeRef = useRef(close);
  closeRef.current = close;
  const geomRef = useRef({ screenW, screenH });
  geomRef.current = { screenW, screenH };

  // ---- animated styles ----------------------------------------------------

  // swipe rides on the container, so the whole pill — glass, rim, shadow —
  // moves together rather than the label sliding inside a static shell
  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(morph.value, [0, 1], [PILL_W, sheetW]),
    height: interpolate(morph.value, [0, 1], [PILL_H, SHEET_H]),
    borderRadius: interpolate(morph.value, [0, 1], [PILL_R, SHEET_R]),
    bottom: interpolate(morph.value, [0, 1], [PILL_BOTTOM - SHEET_BOTTOM, 0]),
    transform: [{ translateX: swipeX.value }],
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
    <View style={styles.root} {...pan.panHandlers}>
      <StatusBar style="light" />

      <View style={[styles.hitArea, { width: sheetW }]}>
      <Animated.View style={[styles.container, containerStyle]}>
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
        {/* tap is handled by the pan responder above, not a Pressable */}
        <Animated.View style={[styles.pillContent, pillContentStyle]} pointerEvents="none">
          <View style={styles.pillPress}>
            <View style={styles.pillOrb}>
              <ThinkingOrb state={state} size={64} theme="dark" />
            </View>
            <View style={styles.pillLabel}>
              <ShimmerText text={`${VERBS[state]}....`} fontSize={16} />
            </View>
          </View>
        </Animated.View>

        {/* sheet content */}
        {/* pointerEvents none ALWAYS: the root pan responder owns every
            touch, and Skia canvases (orb, X icon) would otherwise absorb
            taps natively without bubbling to the responder system —
            verified on-device: the close button was dead precisely because
            the X is a Skia canvas. */}
        <Animated.View style={[StyleSheet.absoluteFill, sheetContentStyle]} pointerEvents="none">
          <View style={styles.sheetOrb}>
            <ThinkingOrb state={state} size={64} theme="dark" style={styles.sheetOrbScale} />
          </View>
          <View style={styles.sheetTitle}>
            <ShimmerText text={`${VERBS[state]}....`} fontSize={16} />
          </View>
          <Text style={styles.sheetSubtitle}>
            Agent is processing your request. Please wait, it might take a few seconds.
          </Text>
          {/* visual only — the tap is resolved by the pan responder's hit rect */}
          <View style={styles.close}>
            {closeSvg && (
              <SkiaCanvas style={styles.closeIcon}>
                <ImageSVG svg={closeSvg} x={0} y={0} width={11.17} height={11.17} />
              </SkiaCanvas>
            )}
          </View>
        </Animated.View>
      </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#3b3b3b',
    alignItems: 'center',
  },
  // static touch target at the SHEET's frame — never animated, so its
  // hit-test rect is always where the eye thinks the surface is
  hitArea: {
    position: 'absolute',
    bottom: SHEET_BOTTOM,
    height: SHEET_H,
    alignItems: 'center',
  },
  container: {
    position: 'absolute',
    overflow: 'hidden',
    // Figma: 0 12 26 rgba(0,0,0,0.24). CSS box-shadow blur maps to roughly
    // TWICE CoreGraphics' shadowRadius, so 26 CSS blur = 13 here — using 26
    // reads as a much softer, bigger halo than the design.
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    // Figma's third shadow layer: 0 0 0 0.5 rgba(0,0,0,0.12) — a hairline
    // dark ring around the glass, separate from the white inner rim
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  sheetGlass: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  // Figma's inset highlights are directional (strongest top-left, faint
  // bottom); RN borders can't vary per edge, so this is a uniform hairline
  // at the average weight of the three inset layers (white alpha 0.24 with
  // negative spread)
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
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

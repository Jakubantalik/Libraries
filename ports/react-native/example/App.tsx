// Logram-style agent status pills, implemented from the Figma reference
// (Logram-.App, node 2584:83673).
//
// Behaviours:
//   - a stack of glass pills bottom-centre; the front one is live, the ones
//     behind recede (see STACK_* below)
//   - swipe the front pill horizontally to page through the nine orb states
//   - tap the front pill: it MORPHS into the modal sheet — the orb scales up
//     into place and the copy reveals with a stagger
//   - drag the sheet down (or flick) to dismiss it back to the pill
//   - tap anywhere outside the pill: a new pill with the next orb state is
//     pushed onto the stack
//
// Figma geometry (402-wide frame), used verbatim below:
//   pill:  213x64  r52.535  bottom 46  orb 48 @ x13  label x71.3
//   sheet: (W-48)x366  r42.54  bottom 24  orb 133 @ y72  title y244
//          subtitle y277 w271 #898989

import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ThinkingOrb } from 'thinking-orbs-native';
import type { OrbState } from 'thinking-orbs-native';
import { ShimmerText } from './ShimmerText';

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

// The orb is rendered ONCE at ORB_SHEET dp and scaled DOWN for the pill, so
// the large end is native resolution and the small end is a downscale.
const ORB_PILL = 48;
const ORB_SHEET = 133;
const ORB_PILL_CX = 13 + ORB_PILL / 2;
const ORB_PILL_CY = PILL_H / 2;
const ORB_SHEET_CY = 72 + ORB_SHEET / 2;

const SWIPE_THRESHOLD = 56;
const SPRING = { damping: 26, stiffness: 260, mass: 1 };

// transitions.dev "Card resize" (01-card-resize.md): --resize-dur 300ms,
// --resize-ease cubic-bezier(0.22, 1, 0.36, 1).
const RESIZE = { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) };

// transitions.dev "Texts reveal" (18-texts-reveal.md): lines rise from
// --stagger-distance over --stagger-dur, with each later line held back by
// --stagger-stagger. The exit is deliberately decoupled — a flat 200ms fade
// with no Y return — so dismissing reads as one quiet fade instead of the
// reveal played backwards.
//
// The recipe's --stagger-blur (3px) is NOT ported. React Native does support
// `filter: [{blur}]` on the new architecture, but applying it to a
// transparent View rasterises it against an opaque backdrop: on device the
// two lines rendered inside solid white boxes. Verified by A/B — removing
// the filter alone fixed it. Opacity plus the Y rise carries the reveal.
const STAGGER_DUR = 500;
const STAGGER_DISTANCE = 12;
const STAGGER_STEP = 40;
const STAGGER_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const STAGGER_EXIT = 200;

// Stacking, following logram-ai/Logram#335: the front card stays solid, the
// one behind drops to 80% and the third to 50%, "so the stack reads as depth
// rather than three equally-loud messages"; anything past the visible window
// is dropped. That PR is web, where the cards differ in size and content —
// here every pill is identical, so depth also needs the lift and shrink.
const STACK_OPACITY = [1, 0.8, 0.5];
const STACK_VISIBLE = STACK_OPACITY.length;
const STACK_LIFT = 12;
const STACK_SHRINK = 0.06;

// the grabber that replaces the close button
const GRAB_W = 36;
const GRAB_H = 5;
const GRAB_TOP = 12;
/** Drag past this many dp, or flick faster than this, and the sheet closes. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.8;

const GLASS_SHADOW = [
  { offsetX: 0, offsetY: 12, blurRadius: 26, spreadDistance: 0, color: 'rgba(0,0,0,0.24)' },
  { offsetX: 1, offsetY: 2, blurRadius: 3, spreadDistance: -2, color: 'rgba(255,255,255,0.24)', inset: true },
  { offsetX: -1, offsetY: -2, blurRadius: 1, spreadDistance: -2, color: 'rgba(255,255,255,0.24)', inset: true },
  { offsetX: 0, offsetY: -2, blurRadius: 1, spreadDistance: -2, color: 'rgba(255,255,255,0.24)', inset: true },
] as const;

const PILL_GRADIENT = ['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.16)'] as const;

export default function App() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const sheetW = screenW - SHEET_MARGIN * 2;

  // front of the stack is the LAST entry, so a new pill pushes on top
  const [stack, setStack] = useState<OrbState[]>(['breathing']);
  const [expanded, setExpanded] = useState(false);

  const morph = useSharedValue(0); // 0 = pill, 1 = sheet
  const swipeX = useSharedValue(0); // horizontal paging offset
  const dragY = useSharedValue(0); // sheet drag-to-dismiss offset
  const reveal = useSharedValue(0); // texts-reveal progress

  const state = stack[stack.length - 1];

  const advance = useCallback((dir: number) => {
    setStack((s) => {
      const i = STATES.indexOf(s[s.length - 1]);
      const next = STATES[(i + dir + STATES.length) % STATES.length];
      return [...s.slice(0, -1), next];
    });
  }, []);

  const push = useCallback(() => {
    setStack((s) => {
      const i = STATES.indexOf(s[s.length - 1]);
      return [...s, STATES[(i + 1) % STATES.length]];
    });
  }, []);

  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const geomRef = useRef({ screenW, screenH });
  geomRef.current = { screenW, screenH };

  const open = useCallback(() => {
    setExpanded(true);
    morph.value = withTiming(1, RESIZE);
    // the copy reveals once the surface has mostly arrived
    reveal.value = withDelay(120, withTiming(1, { duration: STAGGER_DUR, easing: STAGGER_EASE }));
  }, [morph, reveal]);
  const openRef = useRef(open);
  openRef.current = open;

  const close = useCallback(() => {
    setExpanded(false);
    reveal.value = withTiming(0, { duration: STAGGER_EXIT, easing: Easing.linear });
    dragY.value = withTiming(0, { duration: 200 });
    morph.value = withTiming(0, RESIZE);
  }, [morph, dragY, reveal]);
  const closeRef = useRef(close);
  closeRef.current = close;
  const pushRef = useRef(push);
  pushRef.current = push;
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // One responder on the STATIC root view. It cannot live on the animated
  // surface: Reanimated layout-prop animation on Fabric repaints the view but
  // leaves the shadow tree's hit-test frame at the previous geometry, so the
  // sheet would only be tappable inside the old pill rect. Everything is
  // routed here by page-coordinate rects instead.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, g) => {
          if (expandedRef.current) {
            // downward only — dragging up must not lift the sheet off its rest
            dragY.value = Math.max(0, g.dy);
          } else {
            swipeX.value = g.dx;
          }
        },
        onPanResponderRelease: (e, g) => {
          const isTap = Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8;
          const { pageX, pageY } = e.nativeEvent;
          const g2 = geomRef.current;

          if (expandedRef.current) {
            const sheetTop = g2.screenH - SHEET_BOTTOM - SHEET_H;
            const outside =
              pageX < SHEET_MARGIN || pageX > g2.screenW - SHEET_MARGIN || pageY < sheetTop;
            if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY || (isTap && outside)) {
              closeRef.current();
            } else {
              dragY.value = withSpring(0, SPRING);
            }
            return;
          }

          const pillLeft = (g2.screenW - PILL_W) / 2;
          const pillTop = g2.screenH - PILL_BOTTOM - PILL_H;
          const onPill =
            pageX > pillLeft - 8 &&
            pageX < pillLeft + PILL_W + 8 &&
            pageY > pillTop - 8 &&
            pageY < pillTop + PILL_H + 8;

          if (isTap) {
            swipeX.value = withSpring(0, SPRING);
            if (onPill) openRef.current();
            else pushRef.current(); // tap outside stacks a new pill
            return;
          }
          if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
            const dir = g.dx < 0 ? 1 : -1;
            const off = g2.screenW / 2 + PILL_W / 2 + 30;
            swipeX.value = withTiming(-dir * off, { duration: 140 }, () => {
              runOnJS(advanceRef.current)(dir);
              swipeX.value = dir * off;
              swipeX.value = withTiming(0, {
                duration: 180,
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              });
            });
          } else {
            swipeX.value = withSpring(0, SPRING);
          }
        },
        onPanResponderTerminate: () => {
          swipeX.value = withSpring(0, SPRING);
          dragY.value = withSpring(0, SPRING);
        },
      }),
    [swipeX, dragY]
  );

  // ---- animated styles ----------------------------------------------------

  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(morph.value, [0, 1], [PILL_W, sheetW]),
    height: interpolate(morph.value, [0, 1], [PILL_H, SHEET_H]),
    borderRadius: interpolate(morph.value, [0, 1], [PILL_R, SHEET_R]),
    bottom: interpolate(morph.value, [0, 1], [PILL_BOTTOM - SHEET_BOTTOM, 0]),
    transform: [{ translateX: swipeX.value }, { translateY: dragY.value }],
  }));

  const pillGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const sheetGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
  }));
  const pillContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const grabberStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // one orb across both states: travels from the pill's left inset to the
  // sheet's centre and scales 48 -> 133 continuously. Positioned by its
  // centre, since RN scales about a view's middle.
  const orbStyle = useAnimatedStyle(() => {
    const cx = interpolate(morph.value, [0, 1], [ORB_PILL_CX, sheetW / 2]);
    const cy = interpolate(morph.value, [0, 1], [ORB_PILL_CY, ORB_SHEET_CY]);
    const scale = interpolate(morph.value, [0, 1], [ORB_PILL / ORB_SHEET, 1]);
    return {
      left: cx - ORB_SHEET / 2,
      top: cy - ORB_SHEET / 2,
      transform: [{ scale }],
    };
  });

  // Texts reveal. `reveal` runs 0..1 once for the whole block; each line
  // reads a WINDOW of it, which is how the recipe's per-line
  // transition-delay is expressed with a single driver.
  const titleStyle = useAnimatedStyle(() => {
    const p = interpolate(reveal.value, [0, 1 - STAGGER_STEP / STAGGER_DUR], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * STAGGER_DISTANCE }],
    };
  });
  const subtitleStyle = useAnimatedStyle(() => {
    const p = interpolate(reveal.value, [STAGGER_STEP / STAGGER_DUR, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * STAGGER_DISTANCE }],
    };
  });

  // the cards behind the front one, furthest first
  const behind = stack.slice(Math.max(0, stack.length - STACK_VISIBLE), -1);

  return (
    <View style={styles.root} {...pan.panHandlers}>
      <StatusBar style="light" />

      {behind.map((s, i) => {
        const depth = behind.length - i; // 1 = directly behind the front
        return (
          <View
            key={`${s}-${stack.length - depth}`}
            pointerEvents="none"
            style={[
              styles.stackPill,
              {
                bottom: PILL_BOTTOM + depth * STACK_LIFT,
                opacity: STACK_OPACITY[depth] ?? 0,
                transform: [{ scale: 1 - depth * STACK_SHRINK }],
              },
            ]}
          >
            <LinearGradient colors={PILL_GRADIENT} style={StyleSheet.absoluteFill} />
          </View>
        );
      })}

      <View style={[styles.hitArea, { width: sheetW }]} pointerEvents="none">
        <Animated.View style={[styles.container, containerStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, pillGlassStyle]}>
            <LinearGradient colors={PILL_GRADIENT} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.sheetGlass, sheetGlassStyle]} />

          <Animated.View style={[styles.orb, orbStyle]}>
            <ThinkingOrb state={state} size={64} displaySize={ORB_SHEET} theme="dark" />
          </Animated.View>

          <Animated.View style={[styles.pillContent, pillContentStyle]}>
            <View style={styles.pillLabel}>
              <ShimmerText text={`${VERBS[state]}....`} fontSize={16} />
            </View>
          </Animated.View>

          {/* drag-to-dismiss affordance, replacing the close button */}
          <Animated.View style={[styles.grabber, grabberStyle]} />

          <Animated.View style={[styles.sheetTitle, titleStyle]}>
            <ShimmerText text={`${VERBS[state]}....`} fontSize={16} />
          </Animated.View>
          <Animated.View style={[styles.sheetSubtitleWrap, subtitleStyle]}>
            <Text style={styles.sheetSubtitle}>
              Agent is processing your request. Please wait, it might take a few seconds.
            </Text>
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
  stackPill: {
    position: 'absolute',
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_R,
    overflow: 'hidden',
    boxShadow: GLASS_SHADOW,
  },
  container: {
    position: 'absolute',
    overflow: 'hidden',
    // The design's shadow stack, verbatim. React Native 0.76+ on the new
    // architecture implements the real CSS box-shadow model including inset,
    // so this needs no approximating: one outer drop plus three DIRECTIONAL
    // white insets (top-left bright, bottom-right and bottom faint) that a
    // single uniform border could never reproduce.
    //
    // The design also ships a display-p3 variant of the same stack; RN has no
    // wide-gamut colour syntax, so these are the sRGB values, which is what
    // the first CSS declaration falls back to anyway.
    boxShadow: GLASS_SHADOW,
  },
  sheetGlass: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  orb: {
    position: 'absolute',
  },
  pillContent: {
    ...StyleSheet.absoluteFillObject,
  },
  pillLabel: {
    position: 'absolute',
    left: 71.3,
    top: (PILL_H - 22) / 2,
  },
  grabber: {
    position: 'absolute',
    top: GRAB_TOP,
    alignSelf: 'center',
    width: GRAB_W,
    height: GRAB_H,
    borderRadius: GRAB_H / 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  sheetTitle: {
    position: 'absolute',
    top: 244,
    alignSelf: 'center',
  },
  sheetSubtitleWrap: {
    position: 'absolute',
    top: 277,
    alignSelf: 'center',
    width: 271,
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: '#898989',
  },
});

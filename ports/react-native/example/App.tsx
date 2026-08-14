// Logram-style agent status pills, implemented from the Figma reference
// (Logram-.App, node 2584:83673).
//
// Behaviours:
//   - a stack of glass pills bottom-centre; the front one is live, the ones
//     behind recede but KEEP their content — orb frozen, label muted
//   - swipe the front pill horizontally to page through the nine orb states
//   - tap the front pill: it MORPHS into the modal sheet — the orb scales up
//     into place and the copy reveals with a stagger
//   - drag the sheet down (or flick) to dismiss it back to the pill
//   - tap anywhere outside the pill: a new pill with the next orb state is
//     pushed onto the stack; the stack recedes with a subtle bounce and the
//     card leaving the visible window fades out with the SAME motion
//   - TUNE panel top-left: durations, bounce amount and easing family for
//     every animation above, editable live
//
// Figma geometry (402-wide frame), used verbatim below:
//   pill:  213x64  r52.535  bottom 46  orb 48 @ x13  label x71.3
//   sheet: (W-48)x366  r42.54  bottom 24  orb 133 @ y72  title y244
//          subtitle y277 w271 #898989

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  type EasingFunction,
  type EasingFunctionFactory,
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
const STAGGER_DISTANCE = 12;
const STAGGER_STEP = 40;
const STAGGER_EXIT = 200;

// Stacking, following logram-ai/Logram#335: front solid, next 80%, third
// 50%, and past that the card fades OUT — with the same lift/shrink motion,
// not a hard unmount. Cards keep orb + label; the orb is paused.
const STACK_OPACITY = [1, 0.8, 0.5];
const STACK_LIFT = 12;
const STACK_SHRINK = 0.06;
// depths rendered: 1..3; depth 3 is the exit animation target (opacity 0)
const STACK_RENDERED = 3;
const ENTER_RISE = 90;

/** Backdrop blur behind the pills' glass. */
const PILL_BLUR = 15;

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

// ---- live tuning ----------------------------------------------------------

type EaseKind = 'smooth' | 'bounce' | 'spring';

interface Tune {
  /** pill <-> sheet morph, ms (transitions.dev card-resize default: 300) */
  morphMs: number;
  /** stack reposition + pill entrance, ms (sonner: 400) */
  stackMs: number;
  /** texts-reveal duration, ms (recipe: 500) */
  revealMs: number;
  /** back-overshoot amount for the bounce easing, 0..1 */
  bounce: number;
  ease: EaseKind;
}

const DEFAULT_TUNE: Tune = { morphMs: 300, stackMs: 400, revealMs: 500, bounce: 0.3, ease: 'bounce' };

const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);

/** The movement easing the current tune calls for. */
function easeFor(t: Tune): EasingFunction | EasingFunctionFactory {
  if (t.ease === 'bounce') return Easing.out(Easing.back(t.bounce * 4));
  return SMOOTH;
}

/** Animate a movement shared value per the tune (spring ignores duration). */
function animateTo(t: Tune, to: number, ms: number) {
  if (t.ease === 'spring') {
    return withSpring(to, { damping: 14 + (1 - t.bounce) * 16, stiffness: 220, mass: 1 });
  }
  return withTiming(to, { duration: ms, easing: easeFor(t) });
}

// ---- app ------------------------------------------------------------------

export default function App() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const sheetW = screenW - SHEET_MARGIN * 2;

  // front of the stack is the LAST entry, so a new pill pushes on top.
  // Each entry carries an id so a card keeps its own animation state as the
  // stack shifts underneath it.
  const [stack, setStack] = useState<Array<{ id: number; state: OrbState }>>([
    { id: 0, state: 'breathing' },
  ]);
  const nextId = useRef(1);
  const [expanded, setExpanded] = useState(false);
  const [tune, setTune] = useState<Tune>(DEFAULT_TUNE);
  const tuneRef = useRef(tune);
  tuneRef.current = tune;

  const morph = useSharedValue(0); // 0 = pill, 1 = sheet
  const swipeX = useSharedValue(0); // horizontal paging offset
  const dragY = useSharedValue(0); // sheet drag-to-dismiss offset
  const reveal = useSharedValue(0); // texts-reveal progress
  const enterY = useSharedValue(0); // new-pill entrance offset

  const state = stack[stack.length - 1].state;

  const advance = useCallback((dir: number) => {
    setStack((s) => {
      const front = s[s.length - 1];
      const i = STATES.indexOf(front.state);
      const next = STATES[(i + dir + STATES.length) % STATES.length];
      return [...s.slice(0, -1), { ...front, state: next }];
    });
  }, []);

  const push = useCallback(() => {
    setStack((s) => {
      const i = STATES.indexOf(s[s.length - 1].state);
      const id = nextId.current++;
      // keep a bounded tail: rendered depths plus one already-invisible card
      return [...s, { id, state: STATES[(i + 1) % STATES.length] }].slice(-(STACK_RENDERED + 2));
    });
    // the incoming pill rises into place, as sonner slides a new toast up
    const t = tuneRef.current;
    enterY.value = ENTER_RISE;
    enterY.value = animateTo(t, 0, t.stackMs);
  }, [enterY]);

  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const geomRef = useRef({ screenW, screenH });
  geomRef.current = { screenW, screenH };

  const open = useCallback(() => {
    const t = tuneRef.current;
    setExpanded(true);
    morph.value = animateTo(t, 1, t.morphMs);
    // the copy reveals once the surface has mostly arrived
    reveal.value = withDelay(120, withTiming(1, { duration: t.revealMs, easing: SMOOTH }));
  }, [morph, reveal]);
  const openRef = useRef(open);
  openRef.current = open;

  const close = useCallback(() => {
    const t = tuneRef.current;
    setExpanded(false);
    reveal.value = withTiming(0, { duration: STAGGER_EXIT, easing: Easing.linear });
    dragY.value = withTiming(0, { duration: 200 });
    morph.value = animateTo(t, 0, t.morphMs);
  }, [morph, dragY, reveal]);
  const closeRef = useRef(close);
  closeRef.current = close;
  const pushRef = useRef(push);
  pushRef.current = push;
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // One responder on the STATIC gesture layer. It cannot live on the animated
  // surface: Reanimated layout-prop animation on Fabric repaints the view but
  // leaves the shadow tree's hit-test frame at the previous geometry, so the
  // sheet would only be tappable inside the old pill rect. Everything is
  // routed here by page-coordinate rects instead. The TUNE panel is a SIBLING
  // of this layer — a Pressable child under a responder-carrying ancestor
  // never fires on Fabric.
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
    transform: [
      { translateX: swipeX.value },
      { translateY: dragY.value + enterY.value },
    ],
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
  const stepFrac = STAGGER_STEP / tune.revealMs;
  const titleStyle = useAnimatedStyle(() => {
    const p = interpolate(reveal.value, [0, 1 - stepFrac], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * STAGGER_DISTANCE }],
    };
  });
  const subtitleStyle = useAnimatedStyle(() => {
    const p = interpolate(reveal.value, [stepFrac, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * STAGGER_DISTANCE }],
    };
  });

  // the cards behind the front one, furthest first
  const behind = stack.slice(0, -1).slice(-STACK_RENDERED);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* gesture layer — carries the responder AND the background, so it is
          opaque (a transparent view loses Fabric hit-testing; measured) */}
      <View style={styles.gestureLayer} {...pan.panHandlers}>
        {behind.map((entry, i) => (
          <StackPill
            key={entry.id}
            depth={behind.length - i}
            state={entry.state}
            tune={tune}
          />
        ))}

        <View style={[styles.hitArea, { width: sheetW }]} pointerEvents="none">
          <Animated.View style={[styles.container, containerStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, pillGlassStyle]}>
              <BlurView intensity={PILL_BLUR} tint="dark" style={StyleSheet.absoluteFill} />
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

      {/* sibling of the gesture layer, so its Pressables actually fire */}
      <TunePanel tune={tune} onChange={setTune} />
    </View>
  );
}

// ---- stacked cards --------------------------------------------------------

/**
 * A card behind the front pill, KEEPING its content: the orb frozen on its
 * current frame (`paused`) and the label muted. It animates TOWARD its depth
 * rather than being placed at it — it mounts at the depth it is leaving (one
 * nearer the front), which is exactly the position it just occupied — so a
 * push makes the whole stack visibly recede. A card pushed past the visible
 * window animates to depth 3 = opacity 0 with the SAME motion, instead of
 * unmounting in place.
 *
 * Lift rides on TRANSFORM, not `bottom`: Reanimated drives transform and
 * opacity straight on the view; layout props did not animate at all here
 * (measured — an 8s reposition showed zero pixel change over 3s).
 */
function StackPill({ depth, state, tune }: { depth: number; state: OrbState; tune: Tune }) {
  const d = useSharedValue(depth - 1);

  useEffect(() => {
    d.value = animateTo(tune, depth, tune.stackMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      d.value,
      [0, 1, 2, 3],
      [STACK_OPACITY[0], STACK_OPACITY[1], STACK_OPACITY[2], 0],
      Extrapolation.CLAMP
    ),
    transform: [
      { translateY: -d.value * STACK_LIFT },
      { scale: 1 - d.value * STACK_SHRINK },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.stackPill, style]}>
      <BlurView intensity={PILL_BLUR} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={PILL_GRADIENT} style={StyleSheet.absoluteFill} />
      <View style={styles.stackOrb}>
        <ThinkingOrb state={state} size={64} displaySize={ORB_PILL} theme="dark" paused />
      </View>
      <Text style={styles.stackLabel}>{VERBS[state]}....</Text>
    </Animated.View>
  );
}

// ---- tune panel -----------------------------------------------------------

const EASES: EaseKind[] = ['smooth', 'bounce', 'spring'];

function TuneRow({
  label,
  value,
  display,
  onStep,
}: {
  label: string;
  value: number;
  display: string;
  onStep: (dir: number) => void;
}) {
  return (
    <View style={styles.tuneRow}>
      <Text style={styles.tuneLabel}>{label}</Text>
      <Pressable onPress={() => onStep(-1)} hitSlop={8} style={styles.tuneBtn}>
        <Text style={styles.tuneBtnText}>−</Text>
      </Pressable>
      <Text style={styles.tuneValue}>{display}</Text>
      <Pressable onPress={() => onStep(1)} hitSlop={8} style={styles.tuneBtn}>
        <Text style={styles.tuneBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function TunePanel({ tune, onChange }: { tune: Tune; onChange: (t: Tune) => void }) {
  const [openPanel, setOpenPanel] = useState(false);

  const step = (key: 'morphMs' | 'stackMs' | 'revealMs', by: number) => (dir: number) =>
    onChange({ ...tune, [key]: Math.max(100, Math.min(2000, tune[key] + dir * by)) });

  return (
    // The wrapper auto-sizes to its content, so plain `auto` pointer events
    // only claim the panel's own bounds — no need for box-none.
    <View style={styles.tunePanel}>
      <Pressable onPress={() => setOpenPanel((o) => !o)} style={styles.tuneToggle} hitSlop={8}>
        <Text style={styles.tuneToggleText}>{openPanel ? '× TUNE' : '≡ TUNE'}</Text>
      </Pressable>

      {openPanel && (
        <View style={styles.tuneBody}>
          <TuneRow label="MORPH" value={tune.morphMs} display={`${tune.morphMs}ms`} onStep={step('morphMs', 50)} />
          <TuneRow label="STACK" value={tune.stackMs} display={`${tune.stackMs}ms`} onStep={step('stackMs', 50)} />
          <TuneRow label="REVEAL" value={tune.revealMs} display={`${tune.revealMs}ms`} onStep={step('revealMs', 50)} />
          <TuneRow
            label="BOUNCE"
            value={tune.bounce}
            display={tune.bounce.toFixed(2)}
            onStep={(dir) =>
              onChange({ ...tune, bounce: Math.max(0, Math.min(1, +(tune.bounce + dir * 0.05).toFixed(2))) })
            }
          />
          <View style={styles.tuneRow}>
            <Text style={styles.tuneLabel}>EASE</Text>
            <Pressable
              onPress={() => onChange({ ...tune, ease: EASES[(EASES.indexOf(tune.ease) + 1) % EASES.length] })}
              hitSlop={8}
              style={styles.tuneEase}
            >
              <Text style={styles.tuneBtnText}>{tune.ease}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onChange(DEFAULT_TUNE)} hitSlop={8}>
            <Text style={styles.tuneReset}>reset</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ---- styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3b3b3b',
    alignItems: 'center',
  },
  hitArea: {
    position: 'absolute',
    bottom: SHEET_BOTTOM,
    height: SHEET_H,
    alignItems: 'center',
  },
  stackPill: {
    position: 'absolute',
    bottom: PILL_BOTTOM,
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_R,
    overflow: 'hidden',
    boxShadow: GLASS_SHADOW,
  },
  stackOrb: {
    position: 'absolute',
    left: 13,
    top: (PILL_H - ORB_PILL) / 2,
  },
  stackLabel: {
    position: 'absolute',
    left: 71.3,
    top: (PILL_H - 22) / 2,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(251,251,251,0.35)',
  },
  container: {
    position: 'absolute',
    overflow: 'hidden',
    // The design's shadow stack, verbatim. React Native 0.76+ on the new
    // architecture implements the real CSS box-shadow model including inset,
    // so this needs no approximating: one outer drop plus three DIRECTIONAL
    // white insets (top-left bright, bottom-right and bottom faint) that a
    // single uniform border could never reproduce.
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
  tunePanel: {
    position: 'absolute',
    top: 64,
    left: 16,
  },
  tuneToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tuneToggleText: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: 'rgba(255,255,255,0.75)',
  },
  tuneBody: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 6,
  },
  tuneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tuneLabel: {
    width: 52,
    fontSize: 11,
    fontFamily: 'Courier',
    color: 'rgba(255,255,255,0.55)',
  },
  tuneValue: {
    width: 52,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Courier',
    color: '#fff',
  },
  tuneBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuneBtnText: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#fff',
  },
  tuneEase: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tuneReset: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
});

// The React Native ThinkingOrb.
//
// Geometry comes from `thinking-orbs/engine` — the SAME compiled code the
// web component runs, not a re-implementation — so parity is structural
// rather than something to be maintained by hand. All this file does is
// turn a frame's dot list into Skia draw calls.
//
// Threading: the frame is built and recorded into an SkPicture on the JS
// thread, then handed to the UI thread as a shared value, where Skia
// rasterises it. Measured cost of the heaviest mode (`composing`, 566
// dots) is 0.12 ms per frame on desktop V8 — under 1% of a 60 fps budget,
// and a few times that under Hermes on a mid-range phone. That headroom is
// why the geometry is NOT workletized: doing so would require 'worklet'
// directives throughout the shared engine (verified: without them the
// Babel plugin produces zero worklets, so a UI-thread call would throw),
// which would couple the web library to Reanimated's toolchain and risk a
// bundler silently stripping the directives. Rasterisation — the part that
// actually must not jank — is on the UI thread either way.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, PaintStyle, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { MODE_FRAMES, resolvePreset } from 'thinking-orbs/engine';
import { nowSeconds, useAppActive, useReducedMotion, useResolvedDark } from './theme';
import type { ThinkingOrbProps } from './types';

const LABELS: Record<string, string> = {
  working: 'Working…',
  searching: 'Searching…',
  solving: 'Solving…',
  listening: 'Listening…',
  connecting: 'Connecting…',
  weaving: 'Weaving…',
  composing: 'Composing…',
  breathing: 'Thinking…',
  shaping: 'Shaping…'
};

/** The static frame reduced-motion users see — same instant as the web. */
const REDUCED_MOTION_T = 0.6;

export function ThinkingOrb({
  state = 'working',
  size = 64,
  theme = 'auto',
  speed = 1,
  paused = false,
  accessibilityLabel,
  style
}: ThinkingOrbProps) {
  const dark = useResolvedDark(theme);
  const reduced = useReducedMotion();
  const appActive = useAppActive();

  const [picture, setPicture] = useState<SkPicture | null>(null);

  // One paint per pass, mutated in place: a fresh SkPaint per dot would
  // allocate ~600 native objects a frame, which is what actually hurts on
  // low-end Android.
  const paints = useMemo(() => ({ fill: Skia.Paint(), stroke: Skia.Paint() }), []);
  const rgba = useRef(new Float32Array(4)).current;

  const { mode, speed: baseSpeed, opts } = useMemo(() => resolvePreset(state, size), [state, size]);
  const effSpeed = baseSpeed * speed;

  useEffect(() => {
    const { fill, stroke } = paints;
    fill.setAntiAlias(true);
    stroke.setAntiAlias(true);
    stroke.setStyle(PaintStyle.Stroke);

    const build = MODE_FRAMES[mode];

    const setInk = (paint: typeof fill, white: number, alpha: number) => {
      const w = Math.min(1, Math.max(0, white));
      // Quantise to 8-bit exactly as the canvas painter does, so the two
      // platforms land on identical greys rather than merely close ones.
      const g = Math.round((dark ? 1 - w : w) * 255) / 255;
      rgba[0] = g;
      rgba[1] = g;
      rgba[2] = g;
      rgba[3] = alpha;
      paint.setColor(rgba);
    };

    const record = (t: number) => {
      const frame = build(size, t, opts);
      const pic = createPicture((canvas) => {
        // lines first, so nodes sit on top of their edges
        for (const l of frame.lines) {
          setInk(stroke, l.white, l.a ?? 1);
          stroke.setStrokeWidth(l.w);
          canvas.drawLine(l.x1, l.y1, l.x2, l.y2, stroke);
        }
        // dots are already z-sorted into draw order by the engine
        for (const d of frame.dots) {
          setInk(fill, d.white, d.a ?? 1);
          canvas.drawCircle(d.x, d.y, d.r, fill);
        }
      }, Skia.XYWHRect(0, 0, size, size));
      setPicture(pic);
    };

    if (reduced) {
      record(REDUCED_MOTION_T);
      return;
    }

    // draw once even when paused or backgrounded, so the orb is never blank
    record(nowSeconds() * effSpeed);
    if (paused || !appActive) return;

    let raf = 0;
    let running = true;
    const loop = () => {
      record(nowSeconds() * effSpeed);
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [mode, opts, size, dark, effSpeed, paused, reduced, appActive, paints, rgba]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? LABELS[state]}
      style={[{ width: size, height: size }, style]}
    >
      <Canvas style={{ width: size, height: size }}>
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
    </View>
  );
}

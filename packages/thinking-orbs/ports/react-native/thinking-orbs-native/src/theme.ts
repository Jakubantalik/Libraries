// Platform behaviours the web library gets from the DOM.
//
//   theme      web: data-theme ancestor / prefers-color-scheme
//              RN:  useColorScheme()
//   reduced    web: prefers-reduced-motion
//              RN:  AccessibilityInfo.isReduceMotionEnabled
//   pause      web: IntersectionObserver + visibilitychange
//              RN:  AppState (there is no cheap off-screen signal here;
//                   callers can drive the `paused` prop from their own
//                   viewport tracking if they render many orbs in a list)

import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, useColorScheme } from 'react-native';
import type { OrbTheme } from './types';

export function useResolvedDark(theme: OrbTheme): boolean {
  const scheme = useColorScheme();
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return scheme !== 'light';
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** True while the app is foregrounded — the render loop stops otherwise. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s !== 'background'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * One clock for every orb on screen, so several mounted together stay in
 * phase exactly as they do on the web (which reads the shared
 * `performance.now`). Seconds since an arbitrary fixed origin.
 */
export function nowSeconds(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof perf?.now === 'function' ? perf.now() / 1000 : Date.now() / 1000;
}

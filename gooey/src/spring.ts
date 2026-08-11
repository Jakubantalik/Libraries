/** Spring-driven easing, compiled to CSS `linear()` so the DOM wrapper and the
 *  SVG blob can share one GPU-composited transition — the core of zero-lag
 *  mirrored sync. Falls back to cubic-bezier where `linear()` is unsupported. */

export interface SpringConfig {
  stiffness?: number
  damping?: number
  mass?: number
}

export type TransitionPreset = 'snappy' | 'smooth' | 'bouncy'

export type Transition =
  | TransitionPreset
  | SpringConfig
  | { duration: number; ease?: string }

export interface ResolvedTransition {
  /** ms */
  duration: number
  /** CSS timing function */
  easing: string
}

export const presets: Record<TransitionPreset, Required<SpringConfig>> = {
  snappy: { stiffness: 480, damping: 34, mass: 1 },
  smooth: { stiffness: 190, damping: 26, mass: 1 },
  bouncy: { stiffness: 320, damping: 17, mass: 1 },
}

const DT = 1 / 240

function simulate(c: Required<SpringConfig>) {
  let x = 0
  let v = 0
  let t = 0
  let settledAt = -1
  let max = 0
  const xs: number[] = [0]
  while (t < 10) {
    const a = (-c.stiffness * (x - 1) - c.damping * v) / c.mass
    v += a * DT
    x += v * DT
    t += DT
    xs.push(x)
    if (x > max) max = x
    if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.02) {
      if (settledAt < 0) settledAt = t
      if (t - settledAt >= 0.064) break
    } else {
      settledAt = -1
    }
  }
  const duration = settledAt > 0 ? settledAt : t
  const n = Math.round(Math.min(120, Math.max(24, duration * 90)))
  const lastIdx = Math.min(xs.length - 1, duration / DT)
  const values: number[] = []
  for (let i = 0; i <= n; i++) {
    const idx = Math.min(xs.length - 1, Math.round((i / n) * lastIdx))
    values.push(Math.round(xs[idx] * 1e4) / 1e4)
  }
  values[values.length - 1] = 1
  return { duration, values, overshoots: max > 1.001 }
}

let linearOK: boolean | null = null
function supportsLinear(): boolean {
  if (linearOK == null) {
    linearOK =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('transition-timing-function', 'linear(0, 1)')
  }
  return linearOK
}

const cache = new Map<string, ResolvedTransition>()

/** Evaluate a CSS timing function in JS: `linear(...)` sample lists (what the
 *  spring compiler emits), `cubic-bezier(...)`, and the keyword curves.
 *
 *  Exists so item motion can be driven from the SAME rAF that writes the
 *  liquid silhouette instead of a CSS transition. A compositor-run transition
 *  keeps playing through a main-thread stall while the silhouette (written
 *  from JS) freezes — in Safari, where SVG-filter work makes such stalls
 *  routine, the content visibly sailed away from its own liquid. One shared
 *  clock makes the tear impossible: a stall now holds BOTH still. */
const evalCache = new Map<string, (t: number) => number>()
export function easingFunction(spec: string): (t: number) => number {
  let fn = evalCache.get(spec)
  if (fn) return fn
  const lin = /^linear\(([^)]+)\)$/.exec(spec.trim())
  const bez = /^cubic-bezier\(([^)]+)\)$/.exec(spec.trim())
  if (lin) {
    // Our compiled lists carry no percentages: stops are evenly spaced.
    const values = lin[1].split(',').map(Number)
    fn = (t: number) => {
      if (t <= 0) return values[0]
      if (t >= 1) return values[values.length - 1]
      const f = t * (values.length - 1)
      const i = Math.floor(f)
      return values[i] + (values[i + 1] - values[i]) * (f - i)
    }
  } else if (bez) {
    const [x1, y1, x2, y2] = bez[1].split(',').map(Number)
    fn = (t: number) => {
      if (t <= 0) return 0
      if (t >= 1) return 1
      let lo = 0
      let hi = 1
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        const xm = 3 * mid * (1 - mid) * (1 - mid) * x1 + 3 * mid * mid * (1 - mid) * x2 + mid ** 3
        if (xm < t) lo = mid
        else hi = mid
      }
      const u = (lo + hi) / 2
      return 3 * u * (1 - u) * (1 - u) * y1 + 3 * u * u * (1 - u) * y2 + u ** 3
    }
  } else if (spec === 'ease') {
    fn = easingFunction('cubic-bezier(0.25, 0.1, 0.25, 1)')
  } else if (spec === 'ease-in') {
    fn = easingFunction('cubic-bezier(0.42, 0, 1, 1)')
  } else if (spec === 'ease-out') {
    fn = easingFunction('cubic-bezier(0, 0, 0.58, 1)')
  } else if (spec === 'ease-in-out') {
    fn = easingFunction('cubic-bezier(0.42, 0, 0.58, 1)')
  } else {
    fn = (t: number) => Math.min(1, Math.max(0, t))
  }
  evalCache.set(spec, fn)
  return fn
}

export function resolveTransition(
  t: Transition | undefined,
  reducedMotion = false,
): ResolvedTransition {
  if (reducedMotion) return { duration: 0, easing: 'linear' }
  const cfg = t ?? 'smooth'
  if (typeof cfg === 'object' && 'duration' in cfg) {
    return {
      duration: cfg.duration,
      easing: cfg.ease ?? 'cubic-bezier(0.22, 1, 0.36, 1)',
    }
  }
  const spring: Required<SpringConfig> =
    typeof cfg === 'string'
      ? presets[cfg]
      : { stiffness: 300, damping: 24, mass: 1, ...cfg }
  const key = `${spring.stiffness}/${spring.damping}/${spring.mass}/${supportsLinear()}`
  let resolved = cache.get(key)
  if (!resolved) {
    const sim = simulate(spring)
    resolved = {
      duration: Math.round(sim.duration * 1000),
      easing: supportsLinear()
        ? `linear(${sim.values.join(', ')})`
        : sim.overshoots
          ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
          : 'cubic-bezier(0.22, 1, 0.36, 1)',
    }
    cache.set(key, resolved)
  }
  return resolved
}

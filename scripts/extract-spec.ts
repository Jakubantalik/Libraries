// Emits spec/orbs-spec.json — the platform-neutral description of every
// hand-tuned value in the library, so the iOS and React Native ports are
// generated from data rather than transcribed by hand.
//
// The web library stays the source of truth: retune in the inkform mini
// page, bake into src/presets.ts, re-run this, regenerate the ports.
//
// Run: npx tsx scripts/extract-spec.ts

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_PROFILES } from '../src/engine/profiles';
import { PRESETS, STATE_TO_MODE } from '../src/presets';
import type { OrbSize, OrbState } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const STATES = Object.keys(STATE_TO_MODE) as OrbState[];
const SIZES: OrbSize[] = [64, 20];

const spec = {
  specVersion: '1.0.0',
  sourceLibrary: { name: 'thinking-orbs', version: pkg.version },
  reference: 'Web demo at https://orbs.jakubantalik.com is the visual ground truth.',

  enums: {
    states: STATES,
    sizes: SIZES,
    themes: ['dark', 'light'],
    modes: [...new Set(Object.values(STATE_TO_MODE))]
  },

  defaults: { state: 'working', size: 64, theme: 'auto', speed: 1, paused: false },

  stateToMode: STATE_TO_MODE,

  /** Accessibility label per state, so ports read identically to screen readers. */
  labels: {
    working: 'Working…',
    searching: 'Searching…',
    solving: 'Solving…',
    listening: 'Listening…',
    connecting: 'Connecting…',
    weaving: 'Weaving…',
    composing: 'Composing…',
    breathing: 'Thinking…',
    shaping: 'Shaping…'
  },

  /** Per-mode density/geometry before any preset multiplier. */
  baseProfiles: BASE_PROFILES,

  /** Per (mode × size) baked tuning. `extra` merges verbatim after scaling. */
  presets: PRESETS,

  /**
   * How a preset's `count` / `size` multipliers apply to a base profile.
   * Ports must reproduce this exactly or densities drift.
   */
  scaling: {
    // 2-D lattices scale by √count on each axis so the TOTAL scales by count
    countPairs: [
      ['latRings', 'lonDensity'],
      ['rings', 'lonDensity'],
      ['lanes', 'segs']
    ],
    // flat lists scale linearly, then round, floor 1
    countKeys: ['orbitN', 'ghostN', 'nodeN', 'strandN', 'signals'],
    // the morph outline's sampling density scales linearly, floor 0.02
    iconDensityKeys: ['iconD'],
    radiusKeys: [
      'rBase',
      'rDepth',
      'rActive',
      'rDot',
      'ghostR',
      'partR',
      'partRDepth',
      'nodeR',
      'nodeRDepth'
    ],
    rules: {
      countPair: 'value = max(2, round(value * sqrt(count))); a key participates in at most one pair',
      countKey: 'value = max(1, round(value * count)), EXCEPT an explicit 0, which stays 0 (the mode opted out of that layer)',
      iconDensity: 'value = max(0.02, value * count)',
      radius: 'value = value * size; also records rSizeMul = product of size multipliers'
    }
  },

  /**
   * Rendering contract. A frame is a finished list of marks; these are the
   * only rules a port needs beyond drawing them in array order.
   */
  paint: {
    clock: 't = elapsedSeconds * presetSpeed * userSpeed; all instances share one clock so they stay in phase',
    reducedMotion: 'render a single static frame at t = 0.6',
    devicePixelRatioCap: 2,
    cullAlphaBelow: 0.02,
    radiusFloor: 'per-mode rMin, applied before sorting',
    sort: 'ascending by z (far to near); lines are drawn before dots',
    ink: 'grey = round((dark ? 1 - white : white) * 255), white clamped to [0,1]; alpha is the dot/line alpha',
    composite: 'plain source-over fills, no blur/threshold/blend modes'
  },

  /** Timing constants that live in mode code rather than presets. */
  timing: {
    morph: { hold: 1.4, morph: 0.9, shapes: ['circle', 'triangle', 'square'] },
    rubik: { slotDuration: 0.42, rest: 1.2 }
  }
};

mkdirSync(resolve(root, 'spec'), { recursive: true });
writeFileSync(resolve(root, 'spec/orbs-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
console.log(
  `spec/orbs-spec.json — ${STATES.length} states, ${spec.enums.modes.length} modes, v${spec.specVersion} (lib ${pkg.version})`
);

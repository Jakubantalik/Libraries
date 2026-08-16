// Emits spec/orbs-golden.json — the exact geometry the engine produces for
// every (state × size) at fixed timestamps.
//
// This is what makes the SwiftUI port verifiable. That port hand-transcribes
// ~940 lines of math; a golden vector turns "does it look right?" into an
// assertion per dot, so a mistyped constant fails a test instead of shipping
// as a subtly wrong animation. The React Native port imports the same
// compiled engine, so its check is mostly a build guard.
//
// Run: npx tsx scripts/extract-golden.ts

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODE_FRAMES } from '../src/engine/registry';
import { resolvePreset, STATE_TO_MODE } from '../src/presets';
import type { OrbSize, OrbState } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const STATES = Object.keys(STATE_TO_MODE) as OrbState[];
const SIZES: OrbSize[] = [64, 20];

// Same instants the pixel harness freezes at (demo/parity.ts). Four samples
// per case: border-beam's port found that a single freeze time can land in a
// phase lull and hide a real difference.
const TIMES = [0.6, 1.7, 3.3, 5.1];

// Enough precision to catch a transcription error, loose enough to tolerate
// libm's last-ulp differences between JS and Swift.
const P = 6;
const r6 = (n: number) => Number(n.toFixed(P));

const cases = [];
for (const state of STATES) {
  for (const size of SIZES) {
    const { mode, speed, opts } = resolvePreset(state, size);
    for (const t of TIMES) {
      const frame = MODE_FRAMES[mode](size, t, opts);
      cases.push({
        key: `${state}-${size}-${t}`,
        state,
        size,
        mode,
        t,
        dotCount: frame.dots.length,
        lineCount: frame.lines.length,
        // flat arrays keep the file a third the size of objects and decode
        // trivially in Swift
        dots: frame.dots.flatMap((d) => [r6(d.x), r6(d.y), r6(d.z), r6(d.r), r6(d.white), r6(d.a ?? 1)]),
        lines: frame.lines.flatMap((l) => [
          r6(l.x1),
          r6(l.y1),
          r6(l.x2),
          r6(l.y2),
          r6(l.white),
          r6(l.a ?? 1),
          r6(l.w)
        ])
      });
    }
  }
}

const golden = {
  specVersion: '1.0.0',
  sourceLibrary: { name: 'thinking-orbs', version: pkg.version },
  note: 'Dot stride 6: x, y, z, r, white, a. Line stride 7: x1, y1, x2, y2, white, a, w. Dots are in draw order (z ascending); lines draw first.',
  tolerance: 1e-4,
  times: TIMES,
  // resolved opts per (state, size) so a port can verify its preset scaling
  // independently of its geometry
  resolved: Object.fromEntries(
    STATES.flatMap((state) =>
      SIZES.map((size) => {
        const { mode, speed, opts } = resolvePreset(state, size);
        return [`${state}-${size}`, { mode, speed, opts }];
      })
    )
  ),
  cases
};

mkdirSync(resolve(root, 'spec'), { recursive: true });
writeFileSync(resolve(root, 'spec/orbs-golden.json'), `${JSON.stringify(golden)}\n`);

const dots = cases.reduce((n, c) => n + c.dotCount, 0);
const lines = cases.reduce((n, c) => n + c.lineCount, 0);
console.log(
  `spec/orbs-golden.json — ${cases.length} cases, ${dots} dots, ${lines} lines (${STATES.length} states × ${SIZES.length} sizes × ${TIMES.length} times)`
);

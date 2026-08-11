// Asserts this package's resolved `thinking-orbs/engine` reproduces
// spec/orbs-golden.json exactly.
//
// The RN port re-implements no math, so this is not checking arithmetic —
// it is checking that the dependency actually resolved to the engine the
// golden vectors were generated from. A stale or duplicated copy of
// thinking-orbs in the tree is the realistic failure this catches, and it
// would otherwise show up as an animation that is subtly out of step with
// the web.
//
// Run: npm run verify:golden

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODE_FRAMES, resolvePreset } from 'thinking-orbs/engine';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, '../../../../spec/orbs-golden.json');
const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
const TOL = golden.tolerance ?? 1e-4;

let checked = 0;
const failures = [];

const cmp = (label, actual, expected) => {
  if (Math.abs(actual - expected) > TOL) {
    failures.push(`${label}: got ${actual}, expected ${expected}`);
  }
  checked++;
};

for (const c of golden.cases) {
  const { mode, opts } = resolvePreset(c.state, c.size);
  if (mode !== c.mode) {
    failures.push(`${c.key}: mode ${mode} !== ${c.mode}`);
    continue;
  }
  const frame = MODE_FRAMES[mode](c.size, c.t, opts);
  if (frame.dots.length !== c.dotCount || frame.lines.length !== c.lineCount) {
    failures.push(
      `${c.key}: ${frame.dots.length}/${frame.lines.length} dots/lines, expected ${c.dotCount}/${c.lineCount}`
    );
    continue;
  }
  frame.dots.forEach((d, i) => {
    const b = i * 6;
    cmp(`${c.key} dot${i}.x`, d.x, c.dots[b]);
    cmp(`${c.key} dot${i}.y`, d.y, c.dots[b + 1]);
    cmp(`${c.key} dot${i}.z`, d.z, c.dots[b + 2]);
    cmp(`${c.key} dot${i}.r`, d.r, c.dots[b + 3]);
    cmp(`${c.key} dot${i}.white`, d.white, c.dots[b + 4]);
    cmp(`${c.key} dot${i}.a`, d.a ?? 1, c.dots[b + 5]);
  });
  frame.lines.forEach((l, i) => {
    const b = i * 7;
    cmp(`${c.key} line${i}.x1`, l.x1, c.lines[b]);
    cmp(`${c.key} line${i}.y1`, l.y1, c.lines[b + 1]);
    cmp(`${c.key} line${i}.x2`, l.x2, c.lines[b + 2]);
    cmp(`${c.key} line${i}.y2`, l.y2, c.lines[b + 3]);
    cmp(`${c.key} line${i}.white`, l.white, c.lines[b + 4]);
    cmp(`${c.key} line${i}.a`, l.a ?? 1, c.lines[b + 5]);
    cmp(`${c.key} line${i}.w`, l.w, c.lines[b + 6]);
  });
}

if (failures.length) {
  console.error(`FAIL — ${failures.length} mismatch(es) of ${checked} values:`);
  for (const f of failures.slice(0, 20)) console.error('  ' + f);
  process.exit(1);
}
console.log(
  `PASS — ${golden.cases.length} cases, ${checked} values within ${TOL} (spec ${golden.specVersion}, lib ${golden.sourceLibrary.version})`
);

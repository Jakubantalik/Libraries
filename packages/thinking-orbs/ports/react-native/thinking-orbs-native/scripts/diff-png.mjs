// Pixel-diffs the CanvasKit (real Skia) renders against the web canvas
// reference for the same frozen instants.
//
// Both sides run identical geometry and an identical ink rule, so any
// difference here is rasteriser-level: antialiasing of circle edges, and
// how each engine resolves overlapping translucent fills. Large or
// structured differences would mean the Skia draw sequence is wrong.
//
// Run: node scripts/diff-png.mjs <dirA> <dirB>

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const [dirA, dirB] = process.argv.slice(2);
if (!dirA || !dirB) {
  console.error('usage: node scripts/diff-png.mjs <skiaDir> <webDir>');
  process.exit(2);
}

const rows = [];
for (const file of readdirSync(dirB).filter((f) => f.endsWith('.png')).sort()) {
  const pathA = resolve(dirA, file);
  if (!existsSync(pathA)) continue;
  const a = PNG.sync.read(readFileSync(pathA));
  const b = PNG.sync.read(readFileSync(resolve(dirB, file)));
  if (a.width !== b.width || a.height !== b.height) {
    rows.push({ file, note: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` });
    continue;
  }
  // Compare composited-on-black RGB: these are transparent PNGs, and raw
  // RGBA diffing punishes fully-transparent pixels whose colour channels are
  // undefined. What matters is what the viewer sees.
  let sum = 0;
  let max = 0;
  let hot = 0;
  const n = a.width * a.height;
  const diffs = [];
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const aa = a.data[o + 3] / 255;
    const ba = b.data[o + 3] / 255;
    let d = 0;
    for (let c = 0; c < 3; c++) {
      d = Math.max(d, Math.abs(a.data[o + c] * aa - b.data[o + c] * ba));
    }
    diffs.push(d);
    sum += d;
    if (d > max) max = d;
    if (d > 16) hot++;
  }
  diffs.sort((x, y) => x - y);
  rows.push({
    file,
    mean: sum / n,
    p99: diffs[Math.floor(n * 0.99)],
    max,
    hotPct: (hot / n) * 100
  });
}

console.log('file                            mean/255   p99   max   hot%');
for (const r of rows) {
  if (r.note) {
    console.log(`${r.file.padEnd(30)} ${r.note}`);
    continue;
  }
  console.log(
    `${r.file.padEnd(30)} ${r.mean.toFixed(3).padStart(7)} ${String(r.p99).padStart(5)} ${String(r.max).padStart(5)} ${r.hotPct.toFixed(2).padStart(6)}`
  );
}
const scored = rows.filter((r) => !r.note);
if (scored.length) {
  console.log(
    `\nworst mean ${Math.max(...scored.map((r) => r.mean)).toFixed(3)}/255 · ` +
      `worst p99 ${Math.max(...scored.map((r) => r.p99))} · ` +
      `worst hot-pixel share ${Math.max(...scored.map((r) => r.hotPct)).toFixed(2)}% ` +
      `(${scored.length} frames)`
  );
}

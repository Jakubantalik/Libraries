// Renders frames through REAL Skia (CanvasKit, the WASM build of the same
// engine react-native-skia wraps) using the same draw calls ThinkingOrb.tsx
// makes, and writes PNGs.
//
// Why this exists: the golden-vector check proves the geometry is right, but
// says nothing about whether the Skia drawing is. Running the actual draw
// sequence through actual Skia and pixel-diffing it against the browser's
// 2D canvas closes that gap without a simulator — the same trick border-beam
// used to validate its SkSL shaders before it could run them on a device.
//
// The API differs from react-native-skia only in how you obtain the surface;
// Paint / drawCircle / drawLine are the same Skia primitives underneath.
//
// Run: node scripts/render-canvaskit.mjs [outDir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { MODE_FRAMES, resolvePreset } from 'thinking-orbs/engine';

const require = createRequire(import.meta.url);
const CanvasKitInit = require('canvaskit-wasm');
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? resolve(here, '../canvaskit-out'));

// Must match demo/parity.ts on the web side.
const DPR = 2;
const CASES = [];
for (const state of [
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping'
]) {
  for (const t of [0.6, 3.3]) CASES.push({ state, size: 64, dark: true, t });
}

const CanvasKit = await CanvasKitInit({
  locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`)
});

mkdirSync(outDir, { recursive: true });

for (const { state, size, dark, t } of CASES) {
  const { mode, opts } = resolvePreset(state, size);
  const frame = MODE_FRAMES[mode](size, t, opts);

  const surface = CanvasKit.MakeSurface(size * DPR, size * DPR);
  const canvas = surface.getCanvas();
  canvas.clear(CanvasKit.TRANSPARENT);
  canvas.scale(DPR, DPR);

  const fill = new CanvasKit.Paint();
  fill.setAntiAlias(true);
  fill.setStyle(CanvasKit.PaintStyle.Fill);
  const stroke = new CanvasKit.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(CanvasKit.PaintStyle.Stroke);

  // identical ink rule to ThinkingOrb.tsx and to the web painter
  const ink = (white, alpha) => {
    const w = Math.min(1, Math.max(0, white));
    const g = Math.round((dark ? 1 - w : w) * 255) / 255;
    return CanvasKit.Color4f(g, g, g, alpha);
  };

  for (const l of frame.lines) {
    stroke.setColor(ink(l.white, l.a ?? 1));
    stroke.setStrokeWidth(l.w);
    canvas.drawLine(l.x1, l.y1, l.x2, l.y2, stroke);
  }
  for (const d of frame.dots) {
    fill.setColor(ink(d.white, d.a ?? 1));
    canvas.drawCircle(d.x, d.y, d.r, fill);
  }

  const img = surface.makeImageSnapshot();
  const png = img.encodeToBytes();
  writeFileSync(resolve(outDir, `${state}-${size}-${dark ? 'd' : 'l'}-${t}.png`), Buffer.from(png));

  fill.delete();
  stroke.delete();
  img.delete();
  surface.delete();
}

console.log(`rendered ${CASES.length} frames through CanvasKit → ${outDir}`);

/**
 * Captures the web reference frames for the parity harness.
 *
 * Loads /parity.html for every type × variant × theme, waits for the page's
 * freeze to apply (window.__parityReady), and screenshots #stage at
 * deviceScaleFactor 2 — yielding 936x484 PNGs directly comparable to
 * ports/ios/BorderBeamKit/snapshots/*.png (same scene geometry, same frozen
 * timestamps).
 *
 * Usage:  node scripts/parity-capture.mjs   (dev server must be on :5173)
 * Output: demo/parity-web/<size>_<variant>_<theme>.png
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'parity-web');
mkdirSync(OUT, { recursive: true });

const SIZES = ['sm', 'md', 'line', 'pulse-outside', 'pulse-inner'];
const VARIANTS = ['colorful', 'mono', 'ocean', 'sunset'];
const THEMES = ['dark', 'light'];

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 600, height: 400 } });
const page = await context.newPage();

let captured = 0;
for (const size of SIZES) {
  for (const variant of VARIANTS) {
    for (const theme of THEMES) {
      const url = `http://localhost:5173/parity.html?size=${size}&variant=${variant}&theme=${theme}`;
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction('window.__parityReady === true', null, { timeout: 15000 });
      const file = join(OUT, `${size}_${variant}_${theme}.png`);
      await page.locator('#stage').screenshot({ path: file });
      captured++;
      process.stdout.write(`\r${captured}/40 ${size}/${variant}/${theme}      `);
    }
  }
}
console.log(`\nWrote ${captured} captures to ${OUT}`);
await browser.close();

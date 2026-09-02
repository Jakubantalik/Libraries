/**
 * Headless-Chrome CPU profile of the showcase "regenerate" (boil) scenario.
 *
 * Usage: node scripts/profile-boil.mjs [label]
 * Requires: Chrome running with --remote-debugging-port=9222 and the demo
 * dev server on :5173. Prints total busy CPU + top self-time functions.
 */

const DEBUG_PORT = 9222;
const PAGE_URL = 'http://localhost:5173/showcase.html';
const label = process.argv[2] ?? 'run';

async function cdpRequest(path, method = 'GET') {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`, { method });
  return res.json();
}

const target = await cdpRequest(`/json/new?${encodeURIComponent(PAGE_URL)}`, 'PUT');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id != null && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
};
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function evalAsync(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

await send('Runtime.enable');
await send('Profiler.enable');

// Wait for the two startRevealed cards to finish their initial reveal.
const pills = await evalAsync(`(async () => {
  for (let i = 0; i < 40; i++) {
    const n = document.querySelectorAll('.showcase-card .showcase-regen-pill').length;
    if (n >= 2) return n;
    await new Promise((r) => setTimeout(r, 250));
  }
  return document.querySelectorAll('.showcase-card .showcase-regen-pill').length;
})()`);
if (pills < 1) {
  console.error('no regenerate pills appeared — aborting');
  process.exit(1);
}

await send('Profiler.start');
await evalAsync(`(async () => {
  const pills = [...document.querySelectorAll('.showcase-card .showcase-regen-pill')];
  for (const p of pills) p.click();
  await new Promise((r) => setTimeout(r, 6000));
  return 'done';
})()`);
const { profile } = await send('Profiler.stop');

const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const durUs = profile.endTime - profile.startTime;
const self = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i];
  self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0));
}
let busyUs = 0;
const rows = [];
for (const [id, us] of self) {
  const n = nodes.get(id);
  const fn = n.callFrame.functionName || '(anon)';
  if (fn === '(idle)') continue;
  busyUs += us;
  const url = (n.callFrame.url || '').split('/').slice(-1)[0];
  rows.push({ fn: fn + (url ? ` @${url}:${n.callFrame.lineNumber + 1}` : ''), ms: us / 1000 });
}
rows.sort((a, b) => b.ms - a.ms);
console.log(
  `[${label}] duration ${(durUs / 1000).toFixed(0)} ms, busy ${(busyUs / 1000).toFixed(1)} ms = ${((100 * busyUs) / durUs).toFixed(2)}% CPU (pills: ${pills})`
);
for (const r of rows.slice(0, 12)) console.log(r.ms.toFixed(1).padStart(8), r.fn);

await send('Page.enable');
await send('Page.close').catch(() => {});
ws.close();

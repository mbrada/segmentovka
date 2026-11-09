// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Miloslav Brada
//
// Obrázek 3D náhledu pouzdra pro stránku (nahled.webp): vyfotí 3D prohlížeč generátoru
// s výchozím rozložením 88:88 v pohledu Šikmo. Chromium se ovládá přes DevTools Protocol
// vestavěným WebSocketem v Node (bez puppeteeru), WebGL kreslí SwiftShader.
// Použití (web musí běžet, třeba ./build.sh && python3 -m http.server 8000 --directory dist):
//   node tools/nahled.mjs http://localhost:8000/ nahled-raw.png
//   magick nahled-raw.png -shave 6x6 -fuzz 8% -trim +repage -bordercolor '#dbe0dc' -border 6%x9% \
//     -resize 1200x750 -gravity center -background '#dbe0dc' -extent 1200x750 -quality 82 nahled.webp
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, view = 'iso'] = process.argv.slice(2);
if (!url || !out) { console.error('použití: node tools/nahled.mjs <url webu> <výstup.png> [back|front|iso]'); process.exit(1); }
const W = 1400, H = 900, port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'segmentovka-'));
const chrome = spawn('chromium', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'],
  { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stop = () => { chrome.kill(); rmSync(profile, { recursive: true, force: true }); };

let ws;
for (let i = 0; i < 100 && !ws; i++) {
  await sleep(200);
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { /* Chromium ještě neposlouchá */ }
}
if (!ws) { stop(); throw new Error('Chromium nenaběhl s ladicím portem'); }
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
await send('Page.enable');
await send('Page.navigate', { url });
// model je hotový, když stavový řádek přestane být „busy“
let ready = false;
for (let i = 0; i < 120 && !ready; i++) {
  await sleep(500);
  ready = await ev(`(() => { const s = document.getElementById('status'); return !!s && !s.classList.contains('busy'); })()`);
}
if (!ready) { stop(); throw new Error('model se nespočítal do minuty'); }
// lišta cookies a stavový řádek do obrázku nepatří
await ev(`document.getElementById('cc')?.remove(); document.getElementById('status').hidden = true;
  document.querySelector('[data-view="${view}"]')?.click(); 1`);
await sleep(2500);
const r = await ev(`(() => { const b = document.getElementById('viewport').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; })()`);
const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1 } });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log(`uloženo ${out} (${Math.round(r[2] * 2)} × ${Math.round(r[3] * 2)} px)`);
ws.close();
stop();

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Miloslav Brada
//
// Výpočet geometrie mimo hlavní vlákno, aby se stránka při generování nezasekla.
import Module from './manifold.js';
import { computeLayout, buildModels } from './gen.js';

let ready = null;
const init = () => (ready ??= Module().then((M) => { M.setup(); return M; }));

// všechny buffery sítí (i jednotlivých dílů) se předají bez kopírování
function buffers(R) {
  const out = [];
  const add = (m) => { if (m && m.vert) out.push(m.vert.buffer, m.tri.buffer); };
  for (const k of ['case', 'diffuser', 'lid']) add(R[k]);
  for (const q of R.pieces || []) { add(q.case); add(q.diffuser); add(q.lid); }
  return out;
}

self.onmessage = async (ev) => {
  const { id, params } = ev.data;
  try {
    const M = await init();
    const t0 = performance.now();
    const L = computeLayout(params);
    const R = buildModels(M, L);
    self.postMessage({ id, ok: true, R, ms: performance.now() - t0 }, buffers(R));
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};

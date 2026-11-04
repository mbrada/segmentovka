// Výpočet geometrie mimo hlavní vlákno, aby se stránka při generování nezasekla.
import Module from './manifold.js';
import { computeLayout, buildModels } from './gen.js';

let ready = null;
const init = () => (ready ??= Module().then((M) => { M.setup(); return M; }));

self.onmessage = async (ev) => {
  const { id, params } = ev.data;
  try {
    const M = await init();
    const t0 = performance.now();
    const L = computeLayout(params);
    const R = buildModels(M, L);
    const transfer = [];
    for (const k in R) transfer.push(R[k].vert.buffer, R[k].tri.buffer);
    self.postMessage({ id, ok: true, R, ms: performance.now() - t0 }, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};

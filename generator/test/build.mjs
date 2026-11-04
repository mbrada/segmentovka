// Sestaví modely v Node a uloží STL – pro kontrolu geometrie.
// Použití: node test/build.mjs [výstupní_adresář] ['{"layout":"88.88"}']
import Module from '../manifold.js';
import { computeLayout, buildModels, lidToPrint, ledMap } from '../gen.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2] || '.';
const params = process.argv[3] ? JSON.parse(process.argv[3]) : {};
mkdirSync(out, { recursive: true });
const M = await Module();
M.setup();
const t0 = performance.now();
const L = computeLayout(params);
const R = buildModels(M, L);
const ms = performance.now() - t0;
console.log(`layout ${L.p.layout}: pouzdro ${L.caseW.toFixed(2)} x ${L.caseH.toFixed(2)} x ${L.p.depth} mm, LED ${L.els.length}, sloupky ${L.posts.length}, ${ms.toFixed(0)} ms`);
for (const w of L.warnings) console.log('VAROVÁNÍ:', w);
function stl(mesh) {
  const n = mesh.tri.length / 3, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  dv.setUint32(80, n, true);
  for (let i = 0; i < n; i++) {
    let o = 84 + i * 50 + 12;
    for (let k = 0; k < 3; k++) { const v = mesh.tri[i * 3 + k] * 3; for (let j = 0; j < 3; j++) { dv.setFloat32(o, mesh.vert[v + j], true); o += 4; } }
  }
  return Buffer.from(buf);
}
for (const [k, m] of Object.entries(R)) {
  const mesh = k === 'lid' ? lidToPrint(m, L) : m;
  console.log(`${k}: tri ${m.tri.length / 3}, objem ${(m.volume / 1000).toFixed(1)} cm3, genus ${m.genus}, status ${m.status}`);
  writeFileSync(`${out}/${k}.stl`, stl(mesh));
}
writeFileSync(`${out}/ledmap.txt`, ledMap(L));

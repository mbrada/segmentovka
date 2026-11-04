// Kontroly topologie pouzdra:
//  - genus hlavního tělesa = počet LED (každý světlovod segmentu je jeden průchozí otvor);
//    u symbolů má jedna dutina víc otvorů (každý souvislý tah písma), proto se tam genus nekontroluje,
//  - žádné volné ostrůvky materiálu (např. vnitřek „o“ v masce symbolu),
//  - drobné uzavřené bublinky mezi stěnami sousedních světlovodů jen hlásí – tisku nevadí.
// Použití: node test/genus.mjs
import Module from '../manifold.js';
import { computeLayout, buildModels } from '../gen.js';
import { SYMBOL_PRESETS } from '../symbols.js';

const M = await Module();
M.setup();
let bad = 0;

function check(params) {
  const L = computeLayout(params);
  const R = buildModels(M, L);
  const whole = new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: R.case.vert, triVerts: R.case.tri }));
  const parts = whole.decompose().sort((a, b) => b.volume() - a.volume());
  const genus = parts[0].genus();
  const islands = parts.slice(1).filter((q) => q.volume() > 0.01);
  const voids = parts.slice(1).filter((q) => q.volume() < 0).reduce((s, q) => s - q.volume(), 0);
  const hasSym = L.els.some((e) => e.kind === 'sym');
  const ok = R.case.status === 'NoError' && !islands.length && (hasSym || genus === L.els.length);
  for (const q of parts) q.delete();
  whole.delete();
  if (!ok) bad++;
  return `${hasSym ? '' : `${genus}/${L.els.length}`}${islands.length ? ` OSTRŮVKY ${islands.length}` : ''}${voids ? ` (bublinky ${voids.toFixed(2)} mm³)` : ''}${ok ? ' ok' : ' !!'}`;
}

for (const layout of ['88:88', '8.8', '-8', '8°', '188', '-88.8°', '88:88:88']) {
  const row = ['pointed', 'bevel', 'round', 'flat'].map((segStyle) => `${segStyle} ${check({ layout, segStyle })}`);
  console.log(layout.padEnd(9), row.join('   '));
}
for (const sym of SYMBOL_PRESETS) {
  console.log(`[${sym}]`.padEnd(9), `8[${sym}] ${check({ layout: `8[${sym}]` })}`, `  sklon 8°: ${check({ layout: `8[${sym}]`, slant: 8 })}`);
}
console.log(bad ? `CHYBA: ${bad} kombinací` : 'OK');
process.exitCode = bad ? 1 : 0;

// Kontrola, že se světlovody nespojují ani neucpávají: genus hlavního tělesa pouzdra
// má odpovídat počtu LED (každý světlovod je jeden průchozí otvor).
// Drobné uzavřené bublinky mezi stěnami sousedních světlovodů jen hlásí – tisku nevadí.
// Použití: node test/genus.mjs
import Module from '../manifold.js';
import { computeLayout, buildModels } from '../gen.js';

const M = await Module();
M.setup();
let bad = 0;
for (const layout of ['88:88', '8.8', '-8', '8°', '188', '-88.8°', '88:88:88']) {
  const row = [];
  for (const segStyle of ['pointed', 'bevel', 'round', 'flat']) {
    const L = computeLayout({ layout, segStyle });
    const R = buildModels(M, L);
    const whole = new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: R.case.vert, triVerts: R.case.tri }));
    const parts = whole.decompose().sort((a, b) => b.volume() - a.volume());
    const genus = parts[0].genus();
    const voids = parts.slice(1).reduce((s, p) => s + Math.abs(p.volume()), 0);
    const ok = genus === L.els.length && R.case.status === 'NoError';
    if (!ok) bad++;
    row.push(`${segStyle} ${genus}/${L.els.length}${voids ? ` (bublinky ${voids.toFixed(2)} mm³)` : ''}${ok ? '' : ' !!'}`);
    for (const p of parts) p.delete();
    whole.delete();
  }
  console.log(layout.padEnd(9), row.join('   '));
}
console.log(bad ? `CHYBA: ${bad} kombinací má spojené nebo ucpané světlovody` : 'OK');
process.exitCode = bad ? 1 : 0;

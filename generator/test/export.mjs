// Ověří ZIP a 3MF export: node test/export.mjs <výstupní_adresář>
import Module from '../manifold.js';
import { computeLayout, buildModels, lidToPrint, ledMap } from '../gen.js';
import { stl, threeMF, zip } from '../export.js';
import { writeFileSync, mkdirSync } from 'node:fs';
const out = process.argv[2] || '.';
mkdirSync(out, { recursive: true });
const M = await Module(); M.setup();
const L = computeLayout({ layout: '88.88' });
const R = buildModels(M, L);
const mf = await zip(threeMF({ title: 'test', parts: [{ name: 'Pouzdro', mesh: R.case }, { name: 'Difuzory', mesh: R.diffuser }], extra: [{ name: 'Zadní krabička', mesh: lidToPrint(R.lid, L), offset: [0, L.caseH + 10, 0] }] }));
const z = await zip([
  { name: 'a_pouzdro.stl', data: stl(R.case, 'pouzdro') },
  { name: 'a.3mf', data: mf },
  { name: 'a_led-mapa.h', data: ledMap(L) },
  { name: 'CTIMNE.txt', data: 'Příliš žluťoučký kůň\n' },
]);
writeFileSync(`${out}/test.zip`, z);
console.log('zip', z.length, 'B, 3mf', mf.length, 'B');

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Miloslav Brada
//
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
const mf = await zip(threeMF({ title: 'test', groups: [
  { name: 'Pouzdro s difuzory', parts: [{ name: 'Pouzdro', mesh: R.case }, { name: 'Difuzory', mesh: R.diffuser }] },
  { name: 'Zadní krabička', parts: [{ name: 'Zadní krabička', mesh: lidToPrint(R.lid, L) }], offset: [0, L.caseH + 10, 0] },
] }));
const z = await zip([
  { name: 'a_pouzdro.stl', data: stl(R.case, 'pouzdro') },
  { name: 'a.3mf', data: mf },
  { name: 'a_led-mapa.h', data: ledMap(L) },
  { name: 'CTIMNE.txt', data: 'Příliš žluťoučký kůň\n' },
]);
writeFileSync(`${out}/test.zip`, z);

// rozdělené velké pouzdro: každý díl jako objekt (pouzdro + difuzory), krabičky zvlášť
const LS = computeLayout({ layout: '88:88', digitH: 300, digitW: 140, segW: 30, gap: 8, colonW: 50, dotSize: 28, margin: 15 });
const RS = buildModels(M, LS);
const groups = [];
for (const q of RS.pieces) groups.push({ name: `Díl ${q.k}`, parts: [{ name: `Pouzdro ${q.k}`, mesh: q.case }, { name: `Difuzory ${q.k}`, mesh: q.diffuser }], offset: [-q.i * 20, q.j * 20, 0] });
for (const q of RS.pieces) groups.push({ name: `Krabička ${q.k}`, parts: [{ name: `Krabička ${q.k}`, mesh: lidToPrint(q.lid, LS) }], offset: [-q.i * 20, LS.caseH + 30 + (LS.split.ny - 1 - q.j) * 20, 0] });
const mfs = await zip(threeMF({ title: 'test dílů', groups }));
writeFileSync(`${out}/dily.3mf`, mfs);
console.log('3mf dílů', mfs.length, 'B,', groups.length, 'objektů');
console.log('zip', z.length, 'B, 3mf', mf.length, 'B');

// Kontroly topologie pouzdra:
//  - genus hlavního tělesa = počet LED (každý světlovod segmentu je jeden průchozí otvor);
//    u symbolů má jedna dutina víc otvorů (každý souvislý tah písma), proto se tam genus nekontroluje,
//  - žádné volné ostrůvky materiálu (např. vnitřek „o“ v masce symbolu),
//  - drobné uzavřené bublinky mezi stěnami sousedních světlovodů jen hlásí – tisku nevadí.
// Použití: node test/genus.mjs
import Module from '../manifold.js';
import { computeLayout, buildModels, USB_PORTS, lidScrewLen, KEYHOLE } from '../gen.js';
import { SYMBOL_PRESETS } from '../symbols.js';

const M = await Module();
M.setup();
let bad = 0;

// rozklad sítě na souvislé části: hlavní těleso, ostrůvky (kladný objem), bublinky (záporný)
function topo(mesh) {
  const whole = new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: mesh.vert, triVerts: mesh.tri }));
  const parts = whole.decompose().sort((a, b) => b.volume() - a.volume());
  const r = {
    genus: parts[0].genus(),
    islands: parts.slice(1).filter((q) => q.volume() > 0.01).length,
    voids: parts.slice(1).filter((q) => q.volume() < 0).reduce((s, q) => s - q.volume(), 0),
  };
  for (const q of parts) q.delete();
  whole.delete();
  return r;
}

// topologie celého pouzdra (dělení vypnuté velkou tiskovou plochou)
function check(params) {
  const L = computeLayout({ bedW: 2000, bedH: 2000, ...params });
  const R = buildModels(M, L);
  const { genus, islands, voids } = topo(R.case);
  const hasSym = L.els.some((e) => e.kind === 'sym');
  const ok = R.case.status === 'NoError' && !islands && (hasSym || genus === L.els.length);
  if (!ok) bad++;
  return `${hasSym ? '' : `${genus}/${L.els.length}`}${islands ? ` OSTRŮVKY ${islands}` : ''}${voids ? ` (bublinky ${voids.toFixed(2)} mm³)` : ''}${ok ? ' ok' : ' !!'}`;
}

// dělení na díly: každý díl platný, bez ostrůvků, vejde se na plochu; spoje mají prvky
function checkSplit(params) {
  const L = computeLayout(params);
  const R = buildModels(M, L);
  const s = L.split;
  const [U, V] = s.bed;
  const msgs = [];
  let ok = !!R.pieces && R.pieces.length === s.n;
  for (const q of R.pieces || []) {
    for (const [name, mesh] of [['pouzdro', q.case], ['krabička', q.lid]]) {
      if (!mesh) continue;
      const t = topo(mesh);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < mesh.vert.length; i += 3) { x0 = Math.min(x0, mesh.vert[i]); x1 = Math.max(x1, mesh.vert[i]); y0 = Math.min(y0, mesh.vert[i + 1]); y1 = Math.max(y1, mesh.vert[i + 1]); }
      const w = x1 - x0, h = y1 - y0;
      // pera rybin přesahují do souseda o pár mm – tolerance 10 mm
      const fits = (w <= U + 10 && h <= V + 10) || (w <= V + 10 && h <= U + 10);
      if (mesh.status !== 'NoError' || t.islands || !fits) { ok = false; msgs.push(`${name} ${q.k}: ${mesh.status}, ostrůvky ${t.islands}, ${w.toFixed(0)}×${h.toFixed(0)}`); }
    }
  }
  const noSpots = s.joints.filter((J) => !J.spots.length).length;
  if (!ok) bad++;
  return `${s.nx}×${s.ny} dílů, spojů ${s.joints.length} (bez šroubů/zámků ${noSpots})${msgs.length ? ' ' + msgs.join('; ') : ''}${ok ? ' ok' : ' !!'}`;
}

for (const layout of ['88:88', '8.8', '-8', '8°', '188', '-88.8°', '88:88:88']) {
  const row = ['pointed', 'bevel', 'round', 'flat', 'lcd'].map((segStyle) => `${segStyle} ${check({ layout, segStyle })}`);
  row.push(`lcd 1,5 ${check({ layout, segStyle: 'lcd', gap: 1.5 })}`, `lcd 0,8 sklon ${check({ layout, segStyle: 'lcd', gap: 0.8, slant: 8 })}`);
  console.log(layout.padEnd(9), row.join('   '));
}
for (const sym of SYMBOL_PRESETS) {
  console.log(`[${sym}]`.padEnd(9), `8[${sym}] ${check({ layout: `8[${sym}]` })}`, `  sklon 8°: ${check({ layout: `8[${sym}]`, slant: 8 })}`);
}
// meteostanice: sloupec symbolů pod sebou, plný i částečný, se sklonem a s jinými styly
for (let [layout, pr] of [
  ['888.8[°C|%|hPa|ppm]', {}], ['888.8[°C|%|hPa|ppm]', { slant: 8, segStyle: 'bevel' }], ['888.8[°C|%|hPa|ppm]', { segStyle: 'round', symStroke: 1.6 }],
  ['888.8[°C|%]', {}], ['888.8[°F|%RH|mbar|CO₂]', {}], ['-88.8[°C|%]', { segStyle: 'flat' }], ['8888[hPa|ppm]', { digitH: 60, digitW: 28, segW: 7, digitGap: 8 }],
  ['8888[°C|%|hPa|ppm] zmenšené písmo', { digitH: 60, digitW: 28, segW: 7, digitGap: 8 }],
]) {
  layout = layout.split(' ')[0]; // za mezerou je jen popis
  const L = computeLayout({ layout, ...pr });
  const sym = L.els.filter((e) => e.kind === 'sym');
  const warn = L.warnings.filter((w) => /překrývají|nevejdou|nemá/.test(w));
  if (warn.length) bad++;
  console.log(layout.padEnd(24), JSON.stringify(pr).padEnd(42), `LED ${L.els.length}, symbolů ${sym.length}, ${L.caseW.toFixed(0)}×${L.caseH.toFixed(0)} mm`, check({ layout, ...pr }), warn.join(' '));
}
const big = { digitH: 300, digitW: 140, segW: 30, gap: 8, colonW: 50, dotSize: 28, margin: 15 };
for (const [name, pr] of [
  ['88:88 obří', { layout: '88:88', ...big }],
  ['88:88 obří, šikmé', { layout: '88:88', ...big, segStyle: 'bevel' }],
  ['88:88 obří, sklon', { layout: '88:88', ...big, slant: 8 }],
  ['8 číslic', { layout: '88888888' }],
  ['88:88:88 velké', { layout: '88:88:88', digitH: 200, digitW: 90, segW: 20 }],
  ['88:88 na A1 mini', { layout: '88:88', bedW: 180, bedH: 180 }],
  ['-88.8[°C] velké', { layout: '-88.8[°C]', digitH: 200, digitW: 90, segW: 20, symH: 40, symStroke: 4 }],
  ['88:88 jen šrouby', { layout: '88:88', ...big, joinType: 'screws' }],
]) console.log(name.padEnd(20), checkSplit(pr));

// Krabička: čepy sloupků zasahují do pouzdra bez kolize (průnik sestavených dílů = 0)
// a otvor pro kabel je v každé poloze celý – úbytek objemu = otvor × tloušťka stěny,
// tedy nezasáhl sloupky, otvory na zavěšení ani spojové stěny dílů.
const man = (m) => new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: m.vert, triVerts: m.tri }));
const unionOf = (meshes) => { const ms = meshes.map(man), u = M.Manifold.union(ms); for (const q of ms) q.delete(); return u; };
function checkLid(params, ports) {
  const L0 = computeLayout({ ...params, usb: 'none' });
  const R0 = buildModels(M, L0);
  const cases = R0.pieces ? R0.pieces.map((q) => q.case) : [R0.case];
  const lids0 = R0.pieces ? R0.pieces.map((q) => q.lid) : [R0.lid];
  const c = unionOf(cases), l = unionOf(lids0), x = c.intersect(l);
  const clash = x.volume();
  [c, l, x].forEach((q) => q.delete());
  const vol0 = lids0.reduce((s, m) => s + m.volume, 0);
  const msgs = [];
  let ok = clash < 0.01;
  if (!ok) msgs.push(`průnik pouzdra a krabičky ${clash.toFixed(2)} mm³`);
  for (const usb of ports) {
    const L = computeLayout({ ...params, usb });
    const R = buildModels(M, L);
    const lids = R.pieces ? R.pieces.map((q) => q.lid) : [R.lid];
    const want = L.usb ? L.p.usbW * L.p.usbH * (L.usb.side ? L.p.lidWall : L.p.lidPlate) : 0;
    const got = vol0 - lids.reduce((s, m) => s + m.volume, 0);
    if (!L.usb || lids.some((m) => m.status !== 'NoError') || Math.abs(got - want) > 1) {
      ok = false;
      msgs.push(`${usb}: ${L.usb ? `úbytek ${got.toFixed(1)} místo ${want.toFixed(1)} mm³` : 'otvor se nevešel'}`);
    }
  }
  if (!ok) bad++;
  return `${R0.pieces ? `${R0.pieces.length} dílů, ` : ''}šrouby M3 × ${lidScrewLen(L0.p).join('–')}, poloh otvoru ${ports.length}${msgs.length ? ' ' + msgs.join('; ') : ''}${ok ? ' ok' : ' !!'}`;
}
const ALL_PORTS = Object.keys(USB_PORTS).filter((k) => k !== 'none');
for (const [name, pr, ports] of [
  ['88:88', { layout: '88:88' }, ALL_PORTS],
  ['8.8 malé', { layout: '8.8' }, ALL_PORTS],
  ['888.8[°C|%] sklon', { layout: '888.8[°C|%]', slant: 8 }, ALL_PORTS],
  ['88:88 bez čepů', { layout: '88:88', postSink: 0 }, ['right', 'back-c']],
  ['88:88 obří', { layout: '88:88', ...big }, ['bottom', 'right', 'top', 'back-c', 'back-tl', 'back-b']],
  ['88888888 A1 mini', { layout: '88888888', bedW: 180, bedH: 180 }, ['bottom', 'top', 'back-c', 'back-t']],
]) console.log(name.padEnd(20), checkLid(pr, ports));

// Otvory na zavěšení: každý je celý průchozí otvor v zadní desce (genus krabičky o 1 víc
// na otvor) a nezasáhne do spojů dílů ani sloupků – úbytek objemu = plocha otvoru × deska.
function checkKeyholes(params) {
  const lidsOf = (pr) => {
    const L = computeLayout({ usb: 'none', ...pr });
    const R = buildModels(M, L);
    return { L, lids: R.pieces ? R.pieces.map((q) => q.lid) : [R.lid] };
  };
  const a = lidsOf({ ...params, keyholes: false }), b = lidsOf(params);
  const n = b.L.keyholes.length;
  const genus = (lids) => lids.reduce((s, m) => s + m.genus, 0);
  const vol = (lids) => lids.reduce((s, m) => s + m.volume, 0);
  const { r, slot, rs } = KEYHOLE;
  // velký kruh + drážka bez části uvnitř kruhu + horní půlka malého kruhu na konci drážky
  const inCircle = rs * Math.sqrt(r * r - rs * rs) + r * r * Math.asin(rs / r);
  const area = Math.PI * r * r + 2 * rs * slot - inCircle + (Math.PI * rs * rs) / 2;
  const want = n * area * b.L.p.lidPlate, got = vol(a.lids) - vol(b.lids);
  const dg = genus(b.lids) - genus(a.lids);
  const ok = b.lids.every((m) => m.status === 'NoError') && dg === n && Math.abs(got - want) < 0.03 * want + 1;
  if (!ok) bad++;
  const pos = b.L.keyholes.map(([x, y]) => `${x.toFixed(1)}/${(b.L.caseH - y).toFixed(1)}`).join(' ');
  return `${n} otvory [${pos}] genus +${dg}, úbytek ${got.toFixed(0)}/${want.toFixed(0)} mm³${b.L.warnings.length ? ' · ' + b.L.warnings.join(' · ') : ''}${ok ? ' ok' : ' !!'}`;
}
for (const [name, pr] of [
  ['88:88 auto', { layout: '88:88' }],
  ['88:88 rozteč 150/40', { layout: '88:88', keyholeGap: 150, keyholeTop: 40 }],
  ['88888888 díly auto', { layout: '88888888' }],
  ['88888888 u spoje', { layout: '88888888', keyholeGap: 100 }],
  ['88:88 obří řez', { layout: '88:88', ...big, keyholeTop: 175 }],
]) console.log(name.padEnd(20), checkKeyholes(pr));
// souvislé písmo symbolů při tisku difuzorů na místě (vůle 0): pouzdro smí mít ostrůvky
// (vnitřky písmen), ale pouzdro + difuzory musí tvořit jeden celek – ostrůvky drží destička
function checkInPlace(params) {
  const L = computeLayout({ bedW: 2000, bedH: 2000, diffClear: 0, ...params });
  const R = buildModels(M, L);
  const own = topo(R.case);
  const u = unionOf([R.case, R.diffuser]);
  const parts = u.decompose();
  const islands = parts.filter((q) => q.volume() > 0.01).length - 1;
  for (const q of parts) q.delete();
  u.delete();
  const ok = R.case.status === 'NoError' && !L.stencil && islands === 0;
  if (!ok) bad++;
  return `ostrůvků v pouzdře ${own.islands}, s difuzory ${islands}${ok ? ' ok' : ' !!'}`;
}
for (const layout of ['888.8[°C|%|hPa|CO₂]', '8[%RH]', '8[mbar|ppm]', '8[A]']) console.log(`na místě ${layout}`.padEnd(32), checkInPlace({ layout }));
{
  // automaticky: šablona při samostatných difuzorech, souvisle při tisku na místě; „vždy“ a „nikdy“ platí
  const st = (pr) => computeLayout({ layout: '8[°C]', ...pr }).stencil;
  const ok = st({}) && !st({ diffClear: 0 }) && st({ diffClear: 0, symStencil: 'on' }) && !st({ symStencil: 'off' }) && st({ diffClear: 0, diffuser: false });
  const warn = computeLayout({ layout: '8[°C]', symStencil: 'off' }).warnings.some((w) => /vypadnou/.test(w));
  if (!ok || !warn) bad++;
  console.log('volba šablonového písma', ok && warn ? 'ok' : '!!');
}
console.log(bad ? `CHYBA: ${bad} kombinací` : 'OK');
process.exitCode = bad ? 1 : 0;

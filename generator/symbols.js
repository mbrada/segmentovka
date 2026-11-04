// Drobné šablonové písmo pro symboly (jednotky apod.) svícené jednou LED.
// Znaky jsou kreslené tahy (středové čáry); tloušťku dává parametr symStroke.
// Uzavřená očka (°, %, A, O, P…) mají záměrné přerušení, aby maska v čele neměla
// volně ležící ostrůvky – pouzdro se tak dá tisknout z jednoho materiálu.
// Bez šablony (stencil: false) jsou tahy souvislé; ostrůvky pak drží difuzor tištěný na místě.
//
// Jednotky písma: výška verzálek 10, výška minusek 7, účaří 0, dotahy dolů do −3.
//
// Symboly lze skládat pod sebe do sloupce: [°C|%|hPa|ppm] – každý má vlastní LED.

export const SYMBOL_PRESETS = ['°C', '°F', '%', '%RH', 'hPa', 'mbar', 'ppm', 'CO₂', 'cm', 'mm', 'm', 'km/h', 'm/s', 'V', 'A', 'W', 'kW', 'kWh', 'Hz', 'h', 'min', 's', 'lx'];

// Veličiny meteostanice v pořadí shora dolů: [klíč, popis, symbol].
export const METEO = [['temp', 'Teplota', '°C'], ['hum', 'Vlhkost', '%'], ['press', 'Tlak', 'hPa'], ['co2', 'CO₂', 'ppm']];

// Symboly, které se standardně zarovnávají nahoru (ostatní dolů na účaří číslic).
const TOP_SYMBOLS = /^°/;

function arc(cx, cy, rx, ry, a0, a1, n = 18) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

// Kroužek s přerušením: gapDeg = úhel mezery, směr mezery at (°).
function ring(cx, cy, r, gapDeg, at) {
  if (gapDeg >= 300) return [[[cx, cy], [cx + 0.01, cy]]]; // příliš malý: jen tečka
  return [arc(cx, cy, r, r, at + gapDeg / 2, at + 360 - gapDeg / 2, 24)];
}

// Bříško šířky w: z bodu (x0, yA) na dříku vodorovně, půlkruh doprava do výšky yB a zpět
// k dříku, kde zůstane mezera šablony gU (jinak by vnitřek písmene vypadl z masky).
function bowl(x0, yA, yB, w, gU) {
  const ry = Math.abs(yA - yB) / 2, cy = (yA + yB) / 2, sgn = yA > yB ? 1 : -1;
  // rovný kus u dříku musí pojmout mezeru; když na kruh nezbude místo, bříško se zúží do elipsy
  const xc = x0 + Math.max(w - ry, gU + 0.3);
  const rx = Math.max(1, Math.min(ry, x0 + w - xc));
  return [[x0, yA], [xc, yA], ...arc(xc, cy, rx, ry, 90 * sgn, -90 * sgn, 14).slice(1), [x0 + gU, yB]];
}

// Každý znak: (gU = mezera šablony v jednotkách písma) => pole lomených čar.
const GLYPHS = {
  '°': (gU) => ring(2, 8, 2, Math.min(359, (2 * Math.asin(Math.min(1, gU / 4)) * 180) / Math.PI), 270),
  C: () => [arc(3.5, 5, 3.5, 5, 40, 320, 24)],
  F: () => [[[5.5, 10], [0, 10], [0, 0]], [[0, 5.3], [4.5, 5.3]]],
  c: () => [arc(3, 3.5, 3, 3.5, 45, 315, 20)],
  m: () => [[[0, 0], [0, 7]], [...arc(2, 5, 2, 2, 180, 0, 10), [4, 0]], [...arc(6, 5, 2, 2, 180, 0, 10), [8, 0]]],
  n: () => [[[0, 0], [0, 7]], [...arc(2.5, 4.5, 2.5, 2.5, 180, 0, 12), [5, 0]]],
  h: () => [[[0, 0], [0, 10]], [...arc(2.5, 4.5, 2.5, 2.5, 180, 0, 12), [5, 0]]],
  i: () => [[[0, 0], [0, 7]], [[0, 9.3], [0, 9.32]]],
  l: () => [[[0, 0], [0, 10]]],
  s: () => [[...arc(2.5, 5.25, 2.5, 1.75, 25, 270, 14), ...arc(2.5, 1.75, 2.5, 1.75, 90, -155, 14).slice(1)]],
  z: () => [[[0, 7], [5, 7], [0, 0], [5, 0]]],
  x: () => [[[0, 0], [5, 7]], [[0, 7], [5, 0]]],
  k: () => [[[0, 0], [0, 10]], [[5, 7], [0, 2.2]], [[1.8, 3.93], [5.2, 0]]],
  '/': () => [[[0, -0.3], [4.2, 10.3]]],
  V: () => [[[0, 10], [3.5, 0], [7, 10]]],
  A: (gU) => {
    const legs = [[0, 0], [3.75, 10], [7.5, 0]];
    const y = 3.4, xl = (3.75 * y) / 10, xr = 7.5 - xl - gU;
    return xr - xl > 1 ? [legs, [[xl, y], [xr, y]]] : [legs];
  },
  W: () => [[[0, 10], [1.9, 0], [3.8, 7], [5.7, 0], [7.6, 10]]],
  H: () => [[[0, 0], [0, 10]], [[6, 0], [6, 10]], [[0, 5], [6, 5]]],
  // oblouk napojený na dřík nahoře, dole končí mezerou šablony (bříško P, R, p, b)
  P: (gU) => [[[0, 0], [0, 10]], bowl(0, 10, 4.6, 5.4, gU)],
  R: (gU) => [[[0, 0], [0, 10]], bowl(0, 10, 4.6, 5.4, gU), [[Math.max(2.6, gU + 0.6), 4.6], [5.8, 0]]],
  p: (gU) => [[[0, -3], [0, 7]], bowl(0, 7, 0, 4.8, gU)],
  b: (gU) => [[[0, 0], [0, 10]], bowl(0, 0, 7, 4.8, gU)],
  // dvoupatrové a: horní oblouk přechází v dřík, bříško visí na dříku a dole má mezeru
  a: (gU) => [
    [...arc(2.4, 4.8, 2.3, 2.2, 160, 0, 12), [4.7, 0]],
    [[4.7, 3.7], [2, 3.7], ...arc(2, 1.85, 1.85, 1.85, 90, 270, 12).slice(1), [Math.max(2, 4.7 - gU), 0]],
  ],
  r: () => [[[0, 0], [0, 7]], arc(2.9, 4.2, 2.9, 2.8, 180, 62, 10)],
  // O se dvěma mezerami (nahoře a dole)
  O: (gU) => {
    const g = Math.min(80, (2 * Math.asin(Math.min(1, gU / 7.4)) * 180) / Math.PI);
    return [arc(3.7, 5, 3.7, 5, 90 + g / 2, 270 - g / 2, 16), arc(3.7, 5, 3.7, 5, 270 + g / 2, 450 - g / 2, 16)];
  },
  // dolní index 2 (CO₂); v textu symbolu lze psát i obyčejnou 2
  '₂': () => [[...arc(1.75, 2.3, 1.55, 1.55, 160, -35, 12), [0, -1.6], [3.5, -1.6]]],
  '%': (gU) => {
    const gd = Math.min(359, (2 * Math.asin(Math.min(1, gU / 3.6)) * 180) / Math.PI);
    return [...ring(1.8, 8.2, 1.8, gd, 180), [[0.2, -0.2], [7.8, 10.2]], ...ring(6.2, 1.8, 1.8, gd, 0)];
  },
};

export const SYMBOL_CHARS = Object.keys(GLYPHS).join('');

// Rozvrhne text symbolu. Vrací lomené čáry v mm (x od 0, účaří y = 0), rozměry a nepodporované znaky.
export function layoutSymbol(text, { height, stroke, stencil = true }) {
  const s = height / 10; // mm na jednotku písma
  const gU = stencil ? (stroke + 1.0) / s : 0; // mezera šablony: 1 mm volného místa mezi tahy
  const spacing = Math.max(stroke + 1.5, 0.2 * height);
  const lines = [];
  const bad = [];
  let x = 0;
  let first = true;
  for (const ch0 of text) {
    const ch = ch0 === '2' ? '₂' : ch0;
    const g = GLYPHS[ch];
    if (!g) { bad.push(ch); continue; }
    const polys = g(gU);
    let minX = Infinity, maxX = -Infinity;
    for (const pl of polys) for (const [px] of pl) { minX = Math.min(minX, px); maxX = Math.max(maxX, px); }
    if (!first) x += spacing;
    for (const pl of polys) lines.push(pl.map(([px, py]) => [x + (px - minX) * s, py * s]));
    x += (maxX - minX) * s;
    first = false;
  }
  let minY = Infinity, maxY = -Infinity;
  for (const pl of lines) for (const [, py] of pl) { minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
  if (!lines.length) { minY = 0; maxY = 0; }
  return { lines, width: x, minY, maxY, bad, top: TOP_SYMBOLS.test(text) };
}

// Obrys tahu jako sada konvexních polygonů (obdélníky úseků + kruhy ve vrcholech), proti směru hodin.
export function strokePolygons(lines, stroke, n = 16) {
  const r = stroke / 2;
  const out = [];
  const circle = ([cx, cy]) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  };
  for (const pl of lines) {
    for (let i = 0; i < pl.length; i++) {
      out.push(circle(pl[i]));
      if (i === 0) continue;
      const [ax, ay] = pl[i - 1], [bx, by] = pl[i];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      const nx = (-dy / L) * r, ny = (dx / L) * r;
      out.push([[ax - nx, ay - ny], [bx - nx, by - ny], [bx + nx, by + ny], [ax + nx, ay + ny]]);
    }
  }
  return out;
}

// Konvexní obal bodů (monotone chain), proti směru hodin.
export function convexHull(points) {
  const P = points.map(([x, y]) => [x, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of P) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

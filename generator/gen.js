// Geometrie generátoru pouzdra pro 7segmentový displej z modulů WS2812B.
//
// Souřadnice:
//  - "čelní" 2D souřadnice (front): pohled zepředu, x doprava, y nahoru, mm.
//  - model 3D: čelo leží na z = 0 (tiskne se čelem dolů), X = šířka − x (zrcadlení,
//    protože na čelo se díváme zespodu), Y = y, Z roste dozadu.
//
// Výchozí hodnoty odpovídají původnímu Case.3mf (7-Segment Uhr v38, 88:88).

import { layoutSymbol, strokePolygons, convexHull } from './symbols.js';
import { computeSplit, jointPoint, JOINT } from './split.js';

export const DEFAULTS = {
  layout: '88:88',
  // číslice
  digitW: 40, digitH: 90, segW: 10, gap: 3.54, slant: 0, segStyle: 'pointed',
  digitGap: 5, colonW: 20, dpW: 12, dotSize: 10, dotShape: 'diamond',
  // symboly [cm], [°C]…: maska v čele, jedna LED
  symH: 16, symStroke: 2, symPos: 'auto', symPad: 2, symStencil: 'auto',
  // pouzdro
  margin: 8, wall: 3, front: 3, depth: 45.5, chamfer: 0.5,
  recessDepth: 1, recessInset: 1, tubeWall: 2, tubeEndD: 10,
  // lůžko modulu
  backSpace: 4, ringH: 2.3, ringWall: 2, modD: 9.85, slotW: 8.5,
  pocket: 8.5, pocketH: 1.2, windowSize: 5.5, windowH: 2, coneH: 1.75,
  lip: 0, pcbT: 1.6,
  // sloupky a šrouby
  postSize: 11, midPostW: 8, screwD: 2.9, screwDepth: 25, extraPosts: true,
  // difuzory
  diffuser: true, diffClear: 0.2, diffT: 1,
  // zadní víko (krabička); sloupky pouzdra jsou o postSink nižší a sloupky krabičky do nich
  // zasahují čepem s vůlí postFit; otvor pro kabel viz USB_PORTS
  lid: true, lidDepth: 30, lidWall: 2, lidPlate: 3, lidScrewD: 3.4, lidHeadD: 6.5,
  lidClamp: 3, postSink: 3, postFit: 0.2, usb: 'right', usbW: 12, usbH: 7,
  // otvory na zavěšení: keyholeTop = od horní hrany ke středu velkého otvoru, keyholeGap = rozteč
  // dvou otvorů souměrně kolem středu (0 = automaticky: čtvrtiny šířky, u dílů střed každého horního dílu)
  keyholes: true, keyholeGap: 0, keyholeTop: 26,
  // dělení na díly podle tiskové plochy
  splitMode: 'auto', bedW: 256, bedH: 256, joinType: 'both', jointWall: 2.5, joinClear: 0.15,
  notchW: 14, notchH: 12,
  // zapojení
  segOrder: 'abcdefg',
  quality: 40,
};

// Otvor pro kabel v čelním pohledu: v boku krabičky uprostřed strany, nebo v zadní stěně
// v mřížce 3 × 3 (back-<svisle><vodorovně>: t/b = nahoře/dole, l/r = vlevo/vpravo, c = střed).
export const USB_PORTS = {
  right: 'v boku vpravo', left: 'v boku vlevo', bottom: 'v boku dole', top: 'v boku nahoře',
  'back-tl': 'vzadu vlevo nahoře', 'back-t': 'vzadu nahoře', 'back-tr': 'vzadu vpravo nahoře',
  'back-l': 'vzadu vlevo', 'back-c': 'vzadu uprostřed', 'back-r': 'vzadu vpravo',
  'back-bl': 'vzadu vlevo dole', 'back-b': 'vzadu dole', 'back-br': 'vzadu vpravo dole',
  none: 'bez otvoru',
};

// Čepy sloupků: o kolik je sloupek pouzdra nižší a jak dlouhý čep na něj z krabičky dosedá
// (0,3 mm osová vůle, aby krabička vždy dosedla okrajem).
export function postPeg(p) {
  const sink = p.lid ? Math.max(0, Math.min(p.postSink, p.depth - p.front - 1)) : 0;
  const peg = sink - 0.3;
  return peg >= 0.3 ? { sink, peg } : { sink: 0, peg: 0 };
}

// Doporučená délka šroubů krabičky (M3): projde dnem pod hlavou a čepem, do pouzdra 8–13 mm.
export function lidScrewLen(p) {
  const STD = [8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50];
  const pass = p.lidClamp + postPeg(p).peg;
  const lo = STD.find((s) => s >= pass + 8) ?? STD[STD.length - 1];
  const hi = [...STD].reverse().find((s) => s <= pass + Math.min(13, p.screwDepth - 1)) ?? lo;
  return [lo, Math.max(lo, hi)];
}

const GLYPH_SEGS = { digit: 'abcdefg', one: 'bc', minus: 'g', deg: 'abfg', blank: '' };
const DIGITLIKE = new Set(['digit', 'one', 'minus', 'deg', 'blank', 'sym']);

export function parseLayout(str) {
  const glyphs = [];
  const bad = new Set();
  const chars = [...String(str || '')];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '[') {
      const end = chars.indexOf(']', i + 1);
      if (end < 0) { bad.add('['); continue; }
      // [°C|%|hPa] = sloupec symbolů pod sebou, každý se svou LED
      const text = chars.slice(i + 1, end).join('').trim();
      const items = text.split('|').map((t) => t.trim()).filter(Boolean);
      if (items.length) glyphs.push({ t: 'sym', ch: items.join('|'), items });
      i = end;
      continue;
    }
    let t = null;
    if (/[02-9]/.test(ch)) t = 'digit';
    else if (ch === '1') t = 'one';
    else if (ch === '-' || ch === '−') t = 'minus';
    else if (ch === '°' || ch === '*') t = 'deg';
    else if (ch === ':') t = 'colon';
    else if (ch === '.' || ch === ',') t = 'dp';
    else if (ch === ' ' || ch === '_') t = 'blank';
    if (t) glyphs.push({ t, ch });
    else bad.add(ch);
  }
  return { glyphs, bad: [...bad] };
}

// ---------- 2D pomocné funkce ----------

function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}
const ccw = (poly) => (area(poly) < 0 ? poly.slice().reverse() : poly);

// Odsazení konvexního polygonu (d > 0 ven, d < 0 dovnitř), ostré rohy.
export function offsetConvex(poly, d) {
  const P = ccw(poly);
  const n = P.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const nx = dy / L, ny = -dx / L; // vnější normála pro CCW
    lines.push({ px: a[0] + nx * d, py: a[1] + ny * d, dx: dx / L, dy: dy / L });
  }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l1 = lines[(i + lines.length - 1) % lines.length], l2 = lines[i];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(den) < 1e-9) { out.push([l2.px, l2.py]); continue; }
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
    out.push([l1.px + l1.dx * t, l1.py + l1.dy * t]);
  }
  return out;
}

function hexSeg(p0, p1, w) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const t = Math.min(w / 2, len / 2), h = w / 2;
  return [
    [p0[0], p0[1]],
    [p0[0] + ux * t - nx * h, p0[1] + uy * t - ny * h],
    [p1[0] - ux * t - nx * h, p1[1] - uy * t - ny * h],
    [p1[0], p1[1]],
    [p1[0] - ux * t + nx * h, p1[1] - uy * t + ny * h],
    [p0[0] + ux * t + nx * h, p0[1] + uy * t + ny * h],
  ];
}

// Obdélník (rovné konce) nebo „stadion“ (půlkruhové konce) mezi koncovými body p0, p1.
function barSeg(p0, p1, w, round, n = 12) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, h = w / 2;
  if (!round) {
    return [
      [p0[0] - nx * h, p0[1] - ny * h], [p1[0] - nx * h, p1[1] - ny * h],
      [p1[0] + nx * h, p1[1] + ny * h], [p0[0] + nx * h, p0[1] + ny * h],
    ];
  }
  const r = Math.min(h, len / 2);
  const c0 = [p0[0] + ux * r, p0[1] + uy * r], c1 = [p1[0] - ux * r, p1[1] - uy * r];
  const a0 = Math.atan2(uy, ux);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 - Math.PI / 2 + (Math.PI * i) / n;
    pts.push([c1[0] + r * Math.cos(a), c1[1] + r * Math.sin(a)]);
  }
  for (let i = 0; i <= n; i++) {
    const a = a0 + Math.PI / 2 + (Math.PI * i) / n;
    pts.push([c0[0] + r * Math.cos(a), c0[1] + r * Math.sin(a)]);
  }
  return pts;
}

// Je polygon konvexní a nedegenerovaný? (kontrola, zda se segment do číslice vejde)
function convexOk(poly) {
  if (Math.abs(area(poly)) < 1) return false;
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], [cx, cy] = poly[(i + 2) % poly.length];
    const cr = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cr) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cr);
    else if (Math.sign(cr) !== sign) return false;
  }
  return true;
}

export const SEG_STYLES = ['pointed', 'bevel', 'round', 'flat'];

// Tvar segmentu s ∈ a..g v daném stylu. k: osy číslice (xl, xr svislé, yb, ym, yt vodorovné),
// polovina tloušťky h a mezera g = nejmenší vzdálenost sousedních segmentů.
// Vrací { poly, p0, p1 } – p0, p1 jsou konce segmentu na jeho ose (pro střed a směr lůžka).
function segmentShape(style, s, k) {
  const { xl, xr, yb, ym, yt, h, g } = k;
  const w = 2 * h, sq = g / Math.SQRT2, sv = g * Math.SQRT2;
  const horiz = s === 'a' || s === 'd' || s === 'g';
  const xs = s === 'b' || s === 'c' ? xr : xl;
  const upper = s === 'b' || s === 'f';
  const mirror = (poly) => poly.map(([x, y]) => [xl + xr - x, y]);

  if (style === 'flat' || style === 'round') {
    // rovné: vodorovné pruhy přes celou šířku včetně rohů, svislé mezi nimi s mezerou g;
    // zaoblené: konce posunuté tak, aby oblouky sousedů dělila mezera g
    const yh = { a: yt, d: yb, g: ym }[s];
    const eh = style === 'flat' ? -h : (g + w) / Math.SQRT2 - h;
    const ev = style === 'flat' ? h + g : eh;
    const [p0, p1] = horiz
      ? [[xl + eh, yh], [xr - eh, yh]]
      : upper ? [[xs, ym + ev], [xs, yt - ev]] : [[xs, yb + ev], [xs, ym - ev]];
    return { poly: barSeg(p0, p1, w, style === 'round'), p0, p1 };
  }

  if (style === 'bevel' && s !== 'g') {
    // vnější rohy dělí šikmá spára pod 45°, u prostředního segmentu zůstávají hroty
    if (s === 'a') return { poly: [[xl - h + sq, yt + h], [xr + h - sq, yt + h], [xr - h - sq, yt - h], [xl + h + sq, yt - h]], p0: [xl + sq, yt], p1: [xr - sq, yt] };
    if (s === 'd') return { poly: [[xl - h + sq, yb - h], [xl + h + sq, yb + h], [xr - h - sq, yb + h], [xr + h - sq, yb - h]], p0: [xl + sq, yb], p1: [xr - sq, yb] };
    const f = [[xl - h, ym + sv + h], [xl, ym + sv], [xl + h, ym + sv + h], [xl + h, yt - h - sq], [xl - h, yt + h - sq]];
    const e = [[xl - h, yb - h + sq], [xl + h, yb + h + sq], [xl + h, ym - sv - h], [xl, ym - sv], [xl - h, ym - sv - h]];
    const poly = upper ? f : e;
    const ends = upper ? [[xl, ym + sv], [xl, yt - sq]] : [[xl, yb + sq], [xl, ym - sv]];
    if (s === 'b' || s === 'c') return { poly: mirror(poly), p0: [xr, ends[0][1]], p1: [xr, ends[1][1]] };
    return { poly, p0: ends[0], p1: ends[1] };
  }

  // hroty 45° (původní tvar): vodorovné sahají až do os, svislé se zkracují o g·√2
  const def = {
    a: [[xl, yt], [xr, yt]], d: [[xl, yb], [xr, yb]], g: [[xl, ym], [xr, ym]],
    b: [[xr, ym + sv], [xr, yt - sv]], c: [[xr, yb + sv], [xr, ym - sv]],
    e: [[xl, yb + sv], [xl, ym - sv]], f: [[xl, ym + sv], [xl, yt - sv]],
  };
  const [p0, p1] = def[s];
  return { poly: hexSeg(p0, p1, w), p0, p1 };
}

function circlePts(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function dotPoly(shape, cx, cy, size, n) {
  const h = size / 2;
  if (shape === 'circle') return circlePts(cx, cy, h, n);
  if (shape === 'square') return [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
  return [[cx, cy - h], [cx + h, cy], [cx, cy + h], [cx - h, cy]]; // kosočtverec
}

// ---------- rozložení ----------

export function computeLayout(params) {
  const p = { ...DEFAULTS, ...params };
  const { glyphs, bad } = parseLayout(p.layout);
  const H = p.digitH, w = p.segW;
  const k = Math.tan((p.slant * Math.PI) / 180);
  const shear = ([x, y]) => [x + (y - H / 2) * k, y];
  const warnings = [];
  if (bad.length) warnings.push(`Neznámé znaky v rozložení: ${bad.map((c) => `„${c}“`).join(', ')} (ignoruji je).`);

  const rOut = p.modD / 2 + p.ringWall;
  // šablonové přerušení písma symbolů: automaticky jen tehdy, když vnitřky písmen nedrží
  // difuzor tištěný na místě (vůle 0 – za maskou je destička z difuzorového materiálu)
  const inPlace = p.diffuser && p.recessDepth > 0 && p.diffClear <= 0;
  const stencil = p.symStencil === 'on' || (p.symStencil !== 'off' && !inPlace);
  const cells = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    const prev = glyphs[i - 1];
    if (prev && DIGITLIKE.has(prev.t) && DIGITLIKE.has(g.t)) x += p.digitGap;
    let cw = g.t === 'one' ? w : g.t === 'colon' ? p.colonW : g.t === 'dp' ? p.dpW : p.digitW;
    let syms = null;
    if (g.t === 'sym') {
      const lay = (hgt) => g.items.map((t) => layoutSymbol(t, { height: hgt, stroke: p.symStroke, stencil }));
      syms = lay(p.symH);
      if (g.items.length > 1) {
        // sloupec: každý symbol má pás výšky H/n; mezi okny musí zůstat stěna světlovodu
        const room = H / g.items.length - p.symStroke - Math.max(p.tubeWall, 1);
        const bb = Math.max(...syms.map((s) => s.maxY - s.minY));
        if (bb > room && room > 1) syms = lay((p.symH * room) / bb);
      }
      syms.forEach((sy, j) => {
        if (sy.bad.length) warnings.push(`Symbol [${g.items[j]}]: znaky ${sy.bad.map((c) => `„${c}“`).join(', ')} písmo nemá (vynechávám je).`);
      });
      cw = Math.max(Math.max(...syms.map((sy) => sy.width)) + p.symStroke + 2 * p.symPad, 2 * rOut + 1);
    }
    cells.push({ ...g, x0: x, w: cw, idx: i, syms });
    x += cw;
  });

  const els = [];
  const nCirc = 24;
  const style = SEG_STYLES.includes(p.segStyle) ? p.segStyle : 'pointed';
  let tooShort = false;
  for (const c of cells) {
    if (c.t in GLYPH_SEGS) {
      const segs = GLYPH_SEGS[c.t];
      const W = c.w;
      const sk = { xl: c.x0 + w / 2, xr: c.x0 + W - w / 2, yb: w / 2, ym: H / 2, yt: H - w / 2, h: w / 2, g: Math.max(0, p.gap) };
      for (const s of segs) {
        const sh = segmentShape(style, s, sk);
        const p0 = sh.p0, p1 = sh.p1;
        const len = (p1[0] - p0[0]) * (s === 'a' || s === 'd' || s === 'g' ? 1 : 0) + (p1[1] - p0[1]) * (s === 'a' || s === 'd' || s === 'g' ? 0 : 1);
        if (len < 0.5 || !convexOk(sh.poly)) { tooShort = true; continue; }
        const poly = sh.poly.map(shear);
        const s0 = shear(p0), s1 = shear(p1);
        const ux = s1[0] - s0[0], uy = s1[1] - s0[1], ul = Math.hypot(ux, uy);
        els.push({
          glyph: c.idx, ch: c.ch, name: s, kind: 'seg', poly,
          c: [(s0[0] + s1[0]) / 2, (s0[1] + s1[1]) / 2], u: [ux / ul, uy / ul],
        });
      }
    } else if (c.t === 'sym') {
      const n = c.syms.length, r = p.symStroke / 2;
      const wMax = Math.max(...c.syms.map((sy) => sy.width));
      c.syms.forEach((sy, j) => {
        if (!sy.lines.length) return;
        let dy, dx;
        if (n > 1) {
          // sloupec zarovnaný vlevo, každý symbol uprostřed svého pásu
          dy = H - (H / n) * (j + 0.5) - (sy.minY + sy.maxY) / 2;
          dx = c.x0 + (c.w - wMax) / 2;
        } else {
          const pos = p.symPos === 'auto' ? (sy.top ? 'top' : 'bottom') : p.symPos;
          dy = pos === 'top' ? H - sy.maxY - r : pos === 'middle' ? H / 2 - (sy.minY + sy.maxY) / 2 : r - sy.minY;
          dx = c.x0 + (c.w - sy.width) / 2;
        }
        const lines = sy.lines.map((pl) => pl.map(([px, py]) => shear([px + dx, py + dy])));
        const window = convexHull(strokePolygons(lines, p.symStroke, 12).flat());
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [px, py] of window) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
        els.push({
          glyph: c.idx, ch: c.ch, name: c.items[j], kind: 'sym', sub: j, stack: n > 1, poly: window, lines,
          c: [(x0 + x1) / 2, (y0 + y1) / 2], u: [1, 0],
        });
      });
    } else {
      const cx = c.x0 + c.w / 2;
      const ys = c.t === 'colon' ? [(H / 2 + H - w / 2) / 2, (w / 2 + H / 2) / 2] : [w / 2];
      const names = c.t === 'colon' ? ['horní', 'dolní'] : ['tečka'];
      ys.forEach((y, j) => {
        const [sx, sy] = shear([cx, y]);
        const vu = Math.hypot(k, 1);
        els.push({
          glyph: c.idx, ch: c.ch, name: names[j], kind: 'dot',
          poly: dotPoly(p.dotShape, sx, sy, p.dotSize, nCirc), c: [sx, sy], u: [k / vu, 1 / vu],
        });
      });
    }
  }

  if (tooShort) warnings.push('Některé segmenty se do číslice nevejdou – zvětšete číslici, nebo zmenšete tloušťku segmentu či mezeru.');

  // ohraničení obsahu: všechny tvary + rohy buněk (kvůli mezerám na krajích)
  let minX = Infinity, maxX = -Infinity, minY = 0, maxY = H;
  const grow = ([px, py]) => {
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  };
  els.forEach((e) => e.poly.forEach(grow));
  cells.forEach((c) => [[c.x0, 0], [c.x0 + c.w, 0], [c.x0, H], [c.x0 + c.w, H]].map(shear).forEach(grow));
  if (!cells.length) { minX = 0; maxX = 0; }

  const offX = p.margin - minX, offY = p.margin - minY;
  const caseW = maxX - minX + 2 * p.margin, caseH = maxY - minY + 2 * p.margin;
  const mv = ([px, py]) => [px + offX, py + offY];
  for (const e of els) { e.poly = e.poly.map(mv); e.c = mv(e.c); if (e.lines) e.lines = e.lines.map((pl) => pl.map(mv)); }
  for (const c of cells) { c.cx = c.x0 + c.w / 2 + offX; }

  // pořadí LED v řetězu
  const order = (p.segOrder || 'abcdefg').toLowerCase();
  const rank = (e) => (e.kind === 'seg' ? (order.indexOf(e.name) >= 0 ? order.indexOf(e.name) : 10 + 'abcdefg'.indexOf(e.name)) : e.kind === 'sym' ? e.sub : e.name === 'dolní' ? 1 : 0);
  els.sort((a, b) => a.glyph - b.glyph || rank(a) - rank(b));
  els.forEach((e, i) => (e.led = i));

  // sloupky se šrouby
  const posts = [];
  const ps = p.postSize, hc = p.wall + (ps - p.wall) / 2, mw = p.midPostW;
  posts.push({ r: [0, 0, ps, ps], h: [hc, hc] });
  posts.push({ r: [caseW - ps, 0, caseW, ps], h: [caseW - hc, hc] });
  posts.push({ r: [0, caseH - ps, ps, caseH], h: [hc, caseH - hc] });
  posts.push({ r: [caseW - ps, caseH - ps, caseW, caseH], h: [caseW - hc, caseH - hc] });
  // vnitřní sloupek nesmí zasahovat do lůžka LED ani do světlovodu u čela
  const rectFree = ([rx0, ry0, rx1, ry1]) => els.every((e) => {
    const dx = Math.max(0, rx0 - e.c[0], e.c[0] - rx1), dy = Math.max(0, ry0 - e.c[1], e.c[1] - ry1);
    if (Math.hypot(dx, dy) < rOut + 1) return false;
    const m = p.tubeWall + 0.5;
    let ex0 = Infinity, ex1 = -Infinity, ey0 = Infinity, ey1 = -Infinity;
    for (const [px, py] of e.poly) { ex0 = Math.min(ex0, px); ex1 = Math.max(ex1, px); ey0 = Math.min(ey0, py); ey1 = Math.max(ey1, py); }
    return rx1 < ex0 - m || rx0 > ex1 + m || ry1 < ey0 - m || ry0 > ey1 + m;
  });
  const edgeRects = (xAt) => [hc, caseH - hc].map((hy) => {
    const hx = xAt(hy), y0 = hy < caseH / 2 ? 0 : caseH - ps;
    return { r: [hx - mw / 2, y0, hx + mw / 2, y0 + ps], h: [hx, hy] };
  });
  const edgePosts = (xAt) => {
    const rs = edgeRects(xAt);
    if (rs.every((q) => rectFree(q.r))) { posts.push(...rs); return true; }
    return false;
  };
  const xAtFor = (xc) => (hy) => xc + (hy - offY - H / 2) * k;
  const colons = cells.filter((c) => c.t === 'colon');
  if (p.extraPosts) {
    for (const c of colons) {
      edgePosts(xAtFor(c.cx));
      const cy = offY + H / 2;
      const r = [c.cx - mw / 2, cy - mw / 2, c.cx + mw / 2, cy + mw / 2];
      if (rectFree(r)) posts.push({ r, h: [c.cx, cy] });
    }
    if (!colons.length && caseW > 150 && cells.length > 1) {
      // hranice mezi buňkami od středu ven; první, kde se sloupky vejdou mimo lůžka
      const xs = [];
      for (let i = 1; i < cells.length; i++) xs.push((cells[i - 1].x0 + cells[i - 1].w + cells[i].x0) / 2 + offX);
      xs.sort((a, b) => Math.abs(a - caseW / 2) - Math.abs(b - caseW / 2));
      for (const xb of xs) if (edgePosts(xAtFor(xb))) break;
    }
  }

  // kontroly
  let minD = Infinity;
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++)
      minD = Math.min(minD, Math.hypot(els[i].c[0] - els[j].c[0], els[i].c[1] - els[j].c[1]));
  if (minD < 2 * rOut) warnings.push(`Lůžka sousedních LED se překrývají (vzdálenost středů ${minD.toFixed(1)} mm < ${(2 * rOut).toFixed(1)} mm). Zvětšete mezery.`);
  const z = zStack(p);
  if (z.tubeEnd < p.front + 3) warnings.push('Pouzdro je na tyto rozměry lůžka příliš mělké – zvětšete hloubku.');
  if (!els.length) warnings.push('Rozložení neobsahuje žádný segment.');
  if (!stencil && !inPlace && els.some((e) => e.kind === 'sym'))
    warnings.push('Písmo symbolů je bez šablonových přerušení, ale difuzory se netisknou na místě (vůle 0) – vnitřky písmen (O, °, %, P…) z masky vypadnou.');

  // dělení na díly (když se pouzdro nevejde na tiskovou plochu)
  const outer = els.map((e) => offsetConvex(e.poly, (e.kind === 'sym' ? 0 : -p.recessInset) + p.tubeWall + 0.5));
  const split = computeSplit(p, { W: caseW, H: caseH, els, outer, posts, rOut, keyholes: [] }, warnings);
  // otvory na zavěšení: zadaná rozteč souměrně kolem středu, automaticky po jednom uprostřed
  // každého horního dílu, jinak ve čtvrtinách šířky; ze zóny spojů dílů se odsunou
  const kh = p.keyholes && caseW > 60 ? keyholePlan(p, caseW, caseH, warnings) : null;
  let keyholes = [];
  if (kh) {
    const xs = kh.xs || (split.n > 1
      ? split.pieces.filter((q) => q.j === split.ny - 1 && q.r[2] - q.r[0] >= 60).map((q) => (q.r[0] + q.r[2]) / 2)
      : [caseW * 0.25, caseW * 0.75]);
    keyholes = xs.map((kx) => keyholeClear(p, [kx, kh.y], caseW, caseH, split, posts, warnings));
  }
  const usb = cablePort(p, caseW, caseH, posts, split, keyholes, warnings);

  return { p, cells, els, posts, stencil, caseW, caseH, offX, offY, warnings, z, rOut, minD, split, keyholes, usb };
}

// Klíčová dírka v čelních souřadnicích: velký otvor (střed [kx, ky]) a nad ním drážka
// k malému otvoru, na kterém pouzdro visí (kreslí ji i čelní pohled).
export const KEYHOLE = { r: 4.2, slot: 10, rs: 2.2 };
const khBox = ([kx, ky]) => [kx - KEYHOLE.r, ky - KEYHOLE.r, kx + KEYHOLE.r, ky + KEYHOLE.slot + KEYHOLE.rs];
const mm = (v) => String(+v.toFixed(1)).replace('.', ',');

// Svislá poloha otvorů a u zadané rozteči i vodorovné; mimo stěny krabičky.
function keyholePlan(p, W, H, warnings) {
  const lw = p.lidWall, { r, slot, rs } = KEYHOLE;
  const tMin = lw + 0.5 + slot + rs, tMax = H - lw - 0.5 - r;
  const top = Math.min(tMax, Math.max(tMin, p.keyholeTop));
  if (Math.abs(top - p.keyholeTop) > 1e-6) warnings.push(`Otvory na zavěšení: vzdálenost od horní hrany ${mm(p.keyholeTop)} mm se nevejde mezi stěny krabičky, použito ${mm(top)} mm.`);
  if (!(p.keyholeGap > 0)) return { y: H - top, xs: null };
  const gMin = 2 * r + 3, gMax = W - 2 * (lw + 0.5 + r);
  const gap = Math.min(gMax, Math.max(gMin, p.keyholeGap));
  if (Math.abs(gap - p.keyholeGap) > 1e-6) warnings.push(`Rozteč otvorů na zavěšení ${mm(p.keyholeGap)} mm ${p.keyholeGap > gap ? 'je na šířku pouzdra moc velká' : 'je moc malá'}, použito ${mm(gap)} mm.`);
  return { y: H - top, xs: [W / 2 - gap / 2, W / 2 + gap / 2] };
}

// Otvor nesmí zasáhnout spojovou stěnu dílů ani zámky, šrouby a průchody pro vodiče
// (sahají nejvýš jz od řezu) – posune se vedle spoje.
// Do sloupku krabičky zasahovat smí jen s varováním (posouvá se jen zadáním parametrů).
function keyholeClear(p, k, W, H, split, posts, warnings) {
  const { r, slot, rs } = KEYHOLE;
  const jz = Math.max(p.jointWall + 1, JOINT.dove.td + JOINT.dove.boss + 1, p.jointWall + JOINT.padT + 3.5) + 1;
  let [kx, ky] = k;
  for (const J of split.joints) {
    const b = khBox([kx, ky]);
    if (J.dir === 'v') {
      if (b[3] < J.from || b[1] > J.to || b[2] <= J.at - jz || b[0] >= J.at + jz) continue;
      kx = kx < J.at ? J.at - jz - r : J.at + jz + r;
    } else {
      if (b[2] < J.from || b[0] > J.to || b[3] <= J.at - jz || b[1] >= J.at + jz) continue;
      ky = J.at + jz + r + slot + rs <= H - p.lidWall - 0.5 ? J.at + jz + r : J.at - jz - slot - rs;
    }
  }
  const d = Math.hypot(kx - k[0], ky - k[1]);
  const msg = `Otvor na zavěšení by zasáhl do spoje dílů, je posunutý o ${mm(d)} mm.`;
  if (d > 1e-6 && !warnings.includes(msg)) warnings.push(msg);
  const postR = p.lidHeadD / 2 + 1.6, b = khBox([kx, ky]);
  const near = (q) => Math.hypot(Math.max(0, b[0] - q[0], q[0] - b[2]), Math.max(0, b[1] - q[1], q[1] - b[3])) < postR + 0.5;
  if (posts.some((po) => near(po.h)) && !warnings.some((w) => w.startsWith('Otvor na zavěšení zasahuje')))
    warnings.push('Otvor na zavěšení zasahuje do sloupku krabičky – změňte rozteč otvorů nebo vzdálenost od horní hrany.');
  return [kx, ky];
}

// Otvor pro kabel: obdélník v čelních souřadnicích (u boku pás přes celou stěnu krabičky).
// Z požadované polohy se posune na nejbližší místo mimo sloupky, otvory na zavěšení a spoje dílů.
function cablePort(p, W, H, posts, split, keyholes, warnings) {
  if (!p.lid || !USB_PORTS[p.usb] || p.usb === 'none') return null;
  const lw = p.lidWall, hw = p.usbW / 2, hh = p.usbH / 2;
  const postR = p.lidHeadD / 2 + 1.6;
  const jm = p.jointWall + Math.max(JOINT.padT, JOINT.dove.td + JOINT.dove.boss) + 1;
  const dist = ([x0, y0, x1, y1], [px, py]) => Math.hypot(Math.max(0, x0 - px, px - x1), Math.max(0, y0 - py, py - y1));
  const free = (bb, back) => posts.every((po) => dist(bb, po.h) >= postR + (back ? 1 : 0.3))
    && (!back || keyholes.every(([kx, ky]) => bb[2] < kx - 5.2 || bb[0] > kx + 5.2 || bb[3] < ky - 5.2 || bb[1] > ky + 13.2))
    && split.joints.every((J) => {
      const [a0, a1, b0, b1] = J.dir === 'v' ? [bb[0], bb[2], bb[1], bb[3]] : [bb[1], bb[3], bb[0], bb[2]];
      return b1 < J.from || b0 > J.to || a1 < J.at - jm || a0 > J.at + jm;
    });
  const what = USB_PORTS[p.usb];
  if (!p.usb.startsWith('back')) {
    if (p.usbH > p.lidDepth - p.lidPlate - 1) warnings.push(`Otvor pro kabel (${p.usbH} mm) je vyšší než bok krabičky – zvětšete hloubku krabičky.`);
    // poloha podél strany: u boků vlevo/vpravo svisle, dole/nahoře vodorovně
    const vert = p.usb === 'left' || p.usb === 'right';
    const len = vert ? H : W;
    const strip = (t) => (p.usb === 'right' ? [W - lw - 1, t - hw, W + 1, t + hw]
      : p.usb === 'left' ? [-1, t - hw, lw + 1, t + hw]
        : p.usb === 'bottom' ? [t - hw, -1, t + hw, lw + 1] : [t - hw, H - lw - 1, t + hw, H + 1]);
    for (let d = 0; d <= len / 2; d += 0.5) {
      for (const t of d ? [len / 2 - d, len / 2 + d] : [len / 2]) {
        if (t - hw < lw + 1 || t + hw > len - lw - 1) continue;
        const bb = strip(t);
        if (free(bb, false)) return { port: p.usb, side: true, bb };
      }
    }
  } else {
    // zadní stěna: kraje mřížky za rohovými sloupky, střed uprostřed
    const pos = p.usb.slice(5);
    const e = Math.max(p.postSize, p.wall + (p.postSize - p.wall) / 2 + postR) + 3;
    const tx = pos.includes('l') ? e + hw : pos.includes('r') ? W - e - hw : W / 2;
    const ty = pos.includes('b') ? e + hh : pos.includes('t') ? H - e - hh : H / 2;
    const ok = (x, y) => x - hw >= lw + 1 && x + hw <= W - lw - 1 && y - hh >= lw + 1 && y + hh <= H - lw - 1
      && free([x - hw, y - hh, x + hw, y + hh], true);
    // nejbližší volné místo po 1 mm: čtvercové prstence kolem cíle, dokud mohou mít bližší bod
    let best = null, bd = Infinity;
    for (let r = 0; r <= Math.max(W, H) && r <= bd; r++) {
      const ring = r ? [] : [[0, 0]];
      for (let i = -r; r && i <= r; i++) ring.push([i, -r], [i, r], [-r, i], [r, i]);
      for (const [dx, dy] of ring) {
        const d = Math.hypot(dx, dy);
        if (d < bd && ok(tx + dx, ty + dy)) { bd = d; best = [tx + dx, ty + dy]; }
      }
    }
    if (best) return { port: p.usb, side: false, bb: [best[0] - hw, best[1] - hh, best[0] + hw, best[1] + hh] };
  }
  warnings.push(`Otvor pro kabel ${what} se nevešel mimo sloupky${split.n > 1 ? ' a spoje dílů' : ''} – zvolte jinou polohu nebo menší otvor.`);
  return null;
}

export function zStack(p) {
  const ringTop = p.depth - p.backSpace;
  const ringBase = ringTop - p.ringH;
  const pocketBase = ringBase - p.pocketH;
  const windowBase = pocketBase - p.windowH;
  const tubeEnd = windowBase - p.coneH;
  return { ringTop, ringBase, pocketBase, windowBase, tubeEnd };
}

// ---------- 3D ----------

export function buildModels(M, L, opts = {}) {
  const { Manifold } = M;
  const p = L.p;
  const z = L.z;
  const seg = Math.max(16, Math.round(p.quality));
  const pool = [];
  const T = (m) => { pool.push(m); return m; };
  const W = L.caseW, H = L.caseH;
  const mx = ([x, y]) => [W - x, y];
  const ring = (poly2, zz) => poly2.map(([x, y]) => [x, y, zz]);
  const hull = (...rings) => T(Manifold.hull(rings.flat()));
  const circ = (c, r, n = seg) => circlePts(c[0], c[1], r, n);
  const rect = (c, u, along, across) => {
    const [ux, uy] = u, nx = -uy, ny = ux, a = along / 2, b = across / 2;
    return [[-a, -b], [a, -b], [a, b], [-a, b]].map(([s, t]) => [c[0] + ux * s + nx * t, c[1] + uy * s + ny * t]);
  };
  const cyl = (c, r0, r1, z0, z1, n = seg) => T(T(Manifold.cylinder(z1 - z0, r0, r1, n)).translate([c[0], c[1], z0]));
  const box = (x0, y0, z0, x1, y1, z1) => T(T(Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));

  const result = {};
  try {
    // --- pouzdro ---
    const ch = Math.min(p.chamfer, p.front / 2, p.wall / 2);
    const outer = ch > 0
      ? hull(ring([[ch, ch], [W - ch, ch], [W - ch, H - ch], [ch, H - ch]], 0), ring([[0, 0], [W, 0], [W, H], [0, H]], ch), ring([[0, 0], [W, 0], [W, H], [0, H]], p.depth))
      : box(0, 0, 0, W, H, p.depth);
    const inner = box(p.wall, p.wall, p.front, W - p.wall, H - p.wall, p.depth + 1);
    const adds = [T(outer.subtract(inner))];
    const cuts = [];

    // box z obdélníku v čelních souřadnicích
    const boxF = ([x0, y0, x1, y1], z0, z1) => { const a = mx([x1, y0]), b = mx([x0, y1]); return box(a[0], a[1], z0, b[0], b[1], z1); };
    // část sloupku uvnitř pouzdra (bez boční stěny), sem zasahuje čep krabičky
    const postInner = ([x0, y0, x1, y1], d = 0) => {
      const r = [Math.max(x0, p.wall) + d, Math.max(y0, p.wall) + d, Math.min(x1, W - p.wall) - d, Math.min(y1, H - p.wall) - d];
      return r[2] - r[0] > 1 && r[3] - r[1] > 1 ? r : null;
    };
    const { sink, peg } = postPeg(p);
    for (const po of L.posts) {
      adds.push(boxF(po.r, 0, p.depth));
      const hpt = mx(po.h);
      cuts.push(cyl(hpt, p.screwD / 2, p.screwD / 2, p.depth - p.screwDepth, p.depth + 1, 24));
      const ir = sink > 0 && postInner(po.r);
      if (ir) cuts.push(boxF(ir, p.depth - sink, p.depth + 1));
    }

    const rT = p.tubeEndD / 2, rOut = L.rOut, rTo = rT + p.tubeWall;
    const rIn = p.modD / 2;
    const maskT = Math.min(Math.max(p.recessDepth, 0.6), p.front - 0.4);
    // písmo symbolu jako plocha (sjednocené tahy), v souřadnicích modelu
    const symbolCS = (e) => {
      const polys = strokePolygons(e.lines.map((pl) => pl.map(mx)), p.symStroke, 16).map((q) => q.reverse());
      return T(new M.CrossSection(polys, 'NonZero'));
    };
    for (const e of L.els) {
      const poly = e.poly.map(mx);
      const c = mx(e.c);
      const u = [-e.u[0], e.u[1]];
      const isSym = e.kind === 'sym';
      const inner0 = isSym ? poly : offsetConvex(poly, -p.recessInset);
      const outer0 = offsetConvex(poly, (isSym ? 0 : -p.recessInset) + p.tubeWall);
      // světlovod (vnější plášť) + válec lůžka
      adds.push(hull(ring(outer0, p.front - 0.5), ring(outer0, p.front), ring(circ(c, rTo), z.tubeEnd)));
      adds.push(cyl(c, rOut, rOut, z.tubeEnd - 0.5, z.ringTop));
      if (isSym) {
        // maska: písmo prořízne čelo do hloubky maskT, za ním společné okno a světlovod
        cuts.push(T(T(symbolCS(e).extrude(maskT + 1)).translate([0, 0, -1])));
        cuts.push(hull(ring(inner0, maskT - 0.05), ring(inner0, p.front), ring(circ(c, rT), z.tubeEnd)));
      } else {
        // vybrání pro difuzor
        if (p.recessDepth > 0) cuts.push(hull(ring(poly, -1), ring(poly, p.recessDepth)));
        // světlovod (dutina)
        cuts.push(hull(ring(inner0, -1), ring(inner0, p.front), ring(circ(c, rT), z.tubeEnd)));
      }
      // kužel k okénku LED
      const win = rect(c, u, p.windowSize, p.windowSize);
      cuts.push(hull(ring(circ(c, rT), z.tubeEnd - 0.01), ring(win, z.windowBase)));
      // okénko a kapsa
      cuts.push(hull(ring(win, z.windowBase - 0.01), ring(win, z.pocketBase + 0.01)));
      const pk = rect(c, u, p.pocket, p.pocket);
      cuts.push(hull(ring(pk, z.pocketBase), ring(pk, z.ringBase + 0.01)));
      // kroužek s pružnými oblouky
      if (p.lip > 0) {
        const zl = Math.min(z.ringBase + p.pcbT, z.ringTop - 0.2);
        cuts.push(cyl(c, rIn, rIn, z.ringBase, zl + 0.01));
        cuts.push(cyl(c, rIn - p.lip, rIn, zl, z.ringTop + 0.01));
        cuts.push(cyl(c, rIn, rIn, z.ringTop, p.depth + 1));
      } else {
        cuts.push(cyl(c, rIn, rIn, z.ringBase, p.depth + 1));
      }
      const sl = rect(c, u, 2 * rOut + 2, p.slotW);
      cuts.push(hull(ring(sl, z.ringBase), ring(sl, p.depth + 1)));
    }

    const body = T(Manifold.union(adds));
    const cutsU = T(Manifold.union(cuts));
    const caseM = T(body.subtract(cutsU));
    const split = L.split && L.split.n > 1 ? L.split : null;
    if (!split) result.case = meshOut(caseM);

    // --- difuzory ---
    let diffM = null;
    if (p.diffuser && p.recessDepth > 0) {
      const parts = L.els.map((e) => {
        if (e.kind === 'sym') {
          // písmena do masky; při tisku na místě (vůle 0) i destička za maskou, která vše drží pohromadě
          let cs = symbolCS(e);
          if (p.diffClear > 0) cs = T(cs.offset(-p.diffClear, 'Round', 2, 16));
          const letters = T(cs.extrude(maskT));
          if (p.diffClear > 0) return letters;
          const win = e.poly.map(mx);
          return T(letters.add(hull(ring(win, maskT - 0.01), ring(win, Math.min(p.front, maskT + p.diffT)))));
        }
        const poly = offsetConvex(e.poly.map(mx), -p.diffClear);
        return hull(ring(poly, 0), ring(poly, p.diffT));
      });
      if (parts.length) {
        diffM = T(Manifold.union(parts));
        result.diffuser = meshOut(diffM);
      }
    }

    // --- zadní krabička (sestavená poloha: z od depth do depth+lidDepth) ---
    let lidM = null, lidCutsU = null;
    if (p.lid) {
      const z0 = p.depth, z1 = p.depth + p.lidDepth, lw = p.lidWall;
      const ladds = [T(box(0, 0, z0, W, H, z1).subtract(box(lw, lw, z0 - 1, W - lw, H - lw, z1 - p.lidPlate)))];
      const lcuts = [];
      const postR = p.lidHeadD / 2 + 1.6;
      for (const po of L.posts) {
        const hpt = mx(po.h);
        ladds.push(cyl(hpt, postR, postR, z0, z1, 32));
        // čep: sloupek krabičky pokračuje do kapsy ve sloupku pouzdra (s vůlí ke stěnám)
        const ir = peg > 0 && postInner(po.r, p.postFit);
        if (ir) ladds.push(T(cyl(hpt, postR, postR, z0 - peg, z0 + 0.5, 32).intersect(boxF(ir, z0 - peg - 1, z0 + 1))));
        lcuts.push(cyl(hpt, p.lidScrewD / 2, p.lidScrewD / 2, z0 - peg - 1, z1 + 1, 24));
        lcuts.push(cyl(hpt, p.lidHeadD / 2, p.lidHeadD / 2, z0 + p.lidClamp, z1 + 1, 32));
      }
      // otvor pro kabel: v boku uprostřed výšky krabičky, vzadu skrz zadní desku
      if (L.usb) {
        const zc = z0 + (p.lidDepth - p.lidPlate) / 2;
        lcuts.push(L.usb.side ? boxF(L.usb.bb, zc - p.usbH / 2, zc + p.usbH / 2) : boxF(L.usb.bb, z1 - p.lidPlate - 1, z1 + 1));
      }
      // otvory na zavěšení (klíčová dírka)
      const { r: khR, slot: khS, rs: khRs } = KEYHOLE;
      for (const kh of L.keyholes || []) {
        const c = mx(kh);
        lcuts.push(cyl(c, khR, khR, z1 - p.lidPlate - 1, z1 + 1, 32));
        lcuts.push(hull(ring(rect([c[0], c[1] + khS / 2], [0, 1], khS, 2 * khRs), z1 - p.lidPlate - 1), ring(rect([c[0], c[1] + khS / 2], [0, 1], khS, 2 * khRs), z1 + 1)));
        lcuts.push(cyl([c[0], c[1] + khS], khRs, khRs, z1 - p.lidPlate - 1, z1 + 1, 24));
      }
      lidCutsU = T(Manifold.union(lcuts));
      lidM = T(T(Manifold.union(ladds)).subtract(lidCutsU));
      if (!split) result.lid = meshOut(lidM);
    }

    // --- díly (když se pouzdro nevejde na tiskovou plochu) ---
    if (split) {
      const jw = p.jointWall, { padT, padW, dove } = JOINT;
      const z0 = p.depth, z1 = p.depth + p.lidDepth;
      const zone = {
        case: { za: 0, zb: p.depth, zf: p.front, zs: p.front + (p.depth - p.front) / 2, tongue: [p.front, p.depth], groove: [p.front, p.depth + 1], notch: [p.depth - p.notchH, p.depth + 1] },
        lid: { za: z0, zb: z1, zs: z0 + (p.lidDepth - p.lidPlate) / 2, tongue: [z0, z1 - p.lidPlate], groove: [z0 - 1, z1 - p.lidPlate], notch: [z0 - 1, z0 + p.notchH] },
      };
      // hranol z obdélníku/polygonu ve spojových souřadnicích (n, t)
      const prismNT = (J, nt, za, zb) => {
        const pts = nt.map(([n, t]) => mx(jointPoint(J, n, t)));
        return hull(ring(pts, za), ring(pts, zb));
      };
      const rectNT = (n0, n1, t0, t1) => [[n0, t0], [n1, t0], [n1, t1], [n0, t1]];
      // vůle lůžek: spojová stěna se nesmí dotknout pružného kroužku
      const sockClear = L.els.length
        ? T(Manifold.union(L.els.map((e) => cyl(mx(e.c), rOut + 0.4, rOut + 0.4, z.tubeEnd - 0.5, p.depth + 1))))
        : null;
      const features = (q, zn) => {
        const Z = zone[zn];
        const fadds = [], fcuts = [];
        for (const J of split.joints) {
          const side = J.a === q.k - 1 ? 'a' : J.b === q.k - 1 ? 'b' : null;
          if (!side) continue;
          const nIn = (d) => (side === 'a' ? [-d, 0] : [0, d]);
          // spojová stěna po celé délce spoje
          fadds.push(prismNT(J, rectNT(...nIn(jw), J.from, J.to), Z.za, Z.zb));
          // zadní zóna: prvky jen za světlovody, spodní hrany sražené pod 45° (tisk bez podpor)
          const back = (sp) => zn === 'case' && sp.zone === 'back';
          const zbk = z.tubeEnd + 1;
          const chamfered = (J2, wallNT, fullNT, zTop, drop) => {
            const wp = wallNT.map(([n, t]) => mx(jointPoint(J2, n, t)));
            const fp = fullNT.map(([n, t]) => mx(jointPoint(J2, n, t)));
            return hull(ring(wp, zTop - drop), ring(fp, zTop), ring(fp, Z.zb));
          };
          for (const sp of J.spots) {
            const s = sp.s;
            const trap = [[0, s - dove.bw / 2], [dove.td, s - dove.tw / 2], [dove.td, s + dove.tw / 2], [0, s + dove.bw / 2]];
            if (sp.type === 'screw') {
              const zs = back(sp) ? (zbk + p.depth) / 2 : Z.zs;
              const padNT = rectNT(...nIn(jw + padT), s - padW / 2, s + padW / 2);
              if (back(sp)) fadds.push(chamfered(J, rectNT(...nIn(jw), s - padW / 2, s + padW / 2), padNT, zbk, padT));
              else {
                const [pz0, pz1] = zn === 'case' ? [Z.zf, zs + 5] : [zs - 5, Z.zb];
                fadds.push(prismNT(J, padNT, pz0, pz1));
              }
              const hp = [];
              for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2, t = s + 1.7 * Math.cos(a), zz = zs + 1.7 * Math.sin(a);
                for (const n of [-(jw + padT + 1), jw + padT + 1]) hp.push([...mx(jointPoint(J, n, t)), zz]);
              }
              fcuts.push(T(Manifold.hull(hp)));
            } else if (side === 'a') {
              // pero rybiny vyčnívá do sousedního dílu
              const [tz0, tz1] = back(sp) ? [zbk, Z.zb] : Z.tongue;
              fadds.push(prismNT(J, rectNT(-jw, 0.01, s - dove.bw / 2, s + dove.bw / 2), back(sp) ? tz0 - dove.td : tz0, tz1));
              if (back(sp)) {
                const tp = trap.map(([n, t]) => mx(jointPoint(J, n, t)));
                const base = [[0, s - dove.bw / 2], [0, s + dove.bw / 2]].map(([n, t]) => mx(jointPoint(J, n, t)));
                fadds.push(hull(ring(base, tz0 - dove.td), ring(tp, tz0), ring(tp, tz1)));
              } else fadds.push(prismNT(J, trap, tz0, tz1));
            } else {
              // drážka v zesíleném místě
              const tr = offsetConvex(trap, p.joinClear);
              const bossNT = rectNT(0, dove.td + dove.boss, s - dove.tw / 2 - dove.boss, s + dove.tw / 2 + dove.boss);
              if (back(sp)) {
                const gz0 = zbk - dove.td - 0.3;
                fadds.push(chamfered(J, rectNT(0, jw, s - dove.tw / 2 - dove.boss, s + dove.tw / 2 + dove.boss), bossNT, gz0 - 1, dove.td + dove.boss - jw));
                fcuts.push(prismNT(J, tr, gz0, Z.zb + 1));
              } else {
                fadds.push(prismNT(J, bossNT, Z.za, Z.zb));
                fcuts.push(prismNT(J, tr, Z.groove[0], Z.groove[1]));
              }
            }
          }
          for (const s of J.notches) fcuts.push(prismNT(J, rectNT(-(jw + padT + 1), jw + padT + 1, s - p.notchW / 2, s + p.notchW / 2), Z.notch[0], Z.notch[1]));
        }
        return { fadds, fcuts };
      };
      const pieceOf = (whole, cutsAll, q, zn, za, zb) => {
        const [x0, y0, x1, y1] = q.r;
        const a = mx([x1, y0]), b = mx([x0, y1]);
        let m = T(whole.intersect(box(a[0], a[1], za, b[0], b[1], zb)));
        const { fadds, fcuts } = features(q, zn);
        if (fadds.length) {
          let f = T(T(Manifold.union(fadds)).subtract(cutsAll));
          if (zn === 'case' && sockClear) f = T(f.subtract(sockClear));
          m = T(m.add(f));
        }
        if (fcuts.length) m = T(m.subtract(T(Manifold.union(fcuts))));
        return m;
      };
      result.pieces = split.pieces.map((q) => {
        const out = { k: q.k, i: q.i, j: q.j, r: q.r };
        out.case = meshOut(pieceOf(caseM, cutsU, q, 'case', -1, p.depth + 1));
        if (diffM) {
          const [x0, y0, x1, y1] = q.r;
          const a = mx([x1, y0]), b = mx([x0, y1]);
          const d = T(diffM.intersect(box(a[0], a[1], -1, b[0], b[1], p.front + 1)));
          if (!d.isEmpty()) out.diffuser = meshOut(d);
        }
        if (lidM) out.lid = meshOut(pieceOf(lidM, lidCutsU, q, 'lid', z0 - peg - 1, z1 + 1));
        return out;
      });
    }
  } finally {
    for (const m of pool) { try { m.delete(); } catch (_) { /* už uvolněno */ } }
  }
  return result;
}

function meshOut(m) {
  const mesh = m.getMesh();
  const np = mesh.numProp;
  const vp = mesh.vertProperties;
  let vert;
  if (np === 3) vert = Float32Array.from(vp);
  else {
    const n = vp.length / np;
    vert = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { vert[i * 3] = vp[i * np]; vert[i * 3 + 1] = vp[i * np + 1]; vert[i * 3 + 2] = vp[i * np + 2]; }
  }
  return { vert, tri: Uint32Array.from(mesh.triVerts), volume: m.volume(), genus: m.genus(), status: m.status() };
}

// Víko se tiskne zadní deskou dolů: otočení o 180° kolem osy X.
export function lidToPrint(mesh, L) {
  const p = L.p, zTop = p.depth + p.lidDepth;
  const v = new Float32Array(mesh.vert.length);
  for (let i = 0; i < v.length; i += 3) {
    v[i] = mesh.vert[i];
    v[i + 1] = L.caseH - mesh.vert[i + 1];
    v[i + 2] = zTop - mesh.vert[i + 2];
  }
  return { ...mesh, vert: v };
}

// Text s mapou LED pro firmware.
export function ledMap(L) {
  const p = L.p;
  const lines = [];
  const glyphs = [...new Set(L.els.map((e) => e.glyph))];
  const n = L.els.length;
  lines.push(`// Rozložení „${p.layout}“, ${n} LED WS2812B v řetězu (index od 0).`);
  lines.push(`#define NUM_LEDS ${n}`);
  const digits = L.cells.filter((c) => c.t in GLYPH_SEGS && c.t !== 'blank');
  if (digits.length) {
    lines.push('// Pro každou pozici index LED segmentu a..g, -1 = segment chybí.');
    lines.push(`const int16_t SEG_LED[${digits.length}][7] = {`);
    for (const c of digits) {
      const row = 'abcdefg'.split('').map((s) => {
        const e = L.els.find((x) => x.glyph === c.idx && x.name === s);
        return e ? String(e.led).padStart(3) : ' -1';
      });
      lines.push(`  {${row.join(',')} }, // pozice ${c.idx + 1}: „${c.ch}“`);
    }
    lines.push('};');
  }
  const syms = L.els.filter((e) => e.kind === 'sym');
  if (syms.length) {
    lines.push(`const uint16_t SYMBOL_LED[${syms.length}] = { ${syms.map((d) => d.led).join(', ')} }; // ${syms.map((d) => d.name).join(', ')}`);
    // sloupec veličin (meteostanice): pojmenované indexy do SYMBOL_LED
    const METEO_ID = { '°C': 'TEPLOTA', '°F': 'TEPLOTA', '%': 'VLHKOST', '%RH': 'VLHKOST', hPa: 'TLAK', mbar: 'TLAK', ppm: 'CO2', 'CO₂': 'CO2', CO2: 'CO2' };
    const named = syms.map((d, i) => [METEO_ID[d.name], i]).filter(([id], i, a) => id && a.findIndex(([x]) => x === id) === i);
    if (named.length > 1) lines.push(`enum { ${named.map(([id, i]) => `SYM_${id} = ${i}`).join(', ')} }; // index do SYMBOL_LED`);
  }
  const dots = L.els.filter((e) => e.kind === 'dot');
  if (dots.length) {
    lines.push(`const uint16_t DOT_LED[${dots.length}] = { ${dots.map((d) => d.led).join(', ')} }; // ${dots.map((d) => `${d.ch === ':' ? 'dvojtečka' : 'tečka'} ${d.name}`).join(', ')}`);
  }
  void glyphs;
  return lines.join('\n');
}

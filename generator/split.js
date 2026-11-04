// Dělení velkého pouzdra na díly, které se vejdou na tiskovou plochu.
//
// Řezy jsou rovné (svislé a vodorovné) a nikdy nevedou přes lůžko LED. Při volbě řezu se
// počítá, kolik milimetrů dutin a stěn světlovodů přetne, jak daleko je od rovnoměrného
// dělení a kolik místa na něm zbude pro spojovací prvky. Na každém spoji dostanou oba díly
// spojovací stěnu, v ní:
//  - rybinové zámky (díl A má pero, díl B drážku; díly se do sebe zasunou zezadu),
//  - průchody pro šrouby M3 s maticí (podložené zesílením stěny),
//  - výřezy pro vodiče otevřené dozadu (u krabičky směrem k pouzdru).
// Vše ve „spojových“ souřadnicích: n kolmo na řez (od dílu A k dílu B), t podél řezu.

export const JOINT = { padT: 2.5, padW: 10, dove: { bw: 6, tw: 9, td: 4, boss: 3 } };

const bboxOf = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};
const rectPointDist = ([x0, y0, x1, y1], [px, py]) => Math.hypot(Math.max(0, x0 - px, px - x1), Math.max(0, y0 - py, py - y1));
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// Překrývá se osově rovnoběžný obdélník s konvexním polygonem? (věta o oddělující ose)
function rectHitsPoly(r, poly, pbb) {
  if (!overlap(r, pbb)) return false;
  const rp = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const nx = by - ay, ny = ax - bx;
    let pmin = Infinity, pmax = -Infinity, rmin = Infinity, rmax = -Infinity;
    for (const [x, y] of poly) { const d = x * nx + y * ny; pmin = Math.min(pmin, d); pmax = Math.max(pmax, d); }
    for (const [x, y] of rp) { const d = x * nx + y * ny; rmin = Math.min(rmin, d); rmax = Math.max(rmax, d); }
    if (rmax <= pmin || rmin >= pmax) return false;
  }
  return true;
}

// Délka tětivy konvexního polygonu na přímce souřadnice[ax] = v.
function chord(poly, ax, v) {
  const o = 1 - ax;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[ax] - v) * (b[ax] - v) > 0 || a[ax] === b[ax]) continue;
    const t = (v - a[ax]) / (b[ax] - a[ax]), w = a[o] + t * (b[o] - a[o]);
    lo = Math.min(lo, w); hi = Math.max(hi, w);
  }
  return hi > lo ? hi - lo : 0;
}

// Bod spoje (n, t) v čelních souřadnicích.
export const jointPoint = (J, n, t) => (J.dir === 'v' ? [J.at + n, t] : [t, J.at + n]);

export function computeSplit(p, ctx, warnings) {
  const { W, H, els, outer, posts, rOut, keyholes } = ctx;
  const U = Math.max(40, p.bedW - 10), V = Math.max(40, p.bedH - 10); // 5 mm okraj tiskové plochy
  const one = { n: 1, nx: 1, ny: 1, cols: [0, W], rows: [0, H], pieces: [{ k: 1, i: 0, j: 0, r: [0, 0, W, H] }], joints: [], bed: [U, V] };
  const fits = (w, h) => (w <= U && h <= V) || (w <= V && h <= U);
  if (fits(W, H)) return one;
  if (p.splitMode === 'off') {
    warnings.push(`Pouzdro ${W.toFixed(0)} × ${H.toFixed(0)} mm se nevejde na tiskovou plochu ${p.bedW} × ${p.bedH} mm. Zapněte dělení na díly.`);
    return one;
  }
  const jw = p.jointWall;
  const { padT, padW, dove } = JOINT;
  const postR = p.lidHeadD / 2 + 1.6;
  const obb = outer.map(bboxOf);

  // Je obdélník (čelní souřadnice) volný pro spojovací prvek?
  const caseFree = (bb, tubes) => els.every((e, ei) => rectPointDist(bb, e.c) >= rOut + 1 && !(tubes && rectHitsPoly(bb, outer[ei], obb[ei])))
    && posts.every((po) => !overlap(bb, [po.r[0] - 1, po.r[1] - 1, po.r[2] + 1, po.r[3] + 1]));
  const lidFree = (bb) => !p.lid || (posts.every((po) => rectPointDist(bb, po.h) >= postR + 1)
    && keyholes.every((k) => !overlap(bb, [k[0] - 6, k[1] - 6, k[0] + 6, k[1] + 16])));
  const half = { dove: dove.td + dove.boss + 1, screw: jw + padT + 3.5 };

  // Kolik místa pro šroub zůstane podél řezu (mm), vzorkováno po 3 mm.
  const roomAlong = (ax, v, len) => {
    let free = 0;
    for (let t = p.wall + 8; t <= len - p.wall - 8; t += 4) {
      const bb = ax === 0 ? [v - half.screw, t - padW / 2, v + half.screw, t + padW / 2] : [t - padW / 2, v - half.screw, t + padW / 2, v + half.screw];
      if (caseFree(bb, true)) free += 4;
    }
    return free;
  };

  // Rozmístění řezů na jedné ose dynamickým programováním.
  const minPiece = 30;
  const candCache = [null, null];
  const candidates = (ax) => {
    if (candCache[ax]) return candCache[ax];
    const len = ax === 0 ? W : H, other = ax === 0 ? H : W;
    const cand = (candCache[ax] = []);
    // zakázané úseky (lůžka, sloupky) → volné intervaly; z každého střed a body po 2 mm
    const banned = [
      ...els.map((e) => [e.c[ax] - rOut - 0.5, e.c[ax] + rOut + 0.5]),
      ...posts.map((po) => [po.r[ax] - 3, po.r[ax + 2] + 3]),
    ].sort((a, b) => a[0] - b[0]);
    const vs = [];
    let cur = minPiece;
    const addInterval = (a, b) => {
      if (b - a < 0.01) return;
      // střed, okraje (kvůli největšímu dosahu dílu) a body po 2 mm
      vs.push((a + b) / 2, a + 0.05, b - 0.05);
      for (let v = Math.ceil(a / 2) * 2; v <= b; v += 2) if (Math.abs(v - (a + b) / 2) > 1e-6) vs.push(v);
    };
    for (const [a, b] of banned) {
      if (b <= cur) continue;
      if (a > cur) addInterval(cur, Math.min(a, len - minPiece));
      cur = Math.max(cur, b);
      if (cur >= len - minPiece) break;
    }
    if (cur < len - minPiece) addInterval(cur, len - minPiece);
    vs.sort((a, b) => a - b);
    for (const v of vs) {
      let cav = 0, wall = 0;
      els.forEach((e, ei) => {
        if (v < obb[ei][ax] || v > obb[ei][ax + 2]) return;
        const c = chord(e.poly, ax, v);
        cav += c;
        wall += chord(outer[ei], ax, v) - c;
      });
      const room = Math.min(roomAlong(ax, v, other), 120);
      cand.push({ v, score: cav * 0.5 + wall * 0.05 - room * 0.1 });
    }
    return cand;
  };
  const axisCuts = (len, n, maxPiece, ax) => {
    if (n === 1) return len <= maxPiece ? { cuts: [0, len], score: 0 } : null;
    const cand = candidates(ax);
    const cost = (c, k) => c.score + Math.abs(c.v - (len * k) / n) * 0.2;
    let prev = cand.map((c) => (c.v <= maxPiece ? cost(c, 1) : Infinity));    const back = [];
    for (let k = 2; k < n; k++) {
      const cur = new Array(cand.length).fill(Infinity), bp = new Array(cand.length).fill(-1);
      for (let i = 0; i < cand.length; i++) {
        for (let j = i - 1; j >= 0; j--) {
          const d = cand[i].v - cand[j].v;
          if (d > maxPiece) break;
          if (d < minPiece || prev[j] === Infinity) continue;
          const c = prev[j] + cost(cand[i], k);
          if (c < cur[i]) { cur[i] = c; bp[i] = j; }
        }
      }
      back.push(bp);
      prev = cur;
    }
    let best = -1, bc = Infinity;
    for (let i = 0; i < cand.length; i++) {
      const rest = len - cand[i].v;
      if (rest <= maxPiece && rest >= minPiece && prev[i] < bc) { bc = prev[i]; best = i; }
    }
    if (best < 0) return null;
    const cuts = [cand[best].v];
    for (let k = back.length - 1; k >= 0; k--) { best = back[k][best]; cuts.unshift(cand[best].v); }
    return { cuts: [0, ...cuts, len], score: bc };
  };

  let found = null;
  const combos = [];
  for (let nx = 1; nx <= 12; nx++) for (let ny = 1; ny <= 12; ny++) combos.push([nx, ny]);
  combos.sort((a, b) => a[0] * a[1] - b[0] * b[1] || Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]));
  for (const [nx, ny] of combos) {
    if (found && nx * ny > found.nx * found.ny) break;
    for (const [mw, mh] of [[U, V], [V, U]]) {
      if (W / nx > mw || H / ny > mh) continue;
      const cx = axisCuts(W, nx, mw, 0);
      if (!cx) continue;
      const cy = axisCuts(H, ny, mh, 1);
      if (!cy) continue;
      const score = cx.score + cy.score;
      if (!found || score < found.score) found = { nx, ny, cols: cx.cuts, rows: cy.cuts, score };
    }
  }
  if (!found) {
    warnings.push('Pouzdro se nepodařilo rozdělit tak, aby spoje nevedly přes lůžka LED. Zvětšete mezery mezi číslicemi nebo tiskovou plochu.');
    return one;
  }

  const { cols, rows } = found;
  const pieces = [];
  for (let j = rows.length - 2; j >= 0; j--) {
    for (let i = 0; i < cols.length - 1; i++) pieces.push({ k: pieces.length + 1, i, j, r: [cols[i], rows[j], cols[i + 1], rows[j + 1]] });
  }
  const idx = (i, j) => pieces.findIndex((q) => q.i === i && q.j === j);
  const joints = [];
  for (let i = 1; i < cols.length - 1; i++) {
    for (let j = 0; j < rows.length - 1; j++) joints.push({ dir: 'v', at: cols[i], from: rows[j], to: rows[j + 1], a: idx(i - 1, j), b: idx(i, j), len: H });
  }
  for (let j = 1; j < rows.length - 1; j++) {
    for (let i = 0; i < cols.length - 1; i++) joints.push({ dir: 'h', at: rows[j], from: cols[i], to: cols[i + 1], a: idx(i, j - 1), b: idx(i, j), len: W });
  }

  // --- rozmístění šroubů, zámků a průchodů pro vodiče na každém spoji ---
  for (const J of joints) {
    const rectBB = (n0, n1, t0, t1) => bboxOf([jointPoint(J, n0, t0), jointPoint(J, n1, t1)]);
    const extent = {
      dove: (s) => rectBB(-jw - 1, half.dove, s - dove.tw / 2 - dove.boss - 1, s + dove.tw / 2 + dove.boss + 1),
      screw: (s) => rectBB(-half.screw, half.screw, s - padW / 2 - 1, s + padW / 2 + 1),
      notch: (s) => rectBB(-(jw + padT + 1), jw + padT + 1, s - p.notchW / 2 - 1, s + p.notchW / 2 + 1),
    };
    const edge0 = J.from <= 0.01, edge1 = J.to >= J.len - 0.01;
    const m0 = J.from + (edge0 ? p.wall : jw) + 7, m1 = J.to - (edge1 ? p.wall : jw) - 7;
    J.spots = [];
    J.notches = [];
    if (m1 - m0 < 4) { warnings.push(`Spoj dílů ${J.a + 1} a ${J.b + 1} je příliš krátký na šrouby a zámky.`); continue; }
    const len = m1 - m0;
    const nS = Math.max(2, Math.round(len / 70));
    const types = [];
    for (let k = 0; k < nS; k++) types.push(p.joinType === 'screws' ? 'screw' : p.joinType === 'dovetail' ? 'dove' : k % 2 ? 'screw' : 'dove');
    const taken = [];
    // Pořadí pokusů: prvek po celé výšce stěny, pak jen v zadní části (za světlovody,
    // kde zbývají jen kroužky lůžek). U „obojího“ se místo zámku smí použít šroub.
    const nearest = (type, tubes, target) => {
      let best = null;
      for (let s = m0; s <= m1; s += 1) {
        if (taken.some((q) => Math.abs(q - s) < 24)) continue;
        const bb = extent[type](s);
        if (!caseFree(bb, tubes) || !lidFree(bb)) continue;
        if (best === null || Math.abs(s - target) < Math.abs(best - target)) best = s;
      }
      return best;
    };
    types.forEach((type, k) => {
      const target = m0 + (len * (k + 0.5)) / nS;
      const tries = [[type, 'full'], ...(type === 'dove' && p.joinType === 'both' ? [['screw', 'full']] : []), [type, 'back'], ...(type === 'dove' && p.joinType === 'both' ? [['screw', 'back']] : [])];
      for (const [ty, zone] of tries) {
        const s = nearest(ty, zone === 'full', target);
        if (s !== null) { J.spots.push({ s, type: ty, zone }); taken.push(s); break; }
      }
    });
    const nN = Math.max(1, Math.round(len / 90));
    for (let k = 0; k < nN; k++) {
      const target = m0 + (len * (k + 0.5)) / nN;
      let best = null;
      for (let s = m0; s <= m1; s += 1) {
        if (J.spots.some((q) => Math.abs(q.s - s) < p.notchW / 2 + 9)) continue;
        if (J.notches.some((q) => Math.abs(q - s) < p.notchW + 10)) continue;
        const bb = extent.notch(s);
        if (!caseFree(bb, false) || !lidFree(bb)) continue;
        if (best === null || Math.abs(s - target) < Math.abs(best - target)) best = s;
      }
      if (best !== null) J.notches.push(best);
    }
    J.spots.sort((a, b) => a.s - b.s);
    if (!J.spots.length) warnings.push(`Spoj dílů ${J.a + 1} a ${J.b + 1}: mezi světlovody není místo pro šrouby ani zámky. Díly bude potřeba slepit.`);
    if (!J.notches.length) warnings.push(`Spoj dílů ${J.a + 1} a ${J.b + 1}: není místo pro průchod vodičů.`);
  }
  return { n: pieces.length, nx: cols.length - 1, ny: rows.length - 1, cols, rows, pieces, joints, bed: [U, V] };
}

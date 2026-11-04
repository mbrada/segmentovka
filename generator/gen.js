// Geometrie generátoru pouzdra pro 7segmentový displej z modulů WS2812B.
//
// Souřadnice:
//  - "čelní" 2D souřadnice (front): pohled zepředu, x doprava, y nahoru, mm.
//  - model 3D: čelo leží na z = 0 (tiskne se čelem dolů), X = šířka − x (zrcadlení,
//    protože na čelo se díváme zespodu), Y = y, Z roste dozadu.
//
// Výchozí hodnoty odpovídají původnímu Case.3mf (7-Segment Uhr v38, 88:88).

export const DEFAULTS = {
  layout: '88:88',
  // číslice
  digitW: 40, digitH: 90, segW: 10, gap: 3.54, slant: 0,
  digitGap: 5, colonW: 20, dpW: 12, dotSize: 10, dotShape: 'diamond',
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
  // zadní víko (krabička)
  lid: true, lidDepth: 30, lidWall: 2, lidPlate: 3, lidScrewD: 3.4, lidHeadD: 6.5,
  lidClamp: 3, usb: 'right', usbW: 12, usbH: 7, keyholes: true,
  // zapojení
  segOrder: 'abcdefg',
  quality: 40,
};

const GLYPH_SEGS = { digit: 'abcdefg', one: 'bc', minus: 'g', deg: 'abfg', blank: '' };
const DIGITLIKE = new Set(['digit', 'one', 'minus', 'deg', 'blank']);

export function parseLayout(str) {
  const glyphs = [];
  const bad = new Set();
  for (const ch of String(str || '')) {
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

  const cells = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    const prev = glyphs[i - 1];
    if (prev && DIGITLIKE.has(prev.t) && DIGITLIKE.has(g.t)) x += p.digitGap;
    const cw = g.t === 'one' ? w : g.t === 'colon' ? p.colonW : g.t === 'dp' ? p.dpW : p.digitW;
    cells.push({ ...g, x0: x, w: cw, idx: i });
    x += cw;
  });

  const els = [];
  const sv = Math.max(0, p.gap * Math.SQRT2);
  const nCirc = 24;
  for (const c of cells) {
    if (c.t in GLYPH_SEGS) {
      const segs = GLYPH_SEGS[c.t];
      const W = c.w;
      const xl = c.x0 + w / 2, xr = c.x0 + W - w / 2;
      const yb = w / 2, ym = H / 2, yt = H - w / 2;
      const def = {
        a: [[xl, yt], [xr, yt]],
        b: [[xr, ym + sv], [xr, yt - sv]],
        c: [[xr, yb + sv], [xr, ym - sv]],
        d: [[xl, yb], [xr, yb]],
        e: [[xl, yb + sv], [xl, ym - sv]],
        f: [[xl, ym + sv], [xl, yt - sv]],
        g: [[xl, ym], [xr, ym]],
      };
      for (const s of segs) {
        let [p0, p1] = def[s];
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.5) {
          warnings.push('Segmenty jsou příliš krátké – zvětšete číslici nebo zmenšete mezeru.');
          continue;
        }
        const poly = hexSeg(p0, p1, w).map(shear);
        const s0 = shear(p0), s1 = shear(p1);
        const ux = s1[0] - s0[0], uy = s1[1] - s0[1], ul = Math.hypot(ux, uy);
        els.push({
          glyph: c.idx, ch: c.ch, name: s, kind: 'seg', poly,
          c: [(s0[0] + s1[0]) / 2, (s0[1] + s1[1]) / 2], u: [ux / ul, uy / ul],
        });
      }
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
  for (const e of els) { e.poly = e.poly.map(mv); e.c = mv(e.c); }
  for (const c of cells) { c.cx = c.x0 + c.w / 2 + offX; }

  // pořadí LED v řetězu
  const order = (p.segOrder || 'abcdefg').toLowerCase();
  const rank = (e) => (e.kind === 'seg' ? (order.indexOf(e.name) >= 0 ? order.indexOf(e.name) : 10 + 'abcdefg'.indexOf(e.name)) : e.name === 'dolní' ? 1 : 0);
  els.sort((a, b) => a.glyph - b.glyph || rank(a) - rank(b));
  els.forEach((e, i) => (e.led = i));

  // sloupky se šrouby
  const posts = [];
  const ps = p.postSize, hc = p.wall + (ps - p.wall) / 2, mw = p.midPostW;
  posts.push({ r: [0, 0, ps, ps], h: [hc, hc] });
  posts.push({ r: [caseW - ps, 0, caseW, ps], h: [caseW - hc, hc] });
  posts.push({ r: [0, caseH - ps, ps, caseH], h: [hc, caseH - hc] });
  posts.push({ r: [caseW - ps, caseH - ps, caseW, caseH], h: [caseW - hc, caseH - hc] });
  const edgePosts = (xAt) => {
    for (const hy of [hc, caseH - hc]) {
      const hx = xAt(hy);
      const y0 = hy < caseH / 2 ? 0 : caseH - ps;
      posts.push({ r: [hx - mw / 2, y0, hx + mw / 2, y0 + ps], h: [hx, hy] });
    }
  };
  const xAtFor = (xc) => (hy) => xc + (hy - offY - H / 2) * k;
  const colons = cells.filter((c) => c.t === 'colon');
  if (p.extraPosts) {
    for (const c of colons) {
      edgePosts(xAtFor(c.cx));
      const cy = offY + H / 2;
      posts.push({ r: [c.cx - mw / 2, cy - mw / 2, c.cx + mw / 2, cy + mw / 2], h: [c.cx, cy] });
    }
    if (!colons.length && caseW > 150 && cells.length > 1) {
      let best = null;
      for (let i = 1; i < cells.length; i++) {
        const xb = (cells[i - 1].x0 + cells[i - 1].w + cells[i].x0) / 2 + offX;
        if (!best || Math.abs(xb - caseW / 2) < Math.abs(best - caseW / 2)) best = xb;
      }
      edgePosts(xAtFor(best));
    }
  }

  // kontroly
  const rOut = p.modD / 2 + p.ringWall;
  let minD = Infinity;
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++)
      minD = Math.min(minD, Math.hypot(els[i].c[0] - els[j].c[0], els[i].c[1] - els[j].c[1]));
  if (minD < 2 * rOut) warnings.push(`Lůžka sousedních LED se překrývají (vzdálenost středů ${minD.toFixed(1)} mm < ${(2 * rOut).toFixed(1)} mm). Zvětšete mezery.`);
  const z = zStack(p);
  if (z.tubeEnd < p.front + 3) warnings.push('Pouzdro je na tyto rozměry lůžka příliš mělké – zvětšete hloubku.');
  if (!els.length) warnings.push('Rozložení neobsahuje žádný segment.');

  return { p, cells, els, posts, caseW, caseH, offX, offY, warnings, z, rOut, minD };
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

    for (const po of L.posts) {
      const [x0, y0, x1, y1] = po.r;
      const a = mx([x1, y0]), b = mx([x0, y1]);
      adds.push(box(a[0], a[1], 0, b[0], b[1], p.depth));
      const hpt = mx(po.h);
      cuts.push(cyl(hpt, p.screwD / 2, p.screwD / 2, p.depth - p.screwDepth, p.depth + 1, 24));
    }

    const rT = p.tubeEndD / 2, rOut = L.rOut, rTo = rT + p.tubeWall;
    const rIn = p.modD / 2;
    for (const e of L.els) {
      const poly = e.poly.map(mx);
      const c = mx(e.c);
      const u = [-e.u[0], e.u[1]];
      const inner0 = offsetConvex(poly, -p.recessInset);
      const outer0 = offsetConvex(poly, -p.recessInset + p.tubeWall);
      // světlovod (vnější plášť) + válec lůžka
      adds.push(hull(ring(outer0, p.front - 0.5), ring(outer0, p.front), ring(circ(c, rTo), z.tubeEnd)));
      adds.push(cyl(c, rOut, rOut, z.tubeEnd - 0.5, z.ringTop));
      // vybrání pro difuzor
      if (p.recessDepth > 0) cuts.push(hull(ring(poly, -1), ring(poly, p.recessDepth)));
      // světlovod (dutina)
      cuts.push(hull(ring(inner0, -1), ring(inner0, p.front), ring(circ(c, rT), z.tubeEnd)));
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
    const caseM = T(body.subtract(T(Manifold.union(cuts))));
    result.case = meshOut(caseM);

    // --- difuzory ---
    if (p.diffuser && p.recessDepth > 0) {
      const parts = L.els.map((e) => {
        const poly = offsetConvex(e.poly.map(mx), -p.diffClear);
        return hull(ring(poly, 0), ring(poly, p.diffT));
      });
      if (parts.length) result.diffuser = meshOut(T(Manifold.union(parts)));
    }

    // --- zadní krabička (sestavená poloha: z od depth do depth+lidDepth) ---
    if (p.lid) {
      const z0 = p.depth, z1 = p.depth + p.lidDepth, lw = p.lidWall;
      const ladds = [T(box(0, 0, z0, W, H, z1).subtract(box(lw, lw, z0 - 1, W - lw, H - lw, z1 - p.lidPlate)))];
      const lcuts = [];
      const postR = p.lidHeadD / 2 + 1.6;
      for (const po of L.posts) {
        const hpt = mx(po.h);
        ladds.push(cyl(hpt, postR, postR, z0, z1, 32));
        lcuts.push(cyl(hpt, p.lidScrewD / 2, p.lidScrewD / 2, z0 - 1, z1 + 1, 24));
        lcuts.push(cyl(hpt, p.lidHeadD / 2, p.lidHeadD / 2, z0 + p.lidClamp, z1 + 1, 32));
      }
      // otvor pro kabel / USB
      if (p.usb && p.usb !== 'none') {
        const zc = z0 + (p.lidDepth - p.lidPlate) / 2;
        const hw = p.usbW / 2, hh = p.usbH / 2;
        if (p.usb === 'right') lcuts.push(box(-1, H / 2 - hw, zc - hh, lw + 1, H / 2 + hw, zc + hh));
        else if (p.usb === 'left') lcuts.push(box(W - lw - 1, H / 2 - hw, zc - hh, W + 1, H / 2 + hw, zc + hh));
        else if (p.usb === 'bottom') {
          const xc = W - W * 0.3; // v čelním pohledu vlevo dole od středu
          lcuts.push(box(xc - hw, -1, zc - hh, xc + hw, lw + 1, zc + hh));
        }
      }
      // otvory na zavěšení (klíčová dírka)
      if (p.keyholes && W > 60) {
        for (const fx of [0.25, 0.75]) {
          const c = [W * fx, H - 26];
          lcuts.push(cyl(c, 4.2, 4.2, z1 - p.lidPlate - 1, z1 + 1, 32));
          lcuts.push(hull(ring(rect([c[0], c[1] + 5], [0, 1], 10, 4.4), z1 - p.lidPlate - 1), ring(rect([c[0], c[1] + 5], [0, 1], 10, 4.4), z1 + 1)));
          lcuts.push(cyl([c[0], c[1] + 10], 2.2, 2.2, z1 - p.lidPlate - 1, z1 + 1, 24));
        }
      }
      const lidM = T(T(Manifold.union(ladds)).subtract(T(Manifold.union(lcuts))));
      result.lid = meshOut(lidM);
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
  const dots = L.els.filter((e) => e.kind === 'dot');
  if (dots.length) {
    lines.push(`const uint16_t DOT_LED[${dots.length}] = { ${dots.map((d) => d.led).join(', ')} }; // ${dots.map((d) => `${d.ch === ':' ? 'dvojtečka' : 'tečka'} ${d.name}`).join(', ')}`);
  }
  void glyphs;
  return lines.join('\n');
}

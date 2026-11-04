// Náhledový obrázek pro sdílení odkazu (Open Graph, 1200 × 630).
// Použití: node tools/og.mjs og.svg && inkscape og.svg --export-type=png --export-filename=og.png
// Displej vzniká přímo z generátoru (styl LCD), rozsvícené segmenty ukazují „12:45“.
import { writeFileSync } from 'node:fs';
import { computeLayout } from '../gen.js';

const W = 1200, H = 630;
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const shown = '1245';
const L = computeLayout({ layout: '88:88', segStyle: 'lcd', gap: 1.5, slant: 6, margin: 0 });
const digits = L.cells.filter((c) => c.t === 'digit').map((c) => c.idx);

// displej zmenšený do horní části obrázku
const s = 860 / L.caseW, ox = (W - L.caseW * s) / 2, oy = 70;
const pt = ([x, y]) => `${(ox + x * s).toFixed(1)},${(oy + (L.caseH - y) * s).toFixed(1)}`;
let segs = '';
for (const e of L.els) {
  const di = digits.indexOf(e.glyph);
  const on = e.kind === 'dot' || (di >= 0 && SEGS[shown[di]].includes(e.name));
  segs += `<polygon points="${e.poly.map(pt).join(' ')}" fill="${on ? 'url(#led)' : '#1c211f'}"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="led" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a5c"/><stop offset="1" stop-color="#ff4a26"/></linearGradient>
  <filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="${W}" height="${H}" fill="#0d0f0e"/>
<g filter="url(#glow)">${segs}</g>
<text x="80" y="${oy + L.caseH * s + 92}" font-family="Inter Display, Inter, sans-serif" font-weight="800" font-size="64" fill="#f2f3f1">Segmentovka</text>
<text x="80" y="${oy + L.caseH * s + 140}" font-family="Inter, sans-serif" font-weight="500" font-size="29" fill="#a9b0ac">Generátor pouzdra pro 7segmentový displej z LED WS2812B na 3D tisk</text>
<text x="${W - 80}" y="${oy + L.caseH * s + 92}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="24" fill="#ff6a48">segmentovka.miloslavbrada.cz</text>
</svg>`;
writeFileSync(process.argv[2] || 'og.svg', svg);

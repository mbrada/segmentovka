// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Miloslav Brada
//
// Exporty: binární STL, 3MF (pouzdro + difuzory jako díly jednoho objektu) a ZIP.
import { T, LOCALE } from './i18n.js';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function stl(mesh, name = 'model') {
  const n = mesh.tri.length / 3;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const head = new TextEncoder().encode(String(name).replace(/[^\x20-\x7e]/g, '_').slice(0, 79));
  new Uint8Array(buf, 0, head.length).set(head);
  dv.setUint32(80, n, true);
  const V = mesh.vert, Tr = mesh.tri;
  for (let i = 0; i < n; i++) {
    const a = Tr[i * 3] * 3, b = Tr[i * 3 + 1] * 3, c = Tr[i * 3 + 2] * 3;
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
    const vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    let o = 84 + i * 50;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    o += 12;
    for (const v of [a, b, c]) {
      dv.setFloat32(o, V[v], true); dv.setFloat32(o + 4, V[v + 1], true); dv.setFloat32(o + 8, V[v + 2], true);
      o += 12;
    }
  }
  return new Uint8Array(buf);
}

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const num = (v) => String(Math.round(v * 1e4) / 1e4);

function meshXml(mesh) {
  const out = ['<mesh><vertices>'];
  const V = mesh.vert, Tr = mesh.tri;
  for (let i = 0; i < V.length; i += 3) out.push(`<vertex x="${num(V[i])}" y="${num(V[i + 1])}" z="${num(V[i + 2])}"/>`);
  out.push('</vertices><triangles>');
  for (let i = 0; i < Tr.length; i += 3) out.push(`<triangle v1="${Tr[i]}" v2="${Tr[i + 1]}" v3="${Tr[i + 2]}"/>`);
  out.push('</triangles></mesh>');
  return out.join('\n');
}

// groups: [{name, parts: [{name, mesh}], offset: [x,y,z]}] – každá skupina je jeden objekt
// na podložce; má-li víc dílů (pouzdro + difuzory), jsou to díly jednoho objektu (tisk s AMS).
export function threeMF({ title, groups }) {
  const res = [];
  const items = [];
  let id = 1;
  for (const g of groups) {
    const parts = g.parts.filter((q) => q && q.mesh);
    if (!parts.length) continue;
    const partIds = [];
    for (const p of parts) {
      res.push(`<object id="${id}" type="model" name="${esc(p.name)}">${meshXml(p.mesh)}</object>`);
      partIds.push(id++);
    }
    let itemId = partIds[0];
    if (partIds.length > 1) {
      res.push(`<object id="${id}" type="model" name="${esc(g.name)}"><components>${partIds.map((i) => `<component objectid="${i}"/>`).join('')}</components></object>`);
      itemId = id++;
    }
    const [x, y, z] = g.offset || [0, 0, 0];
    items.push(`<item objectid="${itemId}"${x || y || z ? ` transform="1 0 0 0 1 0 0 0 1 ${num(x)} ${num(y)} ${num(z)}"` : ''}/>`);
  }
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="${LOCALE}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Application">${T('Generátor segmentovky', 'Segmentovka generator')}</metadata>
<resources>
${res.join('\n')}
</resources>
<build>${items.join('')}</build>
</model>`;
  const enc = new TextEncoder();
  return [
    { name: '[Content_Types].xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>') },
    { name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>') },
    { name: '3D/3dmodel.model', data: enc.encode(model) },
  ];
}

async function deflateRaw(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (_) {
    return null;
  }
}

// files: [{name, data: Uint8Array | string}] -> Uint8Array (ZIP)
export async function zip(files, { compress = true } = {}) {
  const enc = new TextEncoder();
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const raw = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const name = enc.encode(f.name);
    const crc = crc32(raw);
    let body = raw, method = 0;
    if (compress && raw.length > 256) {
      const z = await deflateRaw(raw);
      if (z && z.length < raw.length) { body = z; method = 8; }
    }
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, method, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, raw.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), name, body);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true);
    ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let o = 0;
  for (const c of all) { out.set(c, o); o += c.length; }
  return out;
}

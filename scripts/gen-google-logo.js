// One-off: rasterizes the four-color Google "G" to assets/google-g.png.
// Pure Node (zlib only) — scanline nonzero-winding fill with 4x box downsample.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = 192;      // final PNG size
const SS = 4;         // supersampling factor
const GRID = OUT * SS;

const PATHS = [
  { c: [234, 67, 53], d: 'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z' },
  { c: [66, 133, 244], d: 'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z' },
  { c: [251, 188, 5], d: 'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z' },
  { c: [52, 168, 83], d: 'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z' },
];

// --- tiny SVG path parser (M/m, L/l, H/h, V/v, C/c, Z/z) -> polygons ---
function parsePath(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  const polys = [];
  let poly = null, x = 0, y = 0, sx = 0, sy = 0, i = 0, cmd = null, prevC2 = null;
  const num = () => parseFloat(toks[i++]);
  const push = (px, py) => { if (poly) poly.push([px, py]); };
  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
    const STEPS = 24;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS, u = 1 - t;
      push(
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
      );
    }
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) { cmd = toks[i++]; if (!/[Cs]/i.test(cmd)) prevC2 = null; }
    const rel = cmd >= 'a';
    const C = cmd.toUpperCase();
    if (C === 'M') {
      let px = num(), py = num();
      if (rel) { px += x; py += y; }
      if (poly && poly.length > 2) polys.push(poly);
      poly = [[px, py]]; x = sx = px; y = sy = py; cmd = rel ? 'l' : 'L';
    } else if (C === 'L') {
      let px = num(), py = num();
      if (rel) { px += x; py += y; }
      push(px, py); x = px; y = py;
    } else if (C === 'H') {
      let px = num(); if (rel) px += x;
      push(px, y); x = px;
    } else if (C === 'V') {
      let py = num(); if (rel) py += y;
      push(x, py); y = py;
    } else if (C === 'C') {
      let a = num(), b = num(), c = num(), e = num(), f = num(), g = num();
      if (rel) { a += x; b += y; c += x; e += y; f += x; g += y; }
      cubic(x, y, a, b, c, e, f, g); x = f; y = g; prevC2 = [c, e];
    } else if (C === 'S') {
      let c = num(), e = num(), f = num(), g = num();
      if (rel) { c += x; e += y; f += x; g += y; }
      const a = prevC2 ? 2 * x - prevC2[0] : x;
      const b = prevC2 ? 2 * y - prevC2[1] : y;
      cubic(x, y, a, b, c, e, f, g); x = f; y = g; prevC2 = [c, e];
    } else if (C === 'Z') {
      push(sx, sy); x = sx; y = sy;
    } else {
      throw new Error('unsupported cmd ' + cmd);
    }
  }
  if (poly && poly.length > 2) polys.push(poly);
  return polys;
}

// --- rasterize ---
const buf = Buffer.alloc(GRID * GRID * 4, 0); // RGBA, transparent black
const scale = GRID / 48;

for (const { c, d } of PATHS) {
  for (const poly of parsePath(d)) {
    const pts = poly.map(([px, py]) => [px * scale, py * scale]);
    // scanline nonzero fill on subsample rows
    for (let yy = 0; yy < GRID; yy++) {
      const yc = yy + 0.5;
      const xs = [];
      for (let k = 0; k < pts.length; k++) {
        const [x1, y1] = pts[k], [x2, y2] = pts[(k + 1) % pts.length];
        if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
          const t = (yc - y1) / (y2 - y1);
          xs.push([x1 + t * (x2 - x1), y2 > y1 ? 1 : -1]);
        }
      }
      if (!xs.length) continue;
      xs.sort((a, b) => a[0] - b[0]);
      let wind = 0;
      for (let k = 0; k < xs.length - 1; k++) {
        wind += xs[k][1];
        if (wind !== 0) {
          const xa = Math.max(0, Math.ceil(xs[k][0] - 0.5));
          const xb = Math.min(GRID, Math.floor(xs[k + 1][0] - 0.5));
          for (let xx = xa; xx <= xb; xx++) {
            const o = (yy * GRID + xx) * 4;
            buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
          }
        }
      }
    }
  }
}

// --- box downsample GRID -> OUT (alpha-weighted) ---
const out = Buffer.alloc(OUT * OUT * 4, 0);
for (let y = 0; y < OUT; y++) {
  for (let x = 0; x < OUT; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) {
      for (let dx = 0; dx < SS; dx++) {
        const o = (((y * SS + dy) * GRID) + x * SS + dx) * 4;
        const av = buf[o + 3];
        r += buf[o] * av; g += buf[o + 1] * av; b += buf[o + 2] * av; a += av;
      }
    }
    const o = (y * OUT + x) * 4;
    if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
    out[o + 3] = Math.round(a / (SS * SS));
  }
}

// --- PNG encode (RGBA8, filter 0) ---
function crc32(b) {
  let t = [], c;
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (let i = 0; i < b.length; i++) crc = t[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crc]);
}
const raw = Buffer.alloc(OUT * (OUT * 4 + 1));
for (let y = 0; y < OUT; y++) {
  raw[y * (OUT * 4 + 1)] = 0;
  out.copy(raw, y * (OUT * 4 + 1) + 1, y * OUT * 4, (y + 1) * OUT * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OUT, 0); ihdr.writeUInt32BE(OUT, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'google-g.png'), png);

// --- geometric sanity: sample points known to lie in each region ---
const probe = (name, vx, vy) => {
  const x = Math.floor(vx * scale / SS), y = Math.floor(vy * scale / SS);
  const o = (y * OUT + x) * 4;
  console.log(name, '->', out[o], out[o + 1], out[o + 2], 'alpha', out[o + 3]);
};
probe('top-red-ring   (24,2)', 24, 2);
probe('right-blue     (42,24)', 42, 24);
probe('left-yellow    (3,24)', 3, 24);
probe('bottom-green   (24,45)', 24, 45);
probe('hole-center    (14,24)', 14, 24);
probe('edge-aa        (24,9.6)', 24, 9.6);
probe('bar-blue       (30,24)', 30, 24);
console.log('wrote assets/google-g.png', png.length, 'bytes');

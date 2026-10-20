// Regenerates assets/adaptive-icon.png (Android adaptive foreground) from the
// user's 1024x1024 assets/icon.png: square canvas, white background, and the
// artwork centered at ~70% so the launcher's mask never crops it.
// Run: node scripts/gen-adaptive-icon.js
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/icon.png')));

const SIZE = 1024;
const ART = 720; // safe zone: adaptive masks keep ~66% of the canvas
const scale = ART / src.width;
const dw = ART;
const dh = Math.round(src.height * scale);
const ox = Math.floor((SIZE - dw) / 2);
const oy = Math.floor((SIZE - dh) / 2);

const out = new PNG({ width: SIZE, height: SIZE });
// White background (RGBA = 255,255,255,255)
for (let i = 0; i < out.data.length; i += 4) {
  out.data[i] = 255;
  out.data[i + 1] = 255;
  out.data[i + 2] = 255;
  out.data[i + 3] = 255;
}

// Nearest-neighbour draw with alpha blend over white.
for (let y = 0; y < dh; y++) {
  const sy = Math.min(src.height - 1, Math.floor(y / scale));
  for (let x = 0; x < dw; x++) {
    const sx = Math.min(src.width - 1, Math.floor(x / scale));
    const si = (sy * src.width + sx) * 4;
    const di = ((y + oy) * SIZE + (x + ox)) * 4;
    const a = src.data[si + 3] / 255;
    out.data[di] = Math.round(src.data[si] * a + 255 * (1 - a));
    out.data[di + 1] = Math.round(src.data[si + 1] * a + 255 * (1 - a));
    out.data[di + 2] = Math.round(src.data[si + 2] * a + 255 * (1 - a));
    out.data[di + 3] = 255;
  }
}

fs.writeFileSync(path.join(root, 'assets/adaptive-icon.png'), PNG.sync.write(out));
console.log('Wrote assets/adaptive-icon.png', SIZE + 'x' + SIZE);

// Tiny ASCII preview of the result so the composition can be sanity-checked.
const G = 20;
for (let gy = 0; gy < G; gy++) {
  let row = '';
  for (let gx = 0; gx < G; gx++) {
    const px = Math.floor((gx + 0.5) * SIZE / G);
    const py = Math.floor((gy + 0.5) * SIZE / G);
    const i = (py * SIZE + px) * 4;
    const lum = 0.299 * out.data[i] + 0.587 * out.data[i + 1] + 0.114 * out.data[i + 2];
    row += lum > 245 ? '.' : lum > 200 ? '-' : lum > 120 ? '+' : lum > 60 ? '#' : '@';
  }
  console.log(row);
}

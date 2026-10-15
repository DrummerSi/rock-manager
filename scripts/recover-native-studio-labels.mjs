import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
const root = 'analysis/original';
const index = JSON.parse(fs.readFileSync(`${root}/runtime/reference/index.json`));
const capture = index.captures.find((c) => c.image === 'native-006.png');
const input = fs.readFileSync(`${root}/runtime/reference/${capture.stage}`);
if (crypto.createHash('sha256').update(input).digest('hex') !== capture.stageSHA256) throw new Error('Native reference digest mismatch');
const source = PNG.sync.read(input);
fs.mkdirSync(`${root}/media/native-studio-labels`, { recursive: true });
const recovered = ['age', 'style', 'skill', 'star-quality'].map((label, row) => {
  const crop = { x: 234, y: 150 + row * 14, width: 80, height: row === 3 ? 16 : 14 };
  const png = new PNG({ width: crop.width, height: crop.height });
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const offset = ((crop.y + y) * source.width + crop.x + x) * 4;
    const rgb = [...source.data.subarray(offset, offset + 3)];
    const black = rgb.every((v) => v === 0);
    if (!black && rgb.join(',') !== '181,156,123') throw new Error(`Unexpected colour in fixed label ${label}`);
    const target = (y * crop.width + x) * 4;
    png.data[target] = png.data[target + 1] = png.data[target + 2] = 0;
    png.data[target + 3] = black ? 255 : 0;
  }
  const bytes = PNG.sync.write(png), key = `native-studio-label-${label}`;
  const path = `media/native-studio-labels/${key}.png`;
  fs.writeFileSync(`${root}/${path}`, bytes);
  return { key, path, crop, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
fs.writeFileSync(`${root}/native-studio-text-evidence.json`, JSON.stringify({ source: capture.source, sourceSHA256: capture.sourceSHA256,
  screenshot: capture.image, screenshotSHA256: capture.screenshotSHA256, stageSHA256: capture.stageSHA256,
  rule: 'Preserve the original fixed English label glyphs. The reference regions contain only pure black glyphs and uniform paper colour; paper becomes transparent. Dynamic text still uses pinned browser fonts.', recovered }, null, 2));
console.log('Recovered four original static musician-sheet labels without regenerating their glyphs.');

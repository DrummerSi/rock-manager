import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

const root = 'analysis/original/runtime/reference';
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const flatten = (value) => Array.isArray(value) ? value.flatMap(flatten) : value?.image ? [value] : value?.value ? flatten(value.value) : [];
const records = flatten(JSON.parse(fs.readFileSync(`${root}/captures.json`, 'utf8').replace(/^\uFEFF/, '')));
const states = ['Artist frustration event', 'Mixer', 'City', 'Song publisher', 'Café Lizette venue', 'Mixer Settings — Corky',
  'Record Store', 'Radio FM', 'Rebel Records — signed contract', 'Radio request for promotional CD', 'Design Studio — empty cover',
  'Design Studio — composed cover', 'Schedule Release', 'Sales chart'];
fs.mkdirSync(`${root}/stage`, { recursive: true });
const captures = [], history = [];
for (const name of fs.readdirSync(root).filter((name) => /^native-\d+\.png$/.test(name)).sort()) {
  const bytes = fs.readFileSync(`${root}/${name}`), sha256 = digest(bytes);
  const matching = records.filter((record) => record.image === name && record.screenshotSHA256 === sha256);
  const superseded = records.filter((record) => record.image === name && record.screenshotSHA256 !== sha256);
  history.push(...superseded.map((record) => ({ ...record, status: 'historical record does not match current file; earlier image unavailable' })));
  const identity = matching.at(-1);
  if (!identity) throw new Error(`No matching source manifest record for ${name}`);
  if (digest(fs.readFileSync(identity.source)) !== identity.sourceSHA256) throw new Error(`Original executable identity changed for ${name}`);
  const png = PNG.sync.read(bytes);
  const crop = { x: (png.width - 800) / 2, y: (png.height - 600) / 2, width: 800, height: 600 };
  if (crop.x < 0 || crop.y < 0 || !Number.isInteger(crop.x) || !Number.isInteger(crop.y)) throw new Error(`Unexpected screen dimensions for ${name}`);
  const stage = new PNG({ width: 800, height: 600 });
  PNG.bitblt(png, stage, crop.x, crop.y, 800, 600, 0, 0);
  const stageBytes = PNG.sync.write(stage);
  fs.writeFileSync(`${root}/stage/${name}`, stageBytes);
  captures.push({ ...identity, state: states[Number(name.match(/\d+/)[0]) - 1] ?? 'Unclassified', crop,
    stage: `stage/${name}`, stageSHA256: digest(stageBytes), sourceIdentityVerified: true });
}
fs.writeFileSync(`${root}/index.json`, JSON.stringify({ provenance: 'User-controlled captures of the original executable; static images establish visual states, not audio or interaction traces.',
  normalization: 'Lossless center crop of the original 800x600 stage; no scaling or original-file modification.', captures, history }, null, 2));
fs.writeFileSync(`${root}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Original Rock Manager references</title>
<style>body{background:#222;color:#eee;font:16px Arial;margin:24px}img{width:800px;height:600px;max-width:100%;image-rendering:pixelated}section{margin:30px 0}</style>
<h1>Original Rock Manager runtime captures</h1><p>Lossless 800×600 crops. Source and screenshot digests verified against the retained manifest; one overwritten historical image is reported separately in index.json. These captures contain no audio.</p>
${captures.map((c) => `<section><h2>${c.image}: ${c.state}</h2><img src="${c.stage}" alt="${c.state}"></section>`).join('\n')}</html>`);
console.log(`Indexed ${captures.length} verified screenshots; retained ${history.length} unmatched historical record(s).`);

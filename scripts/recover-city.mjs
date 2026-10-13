import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
const root = 'analysis/original';
const metadata = JSON.parse(fs.readFileSync(`${root}/scripts/cd/city01.cxt/metadata.json`));
const file = fs.readFileSync('E:/Games/Rock Manager/city01.cxt');
if (crypto.createHash('sha256').update(file).digest('hex') !== metadata.sha256) throw new Error('Installed city cast differs from recovered CD cast.');
const map = metadata.chunks.find((c) => c.fourCC === 'mmap').data.mapArray;
const keys = metadata.chunks.find((c) => c.fourCC === 'KEY*').data.entries;
const slots = metadata.chunks.find((c) => c.fourCC === 'CAS*').data.memberIDs;
const members = metadata.chunks.filter((c) => c.fourCC === 'CASt');
function header(member) {
  const chunk = map[member.id], raw = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  const info = raw.subarray(12 + raw.readUInt32BE(4));
  return { name: member.data.info.name, memberId: member.id, width: info.readUInt16BE(8), height: info.readUInt16BE(6),
    regX: info.readInt16BE(20), regY: info.readInt16BE(18) };
}
const media = JSON.parse(fs.readFileSync(`${root}/media-manifest.json`));
const sprite = (member) => member?.data.type === 1 ? { ...header(member),
  path: media.find((m) => m.path.includes('/city01/') && m.memberChunkId === member.id)?.path
    ?? media.find((m) => m.path.includes('/city01/') && m.originalMemberName === member.data.info.name)?.path ?? null } : null;
const tracks = [];
for (const member of members) {
  const name = member.data.info.name;
  if (!/f$/.test(name)) continue;
  const key = keys.find((k) => k.castID === member.id && k.fourCC === 'STXT');
  if (!key) continue;
  const chunk = map[key.sectionID], raw = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  const text = raw.subarray(raw.readUInt32BE(0), raw.readUInt32BE(0) + raw.readUInt32BE(4)).toString('latin1');
  const base = members.find((m) => m.data.info.name === name.slice(0, -1));
  const baseSlot = slots.indexOf(base.id);
  const sequence = [...text.matchAll(/\[(\d+)\s*:\s*(\d+)\]|(\d+)/g)].map((m) => ({
    offset: Number(m[1] ?? m[3]), pause: Number(m[2] ?? 0),
    sprite: sprite(members.find((c) => c.id === slots[baseSlot + Number(m[1] ?? m[3])])),
  }));
  tracks.push({ name: name.slice(0, -1), sourceMember: member.id, sequenceText: text,
    placeId: /^(live|record|media|video|tour|gangsta)/.test(name) ? name.split('_')[0] : null, sequence });
}
const placeNames = new Set(JSON.parse(fs.readFileSync('src/generated/game-data.json')).hotspots.map((h) => h.id));
const buildings = members.filter((m) => placeNames.has(m.data.info.name.toLowerCase())).map(sprite).filter(Boolean);
const config = JSON.parse(fs.readFileSync(`${root}/scripts/cd/Main.dxr/metadata.json`)).chunks.find((c) => c.fourCC === 'DRCF');
fs.writeFileSync(`${root}/city-animation-evidence.json`, JSON.stringify({ source: 'E:/Games/Rock Manager/city01.cxt', sha256: metadata.sha256,
  sourceScripts: ['ScrollingCityScript', 'BuildingScript', 'CityAnimScript'], ticksPerStep: 3,
  movieFPS: config.data.frameRate, tempoEvidence: { source: 'V:/Movies/Main.dxr', chunkId: config.id, frameRate: config.data.frameRate },
  tracks, buildings }, null, 2));

// The earlier extractor's abbreviated Windows palette turned these images black.
const cursorMeta = JSON.parse(fs.readFileSync(`${root}/scripts/installed/RockMaterial.cxt/metadata.json`));
const cursorFile = fs.readFileSync(cursorMeta.source), cursorMap = cursorMeta.chunks.find((c) => c.fourCC === 'mmap').data.mapArray;
const cursorKeys = cursorMeta.chunks.find((c) => c.fourCC === 'KEY*').data.entries;
const cursorSlots = cursorMeta.chunks.find((c) => c.fourCC === 'CAS*').data.memberIDs;
const palette = JSON.parse(fs.readFileSync(`${root}/director-windows-palette.json`)).rgb;
const cursorRecords = [];
fs.mkdirSync(`${root}/media/cursors`, { recursive: true });
for (const name of ['cursor_inactive01', 'cursor_normal01', 'cursor_enter building01']) {
  // Director resolves duplicate names in cast-slot order, not chunk order.
  const member = cursorMeta.chunks.filter((c) => c.fourCC === 'CASt' && c.data.info?.name === name)
    .sort((a, b) => cursorSlots.indexOf(a.id) - cursorSlots.indexOf(b.id))[0];
  const chunk = cursorMap[member.id], raw = cursorFile.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  const info = raw.subarray(12 + raw.readUInt32BE(4)), width = info.readUInt16BE(8), height = info.readUInt16BE(6), stride = info.readUInt16BE(0) & 0x7fff;
  const bitd = cursorMap[cursorKeys.find((k) => k.castID === member.id && k.fourCC === 'BITD').sectionID];
  const bytes = cursorFile.subarray(bitd.offset + 8, bitd.offset + 8 + bitd.len);
  let indices = [];
  if (bytes.length === stride * height) indices = Array.from(bytes);
  else for (let i = 0; i < bytes.length;) {
    const control = bytes[i++];
    if (control < 128) for (let j = 0; j <= control; j++) indices.push(bytes[i++]);
    else { const val = bytes[i++]; for (let j = 0; j < 257 - control; j++) indices.push(val); }
  }
  if (indices.length !== stride * height) throw new Error(`Cursor byte count mismatch: ${name}`);
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = indices[y * stride + x], pos = (y * width + x) * 4;
    png.data[pos] = palette[index * 3]; png.data[pos + 1] = palette[index * 3 + 1]; png.data[pos + 2] = palette[index * 3 + 2];
    png.data[pos + 3] = index === 0 ? 0 : 255;
  }
  const filename = name.replaceAll(' ', '_') + '.png';
  fs.writeFileSync(`${root}/media/cursors/${filename}`, PNG.sync.write(png));
  const hotspots = { cursor_inactive01: [11, 13], cursor_normal01: [2, 5], 'cursor_enter building01': [12, 5] };
  cursorRecords.push({ name, memberId: member.id, width, height, hotspotX: hotspots[name][0], hotspotY: hotspots[name][1],
    path: `media/cursors/${filename}`, rule: 'Windows D5 indexed palette; white matte transparent; bitmap registration retained' });
}
fs.writeFileSync(`${root}/city-cursor-evidence.json`, JSON.stringify({ sourceSHA256: cursorMeta.sha256, cursorScriptDefault: 'NoClickPointer',
  cursors: cursorRecords, hotspotEvidence: 'NoClickPointer / ActivePointer / GoPointer cursor Xtra specificData metadata, not bitmap registration points.' }, null, 2));
console.log(`Recovered ${tracks.length} city tracks, ${buildings.length} building layers and ${cursorRecords.length} cursors.`);

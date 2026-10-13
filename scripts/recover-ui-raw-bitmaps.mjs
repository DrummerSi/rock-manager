// One-time evidence recovery. Runtime asset preparation uses the retained bytes.
import fs from 'node:fs';
import crypto from 'node:crypto';
const metadata = JSON.parse(fs.readFileSync('analysis/original/scripts/installed/RockMaterial.cxt/metadata.json'));
const file = fs.readFileSync(metadata.source);
const map = metadata.chunks.find((c) => c.fourCC === 'mmap').data.mapArray;
const keys = metadata.chunks.find((c) => c.fourCC === 'KEY*').data.entries;
const recovered = [];
for (const member of metadata.chunks.filter((c) => c.fourCC === 'CASt' && /^Rock(Dialog|Frame[12]|Srnd|Button).*Edge/.test(c.data.info?.name ?? ''))) {
  const cast = map[member.id];
  const data = file.subarray(cast.offset + 8, cast.offset + 8 + cast.len);
  const specific = data.subarray(12 + data.readUInt32BE(4));
  const width = specific.readUInt16BE(8), height = specific.readUInt16BE(6), depth = specific[23];
  const stride = specific.readUInt16BE(0) & 0x7fff;
  const key = keys.find((k) => k.castID === member.id && k.fourCC === 'BITD');
  if (!key) continue;
  const chunk = map[key.sectionID];
  // Raw BITD uses interleaved pixels. Compressed BITD uses channel planes.
  if (chunk.len !== stride * height || ![16, 32].includes(depth)) continue;
  const pixels = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  recovered.push({ name: member.data.info.name, memberId: member.id, chunkId: key.sectionID,
    width, height, depth, stride, rawHex: pixels.toString('hex'), sha256: crypto.createHash('sha256').update(pixels).digest('hex') });
}
fs.writeFileSync('analysis/original/ui-raw-bitmaps.json', JSON.stringify({ source: metadata.source, sourceSHA256: metadata.sha256,
  rule: 'BITD payload equals stored row stride times height; raw interleaved xRGB1555 (16 bit) or ARGB (32 bit), not RLE/channel-separated', recovered }, null, 2));
console.log(`Retained ${recovered.length} raw UI bitmap payloads.`);
const registrations = metadata.chunks.filter((c) => c.fourCC === 'CASt' && c.data.type === 1 && /^icon_/.test(c.data.info?.name ?? '')).map((member) => {
  const chunk = map[member.id], raw = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  const header = raw.subarray(12 + raw.readUInt32BE(4));
  return { name: member.data.info.name, memberId: member.id, regX: header.readInt16BE(20), regY: header.readInt16BE(18) };
});
fs.writeFileSync('analysis/original/ui-icon-registrations.json', JSON.stringify({ sourceSHA256: metadata.sha256, registrations }, null, 2));

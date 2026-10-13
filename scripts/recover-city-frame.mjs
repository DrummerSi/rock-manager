// One-time recovery of the original Director one-bit surround masks.
import fs from 'node:fs';
import crypto from 'node:crypto';
const metadata = JSON.parse(fs.readFileSync('analysis/original/scripts/installed/RockMaterial.cxt/metadata.json'));
const file = fs.readFileSync(metadata.source);
const map = metadata.chunks.find((c) => c.fourCC === 'mmap').data.mapArray;
const keys = metadata.chunks.find((c) => c.fourCC === 'KEY*').data.entries;
const movieMetadata = JSON.parse(fs.readFileSync('analysis/original/scripts/cd/Main.dxr/metadata.json'));
const movie = fs.readFileSync(movieMetadata.source);
if (crypto.createHash('sha256').update(movie).digest('hex') !== movieMetadata.sha256) throw new Error('Main.dxr source hash changed');
const scoreMap = movieMetadata.chunks.find((c) => c.fourCC === 'mmap').data.mapArray.find((c) => c.fourCC === 'VWSC');
const score = movie.subarray(scoreMap.offset + 8, scoreMap.offset + 8 + scoreMap.len);
const entryStart = 24 + (score.readUInt32BE(12) + 1) * 4;
const frame = score.subarray(entryStart);
const recordSize = frame.readUInt16BE(14);
const state = Buffer.alloc(recordSize * frame.readUInt16BE(16));
let offset = 20;
const frameEnd = offset + frame.readUInt16BE(offset);
offset += 2;
while (offset < frameEnd) {
  const count = frame.readUInt16BE(offset), destination = frame.readUInt16BE(offset + 2);
  offset += 4;
  frame.copy(state, destination, offset, offset + count);
  offset += count;
}
const scoreSprites = [55, 56, 58].map((channel) => {
  const record = state.subarray(channel * recordSize, (channel + 1) * recordSize);
  return { sprite: channel - 6, castLibrary: record.readUInt16BE(4), castSlot: record.readUInt16BE(6),
    x: record.readInt16BE(14), y: record.readInt16BE(12), ink: record[1] & 63,
    width: record.readUInt16BE(18), height: record.readUInt16BE(16), rawHex: record.toString('hex') };
});
const masks = [3684, 3193].map((memberId) => {
  const cast = map[memberId];
  const bytes = file.subarray(cast.offset + 8, cast.offset + 8 + cast.len);
  const header = bytes.subarray(12 + bytes.readUInt32BE(4));
  const width = header.readUInt16BE(8), height = header.readUInt16BE(6);
  const stride = header.readUInt16BE(0) & 0x7fff;
  const chunkId = keys.find((k) => k.castID === memberId && k.fourCC === 'BITD').sectionID;
  const chunk = map[chunkId];
  const raw = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  const regX = header.readInt16BE(20), regY = header.readInt16BE(18);
  return { key: memberId === 3684 ? 'city-frame-left' : 'city-frame-right', memberId, chunkId,
    width, height, stride, depth: header[23], regX, regY, x: 400 - regX, y: 300 - regY,
    encoding: raw.length === stride * height ? 'raw' : 'packbits', rawHex: raw.toString('hex'),
    sha256: crypto.createHash('sha256').update(raw).digest('hex') };
});
fs.writeFileSync('analysis/original/city-frame-evidence.json', JSON.stringify({
  source: metadata.source, sourceSHA256: metadata.sha256,
  movieSource: movieMetadata.source, movieSHA256: movieMetadata.sha256, scoreOffset: scoreMap.offset + 8, scoreSprites,
  placement: 'Main.dxr VWSC first frame: RockMaterial slots 157 and 159, loc(400,300); ink 36 (background transparent). One-bit 1=black, 0=white matte.',
  limitation: 'The prototype footer controls are retained; they are not original game controls. Slot 158 is the black bottom bitmap (722x50, regPoint 360,-250), but its score dimensions are zero in the first frame, so original runtime visibility is not established.', masks,
}, null, 2));
console.log('Retained both original one-bit city surround masks.');

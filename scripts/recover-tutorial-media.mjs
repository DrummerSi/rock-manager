import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
const root = 'analysis/original';
const palette = JSON.parse(fs.readFileSync(`${root}/director-windows-palette.json`)).rgb;
const recovered = [];
for (const [cast, directory, names] of [
  ['cd/Mixer.dxr', 'Mixer', /^(background_mixer_(control|channel|rack|effect_delay|effect_timeshift)01|background_mixerdirt|button_(slider01|mute0[12]|effects_style0[12]|switch0[12]|playback_(play|stop)0[12])|small_ratt01_\d{4}|large_ratt01_\d{4})$/],
  ['installed/RockMaterial.cxt', 'Tutorial', /^(musician_paper01|meter02_(background01|line01(Left|Mid|Right))|frame01|studio0[14]_environment01|record0[13]_environment01|image_contract01|icon_(mixer|recorder|golden record|paragraph|money)0[12]|portrait_actor\d+_small)$/i],
  ['cd/Record01.cxt', 'Record01', /^(background01|moves_0001|moves_0003|moves_0063)$/],
  ['cd/Record03.cxt', 'Record03', /^(background01|moves_0001|moves_0003|moves_0063)$/],
]) {
  const metadata = JSON.parse(fs.readFileSync(`${root}/scripts/${cast}/metadata.json`));
  const file = fs.readFileSync(metadata.source);
  const map = metadata.chunks.find((c) => c.fourCC === 'mmap').data.mapArray;
  const keys = metadata.chunks.find((c) => c.fourCC === 'KEY*').data.entries;
  const slots = metadata.chunks.find((c) => c.fourCC === 'CAS*').data.memberIDs;
  let castPalette = palette;
  const paletteKey = keys.find((k) => k.fourCC === 'CLUT');
  if (paletteKey) {
    const chunk = map[paletteKey.sectionID];
    const bytes = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
    castPalette = Array.from({ length: bytes.length / 6 }, (_, i) => [bytes[i * 6], bytes[i * 6 + 2], bytes[i * 6 + 4]]).flat();
  }
  const members = metadata.chunks.filter((c) => c.fourCC === 'CASt' && c.data.type === 1 && names.test(c.data.info.name))
    .sort((a, b) => slots.indexOf(a.id) - slots.indexOf(b.id));
  const seen = new Set();
  for (const member of members) {
    const name = member.data.info.name;
    if (seen.has(name)) continue;
    seen.add(name);
    const castChunk = map[member.id];
    const rawCast = file.subarray(castChunk.offset + 8, castChunk.offset + 8 + castChunk.len);
    const header = rawCast.subarray(12 + rawCast.readUInt32BE(4));
    const width = header.readUInt16BE(8), height = header.readUInt16BE(6), depth = header[23];
    const stride = header.readUInt16BE(0) & 0x7fff;
    const regX = header.readInt16BE(20), regY = header.readInt16BE(18);
    const key = keys.find((k) => k.castID === member.id && k.fourCC === 'BITD');
    if (!key || !width || !height) continue;
    const chunk = map[key.sectionID];
    const raw = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
    const isRaw = raw.length === stride * height;
    let pixels = raw;
    if (!isRaw) {
      const decoded = [];
      for (let offset = 0; offset < raw.length;) {
        const count = raw[offset++];
        if (count < 128) for (let i = 0; i <= count; i++) decoded.push(raw[offset++]);
        else if (count > 128) {
          const value = raw[offset++];
          for (let i = 0; i < 257 - count; i++) decoded.push(value);
        }
      }
      pixels = Buffer.from(decoded);
    }
    if (pixels.length !== stride * height) throw new Error(`Unexpected BITD length for ${name}: ${pixels.length} / ${stride * height}`);
    const png = new PNG({ width, height });
    // Mixer BITDs have a real alpha plane, including soft shadows and red glow.
    // Some other Director casts store an unused zero plane instead.
    const hasAlpha = depth === 32 && Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => pixels[y * stride + (isRaw ? x * 4 : x)]).some((a) => a !== 0)).some(Boolean);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4, row = y * stride;
      let rgb;
      if (depth === 32) rgb = isRaw ? [...pixels.subarray(row + x * 4 + 1, row + x * 4 + 4)]
        : [pixels[row + width + x], pixels[row + width * 2 + x], pixels[row + width * 3 + x]];
      else if (depth === 16) {
        const value = isRaw ? pixels.readUInt16BE(row + x * 2) : (pixels[row + x] << 8) | pixels[row + width + x];
        rgb = [(value >> 10) & 31, (value >> 5) & 31, value & 31].map((v) => Math.floor(v * 255 / 31));
      } else if (depth === 8) rgb = castPalette.slice(pixels[row + x] * 3, pixels[row + x] * 3 + 3);
      else if (depth === 1) rgb = ((pixels[row + (x >> 3)] >> (7 - (x & 7))) & 1) ? [0, 0, 0] : [255, 255, 255];
      else throw new Error(`Unsupported depth ${depth}`);
      png.data[index] = rgb[0]; png.data[index + 1] = rgb[1]; png.data[index + 2] = rgb[2];
      const opaque = /^studio.*environment/i.test(name);
      png.data[index + 3] = hasAlpha ? pixels[row + (isRaw ? x * 4 : x)] : rgb.every((v) => v === 255) && !opaque ? 0 : 255;
    }
    const target = `media/${directory}/bitmaps/${name.replaceAll(' ', '_')}__m${member.id}.png`;
    fs.mkdirSync(`${root}/media/${directory}/bitmaps`, { recursive: true });
    fs.writeFileSync(`${root}/${target}`, PNG.sync.write(png));
    recovered.push({ name: directory.startsWith('Record') ? `${directory.toLowerCase()}-${name}` : name, path: target, width, height, regX, regY, depth, stride,
      castSlot: slots.indexOf(member.id) + 1, memberId: member.id, chunkId: key.sectionID,
      source: metadata.source, sourceSHA256: metadata.sha256,
      bitdSHA256: crypto.createHash('sha256').update(raw).digest('hex'), alpha: hasAlpha ? 'original' : 'white-matte', encoding: isRaw ? 'raw' : 'packbits' });
  }
}
fs.writeFileSync(`${root}/tutorial-media-evidence.json`, JSON.stringify({ rule: 'Lowest CAS slot resolves duplicate names; raw interleaved or compressed ARGB planes; preserve populated source alpha, otherwise white matte; studio photographs opaque.', recovered }, null, 2));
console.log(`Recovered ${recovered.length} tutorial and mixer images.`);

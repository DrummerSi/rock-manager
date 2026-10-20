import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

const root = 'analysis/original';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const windowsPalette = JSON.parse(fs.readFileSync(`${root}/director-windows-palette.json`)).rgb;
const recovered = [], layouts = [], formatting = [];
const wanted = /^(mission01_(success|failure)01|frame02 large environment|icon_(money|star|newspaper|golden record)02)$/i;
const layoutNames = new Set(['DlgMissionOutroData', 'DlgInfoFrameData', 'DlgFramedPicMiniData', 'DlgHeadlineData', 'DlgRockData', 'DlgButton2Data', 'RockFrame1Style']);
function numbers(bytes) {
  const result = [];
  for (let i = 0; i < bytes.length;) {
    const tag = bytes[i++];
    if (tag === 3) continue;
    if (tag === 0x81 || tag === 0x82) { result.push(0); continue; }
    if (tag === 0xc1 || tag === 0xc2) { result.push(...Array(bytes[i++]).fill(0)); continue; }
    if (tag !== 1 && tag !== 2) throw new Error(`Unknown XMED tag ${tag}`);
    let value = '';
    while (i < bytes.length && /[0-9a-f-]/i.test(String.fromCharCode(bytes[i]))) value += String.fromCharCode(bytes[i++]);
    result.push(parseInt(value, 16));
  }
  return result;
}
for (const cast of ['RockMaterial', 'RockUtil']) {
  const metadata = JSON.parse(fs.readFileSync(`${root}/scripts/installed/${cast}.cxt/metadata.json`));
  const source = metadata.source, file = fs.readFileSync(source), sourceSHA256 = digest(file);
  const map = metadata.chunks.find(c => c.fourCC === 'mmap').data.mapArray;
  const keys = metadata.chunks.find(c => c.fourCC === 'KEY*').data.entries;
  const slots = metadata.chunks.find(c => c.fourCC === 'CAS*').data.memberIDs;
  const chunk = id => { const c = map[id]; return file.subarray(c.offset + 8, c.offset + 8 + c.len); };
  const palettes = new Map(keys.filter(k => k.fourCC === 'CLUT').map(k => {
    const bytes = chunk(k.sectionID);
    return [slots.indexOf(k.castID) + 1, Array.from({ length: bytes.length / 6 }, (_, i) => [bytes[i * 6], bytes[i * 6 + 2], bytes[i * 6 + 4]]).flat()];
  }));
  const seen = new Set();
  for (const member of metadata.chunks.filter(c => c.fourCC === 'CASt').sort((a, b) => slots.indexOf(a.id) - slots.indexOf(b.id))) {
    const name = member.data.info?.name ?? '';
    if (member.data.type === 3 && layoutNames.has(name)) {
      const key = keys.find(k => k.castID === member.id && k.fourCC === 'STXT');
      if (!key) continue;
      const raw = chunk(key.sectionID);
      layouts.push({ name, text: raw.subarray(12, 12 + raw.readUInt32BE(4)).toString('latin1'), source, sourceSHA256, memberId: member.id, chunkId: key.sectionID, sha256: digest(raw) });
    }
    if (member.data.type === 15 && ['MissionOutroFormatting', 'RockInfoText'].includes(name)) {
      const key = keys.find(k => k.castID === member.id && k.fourCC === 'XMED');
      if (!key) continue;
      const raw = chunk(key.sectionID), sections = new Map([...raw.toString('latin1').matchAll(/\x03([0-9a-f]{4})([0-9a-f]{8})([0-9a-f]{8})/gi)].map(m => [parseInt(m[1], 16), { count: parseInt(m[3], 16), bytes: raw.subarray(m.index + 21, m.index + 21 + parseInt(m[2], 16)) }]));
      const fontBytes = sections.get(8).bytes, fontNames = [];
      for (let i = 0; i < fontBytes.length - 4; i++) if (fontBytes.subarray(i, i + 3).toString() === '40,') { const len = fontBytes[i + 3]; if (len > 0 && len < 64) fontNames.push(fontBytes.subarray(i + 4, i + 4 + len).toString('latin1')); }
      const values = numbers(sections.get(6).bytes), count = sections.get(6).count;
      if (values.length !== 1 + 77 * count) throw new Error(`Unexpected XMED style length ${name}`);
      const styles = Array.from({ length: count }, (_, index) => { const fields = values.slice(1 + 77 * index, 1 + 77 * (index + 1)); return { index, fontFamily: fontNames[fields[0]], nominalFontSize: fields[3], fontSize: fields[18] / 65536, bold: fields[39] === 1, letterSpacing: fields[23] / 65536, rawValues: fields }; });
      const runs = numbers(sections.get(4).bytes), rawCast = chunk(member.id), h = rawCast.subarray(12 + member.data.infoLen);
      formatting.push({ name, source, sourceSHA256, memberId: member.id, payloadSHA256: digest(raw), defaultStyle: values[0], styles, runs: Array.from({ length: runs.length / 2 }, (_, i) => ({ offset: runs[i * 2], style: runs[i * 2 + 1] })), cachedTextRect: { width: h.readUInt32BE(52), height: h.readUInt32BE(48) } });
    }
    if (member.data.type !== 1 || !wanted.test(name) || seen.has(name)) continue;
    seen.add(name);
    const key = keys.find(k => k.castID === member.id && k.fourCC === 'BITD');
    if (!key) continue;
    const rawCast = chunk(member.id), h = rawCast.subarray(12 + rawCast.readUInt32BE(4));
    const width = h.readUInt16BE(8), height = h.readUInt16BE(6), depth = h[23], stride = h.readUInt16BE(0) & 0x7fff, regX = h.readInt16BE(20), regY = h.readInt16BE(18), paletteId = h.readInt16BE(26) - 1;
    const palette = paletteId === -3 ? Array.from({ length: 256 }, (_, i) => [255 - i, 255 - i, 255 - i]).flat() : palettes.get(paletteId + 1) ?? windowsPalette;
    const raw = chunk(key.sectionID), isRaw = raw.length === stride * height;
    let pixels = raw;
    if (!isRaw) { const decoded = []; for (let offset = 0; offset < raw.length;) { const count = raw[offset++]; if (count < 128) for (let i = 0; i <= count; i++) decoded.push(raw[offset++]); else if (count > 128) { const value = raw[offset++]; for (let i = 0; i < 257 - count; i++) decoded.push(value); } } pixels = Buffer.from(decoded); }
    if (pixels.length !== stride * height) throw new Error(`Unexpected BITD length for ${name}`);
    let hasAlpha = false;
    if (depth === 32) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[y * stride + (isRaw ? x * 4 : x)] !== 0) hasAlpha = true;
    const png = new PNG({ width, height });
    let whitePixels = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const row = y * stride, index = (y * width + x) * 4;
      let rgb;
      if (depth === 32) rgb = isRaw ? [...pixels.subarray(row + x * 4 + 1, row + x * 4 + 4)] : [pixels[row + width + x], pixels[row + width * 2 + x], pixels[row + width * 3 + x]];
      else if (depth === 16) { const v = isRaw ? pixels.readUInt16BE(row + x * 2) : (pixels[row + x] << 8) | pixels[row + width + x]; rgb = [(v >> 10) & 31, (v >> 5) & 31, v & 31].map(v => Math.floor(v * 255 / 31)); }
      else if (depth === 8) rgb = palette.slice(pixels[row + x] * 3, pixels[row + x] * 3 + 3);
      else throw new Error(`Unsupported mission artwork depth ${depth}`);
      const white = rgb.every(v => v === 255); if (white) whitePixels++;
      png.data.set(rgb, index);
      // Original Outro Pic/Info ink36 uses a white matte even with populated source alpha.
      png.data[index + 3] = white ? 0 : hasAlpha ? pixels[row + (isRaw ? x * 4 : x)] : 255;
    }
    const path = `media/MissionEnding/${name.replaceAll(' ', '_')}__m${member.id}.png`;
    fs.mkdirSync(`${root}/media/MissionEnding`, { recursive: true });
    const output = PNG.sync.write(png); fs.writeFileSync(`${root}/${path}`, output);
    recovered.push({ name, path, width, height, regX, regY, depth, stride, paletteId, memberId: member.id, castSlot: slots.indexOf(member.id) + 1, chunkId: key.sectionID, source, sourceSHA256, bitdSHA256: digest(raw), pngSHA256: digest(output), populatedSourceAlpha: hasAlpha, whitePixels, alpha: 'original ink36 white-matte; preserve populated alpha elsewhere', encoding: isRaw ? 'raw' : 'packbits' });
  }
}
const result = { schemaVersion: 1, recovered, layouts, formatting, layout: {
  dialogLoc: [100, 100], icon: 'icon_effect01', pictureOffset: [32, 42], pictureSurroundOffset: [22, 49], pictureSurround: 'frame02 large environment',
  infoOffsetX: 23, infoGapBelowPicture: 15, scoreColumnOffset: [396, 31], scorePanelGap: 3, scorePanelNames: ['InfoDlg', 'InfoConcerts', 'InfoReviews', 'InfoPoints'],
  scorePanelIcons: ['icon_money02', 'icon_star02', 'icon_newspaper02', 'icon_golden record02'], scoreHeaders: ['szidEconomy', 'szidConcerts', 'szidReviews', 'szidPoint_P'],
  scoreTable: { width: 200, lineSpacing: 15, letterSpacing: -1, baseStyle: 'plain', valueAlignment: 'right', rgb: [255, 251, 240], source: 'DlgMissionOutroScript.createTable/getStdFormat; font inherits original RockInfoText active style.' },
  outerPaddingRightBottom: 20, okButton: { belowInfoPoints: 15, align: 'center of InfoPoints', bottomPadding: 5 },
}, sources: ['analysis/original/scripts/cd/Main.dxr/00039-DlgMissionOutroScript.lingo', 'analysis/original/data/DataDialogs00.json'], limitations: ['Offsets and dependencies are original source declarations. Auto-sized panel heights and final surround dimensions depend on runtime text metrics; no original runtime capture of this ending was available.'] };
fs.writeFileSync(`${root}/mission-ending-layout-evidence.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ recovered: recovered.map(r => ({ name: r.name, width: r.width, height: r.height, alpha: r.alpha })), formatting: formatting.map(f => ({ name: f.name, rect: f.cachedTextRect, activeStyle: f.styles[f.runs[0]?.style ?? f.defaultStyle] })), layouts: layouts.length }));

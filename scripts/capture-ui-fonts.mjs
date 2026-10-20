import fs from 'node:fs';
import crypto from 'node:crypto';
const fonts = ['cour.ttf', 'courbd.ttf', 'arial.ttf', 'arialbd.ttf', 'verdana.ttf', 'verdanab.ttf'];
fs.mkdirSync('public/assets/fonts', { recursive: true });
const records = fonts.map((name) => {
  const source = `C:/Windows/Fonts/${name}`, bytes = fs.readFileSync(source);
  fs.writeFileSync(`public/assets/fonts/${name}`, bytes);
  return { name, source, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
fs.writeFileSync('analysis/original/ui-font-evidence.json', JSON.stringify({
  buttons: { source: 'RockMaterial.cxt DlgButton2Data', family: 'Courier New', size: 14, style: 'bold', antialias: 1, color: '#AAAAAA' },
  headings: { source: 'RockMaterial.cxt DlgHeadlineData', family: 'Verdana', size: 11, style: 'bold', antialias: 0 },
  titlebar: { source: 'RockMaterial.cxt RockWndTitle01 XMED 5671', cachedFontFamilies: ['Arial', 'Courier New', 'Verdana'], status: 'Rich-text runs/glyph cache not yet decoded' },
  limitation: 'Pinned current installed Windows font files, not verified 2001 versions. Browser rasterization is not proved identical to Director. Exact glyph comparison requires original runtime captures.', fonts: records }, null, 2));
console.log('Pinned six installed font files; evidence records their exact hashes.');

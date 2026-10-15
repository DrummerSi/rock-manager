import fs from 'node:fs';
const source = JSON.parse(fs.readFileSync('analysis/original/data/DataDBEC00.json', 'utf8'));
const table = source.data.EventCardOKCancel;
const decode = value => String(value ?? '').replaceAll('\\n', '\n').replaceAll('\\t', '\t').replaceAll('\x96', '–');
const cards = table.ID.flatMap((id, index) => /^ECOCMedia0[34]Review[0-5]$/.test(id)
  ? [Object.fromEntries(['ID','comment','name','dataMemberName','icon','Headline','Caption','question'].map(key => [key, decode(table[key][index])]))] : []);
if (cards.length !== 12) throw new Error('Expected twelve original press review cards');
fs.writeFileSync('src/game/press-review-cards.json', JSON.stringify(cards, null, 2) + '\n');
fs.writeFileSync('analysis/original/press-review-evidence.json', JSON.stringify({source:source.source,sha256:source.sha256,cards:cards.map(c=>c.ID),layoutScript:'RockUtil.cxt/00089-DlgECPressScript.lingo',animation:{frames:9,frameRate:30,newsAnchor:[187,146],magazineAnchor:[188,145]},sound:'snare.swa',rating:'trunc(clamp(rawQuality,0,1)*5)'},null,2)+'\n');

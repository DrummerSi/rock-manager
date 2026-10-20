import fs from 'node:fs';
const root = 'analysis/original';
const metadata = JSON.parse(fs.readFileSync(`${root}/scripts/installed/RockMaterial.cxt/metadata.json`));
const file = fs.readFileSync(metadata.source);
const map = metadata.chunks.find((c) => c.fourCC === 'mmap').data.mapArray;
const keys = metadata.chunks.find((c) => c.fourCC === 'KEY*').data.entries;
const layouts = [];
for (const member of metadata.chunks.filter((c) => c.fourCC === 'CASt' && /^(DlgMainMenuData|DlgMissionChooseData|DlgEventCardBaseData|DlgEventCardNoPicData|EventCard.*Formatting|MainMenuFormatting)$/.test(c.data.info?.name ?? ''))) {
  const key = keys.find((k) => k.castID === member.id && k.fourCC === 'STXT');
  if (!key) continue;
  const chunk = map[key.sectionID], raw = file.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
  layouts.push({ name: member.data.info.name, memberId: member.id, chunkId: key.sectionID,
    text: raw.subarray(raw.readUInt32BE(0), raw.readUInt32BE(0) + raw.readUInt32BE(4)).toString('latin1') });
}
const fixture = JSON.parse(fs.readFileSync(`${root}/data/mission01-recovered.json`));
const table = JSON.parse(fs.readFileSync(`${root}/data/DataDBEC01.json`)).data.EventCardOKCancel;
const cards = table.ID.flatMap((id, index) => /^ECOCMis1/.test(id) ? [{ id, title: table.Headline[index],
  text: table.comment[index].replaceAll('\\n', '\n').replaceAll('\\t', '').replaceAll('\u0096', '–'),
  layout: table.dataMemberName[index], icon: table.icon[index], execute: table.ExecuteThis[index] }] : []);
const menuText = { title: 'Please note', text: 'When you quit Rock Manager, the game is saved automatically. Next time you can continue where you left off.',
  authority: 'English translation of installed Swedish szidMainMenuHeadline / szidMainMenuComment; original English wording not recovered',
  source: 'E:/Games/Rock Manager/Plugins/Swedish/Translation.txt' };
fs.writeFileSync(`${root}/opening-ui-evidence.json`, JSON.stringify({ source: metadata.source, sourceSHA256: metadata.sha256, menuText,
  layouts, cards, startTriggers: fixture.mission.StartTriggers, triggers: fixture.missionSpecificTriggers }, null, 2));
console.log(`Recovered ${layouts.length} layout records and ${cards.length} Mission01 event cards.`);

import fs from 'node:fs';
import crypto from 'node:crypto';
const source = 'V:/Data/Translation.txt';
const bytes = fs.readFileSync(source);
const translations = Object.fromEntries(new TextDecoder('windows-1252').decode(bytes).split(/\r?\n/)
  .map(line => line.split('\t')).filter(row => row[0]?.startsWith('szid')).map(row => [row[0], row[2] ?? '']));
const cardsSource = JSON.parse(fs.readFileSync('analysis/original/data/DataDBEC00.json', 'utf8'));
const table = cardsSource.data.EventCardOKCancel;
const trainingCards = table.ID.flatMap((id, index) => id.startsWith('ECOCTraining') ? [{ id, headline: table.Headline[index],
  text: table.comment[index], layout: table.dataMemberName[index], icon: table.icon[index] }] : []);
fs.writeFileSync('src/game/original-text.json', JSON.stringify({ translations, trainingCards }, null, 2));
fs.writeFileSync('analysis/original/localization-evidence.json', JSON.stringify({ source,
  sourceSHA256: crypto.createHash('sha256').update(bytes).digest('hex'), stringEncoding: 'Windows-1252',
  method: 'Original English tab-separated translation column and previously decoded English event-card table; no invented translations.',
  translationCount: Object.keys(translations).length, cardsSource: cardsSource.source, cardsSHA256: cardsSource.sha256,
  trainingCards }, null, 2));
console.log(`Recovered ${Object.keys(translations).length} English strings and ${trainingCards.length} training cards.`);

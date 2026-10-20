import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import data from '../src/generated/game-data.json';
import { newGame, recruit, licenseSong } from '../src/game/model';
import { startRecording, finishRecording, evaluateDemo, signContract } from '../src/game/recording';
import { defaultDesign, bookRelease } from '../src/game/design';
import { mission01RehearsalExit, pendingMission01Guidance } from '../src/game/mission01-events';
import cards from '../src/game/mission01-cards.json';
const card = (suffix: string) => `ECOCMis1Introduce${suffix}`;
function start() { return { ...newGame(200000, new Date(2001, 2, 13)), started: true }; }
function prepared() {
  let state = start();
  for (const [slot, id, instrument] of [[0, 'RMCJerka', 'Guitar'], [1, 'RMCTony', 'Guitar'], [2, 'RMCRaymond', 'Drums'], [3, 'RMCGurra', 'Bass'], [4, 'RMCSussie', 'Vocals']] as const) state = recruit(state, data.musicians, slot, id, instrument);
  state = { ...state, bandName: 'Guided Band', seenTutorials: ['City', 'Rehearsal', 'Publisher', 'Studio', 'Mixer'].map(card) };
  state = licenseSong(state, data.songs, 'Sng01');
  return finishRecording(startRecording(state, data.tutorialGameplay, 'Studio01', 'Sng01'), data.tutorialGameplay, data.musicians, data.songs);
}
function signed() {
  const state = { ...prepared(), seenTutorials: [...prepared().seenTutorials, card('Label')] };
  const label = data.tutorialGameplay.labels.find(l => evaluateDemo(state, l, data.musicians).accepted)!;
  return signContract(state, label, data.musicians, 4);
}
test('original room source guards vocalist before name warning; a singer alone satisfies minimum band size', () => {
  const source = readFileSync('analysis/original/scripts/cd/Main.dxr/00014-DlgRehearsal01Script.lingo', 'utf8');
  assert.ok(source.indexOf('#ECOCNeedSinger') < source.indexOf('#ECOCForgetBandName'));
  const empty = start();
  assert.deepEqual(mission01RehearsalExit(empty, data.musicians), { allowed: false, cardId: 'ECOCNeedSinger' });
  const guitar = recruit(empty, data.musicians, 0, 'RMCJerka', 'Guitar');
  assert.equal(mission01RehearsalExit(guitar, data.musicians).cardId, 'ECOCNeedSinger');
  const vocalist = recruit(empty, data.musicians, 4, 'RMCJerka', 'Vocals');
  assert.equal(mission01RehearsalExit(vocalist, data.musicians).cardId, 'ECOCForgetBandName');
  assert.ok(mission01RehearsalExit({ ...vocalist, bandName: 'The Single Singer' }, data.musicians).allowed);
});
test('native name reminder is once, singer requirement repeats and still applies with tutorial off', () => {
  const vocalist = recruit(start(), data.musicians, 4, 'RMCJerka', 'Vocals');
  assert.ok(mission01RehearsalExit({ ...vocalist, seenTutorials: ['ECOCForgetBandName'] }, data.musicians).allowed);
  assert.ok(mission01RehearsalExit(vocalist, data.musicians, { bandNameChanged: true }).allowed);
  assert.equal(mission01RehearsalExit({ ...start(), tutorialEnabled: false, seenTutorials: ['ECOCNeedSinger'] }, data.musicians).cardId, 'ECOCNeedSinger');
});
test('recruit and rename child closures never introduce publisher prematurely', () => {
  const initial = { ...start(), seenTutorials: [card('City')] };
  assert.deepEqual(pendingMission01Guidance(initial, { currentModal: 'rehearsal' }), [card('Rehearsal')]);
  assert.deepEqual(pendingMission01Guidance(initial, { previousModal: 'rehearsal', currentModal: 'recruit' }), []);
  assert.deepEqual(pendingMission01Guidance(initial, { previousModal: 'rename', currentModal: 'rehearsal' }), [card('Rehearsal')]);
  assert.deepEqual(pendingMission01Guidance({ ...initial, seenTutorials: [...initial.seenTutorials, card('Rehearsal')] }, { previousModal: 'rehearsal', currentModal: null }), []);
  const singer = recruit(initial, data.musicians, 4, 'RMCSussie', 'Vocals');
  assert.deepEqual(pendingMission01Guidance(singer, { previousModal: 'rehearsal', currentModal: null }), [card('Publisher')]);
});
test('licensed song introduces studio only after actual publisher step; mixer guidance occurs inside mixer', () => {
  const licensed = licenseSong({ ...start(), seenTutorials: [card('City'), card('Rehearsal'), card('Publisher')] }, data.songs, 'Sng01');
  assert.deepEqual(pendingMission01Guidance(licensed, { previousModal: 'publisher' }), [card('Studio')]);
  const recording = startRecording({ ...prepared(), demo: null }, data.tutorialGameplay, 'Studio01', 'Sng01');
  assert.deepEqual(pendingMission01Guidance({ ...recording, seenTutorials: recording.seenTutorials.filter(id => id !== card('Mixer')) }, { currentModal: 'mixer' }), [card('Mixer')]);
  assert.deepEqual(pendingMission01Guidance(licensed, { currentModal: 'publisher' }), ['ECOCPublishAlreadyGotSong']);
});
test('demo, rejected label, contract and scheduled release each explain their next playable step', () => {
  assert.deepEqual(pendingMission01Guidance(prepared()), [card('Label')]);
  const demo = { ...prepared(), seenTutorials: [...prepared().seenTutorials, card('Label')] };
  assert.deepEqual(pendingMission01Guidance(demo, { previousModal: 'rejection' }), ['ECOCMis1NoContract']);
  assert.deepEqual(pendingMission01Guidance({ ...demo, seenTutorials: [...demo.seenTutorials, 'ECOCMis1NoContract'] }), [card('Venue')]);
  const contract = signed();
  assert.deepEqual(pendingMission01Guidance(contract), [card('Sleeve')]);
  const released = bookRelease(contract, data.musicians, defaultDesign(), 6);
  assert.deepEqual(pendingMission01Guidance(released), [card('Media')]);
});
test('calendar waits one full game day after chart acknowledgment, including delayed acknowledgement or reload', () => {
  const album = bookRelease(signed(), data.musicians, defaultDesign(), 6);
  const state = { ...album, day: 20, seenTutorials: [...album.seenTutorials, card('Media'), card('Chart')] };
  assert.ok(!pendingMission01Guidance(state, { acknowledgedDays: { [card('Media')]: 17, [card('Chart')]: 20 } }).includes(card('Calendar')));
  assert.ok(pendingMission01Guidance({ ...state, day: 21 }, { acknowledgedDays: { [card('Media')]: 17, [card('Chart')]: 20 } }).includes(card('Calendar')));
  assert.deepEqual(pendingMission01Guidance({ ...state, tutorialEnabled: false }), []);
});
test('source press-kit reminders respect release delay and current album kit identity', () => {
  const album = bookRelease(signed(), data.musicians, defaultDesign(), 6);
  const state = { ...album, seenTutorials: [...album.seenTutorials, card('Media'), card('Chart'), card('Calendar')] };
  assert.ok(!pendingMission01Guidance({ ...state, day: 15 }).includes('ECOCCityRequestCD'));
  assert.ok(pendingMission01Guidance({ ...state, day: 16 }).includes('ECOCCityRequestCD'));
  assert.ok(pendingMission01Guidance({ ...state, day: 20 }).includes('ECOCZer0RequestCD'));
  assert.ok(pendingMission01Guidance({ ...state, day: 22 }).includes('ECOCRadioRequestCD'));
  const delivered = { ...state, day: 22, publicity: { ...state.publicity, reporters: state.publicity.reporters.map(r => ({ ...r, kit: `${state.demo!.songId}:${state.demo!.recordedDay}` })) } };
  assert.ok(!pendingMission01Guidance(delivered).some(id => /RequestCD/.test(id)));
});
test('every helper guidance card is retained from original source with real readable title and body', () => {
  const evidence = JSON.parse(readFileSync('analysis/original/mission01-guidance-evidence.json', 'utf8'));
  assert.equal(cards.length, 21);
  for (const retained of cards) {
    const original = evidence.cards.find((c: { ID: string }) => c.ID === retained.id);
    assert.ok(original, retained.id);
    assert.ok(retained.title.length > 0);
    assert.ok(retained.text.length > 0);
    assert.equal(retained.execute, original.ExecuteThis);
  }
  assert.equal(cards.find(c => c.id === 'ECOCNeedSinger')!.question, 'Hire vocalist');
  assert.equal(cards.find(c => c.id === 'ECOCForgetBandName')!.title, 'Band Has No Name');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from '../src/generated/game-data.json';
import { newGame, recruit } from '../src/game/model';
import { defaultBandmates, bandmateStats, bandmateOccupied, availableBandmateActions, giveBandmateGift, trainBandmate, advanceBandmates, changeBandmateRelations, fireBandmate, applyBandmateExitToCity, validBandmates, effectiveMusicians, applyBandmateConcertFeedback, bandmateConcerns } from '../src/game/bandmates';
function band() {
  let state = newGame(100000, new Date(2001, 2, 13));
  state = recruit(state, data.musicians, 0, 'RMCJerka', 'Guitar');
  state = recruit(state, data.musicians, 1, 'RMCKanga', 'Guitar');
  return { ...state, bandmates: defaultBandmates(state, data.musicians) };
}
const advance = (state: ReturnType<typeof band>, day: number) => advanceBandmates({ ...state, day }, data.musicians) as ReturnType<typeof band>;
test('physical gift follows recipient taste, hides permanently, and native mood bonus fades daily', () => {
  const before = band(), snapshot = JSON.stringify(before);
  const gifted = giveBandmateGift(before, 'RMCJerka', 'ActGiftPants') as ReturnType<typeof band>;
  assert.equal(gifted.money, before.money - 800);
  assert.equal(JSON.stringify(before), snapshot, 'Action preserves original saved snapshot');
  assert.equal(gifted.bandmates.lastSpeech?.template, 'a01rc0100z');
  assert.equal(bandmateStats(gifted, 'RMCJerka').mood, 1, 'Mood clamps after gift and close friend modifier');
  assert.ok(!availableBandmateActions(gifted, 'RMCJerka', 'ActCatMusicianGifts').some(a => a.id === 'ActGiftPants'));
  assert.throws(() => giveBandmateGift(gifted, 'RMCJerka', 'ActGiftPants'), /already/);
  const after = advance(gifted, 5), bonus = after.bandmates.modifiers.find(m => m.id === 'Gift')!;
  assert.equal(bonus.amount * (1 - (after.day - bonus.startDay) / bonus.duration), .15);
  assert.equal(advance(after, 10).bandmates.modifiers.filter(m => m.id === 'Gift').length, 0);
});
test('disliked gift still charges and is consumed but produces negative voice with no mood modifier', () => {
  const before = band(), after = giveBandmateGift(before, 'RMCKanga', 'ActGiftPants') as ReturnType<typeof band>;
  assert.equal(after.money, before.money - 800);
  assert.equal(after.bandmates.lastSpeech?.template, 'a02rc0200z');
  assert.ok(after.bandmates.people.find(p => p.musicianId === 'RMCKanga')!.gifts.includes('ActGiftPants'));
  assert.equal(after.bandmates.modifiers.length, 0);
  assert.equal(bandmateStats(after, 'RMCKanga').mood, bandmateStats(before, 'RMCKanga').mood);
});
test('booze reaction uses actual party need and applies source health cost only on exiting to city', () => {
  let state = advance(band(), 1);
  const health = bandmateStats(state, 'RMCJerka').health;
  state = giveBandmateGift(state, 'RMCJerka', 'ActGiftDrink01') as typeof state;
  assert.equal(state.bandmates.lastSpeech?.template, 'a01rc0400X');
  assert.equal(bandmateStats(state, 'RMCJerka').health, health);
  assert.ok(state.bandmates.people.find(p => p.musicianId === 'RMCJerka')!.needs.NeedParty > 0);
  state = applyBandmateExitToCity(state) as typeof state;
  assert.equal(state.bandmates.people.find(p => p.musicianId === 'RMCJerka')!.needs.NeedParty, 0);
  assert.ok(Math.abs(bandmateStats(state, 'RMCJerka').health - (health - .09)) < 1e-8);
  assert.equal(state.bandmates.pendingBooze.length, 0);
  assert.ok(availableBandmateActions(state, 'RMCJerka', 'ActCatMusicianGifts').some(a => a.id === 'ActGiftDrink01'));
});
test('training books future days, prevents overlaps, improves musicality only on completion and expires after90days', () => {
  let state = trainBandmate(band(), 'RMCJerka', 'ActTrainMusicality') as ReturnType<typeof band>;
  assert.equal(state.money, 95000);
  assert.equal(state.bandmates.training[0].startDay, 2);
  assert.equal(state.bandmates.training[0].duration, 3);
  assert.equal(bandmateOccupied(state, 'RMCJerka'), false);
  assert.equal(bandmateOccupied(state, 'RMCJerka', 2), true);
  assert.throws(() => trainBandmate(state, 'RMCJerka', 'ActTrainPhysics', 3), /dates/);
  state = advance(state, 4);
  assert.equal(bandmateStats(state, 'RMCJerka').musicality, .3);
  state = advance(state, 5);
  assert.equal(state.bandmates.training[0].completed, true);
  assert.equal(bandmateOccupied(state, 'RMCJerka'), false);
  assert.ok(bandmateStats(state, 'RMCJerka').musicality > .49);
  assert.equal(state.bandmates.completions[0].seen, false);
  assert.equal(effectiveMusicians(state, data.musicians).find(m => m.id === 'RMCJerka')!.musicality, bandmateStats(state, 'RMCJerka').musicality);
  assert.equal(effectiveMusicians(state, data.musicians).find(m => m.id === 'RMCJerka')!.skills.Guitar, 1, 'Lessons never invent instrumental skill changes');
  assert.equal(bandmateStats(advance(state, 95), 'RMCJerka').musicality, .3);
});
test('relations target other band members and firing affects the musicians who liked the fired artist', () => {
  const initial = band(), praised = changeBandmateRelations(initial, 'RMCJerka', 'ActRelationFrontTalk') as ReturnType<typeof band>;
  assert.equal(praised.money, 99000);
  assert.ok(bandmateStats(praised, 'RMCKanga').mood > bandmateStats(initial, 'RMCKanga').mood);
  const fired = fireBandmate(initial, 'RMCJerka') as ReturnType<typeof band>;
  assert.equal(fired.band[0], null);
  assert.equal(fired.money, initial.money);
  assert.equal(fired.bandmates.people.find(p => p.musicianId === 'RMCJerka')!.fired, true);
  assert.equal(fired.bandmates.modifiers.find(m => m.id === 'KickedBandMember')!.amount, -.06);
});
test('invalid or unaffordable actions preserve state and malformed dynamic saves reject', () => {
  const state = band(), poor = { ...state, money: 99 };
  assert.throws(() => giveBandmateGift(poor, 'RMCJerka', 'ActGiftDrink01'), /afford/);
  assert.throws(() => giveBandmateGift(state, 'RMCSussie', 'ActGiftPants'), /not in/);
  assert.ok(validBandmates(state, data.musicians));
  const invalid = structuredClone(state);
  invalid.bandmates.people[0].health = Number.NaN;
  assert.equal(validBandmates(invalid, data.musicians), false);
  const invalidTraining = structuredClone(state);
  invalidTraining.bandmates.training.push({ id: 'fake', musicianId: 'RMCJerka', actionId: 'ActTrainMusicality', type: 'Musicality', startDay: 2, duration: 300, completed: false });
  assert.equal(validBandmates(invalidTraining, data.musicians), false);
  const missing = structuredClone(state);
  missing.bandmates.people.pop();
  assert.equal(validBandmates(missing, data.musicians), false);
  const duplicate = structuredClone(state);
  duplicate.bandmates.people[1] = duplicate.bandmates.people[0];
  assert.equal(validBandmates(duplicate, data.musicians), false);
});
test('firing after completed training clears actor notifications and preserves a valid save', () => {
  const trained = advance(trainBandmate(band(), 'RMCJerka', 'ActTrainMedia') as ReturnType<typeof band>, 5);
  assert.ok(trained.bandmates.completions.length);
  const fired = fireBandmate(trained, 'RMCJerka') as ReturnType<typeof band>;
  assert.equal(fired.bandmates.completions.length, 0);
  assert.ok(validBandmates(fired, data.musicians));
});
test('concert settlement resets live need and adds source practice bonus once for newly settled gigs', () => {
  const before = advance(band(), 3);
  const settled = { ...before, publicity: { ...before.publicity, concertResults: [{ id: 'result1', concertId: 'concert1', venueId: 'Live01', day: 3, audience: 40, satisfaction: .5, income: 400, rent: 0, cancelled: false }] } };
  const after = applyBandmateConcertFeedback(before, settled) as typeof before;
  assert.equal(after.bandmates.people.find(p => p.musicianId === 'RMCJerka')!.needs.NeedLive, 0);
  assert.ok(Math.abs(bandmateStats(after, 'RMCJerka').musicality - .33) < 1e-8);
  assert.equal(applyBandmateConcertFeedback(after, after), after, 'Existing result never reapplies feedback');
  assert.equal(after.bandmates.modifiers.filter(m => m.id === 'GigBoost').length, 2);
});
test('native concerns resolve missing level2 via level1, named relationships, localized aliases and short hover text', () => {
  const sourceStrings = { szidModMoodNoNeg: 'nothing to be angry about', szidModMoodNoPos: 'nothing to be happy about', szidModHealthNoNeg: 'feels OK',
    szidModMoodAttitudeP2: 'really likes <TmpName>', szidModMoodGiftP1: 'liked the gift' };
  const gifted = giveBandmateGift(band(), 'RMCJerka', 'ActGiftPants') as ReturnType<typeof band>;
  const firstName = data.musicians.find(m => m.id === 'RMCKanga')!.name.split(' ')[0];
  assert.deepEqual(bandmateConcerns(gifted, 'RMCJerka', data.musicians, sourceStrings), ['nothing to be angry about', `liked the gift, really likes ${firstName}`, 'feels OK']);
  const aliased = { ...sourceStrings, szidModMoodGiftP1: 'giftAlias', giftAlias: 'liked the gift' };
  assert.deepEqual(bandmateConcerns(gifted, 'RMCJerka', data.musicians, aliased), bandmateConcerns(gifted, 'RMCJerka', data.musicians, sourceStrings));
  const long = { ...sourceStrings, szidModMoodGiftP1: 'This intentionally long localized comment verifies the native clipping boundary' };
  const full = bandmateConcerns(gifted, 'RMCJerka', data.musicians, long);
  const clipped = bandmateConcerns(gifted, 'RMCJerka', data.musicians, long, true);
  assert.equal(clipped[1], full[1].slice(0, 37) + '...');
  assert.equal(bandmateConcerns(gifted, 'RMCJerka', data.musicians, {})[1], '', 'Missing localized strings never invent percentage or concern text');
});

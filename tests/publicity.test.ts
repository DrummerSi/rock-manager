import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from '../src/generated/game-data.json';
import { newGame, recruit, licenseSong, validSave } from '../src/game/model';
import { startRecording, finishRecording, signContract, evaluateDemo } from '../src/game/recording';
import { defaultDesign, bookRelease } from '../src/game/design';
import { defaultPublicity, PUBLICITY_RULES, advancePublicity, bookAdvert, bookConcert, canBookCalendar, givePressKit, giveGift, venueAcceptance, validPublicity, chartRows } from '../src/game/publicity';

function band() {
  let state = newGame(200000, new Date(2001, 2, 13));
  for (const [slot, id, instrument] of [[0, 'RMCJerka', 'Guitar'], [1, 'RMCTony', 'Guitar'], [2, 'RMCRaymond', 'Drums'], [3, 'RMCGurra', 'Bass'], [4, 'RMCSussie', 'Vocals']] as const)
    state = recruit(state, data.musicians, slot, id, instrument);
  state = licenseSong(state, data.songs, 'Sng01');
  state = finishRecording(startRecording(state, data.tutorialGameplay, 'Studio01', 'Sng01'), data.tutorialGameplay, data.musicians, data.songs);
  return { ...state, publicity: defaultPublicity(state) };
}
function album() {
  let state = band();
  const label = data.tutorialGameplay.labels.find(l => evaluateDemo(state, l, data.musicians).accepted)!;
  assert.ok(label);
  state = { ...signContract(state, label, data.musicians, 4), publicity: state.publicity };
  return { ...bookRelease(state, data.musicians, defaultDesign(), 6), publicity: state.publicity };
}
function tick<T extends ReturnType<typeof album>>(state: T, days: number): T {
  for (let i = 0; i < days; i++) state = advancePublicity({ ...state, day: state.day + 1 }, data.musicians);
  return state;
}

test('native venue rules and source calendar resources govern booking; no money changes on rejected booking', () => {
  const state = band(), snapshot = JSON.stringify(state);
  assert.ok(venueAcceptance(state, data.musicians, 'Live01').accepted);
  assert.throws(() => bookConcert(state, data.musicians, 'Live05', 2));
  assert.throws(() => bookConcert(state, data.musicians, 'Live01', 0));
  assert.equal(JSON.stringify(state), snapshot);
  const booked = bookConcert(state, data.musicians, 'Live01', 2);
  assert.equal(booked.money, state.money, 'Café Lizette has zero rent');
  assert.throws(() => bookConcert(booked, data.musicians, 'Live01', 5), /5 days/);
  assert.ok(!canBookCalendar(booked, 'release', 2), 'Release and concert share NotOnTour');
  assert.ok(canBookCalendar(booked, 'advert', 2), 'Adverts have no occupied resources');
});

test('ads charge source price per day once, allow overlap up to source four-event capacity, and affect exposure only while active', () => {
  const state = album(), price = PUBLICITY_RULES.adverts.find(a => a.id === 'AdCN01')!.price;
  let paid = bookAdvert(state, 'AdCN01', 2, 3);
  assert.equal(paid.money, state.money - price * 3);
  assert.equal(state.publicity.adverts.length, 0, 'Input is unchanged');
  for (let i = 0; i < 3; i++) paid = bookAdvert(paid, 'AdCN01', 2, 3);
  assert.throws(() => bookAdvert(paid, 'AdCN01', 2, 3));
  const before = tick(paid, 1);
  assert.ok(before.publicity.groups.every(g => g.albumExposure === 0));
  const active = tick(before, 1);
  assert.ok(active.publicity.groups.some(g => g.albumExposure > 0));
  const ended = tick(active, 3), later = tick(ended, 1);
  assert.equal(later.publicity.groups.reduce((s, g) => s + g.albumExposure, 0), ended.publicity.groups.reduce((s, g) => s + g.albumExposure, 0));
});

test('press kits are reporter-specific, free and persist; gifts charge original costs and apply reporter-specific reaction', () => {
  const state = album(), kit = givePressKit(state, 'Media02', data.musicians);
  assert.equal(kit.money, state.money);
  assert.throws(() => givePressKit(kit, 'Media02'));
  assert.equal(kit.publicity.reporters.find(r => r.mediaId === 'Media03')!.kit, null);
  assert.equal(kit.publicity.reporters.find(r => r.mediaId === 'Media02')!.nextPlaylistDay, 1);
  const gifted = giveGift(kit, 'ActMediaBr03', 'Media02');
  assert.equal(gifted.money, kit.money - 200);
  assert.ok(gifted.publicity.reporters[0].bribes > 0);
  assert.equal(kit.publicity.reporters[0].bribes, 0);
  assert.ok(validPublicity(JSON.parse(JSON.stringify(gifted))));
});

test('one-day gig settles once at event stop with native ticket share and persistent results; missing vocals cancels without new charge', () => {
  const booked = bookConcert(band(), data.musicians, 'Live01', 2);
  const before = tick(booked, 2);
  assert.equal(before.publicity.concertResults.length, 0);
  const complete = tick(before, 1), result = complete.publicity.concertResults[0];
  assert.ok(result.audience > 0);
  assert.equal(result.income, Math.round(result.audience * 50 * 0.5));
  assert.equal(complete.money, booked.money + result.income);
  assert.equal(tick(complete, 2).publicity.concertResults.length, 1);
  assert.deepEqual(advancePublicity(complete, data.musicians), complete);
  const noSinger = { ...booked, band: booked.band.map(b => b?.instrument === 'Vocals' ? null : b) };
  const cancelled = tick(noSinger, 3);
  assert.ok(cancelled.publicity.concertResults[0].cancelled);
  assert.equal(cancelled.money, booked.money);
});

test('daily exposure and source purchase equations produce sales, recoup advances before paying royalty, and survive save validation', () => {
  let state = album();
  state = { ...state, contract: { ...state.contract!, advance: 1 }, publicity: { ...state.publicity, albumKey: `${state.demo!.songId}:${state.demo!.recordedDay}` } };
  state = bookAdvert(state, 'AdCN01', 1, 5);
  state = givePressKit(state, 'Media02', data.musicians);
  const progressed = tick(state, 10);
  assert.ok(progressed.publicity.totalSales > 0);
  assert.equal(progressed.publicity.advanceRepaid, 1);
  assert.ok(progressed.publicity.paidRoyalties > 0);
  assert.ok(Number.isSafeInteger(progressed.money));
  assert.ok(validPublicity(progressed));
  assert.ok(validSave(JSON.parse(JSON.stringify(progressed)), data.musicians, data.songs, data.tutorialGameplay));
  assert.deepEqual(tick(JSON.parse(JSON.stringify(progressed)), 7), tick(progressed, 7), 'Persisted PRNG produces identical review/rotation replay');
  assert.equal(chartRows(progressed).length, 10);
  assert.ok(chartRows(progressed).every(r => r.position >= 1 && r.position <= 10));
});

test('source reach and group hype equations use diminishing returns rather than arbitrary direct sales increments', () => {
  const state = bookAdvert(album(), 'AdCN01', 1, 1);
  const first = tick(state, 1);
  const event = first.publicity.exposures.find(e => e.id === first.publicity.adverts[0].id)!;
  const index = first.publicity.groups.findIndex(g => g.albumExposure > 0), group = first.publicity.groups[index];
  const intensity = event.intensity * event.reach[group.id];
  assert.equal(group.albumExposure, intensity);
  assert.ok(Math.abs(group.albumHype - Math.max(-1, Math.min(1, intensity * event.quality[group.id] * 3 / (10 + intensity)))) < 1e-10);
  assert.equal(first.publicity.totalSales, 0, 'Scheduled albums cannot sell before release');
});

test('released-group demand follows original daily decay, resistance and cumulative purchase arithmetic', () => {
  const initial = album();
  initial.publicity.albumKey = `${initial.demo!.songId}:${initial.demo!.recordedDay}`;
  initial.publicity.lastDay = 5;
  initial.publicity.groups[0].albumHype = 0.2;
  initial.publicity.groups[0].willBuy = 0.05;
  const state = advancePublicity({ ...initial, day: 6 }, data.musicians);
  const group = state.publicity.groups[0], rule = PUBLICITY_RULES.groups[0];
  const hype = (0.2 - 0.005) * 0.962;
  const willingness = Math.max(0, (0.05 + rule.resistance * hype - 0.0065) * 0.995);
  assert.ok(Math.abs(group.albumHype - hype) < 1e-12);
  assert.ok(Math.abs(group.willBuy - willingness) < 1e-12);
  const expectedBought = rule.size * Math.max(0, (group.likes + (1 - 0.006 * 6)) * Math.min(1, willingness));
  assert.ok(Math.abs(group.bought - expectedBought) < 1e-8);
  assert.equal(initial.publicity.groups[0].bought, 0, 'Advancement leaves the original save untouched');
});

test('record store sales-category campaigns use original prices and audience exposure without requiring a reporter', () => {
  const state = album();
  assert.deepEqual(PUBLICITY_RULES.media.find(m => m.id === 'Media05')!.adverts, ['AdRS01', 'AdRS02', 'AdRS03']);
  for (const [id, price, intensity] of [['AdRS01', 1000, 0.1], ['AdRS02', 5000, 0.2], ['AdRS03', 8000, 0.4]] as const) {
    const booked = bookAdvert(state, id, 1, 2);
    assert.equal(booked.money, state.money - price * 2);
    const advanced = tick(booked, 1), exposure = advanced.publicity.exposures.find(e => e.id === booked.publicity.adverts[0].id)!;
    assert.equal(exposure.intensity, intensity);
    assert.ok(advanced.publicity.groups.some(g => g.albumExposure > 0));
    assert.ok(validPublicity(advanced));
  }
  assert.equal(defaultPublicity(state).firstMediaVisitDay, null);
  assert.ok(validPublicity({ ...state, publicity: { ...state.publicity, firstMediaVisitDay: state.day } }));
  assert.equal(validPublicity({ ...state, publicity: { ...state.publicity, firstMediaVisitDay: state.day + 1 } }), false);
});

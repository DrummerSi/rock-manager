import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from '../src/generated/game-data.json';
import { advanceDay, calendarDate, candidates, licenseSong, newGame, recruit, validSave } from '../src/game/model';
import { initialCityAnimation, tickCityAnimation } from '../src/game/city-animation';
import { chooseSessionMusician, contractOffers, defaultEffects, evaluateDemo, finishRecording, signContract, startRecording, updateChannel } from '../src/game/recording';

function recordingBand() {
  let state = newGame(100000, new Date(2001, 2, 13));
  for (const [slot, id, instrument] of [[0, 'RMCJerka', 'Guitar'], [1, 'RMCTony', 'Guitar'], [2, 'RMCRaymond', 'Drums'],
    [3, 'RMCGurra', 'Bass'], [4, 'RMCSussie', 'Vocals']] as const) state = recruit(state, data.musicians, slot, id, instrument);
  return licenseSong(state, data.songs, 'Sng01');
}

test('studios require a band, licensed song and funds; rental is charged once and saved while mixing', () => {
  assert.throws(() => startRecording(licenseSong(newGame(100000), data.songs, 'Sng01'), data.tutorialGameplay, 'Studio01', 'Sng01'));
  const band = recordingBand();
  assert.throws(() => startRecording(band, data.tutorialGameplay, 'Studio01', 'Sng03'));
  assert.throws(() => startRecording({ ...band, money: 5999 }, data.tutorialGameplay, 'Studio01', 'Sng01'));
  const paid = startRecording(band, data.tutorialGameplay, 'Studio01', 'Sng01');
  assert.equal(paid.money, 83000);
  assert.equal(paid.day, 0, 'The original freezes game time while mixing; no invented recording delay');
  assert.equal(paid.recording?.channels.length, 5);
  assert.throws(() => startRecording(paid, data.tutorialGameplay, 'Studio01', 'Sng01'));
  assert.ok(validSave(JSON.parse(JSON.stringify(paid)), data.musicians, data.songs, data.tutorialGameplay));
  assert.equal(startRecording(band, data.tutorialGameplay, 'Studio04', 'Sng01').recording?.channels.length, 4);
  assert.equal(startRecording(licenseSong(band, data.songs, 'Sng02'), data.tutorialGameplay, 'Studio01', 'Sng01').selectedSong, 'Sng01');
});

test('demo quality uses recovered weighted musicality, channel count and studio/song contributions', () => {
  const paid = startRecording(recordingBand(), data.tutorialGameplay, 'Studio01', 'Sng01');
  const finished = finishRecording(paid, data.tutorialGameplay, data.musicians, data.songs);
  // Weighted band musicality: vocals .6*1.3 plus .7,.3,.5,.6 over weight5.3.
  const expected = (0.25 * 0.4 + 2.88 / 5.3 + 0.25 * 0.5) / 1.5;
  assert.ok(Math.abs(finished.demo!.quality - expected) < 1e-12);
  assert.equal(finished.money, paid.money);
  assert.equal(finished.recording, null);
  assert.equal(finished.demo!.songType, 0.7);
  const muted = updateChannel(paid, 0, { muted: true }, data.tutorialGameplay);
  assert.equal(finishRecording(muted, data.tutorialGameplay, data.musicians, data.songs).demo!.songType, 0.35);
  let silent = paid;
  for (let i = 0; i < 5; i++) silent = updateChannel(silent, i, { volume: 0 }, data.tutorialGameplay);
  assert.throws(() => finishRecording(silent, data.tutorialGameplay, data.musicians, data.songs));
});

test('session musician selection charges on replacement, not re-selection, and rejects unaffordable fees', () => {
  const paid = startRecording(recordingBand(), data.tutorialGameplay, 'Studio01', 'Sng01');
  const chosen = chooseSessionMusician(paid, data.tutorialGameplay, 0, 'Stud04');
  assert.equal(chosen.money, paid.money - 16000);
  assert.equal(chooseSessionMusician(chosen, data.tutorialGameplay, 0, 'Stud04').money, chosen.money);
  assert.ok(finishRecording(chosen, data.tutorialGameplay, data.musicians, data.songs).demo!.quality > finishRecording(paid, data.tutorialGameplay, data.musicians, data.songs).demo!.quality);
  assert.throws(() => chooseSessionMusician({ ...paid, money: 15999 }, data.tutorialGameplay, 0, 'Stud04'));
  assert.throws(() => chooseSessionMusician(paid, data.tutorialGameplay, 0, 'Stud01'));
  assert.equal(chooseSessionMusician(chosen, data.tutorialGameplay, 0, null).recording?.channels[0].musicianId, 'RMCSussie');
});

test('labels judge style, song type and quality; negotiation links royalty to advance and signing pays once', () => {
  const demo = finishRecording(startRecording(recordingBand(), data.tutorialGameplay, 'Studio01', 'Sng01'), data.tutorialGameplay, data.musicians, data.songs);
  const rebel = data.tutorialGameplay.labels.find((l) => l.id === 'Record01')!;
  const rainbow = data.tutorialGameplay.labels.find((l) => l.id === 'Record03')!;
  assert.equal(evaluateDemo(demo, rebel, data.musicians).accepted, true);
  assert.equal(evaluateDemo(demo, rainbow, data.musicians).accepted, false);
  assert.throws(() => signContract(demo, rainbow, data.musicians, 4));
  const offers = contractOffers(rebel, 0.6555066918439012);
  assert.equal(offers.length, 11);
  assert.deepEqual(offers[0], { advance: 70000, royalty: 0.05 });
  assert.deepEqual(offers[10], { advance: 40000, royalty: 0.15 });
  const signed = signContract(demo, rebel, data.musicians, 5);
  assert.equal(signed.money, demo.money + offers[5].advance);
  assert.equal(signed.contract!.albums, 3);
  assert.throws(() => signContract(signed, rebel, data.musicians, 5));
  assert.ok(validSave(JSON.parse(JSON.stringify(signed)), data.musicians, data.songs, data.tutorialGameplay));
  assert.equal(validSave({ ...signed, contract: { ...signed.contract, signedDay: -1 } }, data.musicians, data.songs, data.tutorialGameplay), false);
});

test('saved effects retain their normalized ranges and reject corrupt settings without changing demo quality', () => {
  const paid = startRecording(recordingBand(), data.tutorialGameplay, 'Studio01', 'Sng01');
  const effects = defaultEffects(); effects.delay.active = true; effects.delay.mix = 1; effects.timeShift.mode = true;
  const edited = updateChannel(paid, 1, { effects }, data.tutorialGameplay);
  assert.ok(validSave(JSON.parse(JSON.stringify(edited)), data.musicians, data.songs, data.tutorialGameplay));
  assert.equal(finishRecording(edited, data.tutorialGameplay, data.musicians, data.songs).demo!.quality,
    finishRecording(paid, data.tutorialGameplay, data.musicians, data.songs).demo!.quality);
  assert.throws(() => updateChannel(paid, 1, { effects: { ...effects, delay: { ...effects.delay, decay: 2 } } }, data.tutorialGameplay));
  const corrupt = { ...paid, recording: { ...paid.recording, channels: paid.recording!.channels.map((c, i) => i === 1 ? { ...c, effects: null } : c) } };
  assert.equal(validSave(corrupt, data.musicians, data.songs, data.tutorialGameplay), false);
});

test('city frame scripts retain three-tick cadence, long pauses and looping order', () => {
  const sequence = [{ offset: 14, pause: 450 }, { offset: 0, pause: 0 }, { offset: 1, pause: 0 }];
  let state = tickCityAnimation(initialCityAnimation(), sequence);
  assert.equal(state.offset, 14);
  for (let i = 0; i < 1350; i++) state = tickCityAnimation(state, sequence);
  assert.equal(state.offset, 14);
  assert.equal(state.pause, 0);
  for (let i = 0; i < 3; i++) state = tickCityAnimation(state, sequence);
  assert.equal(state.offset, 0);
  for (let i = 0; i < 3; i++) state = tickCityAnimation(state, sequence);
  assert.equal(state.offset, 1);
  for (let i = 0; i < 3; i++) state = tickCityAnimation(state, sequence);
  assert.equal(state.offset, 14);
});

test('licensing uses recovered price, prevents duplicates, rejects unavailable and unaffordable songs', () => {
  const licensed = licenseSong(newGame(100000), data.songs, 'Sng01');
  assert.equal(licensed.money, 89000);
  assert.deepEqual(licensed.ownedSongs, ['Sng01']);
  assert.equal(licensed.selectedSong, 'Sng01');
  assert.throws(() => licenseSong(licensed, data.songs, 'Sng01'));
  assert.throws(() => licenseSong(newGame(100), data.songs, 'Sng01'));
  assert.throws(() => licenseSong(newGame(100000), data.songs, 'Sng03'));
  assert.ok(validSave(licensed, data.musicians, data.songs));
  assert.equal(validSave({ ...licensed, selectedSong: 'Sng02' }, data.musicians, data.songs), false);
});

test('Mission01 starts with recovered funds and filters candidates by the original position rules', () => {
  const state = newGame(data.mission.startMoney, new Date(2001, 2, 13));
  assert.equal(state.money, 100000);
  assert.deepEqual(candidates(state, data.musicians, 2).map((m) => m.id), ['RMCGullan', 'RMCMartin', 'RMCRaymond']);
  assert.equal(calendarDate(state), '13 Mar 2001');
  assert.equal(candidates(state, data.musicians, 99).length, 0);
});

test('recruitment prevents duplicate musicians, occupied positions and unsupported instruments', () => {
  const state = recruit(newGame(100000), data.musicians, 0, 'RMCJerka', 'Guitar');
  assert.equal(state.money, 100000, 'Recruitment has no invented upfront hiring fee');
  assert.throws(() => recruit(state, data.musicians, 1, 'RMCJerka', 'Guitar'));
  assert.throws(() => recruit(state, data.musicians, 0, 'RMCKanga', 'Guitar'));
  assert.throws(() => recruit(state, data.musicians, 2, 'RMCKanga', 'Drums'));
});

test('weekly payroll follows the recovered seventh-day rule, with no duplicate charge after save reload', () => {
  let state = recruit(newGame(100000), data.musicians, 0, 'RMCJerka', 'Guitar');
  state = recruit(state, data.musicians, 2, 'RMCGullan', 'Drums');
  for (let i = 0; i < 6; i++) state = advanceDay(state, data.musicians).state;
  assert.equal(state.money, 100000);
  const seventh = advanceDay(state, data.musicians);
  assert.equal(seventh.wages, 290);
  assert.equal(seventh.state.money, 99710);
  const saved: unknown = JSON.parse(JSON.stringify(seventh.state));
  assert.ok(validSave(saved, data.musicians));
  assert.equal(advanceDay(saved, data.musicians).state.money, 99710);
});

test('unaffordable wages do not make cash negative', () => {
  const hired = recruit(newGame(100), data.musicians, 0, 'RMCJerka', 'Guitar');
  const result = advanceDay({ ...hired, day: 6 }, data.musicians);
  assert.equal(result.state.money, 100);
  assert.equal(result.unpaid, 130);
});

test('save validation rejects corrupt, duplicate, unknown and incompatible members', () => {
  const valid = recruit(newGame(100000), data.musicians, 0, 'RMCJerka', 'Guitar');
  assert.ok(validSave(valid, data.musicians));
  assert.equal(validSave({ ...valid, money: -1 }, data.musicians), false);
  assert.equal(validSave({ ...valid, day: Infinity }, data.musicians), false);
  assert.equal(validSave({ ...valid, band: [valid.band[0], valid.band[0], null, null, null] }, data.musicians), false);
  assert.equal(validSave({ ...valid, band: [null, null, { musicianId: 'RMCJerka', instrument: 'Drums' }, null, null] }, data.musicians), false);
  assert.equal(validSave({ ...valid, band: [null, null, null, null, { musicianId: 'missing', instrument: 'Vocals' }] }, data.musicians), false);
});

test('calendar advancement crosses a leap day without timezone drift', () => {
  const state = { ...newGame(100000), startDate: '2000-02-28', day: 1 };
  assert.equal(calendarDate(state), '29 Feb 2000');
  assert.equal(calendarDate({ ...state, day: 2 }), '01 Mar 2000');
});

import { bookRelease, defaultDesign, designCost } from '../src/game/design';
test('cover booking charges only once, requires a signed demo, preserves artwork and permits tomorrow', () => {
 const demo=finishRecording(startRecording(recordingBand(),data.tutorialGameplay,'Studio01','Sng01'),data.tutorialGameplay,data.musicians,data.songs);
 const label=data.tutorialGameplay.labels.find(l=>l.id==='Record01')!;
 const signed=signContract(demo,label,data.musicians,5);
 const selection=['DEDBGCurtain','DEDArtists01','DEDEfffect04','DEDFont03'];
 assert.equal(designCost(selection),3500);assert.equal(designCost(defaultDesign()),0);
 assert.throws(()=>bookRelease(demo,data.musicians,selection,1));
 assert.throws(()=>bookRelease({...signed,money:3499},data.musicians,selection,1));
 assert.throws(()=>bookRelease(signed,data.musicians,selection,0));
 assert.throws(()=>bookRelease(signed,data.musicians,['bad',...selection.slice(1)],1));
 const booked=bookRelease(signed,data.musicians,selection,1);
 assert.equal(booked.money,signed.money-3500);assert.equal(booked.album?.releaseDay,1);
 assert.deepEqual(booked.demo,signed.demo);assert.equal(signed.album,null);
 assert.throws(()=>bookRelease(booked,data.musicians,selection,6));
 assert.ok(validSave(JSON.parse(JSON.stringify(booked)),data.musicians,data.songs,data.tutorialGameplay));
 assert.equal(validSave({...booked,album:{...booked.album,cost:0}},data.musicians,data.songs,data.tutorialGameplay),false);
 const next=advanceDay(booked,data.musicians).state;assert.equal(next.day,next.album?.releaseDay);assert.equal(next.money,booked.money);
 assert.equal(bookRelease(signed,data.musicians,defaultDesign(),6).album?.quality,Math.max(0,signed.demo!.quality-.05));
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from '../src/generated/game-data.json';
import { advanceDay, calendarDate, candidates, newGame, recruit, validSave } from '../src/game/model';

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

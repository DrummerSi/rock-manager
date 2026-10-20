import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { newGame } from '../src/game/model';
import { evaluateMissionProgress, recordMissionFailure, confirmMissionFailure, acknowledgeMissionResult, missionObjectives, missionEnding, missionScore, validMissionProgress } from '../src/game/mission-progress';
const initial = () => ({ ...newGame(100000, new Date(2001, 2, 13)), started: true });
test('native record-store Top10 entry waits one game day and survives chart exit and save reload', () => {
  const source = JSON.parse(readFileSync('analysis/original/data/DataDBRest01.json', 'utf8')).data.Trigger;
  const entered = source.ID.indexOf('TRMis1Succeeded'), delayed = source.ID.indexOf('TRMis1Succeeded02');
  assert.match(source.ExecuteThis[entered], /media05/i);
  assert.match(source.ExecuteThis[delayed], /triggeractivateDate\+1/i);
  const start = initial();
  const pending = evaluateMissionProgress({ ...start, day: 14, publicity: { ...start.publicity, chart: 10, top10Day: 14 } });
  assert.equal(pending.missionProgress.status, 'pending');
  assert.equal(pending.missionProgress.pendingWinDay, 15);
  assert.equal(validMissionProgress(pending), true);
  const reload = JSON.parse(JSON.stringify(pending));
  const won = evaluateMissionProgress({ ...reload, day: 15, publicity: { ...reload.publicity, chart: 0 } });
  assert.equal(won.missionProgress.status, 'won');
  assert.equal(won.missionProgress.endedDay, 15);
  const acknowledged = acknowledgeMissionResult(won);
  assert.equal(evaluateMissionProgress(JSON.parse(JSON.stringify({ ...acknowledged, day: 30 }))).missionProgress.acknowledged, true);
});
test('radio Top10 alone never completes Mission01; legacy sales Top10 derives its original pending/won day', () => {
  const start = initial();
  assert.equal(evaluateMissionProgress({ ...start, day: 7, publicity: { ...start.publicity, radioChart: 1 } }).missionProgress.status, 'active');
  assert.equal(evaluateMissionProgress({ ...start, day: 7, publicity: { ...start.publicity, chart: 4, top10Day: 7 } }).missionProgress.status, 'pending');
  assert.equal(evaluateMissionProgress({ ...start, day: 10, publicity: { ...start.publicity, top10Day: 7 } }).missionProgress.endedDay, 8);
});
test('zero money is allowed; unpaid mandatory payment queues original warning, acknowledgment fails mission', () => {
  const start = { ...initial(), money: 0 };
  assert.equal(evaluateMissionProgress(start).missionProgress.status, 'active');
  const queued = recordMissionFailure(start, 'NoMoney');
  assert.equal(queued.missionProgress.status, 'pending');
  assert.equal(queued.missionProgress.pendingFailure, 'NoMoney');
  assert.equal(queued.missionProgress.endedDay, null);
  assert.equal(validMissionProgress(queued), true);
  const lost = confirmMissionFailure(JSON.parse(JSON.stringify(queued)));
  assert.equal(lost.missionProgress.status, 'lost');
  assert.equal(lost.missionProgress.failureReason, 'NoMoney');
  assert.equal(missionEnding(lost).text, "You're broke. The game is over.\nYou should manage your cash more carefully in the future.");
  assert.equal(acknowledgeMissionResult(lost).missionProgress.acknowledged, true);
});
test('running out of vocalists confirms generic failure, ending statuses remain terminal', () => {
  const sourceCards = JSON.parse(readFileSync('analysis/original/data/DataDBEC00.json', 'utf8')).data.EventCardOKCancel;
  const noSingers = sourceCards.ID.indexOf('ECOCNoSingersLeft'), noMoney = sourceCards.ID.indexOf('ECOCOutOfMoney');
  assert.match(sourceCards.ButtonOK.ExecuteThis[noSingers], /Mission\.failed\(\)/);
  assert.match(sourceCards.ButtonOK.ExecuteThis[noMoney], /Mission\.failed\(#NoMoney\)/);
  const lost = confirmMissionFailure(recordMissionFailure(initial(), 'NoSingersLeft'));
  assert.equal(lost.missionProgress.failureReason, 'NoSingersLeft');
  assert.match(missionEnding(lost).text, /That didn't go too well/);
  const laterChart = { ...lost, day: 2, publicity: { ...lost.publicity, chart: 1, top10Day: 0 } };
  assert.equal(evaluateMissionProgress(laterChart).missionProgress.status, 'lost');
  const won = evaluateMissionProgress({ ...initial(), day: 2, publicity: { ...initial().publicity, top10Day: 0 } });
  assert.equal(recordMissionFailure(won, 'NoMoney').missionProgress.status, 'won');
});
test('original ending text, artwork references and scores retain evidence; no unimplemented mission is playable', () => {
  const start = initial();
  const won = evaluateMissionProgress({ ...start, day: 2, bandName: 'The Source Band', publicity: { ...start.publicity, top10Day: 0,
    concertResults: [{ id: 'concert1', concertId: 'book1', venueId: 'Live01', day: 1, audience: 50, satisfaction: .79, income: 500, rent: 0, cancelled: false }],
    reviews: [{ id: 'review1', mediaId: 'Media03', day: 1, rating: 4, quality: .79 }] } });
  const score = missionScore(won);
  assert.equal(score.concertPoints, 30000);
  assert.equal(score.reviewPoints, 60000, 'Source truncates raw 5*quality; rounded four-star display must not be scored as80k');
  assert.equal(score.total, 190000);
  const ending = missionEnding(won, 'Source Song');
  assert.match(ending.text, /Source Song entered the Top 10/);
  assert.match(ending.text, /The Source Band are destined/);
  assert.equal(ending.picture, 'Mission01_success01');
  assert.equal(ending.originalNextMissionId, 'Mission02');
  assert.equal(ending.nextPlayableMissionId, 'Mission03');
});
test('objectives distinguish a licensed song, completed demo, signed contract and released cover from missing content', () => {
  const state = initial(), goals = missionObjectives(state);
  assert.equal(goals.find(g => g.id === 'song')!.done, false);
  assert.equal(goals.find(g => g.id === 'demo')!.done, false);
  assert.equal(goals.find(g => g.id === 'release')!.done, false);
  assert.equal(goals.find(g => g.id === 'top10')!.done, false);
  assert.equal(missionObjectives({ ...state, ownedSongs: ['Sng01'], selectedSong: 'Sng01' }).find(g => g.id === 'song')!.done, true);
});
test('mission save validator accepts legacy absence and rejects contradictory or forged outcome dates', () => {
  const start = initial();
  assert.ok(validMissionProgress(start));
  const active = evaluateMissionProgress(start);
  assert.ok(validMissionProgress(active));
  assert.equal(validMissionProgress({ ...active, missionProgress: { ...active.missionProgress, status: 'won', endedDay: 0 } }), false);
  assert.equal(validMissionProgress({ ...active, missionProgress: { ...active.missionProgress, acknowledged: true } }), false);
  assert.equal(validMissionProgress({ ...active, missionProgress: { ...active.missionProgress, status: 'lost', failureReason: 'NoMoney', endedDay: 10 } }), false);
});

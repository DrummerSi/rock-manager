import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newGame,type GameState,type Musician} from '../src/game/model';
import {defaultBandmates} from '../src/game/bandmates';
import {initialMission04Events,updateMission04Events} from '../src/game/mission04-events';
import type {MissionEventState} from '../src/game/mission-event-types';
type State=GameState&{scenario:MissionEventState};
const nadia:Musician={id:'RMCPernille',name:'Nadia Starr',age:22,salary:400,description:'',genre:'Pop',musicality:.1,mood:.5,health:.8,charisma:.2,skills:{Vocals:1}};
function fixture():State{
  const s=newGame(120000);s.band[4]={musicianId:nadia.id,instrument:'Vocals'};s.bandmates=defaultBandmates(s,[nadia]);
  s.album={songId:'Sng03',bandName:s.bandName,band:s.band,selection:[],cost:0,quality:.3,imageStyle:{Metal:0,rock:0,Punk:0,Pop:0,Dance:0,Boring:0},designedDay:0,releaseDay:2};
  return {...s,scenario:initialMission04Events(s)};
}
const tick=(s:State,day:number)=>updateMission04Events({...s,day},{kind:'day'},[nadia]) as State;
test('native Mission04 TV threshold is .15, strict activation+6 delay and source completion acknowledgment',()=>{
  const source=JSON.parse(fs.readFileSync('analysis/original/mission04-recovered.json','utf8'));
  assert.match(source.triggers.find((t:{ID:string})=>t.ID==='TRMis4Media01RqNadia01').ExecuteThis,/>= 0\.15/);
  assert.match(source.triggers.find((t:{ID:string})=>t.ID==='TRMis4Media01RqNadia01b').ExecuteThis,/> me.TriggerActivateDate \+ 6/);
  let s=fixture();for(const group of s.publicity.groups)group.albumHype=.15;
  s=tick(s,1);s=tick(s,7);assert.ok(!s.scenario.queue.some(c=>c.id==='ECOCMis4Media01RqNadia'));
  s=tick(s,8);assert.ok(s.scenario.queue.some(c=>c.id==='ECOCMis4Media01RqNadia'));
  s=updateMission04Events(s,{kind:'card',cardId:'ECOCMis4Media01RqNadia',choice:'ButtonOK'},[nadia]) as State;
  assert.deepEqual(s.scenario.appointments[0],{id:'DivEventWin',kind:'television',startDay:10,duration:1,actorId:nadia.id,placeId:'Media01',completed:false});
  s=tick(s,10);assert.equal(s.scenario.outcome,null);
  s=tick(s,11);assert.ok(s.scenario.queue.some(c=>c.id==='ECOCMis4Complete'));assert.equal(s.scenario.outcome,null);
  s=updateMission04Events(s,{kind:'card',cardId:'ECOCMis4Complete',choice:'ButtonOK'},[nadia]) as State;assert.equal(s.scenario.outcome,'won');
  assert.equal(tick(JSON.parse(JSON.stringify(s)),12).scenario.outcome,'won');
});
test('declining TV and firing Nadia fail only after original cards acknowledged',()=>{
  let s=fixture();s.scenario.queue=[{id:'ECOCMis4Media01RqNadia'}];
  s=updateMission04Events(s,{kind:'card',cardId:'ECOCMis4Media01RqNadia',choice:'ButtonCancel'},[nadia]) as State;
  assert.equal(s.scenario.outcome,null);assert.ok(s.scenario.queue.some(c=>c.id==='ECOCMis4Media01IgnoredGameOver'));
  s=updateMission04Events(s,{kind:'card',cardId:'ECOCMis4Media01IgnoredGameOver',choice:'ButtonOK'},[nadia]) as State;assert.equal(s.scenario.outcome,'lost');
  s=updateMission04Events(fixture(),{kind:'fire',actorId:nadia.id},[nadia]) as State;
  assert.equal(s.scenario.outcome,null);
  s=updateMission04Events(s,{kind:'card',cardId:'ECOCMis4GameOverFireNadia',choice:'ButtonOK'},[nadia]) as State;assert.equal(s.scenario.failureReason,'FireNadia');
});
test('Nadia gift cancels delayed envy; reload preserves timers without repeated daily processing',()=>{
  let s=fixture();s.day=3;s=updateMission04Events(s,{kind:'gift',actorId:'RMCJerka'},[nadia]) as State;assert.equal(s.scenario.active.EnvyGift02,3);
  s.day=4;s=updateMission04Events(s,{kind:'gift',actorId:nadia.id},[nadia]) as State;s=tick(s,5);
  assert.ok(!s.scenario.queue.some(c=>c.id==='ECOCMis4EnvyGift'));
  const saved=JSON.parse(JSON.stringify(s));assert.deepEqual(tick(saved,5),saved);
});
test('scripted card actions cannot be invoked unless card is pending; money warning does not kill mission',()=>{
  let s=fixture();const original=s.money;
  s=updateMission04Events(s,{kind:'card',cardId:'ECOCMis4MoneyBag',choice:'ButtonOK'},[nadia]) as State;assert.equal(s.money,original);
  s.money=9000;s=tick(s,1);assert.ok(s.scenario.queue.some(c=>c.id==='ECOCMis4MoneyLow'));assert.equal(s.scenario.outcome,null);
});
test('source Never Mind third button preserves cash and schedules negative publicity with ten-day mood penalty',()=>{
  const source=JSON.parse(fs.readFileSync('analysis/original/mission04-recovered.json','utf8'));
  assert.match(source.cards.find((c:{ID:string})=>c.ID==='ECMMis4StealSong').Button3.ExecuteThis,/expose\(0,0\.3,-0\.3,1\)/);
  const s=fixture();s.day=12;s.scenario.queue=[{id:'ECMMis4StealSong'}];
  const next=updateMission04Events(s,{kind:'card',cardId:'ECMMis4StealSong',choice:'Button3'},[nadia]) as State;
  assert.equal(next.money,s.money);assert.equal(s.publicity.exposures.length,0);
  const penalty=next.bandmates.modifiers.find(m=>m.id==='Allmad')!;
  assert.deepEqual([penalty.musicianId,penalty.amount,penalty.duration],[nadia.id,-.1,10]);
  const exposure=next.publicity.exposures.at(-1)!;assert.deepEqual([exposure.startDay,exposure.duration,exposure.intensity],[13,1,.3]);
  assert.ok(Object.values(exposure.quality).every(q=>q===-.3));
  assert.equal(next.scenario.active.Rockets02,undefined);assert.equal(next.scenario.active.Rockets03,undefined);
});

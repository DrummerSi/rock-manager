import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/generated/game-data.json' with {type:'json'};
import {newMission} from '../src/game/missions';
import {newGame,type GameState,type Musician} from '../src/game/model';
import {defaultBandmates} from '../src/game/bandmates';
import {applyMusicianQuits,completeMusicianQuit} from '../src/game/musician-quits';
const nadia:Musician={id:'RMCPernille',name:'Nadia',salary:400,age:23,description:'',genre:'Pop',skills:{Vocals:1},health:.8,mood:.5,musicality:.1,charisma:.2};
function fixture():GameState{
  const s=newMission('Mission04',[nadia]);s.started=true;
  s.bandmates.modifiers.push({id:'TestDistress',musicianId:nadia.id,stat:'mood',amount:-1,startDay:0,duration:10});
  return s;
}
test('native quit crossing queues artist card; showing it removes Nadia and queues original failure awaiting acknowledgment',()=>{
  const original=fixture();const queued=applyMusicianQuits(original,[nadia]);
  assert.ok(queued.band[4]);assert.deepEqual(queued.scenario!.queue[0],{id:'ECOCQuitNow',speakerId:nadia.id});
  assert.equal(queued.scenario!.outcome,null);
  const shown=completeMusicianQuit(queued,nadia.id,[nadia]);
  assert.equal(shown.band[4],null);assert.equal(shown.bandmates.people[0].fired,true);
  assert.deepEqual(shown.scenario!.queue.map(c=>c.id),['ECOCQuitNow','ECOCMis4NadiaQuitBand']);
  assert.equal(shown.scenario!.outcome,null);assert.ok(original.band[4]);
  assert.deepEqual(completeMusicianQuit(shown,nadia.id,[nadia]),shown);
});
test('native occupied guard defers training quit, while ordinary concert does not defer',()=>{
  let s=fixture();s.bandmates.training=[{id:'training1',musicianId:nadia.id,actionId:'ActTrainMusic',type:'Musicality',startDay:0,duration:3,completed:false}];
  assert.equal(applyMusicianQuits(s,[nadia]).scenario!.queue.length,0);
  s.day=3;s=applyMusicianQuits(s,[nadia]);assert.equal(s.scenario!.queue[0].id,'ECOCQuitNow');
  s=fixture();s.publicity.concerts=[{id:'concert1',venueId:'Live01',startDay:0,duration:1,completed:false}];
  assert.equal(applyMusicianQuits(s,[nadia]).scenario!.queue[0].id,'ECOCQuitNow');
});
test('furious warning crossing does not remove actor; thresholds and reload do not duplicate pending cards',()=>{
  const s=fixture();s.bandmates.modifiers=[];s.bandmates.people[0].mood=.21;
  s.scenario!.vars['lastMood:'+nadia.id]=.5;
  let warned=applyMusicianQuits(s,[nadia]);assert.equal(warned.scenario!.queue[0].id,'ECOCWantQuit');assert.ok(warned.band[4]);
  warned=applyMusicianQuits(JSON.parse(JSON.stringify(warned)),[nadia]);assert.equal(warned.scenario!.queue.length,1);
  // Sole-band Lonely subtracts .16: .17 leaves the mood at the .01 boundary.
  warned.bandmates.people[0].mood=.17;warned.scenario!.vars['lastMood:'+nadia.id]=.5;
  warned.scenario!.queue=[];const boundary=applyMusicianQuits(warned,[nadia]);
  assert.ok(!boundary.scenario!.queue.some(c=>c.id==='ECOCQuitNow'));
});
test('legacy Mission01 behavior and nonpending actor departure cannot be triggered by helper',()=>{
  const old=newGame(100000);old.bandmates=defaultBandmates(old,data.musicians);assert.equal(applyMusicianQuits(old,data.musicians),old);
  const s=fixture();assert.equal(completeMusicianQuit(s,nadia.id,[nadia]),s);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,type GameState,type Musician} from '../src/game/model';
import {defaultBandmates,BANDMATE_RULES} from '../src/game/bandmates';
import {initialScenario03,updateScenario03,applyScenario03StartingModifiers} from '../src/game/scenario03';
const musicians:Musician[]=['RMCLelle','RMCNille'].map(id=>{const m=BANDMATE_RULES.musicians.find(m=>m.id===id)!;return{id,name:id,age:m.age,salary:500,description:'',genre:'Pop',musicality:m.musicality,mood:m.mood,health:m.health,charisma:m.charisma,skills:{Guitar:id==='RMCNille'?1:0,Vocals:id==='RMCLelle'?1:0}};});
function fresh(){let s={...newGame(100000),missionId:'Mission03',bandName:'Morning Glory',band:[{musicianId:'RMCNille',instrument:'Guitar'},null,null,null,{musicianId:'RMCLelle',instrument:'Vocals'}]} as unknown as GameState;s.bandmates=defaultBandmates(s,musicians);s={...s,scenario:initialScenario03(s)};return applyScenario03StartingModifiers(s);}
const run=(s:GameState,kind:Parameters<typeof updateScenario03>[1]['kind'],args:object={})=>updateScenario03(s,{kind,...args},musicians);
test('native Mission03 starts with immutable day70 gala and reciprocal brother modifiers',()=>{
 const s=fresh();assert.equal(s.scenario!.appointments[0].startDay,70);assert.equal(s.scenario!.appointments[0].placeId,'Live06');
 assert.deepEqual(s.bandmates.modifiers.map(m=>[m.musicianId,m.otherId,m.amount,m.duration]),[['RMCLelle','RMCNille',2,100],['RMCNille','RMCLelle',2,100]]);
});
test('gifts become jealousy only on city return after unequal two gifts; acknowledgement applies exact modifiers',()=>{
 let s=fresh();s=run(s,'gift',{actorId:'RMCLelle'});s=run(s,'gift',{actorId:'RMCLelle'});assert.equal(s.scenario!.queue.length,0);
 s=run(s,'city');assert.deepEqual(s.scenario!.queue,[{id:'ECOCMis3GiftJealousy',speakerId:'RMCNille'}]);
 const before=structuredClone(s);s=run(s,'card',{cardId:'ECOCMis3GiftJealousy',choice:'ButtonOK'});assert.equal(before.bandmates.modifiers.length,2);assert.equal(s.bandmates.modifiers.length,5);
 assert.deepEqual(s.bandmates.modifiers.slice(2).map(m=>[m.musicianId,m.amount,m.duration,m.otherId]),[['RMCLelle',-.2,100,'RMCNille'],['RMCLelle',.6,2,undefined],['RMCNille',-.1,10,undefined]]);
});
test('source Mutton apology and aggressive branches activate different delayed consequences',()=>{
 for(const [choice,next,quality]of [['ButtonOK','muttonfight4',-.3],['ButtonCancel','muttonfight5',.3]] as const){let s=fresh();s.scenario!.queue.push({id:'ECOCMis3MuttonFightBandWimps'});s=run(s,'card',{cardId:'ECOCMis3MuttonFightBandWimps',choice});assert.equal(s.scenario!.active[`TRMis3${next}`],0);assert.equal(s.publicity.exposures[0].startDay,1);assert.equal(Object.values(s.publicity.exposures[0].quality)[0],quality);}
});
test('fixed gala succeeds at START with a demo, without fake chart/rating/release requirements',()=>{
 let s=fresh();s.day=70;s.demo={songId:'Sng18',recordedDay:1} as GameState['demo'];s=run(s,'day');assert.equal(s.scenario!.outcome,'won');assert.equal(s.scenario!.appointments[0].completed,true);
 let empty=fresh();empty.day=70;empty=run(empty,'day');assert.equal(empty.scenario!.outcome,null);assert.equal(empty.scenario!.appointments[0].completed,true);
});
test('losing either brother queues native failure and waits for card acknowledgement',()=>{
 let s=run(fresh(),'fire',{actorId:'RMCNille'});assert.equal(s.scenario!.outcome,null);assert.equal(s.scenario!.queue[0].id,'ECOCMis3GameOverLeaveBand');
 s=run(s,'card',{cardId:'ECOCMis3GameOverLeaveBand',choice:'ButtonOK'});assert.equal(s.scenario!.outcome,'lost');assert.equal(s.scenario!.failureReason,'GameOver');
});
test('native timer activation semantics preserve second reminder sixty days after first',()=>{
 let s=fresh();s.day=40;s=run(s,'day');assert.ok(s.scenario!.queue.some(q=>q.id==='ECOCMis3RemindConcert1'));assert.equal(s.scenario!.active.TRMis3remindconcert2,40);
 s.day=60;s=run(s,'day');assert.ok(!s.scenario!.queue.some(q=>q.id==='ECOCMis3RemindConcert2'));
 s.day=100;s=run(s,'day');assert.ok(s.scenario!.queue.some(q=>q.id==='ECOCMis3RemindConcert2'));
});

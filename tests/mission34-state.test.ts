import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../src/generated/game-data.json' with {type:'json'};
import {newGame,advanceDay,candidates,licenseSong,validSave,type Musician,type GameState} from '../src/game/model';
import {newMission} from '../src/game/missions';
import {PLAYABLE_MISSIONS,missionDefinition} from '../src/game/mission-catalog';
import {BrowserSaveStore,SAVE_KEY} from '../src/game/storage';
import {validRecordingProgress} from '../src/game/recording';

const original=JSON.parse(fs.readFileSync('analysis/original/data/DataMusicians00.json','utf8')).data.RealMusician;
const musicians:Musician[]=original.ID.map((id:string,i:number)=>({id,name:original.name[i],age:Number(original.Age[i]),salary:Number(original.WantedSalary[i]),description:original.comment[i],genre:original.Genre[i],
  musicality:Number(original.Musicality.Current[i]),mood:Number(original.Mood.Current[i]),health:Number(original.Health.Current[i]),charisma:Number(original.Charisma[i]),skills:Object.fromEntries(Object.entries(original.InstrumentalSkills).map(([key,values])=>[key,Number((values as string[])[i])]))}));
const clone=(s:GameState):GameState=>structuredClone(s);

test('only implemented original scenarios are playable and Mission01 restrictions remain intact',()=>{
  assert.deepEqual(PLAYABLE_MISSIONS,['Mission01','Mission03','Mission04','Mission05','Mission06','Mission07','Mission08']);
  const s=newMission('Mission01',musicians,new Date(2026,0,1));
  assert.equal(s.money,100000);assert.equal(s.tutorialEnabled,true);assert.equal(s.scenario,undefined);assert.equal(s.contract,null);assert.ok(s.band.every(b=>b===null));
  assert.deepEqual(candidates(s,musicians,4).map(m=>m.id).sort(),musicians.filter(m=>missionDefinition('Mission01').availableMusicians.includes(m.id)&&m.skills.Vocals>0).map(m=>m.id).sort());
  assert.throws(()=>licenseSong(s,data.songs,'Sng18'),/unavailable/);
  assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
});
test('Mission03 autoload keeps brothers, licensed song and unapproved prearranged deal without granting advance twice',()=>{
  const s=newMission('Mission03',musicians,new Date(2026,0,1));
  assert.equal(s.money,100000);assert.equal(s.tutorialEnabled,false);assert.equal(s.bandName,'Morning Glory');
  assert.deepEqual(s.band.filter(Boolean).map(m=>m!.musicianId).sort(),['RMCLelle','RMCNille']);
  assert.deepEqual(s.ownedSongs,['Sng18']);assert.equal(s.selectedSong,'Sng18');assert.equal(s.demo,null);
  assert.deepEqual(s.contract,{labelId:'Record04',songId:'Sng18',advance:100000,royalty:.1,albums:1,signedDay:0,prearranged:true,approved:false});
  assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
});
test('Mission04 autoload resets cash to source120000 and Nadia starts with exact overridden stats',()=>{
  const s=newMission('Mission04',musicians,new Date(2026,0,1));
  assert.equal(s.money,120000);assert.equal(s.tutorialEnabled,false);assert.deepEqual(s.band[4],{musicianId:'RMCPernille',instrument:'Vocals'});
  const p=s.bandmates.people.find(p=>p.musicianId==='RMCPernille')!;
  assert.deepEqual([p.health,p.musicality,p.charisma,p.mood,p.patience],[.8,.1,.2,.5,.19]);
  assert.equal(s.ownedSongs.length,0);assert.equal(s.contract,null);assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
});
test('Mission04 weekly payroll uses autoload WantedSalary400 rather than English recruitment salary450',()=>{
  const s=newMission('Mission04',musicians,new Date(2026,0,1));s.day=6;
  assert.equal(musicians.find(m=>m.id==='RMCPernille')!.salary,450);
  const next=advanceDay(s,musicians);assert.equal(next.wages,400);assert.equal(next.state.money,119600);
});
test('prearranged contract validation rejects corrupted album counts, nonboolean flags and approval without a demo',()=>{
  const s=newMission('Mission03',musicians);
  for(const value of [-1,0,2,NaN]){const corrupt=clone(s);corrupt.contract!.albums=value;assert.equal(validRecordingProgress(corrupt,musicians,data.tutorialGameplay),false,`albums${value}`);}
  const corrupt=clone(s);(corrupt.contract as unknown as Record<string,unknown>).prearranged='yes';assert.equal(validRecordingProgress(corrupt,musicians,data.tutorialGameplay),false);
  const approved=clone(s);approved.contract!.approved=true;assert.equal(validRecordingProgress(approved,musicians,data.tutorialGameplay),false);
});
test('new scenario save payload rejects malformed queue, appointments and outcomes',()=>{
  const state=newMission('Mission04',musicians);
  const badQueue=clone(state);badQueue.scenario!.queue=[{id:'NotAnOriginalCard'}];assert.equal(validSave(badQueue,musicians,data.songs,data.tutorialGameplay),false);
  const badAppointment=clone(state);badAppointment.scenario!.appointments=[{id:'DivEventWin',kind:'television',startDay:-1,duration:1,actorId:'RMCPernille',completed:false}];assert.equal(validSave(badAppointment,musicians,data.songs,data.tutorialGameplay),false);
  const badOutcome=clone(state);(badOutcome.scenario as unknown as Record<string,unknown>).outcome='maybe';assert.equal(validSave(badOutcome,musicians,data.songs,data.tutorialGameplay),false);
});
test('browser save migration preserves legacy Mission01 state and Mission03/04 roundtrip independently',()=>{
  const cache=new Map<string,string>();const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>cache.get(k)??null,setItem:(k:string,v:string)=>cache.set(k,v)}});
  try{
    const store=new BrowserSaveStore();const legacy=newGame(100000);cache.set(SAVE_KEY,JSON.stringify(legacy));
    const loaded=store.load(musicians)!;assert.ok(loaded);assert.equal(loaded.missionId,'Mission01');assert.equal(loaded.bandmates.people.length,musicians.length);
    for(const id of ['Mission03','Mission04'] as const){const state=newMission(id,musicians);assert.ok(store.save(state));assert.deepEqual(store.load(musicians),state);}
  }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});

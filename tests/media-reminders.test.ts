import {test} from 'node:test';import assert from 'node:assert/strict';
import data from '../src/generated/game-data.json';
import {newMission} from '../src/game/missions';
import {recruit,licenseSong,validSave} from '../src/game/model';
import {startRecording,finishRecording,signContract} from '../src/game/recording';
import {bookRelease,defaultDesign} from '../src/game/design';
import {scenarioEvent} from '../src/game/scenarios';
import {updateMediaReminders} from '../src/game/media-reminders';
import {givePressKit} from '../src/game/publicity';
const musicians=data.allMusicians;
function ready(){let s=newMission('Mission08',musicians);s.started=true;
for(const [slot,id,instrument]of [[0,'RMCSussie','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCMary','Vocals']] as const)s=recruit(s,musicians,slot,id,instrument);
s=licenseSong(s,data.songs,'Sng20');s=finishRecording(startRecording(s,data.tutorialGameplay,'Studio01','Sng20'),data.tutorialGameplay,musicians,data.songs);s=signContract(s,data.tutorialGameplay.labels.find(l=>l.id==='Record03')!,musicians,0);s=bookRelease(s,musicians,defaultDesign('Mission08'),2);s.scenario!.queue=[];return s;}
const tick=(s:ReturnType<typeof ready>,day:number)=>updateMediaReminders({...s,day},{kind:'day'},musicians);
test('Rainbow requests missing CDs once, 10/14/16 days after actual release',()=>{
 let s=ready();s=tick(s,11);assert.ok(!s.scenario!.queue.some(c=>c.id.endsWith('RequestCD')));
 for(const [day,id]of [[12,'ECOCCityRequestCD'],[16,'ECOCZer0RequestCD'],[18,'ECOCRadioRequestCD']] as const){s=tick(s,day);assert.ok(s.scenario!.queue.some(c=>c.id===id));s=scenarioEvent(s,{kind:'card',cardId:id,choice:'ButtonCancel'},musicians);}
 s=tick(s,30);assert.ok(!s.scenario!.queue.some(c=>c.id.endsWith('RequestCD')));
});
test('accepting original CD request costs $10 and feeds the real reporter; refusal does neither',()=>{
 let s=tick(ready(),12);const cash=s.money;s=scenarioEvent(s,{kind:'card',cardId:'ECOCCityRequestCD',choice:'ButtonOK'},musicians);
 assert.equal(s.money,cash-10);assert.equal(s.publicity.reporters.find(r=>r.mediaId==='Media03')!.kit,`${s.demo!.songId}:${s.demo!.recordedDay}`);
 assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
 s=tick(s,18);const before=s.money;s=scenarioEvent(s,{kind:'card',cardId:'ECOCRadioRequestCD',choice:'ButtonCancel'},musicians);assert.equal(s.money,before);assert.equal(s.publicity.reporters.find(r=>r.mediaId==='Media02')!.kit,null);
});
test('previously delivered kits suppress requests; old saves catch up without repeating',()=>{
 let s=givePressKit(ready(),'Media03',musicians);s=tick(s,30);assert.ok(!s.scenario!.queue.some(c=>c.id==='ECOCCityRequestCD'));
 for(const id of ['ECOCZer0RequestCD','ECOCRadioRequestCD'])s=scenarioEvent(s,{kind:'card',cardId:id,choice:'ButtonCancel'},musicians);
 s=tick(s,31);assert.ok(!s.scenario!.queue.some(c=>c.id.endsWith('RequestCD')));
});
test('TV request is eight days after video completion; accepting delivers the real video',()=>{
 let s=ready();const key=`${s.demo!.songId}:${s.demo!.recordedDay}`;s.video={conceptId:'test',albumKey:key,startDay:2,duration:4,members:[],completed:true,seen:true};
 s=tick(s,13);assert.ok(!s.scenario!.queue.some(c=>c.id==='ECOCTVRequestVideo'));
 s=tick(s,14);assert.ok(s.scenario!.queue.some(c=>c.id==='ECOCTVRequestVideo'));const cash=s.money;s=scenarioEvent(s,{kind:'card',cardId:'ECOCTVRequestVideo',choice:'ButtonOK'},musicians);assert.equal(s.money,cash);assert.equal(s.publicity.reporters.find(r=>r.mediaId==='Media01')!.videoKit,key);
});

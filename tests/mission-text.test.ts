import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/generated/game-data.json';
import {newMission} from '../src/game/missions';
import {missionText,missionEvent} from '../src/game/mission-events';
import {missionCards} from '../src/game/mission-catalog';
import {PUBLICITY_RULES} from '../src/game/publicity';
const musicians=data.allMusicians;
const card=missionCards.find(c=>c.ID==='ECOCMis7ArtistBack')!;
test('Roy disappearance retains the actual concert venue for his return dialogue',()=>{
 let s=newMission('Mission07',musicians);s.scenario!.vars.royStage=3;s.publicity.seed=0;
 s=missionEvent(s,{kind:'concert',placeId:'Live03',concertId:'test'},musicians);
 assert.equal(s.scenario!.vars.royStage,4);
 assert.equal(s.scenario!.vars.RoyDisappearPlaceID,'Live03');
 const rendered=missionText(card.comment,s,musicians,'RMCRoy',card.ID);
 assert.ok(rendered.includes(PUBLICITY_RULES.venues.find(v=>v.id==='Live03')!.name));
 assert.doesNotMatch(rendered,/<|getObjByID|missionvar/i);
});
test('legacy Roy return recovers venue from the disappearance-day concert, not a later gig',()=>{
 const s=newMission('Mission07',musicians);s.day=13;
 s.publicity.concertResults=[{id:'a',concertId:'a',venueId:'Live02',day:10,audience:1,satisfaction:1,income:0,rent:0,cancelled:false},{id:'b',concertId:'b',venueId:'Live03',day:12,audience:1,satisfaction:1,income:0,rent:0,cancelled:false}];
 assert.ok(missionText(card.comment,s,musicians,'RMCRoy',card.ID).includes(PUBLICITY_RULES.venues.find(v=>v.id==='Live02')!.name));
});
test('mission text expands the actual drummer, album, band and case-insensitive variables',()=>{
 const s=newMission('Mission07',musicians);s.scenario!.vars.YouSuckMusician='RMCRoy';
 const drummer=musicians.find(m=>m.id===s.band.find(b=>b?.instrument==='Drums')?.musicianId)!;
 assert.equal(missionText('<¤CRealMusicianDrums.Name> / <Cband.Name> / <missionVar.yousuckmusician.name>',s,musicians),`${drummer.name} / ${s.bandName} / ${musicians.find(m=>m.id==='RMCRoy')!.name}`);
});


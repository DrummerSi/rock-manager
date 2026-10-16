import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/generated/game-data.json';
import {newMission} from '../src/game/missions';
import {recruit,licenseSong,advanceDay,validSave,type GameState} from '../src/game/model';
import {startRecording,finishRecording,chooseSessionMusician,signContract} from '../src/game/recording';
import {bookRelease,defaultDesign} from '../src/game/design';
import {bookAdvert,bookConcert,givePressKit,venueBookingIssue,PUBLICITY_RULES} from '../src/game/publicity';
import {useGangsta,resolveGangstaCard} from '../src/game/gangsta';
import {trainBandmate,canTrainBandmate} from '../src/game/bandmates';
import {scenarioEvent} from '../src/game/scenarios';
const musicians=data.allMusicians;
function acknowledge(input:GameState){
  let s=input,count=0;
  while(s.gangsta?.queue.length){assert.ok(count++<100);s=resolveGangstaCard(s);}
  while(s.scenario!.queue.length&&!s.scenario!.outcome){assert.ok(count++<100);s=scenarioEvent(s,{kind:'card',cardId:s.scenario!.queue[0].id,choice:'ButtonOK'},musicians);}
  return s;
}
test('Space Cadets completes through a paid recording, campaigns, gigs and original review sequence',()=>{
  let s=newMission('Mission07',musicians);s.started=true;
  assert.deepEqual(s.band.map(m=>m?.musicianId??null),['RMCRoy',null,'RMCMartin','RMCLina','RMCMary']);
  assert.equal(s.money,50000);
  s=recruit(s,musicians,1,'RMCSussie','Guitar');s=licenseSong(s,data.songs,'Sng01');
  s=chooseSessionMusician(startRecording(s,data.tutorialGameplay,'Studio03','Sng01'),data.tutorialGameplay,5,'Stud02','Keyboards');
  s=finishRecording(s,data.tutorialGameplay,musicians,data.songs);s=scenarioEvent(s,{kind:'recording'},musicians);
  s=signContract(s,data.tutorialGameplay.labels.find(l=>l.id==='Record02')!,musicians,0);
  assert.equal(s.contract!.royalty,.04);assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
  s=bookRelease(s,musicians,['DEDBGSpeakers','DEDArtists01','DEDEfffectNone','DEDFont01'],2);
  for(const id of ['Media02','Media03','Media04'])s=givePressKit(s,id,musicians);
  s=useGangsta(s,'ActGangLoan03',musicians);
  for(const [ad,start,duration]of [['AdFM03',1,3],['AdTV01',1,1],['AdRS01',1,10],['AdZM01',2,5]] as const)s=bookAdvert(s,ad,start,duration);
  for(let i=0;i<110&&!s.scenario!.outcome&&!s.missionProgress?.pendingFailure;i++){
    if(!s.publicity.concerts.some(c=>!c.completed))for(const venue of s.money>50000?['Live03','Live01']:['Live01'])try{s=bookConcert(s,musicians,venue,s.day+2);break;}catch{/* Native venue/resource checks reject this booking. */}
    if(s.gangsta!.debt&&s.money>=s.gangsta!.debt+8000)s=useGangsta(s,'ActGangRepayDebt',musicians);
    s=acknowledge(advanceDay(s,musicians).state);
  }
  assert.equal(s.scenario!.outcome,'won');assert.ok(s.publicity.totalSales>=100000);
  assert.ok(s.scenario!.seen.includes('ECOCMis7ZeroGoodReview'));assert.equal(s.gangsta!.debt,0);
  assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
});
test('Rainbow bankruptcy requires release, two funding instalments and actual paid activities',()=>{
  let s=newMission('Mission08',musicians);s.started=true;assert.equal(s.money,70000);assert.ok(s.band.every(m=>!m));
  for(const [slot,id,instrument]of [[0,'RMCSussie','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCMary','Vocals']] as const)s=recruit(s,musicians,slot,id,instrument);
  s=licenseSong(s,data.songs,'Sng20');s=finishRecording(startRecording(s,data.tutorialGameplay,'Studio01','Sng20'),data.tutorialGameplay,musicians,data.songs);
  s=scenarioEvent(s,{kind:'recording'},musicians);s=signContract(s,data.tutorialGameplay.labels.find(l=>l.id==='Record03')!,musicians,0);
  s=scenarioEvent(s,{kind:'city'},musicians);s=bookRelease(s,musicians,defaultDesign('Mission08'),2);
  s=acknowledge(advanceDay(advanceDay(s,musicians).state,musicians).state);
  for(let i=0;i<70&&!s.scenario!.outcome;i++){
    if(s.money>=5000){const action=s.money>=10000?'ActTrainVacation':'ActTrainMedia';let booked=false;
      for(let day=s.day+1;day<=s.day+100&&!booked;day++)for(const b of s.band)if(b&&canTrainBandmate(s,b.musicianId,action,day)){s=trainBandmate(s,b.musicianId,action,day,musicians);booked=true;break;}
      assert.ok(booked);
    }
    s=acknowledge(scenarioEvent(s,{kind:'city'},musicians));
  }
  assert.equal(s.scenario!.outcome,'won');assert.equal(s.publicity.totalSales,0);
  for(const id of ['ECOCMis8RainbowCheckSucceeded01','ECOCMis8RainbowCheckSucceeded02','ECOCMis8RainbowCheck03'])assert.ok(s.scenario!.seen.includes(id));
  assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
});
test('all six venues exist; venue cooldowns use the original refusal cards',()=>{
  assert.equal(PUBLICITY_RULES.venues.length,6);
  const stadium=PUBLICITY_RULES.venues.find(v=>v.id==='Live06')!;
  assert.deepEqual([stadium.name,stadium.rent,stadium.size,stadium.spacing],['Colosseum',80000,13000,30]);
  const s=newMission('Mission07',musicians);
  assert.equal(venueBookingIssue(s,musicians,'Live06')?.cardId,'ECConcertBookNoDemo');
});

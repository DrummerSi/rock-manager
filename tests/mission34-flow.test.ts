import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/generated/game-data.json';
import {newMission} from '../src/game/missions';
import {recruit,licenseSong,advanceDay,validSave,type GameState} from '../src/game/model';
import {startRecording,finishRecording,signContract,approveContractDemo} from '../src/game/recording';
import {bookRelease} from '../src/game/design';
import {givePressKit,bookAdvert,bookConcert,PUBLICITY_RULES} from '../src/game/publicity';
import {missionEvent} from '../src/game/mission-events';
import {trainBandmate,giveBandmateGift,bandmateStats} from '../src/game/bandmates';
import {completeMusicianQuit} from '../src/game/musician-quits';
const musicians=data.allMusicians;
const date=()=>new Date(2026,9,14);
const hype=(s:GameState)=>PUBLICITY_RULES.groups.reduce((n,g)=>n+g.size*s.publicity.groups.find(x=>x.id===g.id)!.albumHype,0)/PUBLICITY_RULES.groups.reduce((n,g)=>n+g.size,0);
function acknowledge(s:GameState){
 // Match renderer lifecycle: native QuitNow removes the actor on SHOW, before OK.
 for(let count=0;s.scenario!.queue.length&&!s.scenario!.outcome;count++){
  assert.ok(count<100,'Scenario card sequence must terminate');
  const c=s.scenario!.queue[0];
  if(c.id==='ECOCQuitNow'&&c.speakerId)s=completeMusicianQuit(s,c.speakerId,musicians);
  s=missionEvent(s,{kind:'card',cardId:c.id,choice:c.id==='ECMMis4StealSong'?'Button3':'ButtonOK'},musicians);
 }
 return s;
}
test('actual Mission03 template initializes original brothers, song ownership, debt and fixed gala',()=>{
 const s=newMission('Mission03',musicians,date());
 assert.equal(s.money,100000);assert.equal(s.bandName,'Morning Glory');
 assert.deepEqual(s.band.map(b=>b?.musicianId??null),['RMCNille',null,null,null,'RMCLelle']);
 assert.deepEqual(s.ownedSongs,['Sng18']);assert.equal(s.contract?.labelId,'Record04');assert.equal(s.contract?.advance,100000);assert.equal(s.contract?.royalty,.1);
 assert.equal(s.scenario?.appointments[0].startDay,70);assert.equal(s.bandmates.people.find(p=>p.musicianId==='RMCNille')!.mood,.508);
 assert.equal(s.bandmates.modifiers.filter(m=>m.id==='Mis3Bros'&&m.amount===2).length,2);
 assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay));
});
test('fresh Mission04 reaches original TV invitation and victory using paid campaigns funded by real royalties',()=>{
 let s=newMission('Mission04',musicians,date());
 assert.equal(s.money,120000);assert.equal(s.band[4]?.musicianId,'RMCPernille');assert.equal(s.contract,null);
 s.started=true;
 for(const [slot,id,instrument]of [[0,'RMCSussie','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCGullan','Drums'],[3,'RMCGurra','Bass']] as const)s=recruit(s,musicians,slot,id,instrument);
 s=licenseSong(s,data.songs,'Sng01');
 s=finishRecording(startRecording(s,data.tutorialGameplay,'Studio02','Sng01'),data.tutorialGameplay,musicians,data.songs);
 s=signContract(s,data.tutorialGameplay.labels.find(l=>l.id==='Record01')!,musicians,10);
 assert.equal(s.contract!.royalty,.15);assert.equal(s.contract!.advance,37000);
 s=bookRelease(s,musicians,['DEDBGrainbow','DEDArtists03','DEDEfffect01','DEDFont04'],2);
 for(const id of ['Media02','Media03','Media04'])s=givePressKit(s,id,musicians);
 s=bookAdvert(s,'AdFM03',1,3);s=bookConcert(s,musicians,'Live01',3);
 const purchases:number[]=[],cards:string[]=[],invitationDays:number[]=[];let maximumHype=0,minimumMoney=s.money,unpaid=0;
 while(s.day<60&&!s.scenario!.outcome){
  const tick=advanceDay(s,musicians);s=tick.state;unpaid+=tick.unpaid;
  cards.push(...s.scenario!.queue.map(c=>c.id));
  if(s.scenario!.queue.some(c=>c.id==='ECOCMis4Media01RqNadia'))invitationDays.push(s.day);
  s=acknowledge(s);maximumHype=Math.max(maximumHype,hype(s));
  // Ordinary reinvestment: original price30K per day, retain5K cash reserve.
  // Once the source TV trigger latches, further purchases cannot help invitation.
  if(s.day>=5&&Object.hasOwn(s.scenario!.active,'Media01RqNadia01')&&s.money>=35000){s=bookAdvert(s,'AdFM03',s.day+1,1);purchases.push(s.day);}
  minimumMoney=Math.min(minimumMoney,s.money);
  assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay),`Save reload validation day${s.day}`);
 }
 assert.equal(unpaid,0);assert.ok(minimumMoney>=0);assert.ok(maximumHype>=.15);
 assert.deepEqual(purchases,[5,6,8,9,10,11,12]);
 assert.ok(cards.includes('ECOCMis4Media01RqNadia'));assert.ok(cards.includes('ECOCMis4Complete'));
 assert.deepEqual(invitationDays,[20]);
 assert.equal(s.scenario!.outcome,'won');assert.equal(s.day,23);assert.ok(s.publicity.paidRoyalties>0);
 assert.equal(s.scenario!.appointments.find(a=>a.id==='DivEventWin')?.startDay,22);
});
test('fresh Mission03 records and releases the owned song, cares for both brothers and reaches fixed gala solvent',()=>{
 let s=newMission('Mission03',musicians,date());s.started=true;
 for(const[slot,id,instrument]of [[1,'RMCTony','Guitar'],[2,'RMCGullan','Drums'],[3,'RMCGurra','Bass']] as const)s=recruit(s,musicians,slot,id,instrument);
 s=finishRecording(startRecording(s,data.tutorialGameplay,'Studio02','Sng18'),data.tutorialGameplay,musicians,data.songs);
 s=missionEvent(s,{kind:'recording'},musicians);
 const cashBeforeApproval=s.money;
 s=approveContractDemo(s,data.tutorialGameplay.labels.find(l=>l.id==='Record04')!,musicians);
 assert.equal(s.money,cashBeforeApproval,'Prearranged approval does not award a second contract advance');
 s=bookRelease(s,musicians,['DEDBGMoon','DEDArtists01','DEDEfffect01','DEDFont04'],2);
 for(const id of ['Media02','Media03','Media04'])s=givePressKit(s,id,musicians);
 s=bookAdvert(s,'AdRS01',1,14);
 let minimumMoney=s.money,minimumMood=1,unpaid=0;
 while(s.day<75&&!s.scenario!.outcome){
  // Genuine care: two three-day media courses per ten days; balanced gifts.
  if(s.day%10===0&&s.day<60)for(const id of ['RMCLelle','RMCNille']){s=trainBandmate(s,id,'ActTrainMedia',s.day+1);s=missionEvent(s,{kind:'training',actorId:id},musicians);}
  if(s.day%10===0&&s.day<65)s=bookConcert(s,musicians,'Live01',s.day+5);
  if(s.day===18)for(const id of ['RMCLelle','RMCNille']){s=giveBandmateGift(s,id,'ActGiftStereo');s=missionEvent(s,{kind:'gift',actorId:id},musicians);}
  s=missionEvent(s,{kind:'city'},musicians);s=acknowledge(s);
  const tick=advanceDay(s,musicians);s=acknowledge(tick.state);unpaid+=tick.unpaid;
  minimumMoney=Math.min(minimumMoney,s.money);for(const id of ['RMCLelle','RMCNille'])minimumMood=Math.min(minimumMood,bandmateStats(s,id).mood);
  assert.ok(validSave(s,musicians,data.songs,data.tutorialGameplay),`Mission03 save day${s.day}`);
 }
 assert.equal(unpaid,0);assert.ok(minimumMoney>=0);assert.ok(minimumMood>.01,'Brothers never cross native quit threshold');
 assert.equal(s.scenario!.outcome,'won');assert.equal(s.day,70);assert.equal(s.contract!.approved,true);assert.ok(s.publicity.totalSales>0);
 assert.ok(['RMCNille','RMCLelle'].every(id=>s.band.some(b=>b?.musicianId===id)));
});

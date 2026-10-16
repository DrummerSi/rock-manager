import type {GameState,Musician} from './model';
import type {ScenarioEvent,ScenarioState} from './scenario-types';
import {BANDMATE_RULES,bandmateOccupied,bandmateStats,effectiveMusicians} from './bandmates';

// Source: DataDBRest03/DataDBEC03 and M03.dat; see mission03-rules-evidence.json.
const L='RMCLelle',N='RMCNille',brothers=[L,N];
// Director symbols are case-insensitive.
const trigger=(suffix:string)=>`TRMis3${suffix.toLowerCase()}`;
const card=(suffix:string)=>`ECOCMis3${suffix}`;
const starts=['Succeeded','Fail','Fail2','Fail3','BandName','ExitPlace','ExitToCity','Firstfight','Muttonfight1','NoSales','GiveTraining','GiveGift','LeaveMixer','ConcertCheck','IntroduceActionSatisfaction','RemindConcert1'];
export function initialScenario03(state:GameState):ScenarioState {
 return {version:1,vars:{myBandName:'Morning Glory',myLellegift:0,myNillegift:0,myLelleTraining:0,myNilleTraining:0},active:Object.fromEntries(starts.map(t=>[trigger(t),state.day])),queue:[],seen:[],appointments:[{id:'Concert1',kind:'concert',startDay:70,duration:1,placeId:'Live06',completed:false}],approved:false,outcome:null};
}
type State=GameState&{scenario:ScenarioState};
const num=(s:State,key:string)=>Number(s.scenario.vars[key]??0);
function mod(s:State,id:string,name:string,amount:number,duration:number,otherId?:string){
 s.bandmates.modifiers.push({id:name,musicianId:id,stat:'mood',amount,startDay:s.day,duration,...(otherId?{otherId}:{})});
}
function reciprocal(s:State,amount:number,duration=100,name='Mis3Bros'){mod(s,L,name,amount,duration,N);mod(s,N,name,amount,duration,L);}
function bothMood(s:State,name:string,amount:number,duration:number){for(const id of brothers)mod(s,id,name,amount,duration);}
function attitude(s:State,id:string,other:string){
 const base=(BANDMATE_RULES.musicians.find(m=>m.id===id)?.attitudes as Record<string,number>|undefined)?.[other]??0;
 return Math.max(-1,Math.min(1,base+s.bandmates.modifiers.filter(m=>m.musicianId===id&&m.otherId===other).reduce((v,m)=>v+m.amount*Math.max(0,1-(s.day-m.startDay)/m.duration),0)));
}
function randomBrother(s:State){s.publicity.seed=(Math.imul(s.publicity.seed,1664525)+1013904223)>>>0;return s.publicity.seed/4294967296<.5?N:L;}
function queue(s:State,suffix:string,speakerId?:string){const id=card(suffix);if(!s.scenario.queue.some(q=>q.id.toLowerCase()===id.toLowerCase()))s.scenario.queue.push({id,...(speakerId?{speakerId}:{})});}
function activate(s:State,suffix:string){const id=trigger(suffix);if(s.scenario.active[id]===undefined)s.scenario.active[id]=s.day;}
function deactivate(s:State,suffix:string){delete s.scenario.active[trigger(suffix)];}
function due(s:State,suffix:string,days:number){const day=s.scenario.active[trigger(suffix)];return day!==undefined&&s.day>=day+days;}
function free(s:State,id:string){return !bandmateOccupied(s,id);}
function bothFree(s:State){return brothers.every(id=>free(s,id));}
function exposure(s:State,quality:number){
 s.publicity.exposures.push({id:`Mission03Exposure${s.publicity.nextId++}`,startDay:s.day+1,duration:1,intensity:.3,
  reach:Object.fromEntries(s.publicity.groups.map(g=>[g.id,1])),quality:Object.fromEntries(s.publicity.groups.map(g=>[g.id,quality])),albumKey:s.demo?`${s.demo.songId}:${s.demo.recordedDay}`:null});
}
function livePerformance(s:State,musicians:Musician[]){
 const influence={Vocals:1,Guitar:.75,Keyboards:.6,Drums:.25,Bass:.5};
 const effective=effectiveMusicians(s,musicians),entries=s.band.flatMap(b=>{const m=effective.find(m=>m.id===b?.musicianId);if(!m||!b)return[];const p=bandmateStats(s,m.id);return[{value:(.5*p.musicality+.4*p.charisma+.6*p.mood)/1.5,weight:influence[b.instrument]}];});
 const sum=entries.reduce((v,e)=>v+e.weight,0);return Math.max(0,Math.min(1,((sum?entries.reduce((v,e)=>v+e.value*e.weight,0)/sum:0)-.2)/.55));
}
function applyCard(s:State,event:ScenarioEvent){
 const pending=s.scenario.queue.find(q=>q.id.toLowerCase()===event.cardId?.toLowerCase());if(!pending)return;
 const id=pending.id.slice('ECOCMis3'.length).toLowerCase(),cancel=event.choice==='ButtonCancel';
 s.scenario.queue=s.scenario.queue.filter(q=>q!==pending);s.scenario.seen.push(pending.id);
 switch(id){
 case 'gameoverleaveband':case 'gameover':s.scenario.outcome='lost';s.scenario.failureReason='GameOver';break;
 case 'nomoney':s.scenario.outcome='lost';s.scenario.failureReason='NoMoney';break;
 case 'cancelcontract':s.scenario.outcome='lost';s.scenario.failureReason='CancelContract';break;
 case 'muttonfight':exposure(s,.3);break;
 case 'muttonfightbandwimps':case 'muttonfightaction':activate(s,cancel?(id==='muttonfightaction'?'MuttonFight7':'MuttonFight5'):'MuttonFight4');exposure(s,cancel?.3:-.3);break;
 case 'muttonfightover':bothMood(s,'LellePissed',-.4,30);exposure(s,-.3);break;
 case 'muttonfightwar':bothMood(s,'LelleHappy',.1,10);exposure(s,.3);break;
 case 'muttonfighttv':activate(s,cancel?'MuttonFight9':'MuttonFight10');break;
 case 'muttonfighttvno':exposure(s,-.3);break;
 case 'muttonfighttvairwin':bothMood(s,'LellePissed',.2,10);reciprocal(s,.2,60);exposure(s,.3);break;
 case 'muttonfighttvairlose':bothMood(s,'LellePissed',-.4,30);exposure(s,-.3);break;
 case 'smallartistfight01':reciprocal(s,-.1);break;
 case 'smallartistfight02':bothMood(s,'LelleMad',-.1,8);reciprocal(s,-.2);break;
 case 'smallartistfight03':bothMood(s,'LelleMad',-.1,10);reciprocal(s,-.2);break;
 case 'namechange':bothMood(s,'LellePissed',-.1,10);reciprocal(s,-.2);break;
 case 'nohype':case 'nosales':bothMood(s,'LelleMad',-.1,5);reciprocal(s,-.2);break;
 case 'nellyangry':bothMood(s,'LellePissed',-.3,30);reciprocal(s,-.2);break;
 case 'giftjealousy':case 'trainingjealousy':{const id=pending.speakerId??N,other=id===N?L:N;mod(s,other,'Mis3Bros',-.2,100,id);mod(s,other,'ArtistPissed',.6,2);mod(s,id,'ArtistPissed',-.1,10);break;}
 case 'sleeveangry':{const id=pending.speakerId??N;/* Original compares #Nille, not #RMCNille: else branch. */mod(s,N,'Mis3Bros',-.2,100,L);mod(s,id,'ArtistPissed',-.1,10);break;}
 }
}

/** Applies source Mission03 messages; never charges invented gala rent or tests invented sales targets. */
export function updateScenario03(state:GameState,event:ScenarioEvent,musicians:Musician[]):GameState {
 if(state.missionId!=='Mission03'||!state.scenario||state.scenario.outcome)return state;
 const s=structuredClone(state) as State;
 if(event.kind==='card'){applyCard(s,event);return s;}
 if((event.kind==='fire'||event.kind==='action'&&event.actionId==='QuitBand')&&brothers.includes(event.actorId??''))queue(s,'GameOverLeaveBand','HmRecord04');
 if(event.kind==='action'&&event.actionId==='CancelContract')queue(s,'CancelContract','HmRecord04');
 if(event.kind==='gift'&&brothers.includes(event.actorId??'')&&free(s,event.actorId===N?L:N)){
  const key=event.actorId===N?'myNillegift':'myLellegift';s.scenario.vars[key]=num(s,key)+1;
 }
 if(event.kind==='training'&&brothers.includes(event.actorId??'')&&free(s,event.actorId===N?L:N)){
  const key=event.actorId===N?'myNilleTraining':'myLelleTraining';s.scenario.vars[key]=Math.min(2,num(s,key)+1);
 }
 if(event.kind==='recording'){
  if(s.scenario.active[trigger('LeaveMixer')]!==undefined&&s.demo?.songId!=='Sng18'){queue(s,'NellyAngry',N);deactivate(s,'LeaveMixer');}
  s.scenario.vars.recordingUnlocks=true;
 }
 if(event.kind==='concert'){
  const result=s.publicity.concertResults.find(r=>r.concertId===event.concertId);
  if(result&&!result.cancelled){const amount=result.satisfaction*5*.05;if(amount>=.1)reciprocal(s,amount);}
  if(event.placeId==='Live06'&&s.demo)s.scenario.outcome='won';
 }
 if(event.kind==='place'&&event.placeId==='Design01')for(const id of brothers)if(s.bandmates.modifiers.some(m=>m.musicianId===id&&m.id==='SleeveAngry'))queue(s,'SleeveAngry',id);
 if(event.kind==='city'||event.kind==='name'){
  if(s.bandName!==s.scenario.vars.myBandName){s.bandName=String(s.scenario.vars.myBandName);queue(s,'NameChange',randomBrother(s));}
  if(event.kind==='city'){
   for(const type of ['gift','Training']){
    const left=`myLelle${type}`,right=`myNille${type}`,diff=num(s,left)-num(s,right);
    if(Math.abs(diff)>=2){queue(s,type==='gift'?'GiftJealousy':'TrainingJealousy',diff>0?N:L);s.scenario.vars[left]=diff>0||type==='Training'?1:0;s.scenario.vars[right]=diff>0||type==='Training'?0:1;}
   }
   const vocalist=s.band.find(b=>b?.instrument==='Vocals')?.musicianId;
   if(vocalist&&free(s,vocalist)&&free(s,N)){
    if(due(s,'SmallArtistfight2',15)&&(attitude(s,N,L)<-.5||attitude(s,L,N)<-.5)){queue(s,'SmallArtistFight02',randomBrother(s));activate(s,'SmallArtistfight3');deactivate(s,'SmallArtistfight2');}
    if(due(s,'SmallArtistfight3',15)&&(attitude(s,N,L)<-.7||attitude(s,vocalist,N)<-.7)){queue(s,'SmallArtistFight03',randomBrother(s));deactivate(s,'SmallArtistfight3');}
   }
  }
 }
 if(event.kind==='day'){
  // QuitBand is emitted by the existing musician model; missing a required brother is equivalent here.
  if(!brothers.every(id=>s.band.some(b=>b?.musicianId===id)))queue(s,'GameOverLeaveBand','HmRecord04');
  // #Training is the native event START message, distinct from #GiveTraining when booked.
  for(const t of s.bandmates.training)if(t.startDay<=s.day&&brothers.includes(t.musicianId)&&!s.scenario.vars[`training:${t.id}`]){s.scenario.vars[`training:${t.id}`]=true;reciprocal(s,.2,100,'BrosRest');}
  if(due(s,'IntroduceActionSatisfaction',2)){queue(s,'IntroduceActionSatisfaction');deactivate(s,'IntroduceActionSatisfaction');}
  if(due(s,'NoSales',30)&&s.publicity.totalSales===0){queue(s,'NoSales','HmRecord04');deactivate(s,'NoSales');}
  if(due(s,'Firstfight',15)&&bothFree(s)){queue(s,'SmallArtistFight01',randomBrother(s));activate(s,'SmallArtistfight2');deactivate(s,'Firstfight');}
  if(due(s,'Muttonfight1',15)){activate(s,'Muttonfight2');deactivate(s,'Muttonfight1');}
  const sequence:[string,number,string,string?][]=[['Muttonfight2',1,'MuttonFight','MuttonFight3'],['MuttonFight3',2,'MuttonFightBandWimps'],['MuttonFight4',1,'MuttonFightOver'],['MuttonFight5',1,'MuttonFightWar','MuttonFight6'],['MuttonFight6',2,'MuttonFightAction'],['MuttonFight8',2,'MuttonFightTV'],['MuttonFight9',2,'MuttonFightTVNo'],['MuttonFight10',2,livePerformance(s,musicians)>=.5?'MuttonFightTVAirWin':'MuttonFightTVAirLose']];
  for(const [id,days,ec,next]of sequence)if(due(s,id,days)&&(id==='MuttonFight3'||bothFree(s))){queue(s,ec,id==='Muttonfight2'?L:randomBrother(s));if(next)activate(s,next);deactivate(s,id);}
  if(due(s,'MuttonFight7',2)){const actor=s.band.find(b=>b?.instrument==='Bass')?.musicianId??s.band.find(b=>b?.instrument==='Drums')?.musicianId??N;if(free(s,actor))queue(s,'MuttonFightArtistFear',actor);activate(s,'MuttonFight8');deactivate(s,'MuttonFight7');}
  if(due(s,'RemindConcert1',40)){queue(s,'RemindConcert1');activate(s,'RemindConcert2');deactivate(s,'RemindConcert1');}
  if(due(s,'RemindConcert2',60)){queue(s,'RemindConcert2');deactivate(s,'RemindConcert2');}
  for(const appointment of s.scenario.appointments)if(!appointment.completed&&s.day>=appointment.startDay){appointment.completed=true;if(s.demo&&brothers.every(id=>s.band.some(b=>b?.musicianId===id))&&!s.scenario.queue.some(q=>q.id===card('GameOverLeaveBand')||q.id===card('CancelContract')))s.scenario.outcome='won';}
 }
 return s;
}

/** The source WasActivated trigger adds these before the first day advances. */
export function applyScenario03StartingModifiers(state:GameState):GameState {const s=structuredClone(state) as State;reciprocal(s,2);return s;}

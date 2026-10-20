import {missionSpend} from './mission-spending';
import type {GameState,Musician} from './model';
import data from '../generated/game-data.json' with {type:'json'};
import publicityRules from './publicity-rules.json' with {type:'json'};
import rules from './gangsta-rules.json' with {type:'json'};
import {bandmateOccupied} from './bandmates';
import {missionEvent} from './mission-events';
import {recordMissionFailure} from './mission-progress';
import {canBookCalendar} from './publicity';

export const GANGSTA_RULES=rules;
export interface GangstaState {
  seed:number;used:boolean;debt:number;loanDeadline:number;loanDays:number;loanTier:number;
  fans:number;scandals:number;paparazzi:number;bombs:number;tamper:boolean;tamperRating:number;legal:boolean;
  pending:{kind:string;day:number;actorId?:string}[];
  queue:{id:string;actorId?:string}[];away:{actorId:string;until:number}[];
  security:{startDay:number;duration:number}[];
}
export const defaultGangsta=():GangstaState=>({seed:0x53455247,used:false,debt:0,loanDeadline:0,loanDays:0,loanTier:0,fans:0,scandals:0,paparazzi:0,bombs:0,tamper:false,tamperRating:0,legal:false,pending:[],queue:[],away:[],security:[]});
const current=(s:GameState)=>s.gangsta??defaultGangsta();
const copy=(s:GameState):GameState&{gangsta:GangstaState}=>({...s,gangsta:structuredClone(current(s)),publicity:structuredClone(s.publicity),bandmates:structuredClone(s.bandmates),scenario:s.scenario?structuredClone(s.scenario):undefined});
export const gangstaAvailable=(s:GameState)=>['Mission04','Mission05','Mission06','Mission07','Mission08','Mission09','Mission10'].includes(s.missionId);
export const gangstaAway=(s:GameState,id:string,day=s.day)=>current(s).away.some(a=>a.actorId===id&&day<a.until);
export const gangstaAction=(id:string)=>data.activities.tables.Action.find(a=>a.ID===id);
export const gangstaCategories=()=>[...rules.office.Actions.matchAll(/#(\w+)/g)].map(m=>data.activities.tables.ActionCategory.find(c=>c.ID===m[1])!);
export function gangstaActions(state:GameState,categoryId:string):string[]{
  const category=gangstaCategories().find(c=>c.ID===categoryId);
  return [...(category?.Actions??'').matchAll(/#(\w+)/g)].map(m=>m[1]).filter(id=>!/^ActGangLoan/.test(id)||current(state).debt===0);
}
export const gangstaPrice=(s:GameState,id:string)=>id==='ActGangRepayDebt'?current(s).debt:Number(gangstaAction(id)?.price??0);
export function canUseGangsta(s:GameState,id:string):boolean {
  const g=current(s),action=gangstaAction(id);if(!gangstaAvailable(s)||!action||s.money<gangstaPrice(s,id))return false;
  if(/^ActGangLoan/.test(id))return g.debt===0;
  if(id==='ActGangRepayDebt')return g.debt>0;
  if(id==='ActGangChart')return !g.tamper;
  if(id==='ActGangBribe')return !g.legal;
  if(id==='ActGangBomb')return s.publicity.concerts.some(c=>!c.completed&&c.startDay>s.day);
  if(id==='ActGangScandal')return !g.pending.some(p=>/^scandal/.test(p.kind));
  if(id==='ActGangPapa')return !g.pending.some(p=>/^papa/.test(p.kind));
  if(['ActGangWreck','ActGangSuicide','ActGangOD'].includes(id))return !g.pending.some(p=>p.kind===id);
  return true;
}
const random=(g:GangstaState)=>{let n=g.seed;n^=n<<13;n^=n>>>17;n^=n<<5;g.seed=n>>>0;return g.seed/4294967296;};
function expose(s:GameState,intensity:number,quality:number,duration:number){
  s.publicity.exposures.push({id:'GangstaExposure'+s.publicity.nextId++,startDay:s.day+1,duration,intensity,
    reach:Object.fromEntries(s.publicity.groups.map(g=>[g.id,1])),quality:Object.fromEntries(s.publicity.groups.map(g=>[g.id,quality])),albumKey:s.demo?`${s.demo.songId}:${s.demo.recordedDay}`:null});
}
function modify(s:GameState,id:string,amount:number,duration:number){for(const member of s.band)if(member)s.bandmates.modifiers.push({id,musicianId:member.musicianId,stat:'mood',amount,startDay:s.day,duration});}
const queue=(g:GangstaState,id:string,actorId?:string)=>{if(!g.queue.some(c=>c.id===id))g.queue.push({id,actorId});};
export function useGangsta(input:GameState,id:string,musicians:Musician[],actorId?:string):GameState {
  if(!canUseGangsta(input,id))throw new Error('This service is unavailable.');
  if(['ActGangWreck','ActGangSuicide','ActGangOD'].includes(id)&&!input.band.some(b=>b?.musicianId===actorId))throw new Error('Choose a band member.');
  const s=missionSpend(copy(input),'gangsta',Math.max(0,gangstaPrice(input,id))),g=s.gangsta;g.used=true;s.money-=gangstaPrice(s,id);
  if(/^ActGangLoan/.test(id)){g.debt=-Number(gangstaAction(id)!.price);g.loanDays=id==='ActGangLoan03'?35:30;g.loanTier=Number(id.slice(-2));g.loanDeadline=s.day+g.loanDays;}
  if(id==='ActGangRepayDebt'){g.debt=0;g.loanDeadline=0;g.loanTier=0;}
  if(id==='ActGangStreet'){expose(s,.1,-.1,7);expose(s,.2,.1,14);}
  if(id==='ActGangFans'){g.fans++;g.pending=g.pending.filter(p=>p.kind!=='fans');g.pending.push({kind:'fans',day:s.day+5});}
  if(id==='ActGangChart'){g.tamper=true;const rates=[...publicityRules.media.find(m=>m.id==='Media05')!.chartThresholds].sort((a,b)=>a-b);g.tamperRating=rates[4+Math.floor(random(g)*5)];g.pending.push({kind:'chart',day:s.day+14});}
  if(id==='ActGangBribe'){g.legal=true;if(s.scenario)s.scenario.vars.LegalSafe=1;g.pending.push({kind:'legal',day:s.day+14});}
  if(id==='ActGangBomb'){g.bombs++;g.pending=g.pending.filter(p=>p.kind!=='bomb');g.pending.push({kind:'bomb',day:s.publicity.concerts.filter(c=>!c.completed&&c.startDay>s.day).sort((a,b)=>a.startDay-b.startDay)[0].startDay});}
  if(id==='ActGangScandal'||id==='ActGangPapa'){
    const scandal=id==='ActGangScandal',count=scandal?g.scandals:g.paparazzi,good=random(g)*100<100-count;
    if(good){if(scandal)g.scandals+=15;else g.paparazzi+=10;}
    g.pending.push({kind:(scandal?'scandal':'papa')+(good?'Good':'Bad'),day:s.day+5});
  }
  if(['ActGangWreck','ActGangSuicide','ActGangOD'].includes(id)){
    if(actorId==='RMCPernille')s.money+=id==='ActGangWreck'?100000:id==='ActGangSuicide'?150000:85000;
    else g.pending.push({kind:id,day:s.day+5,actorId});
  }
  return missionEvent(s,{kind:'action',placeId:'Gangsta01',actionId:id,actorId},musicians);
}
export function bookSecurity(input:GameState,startDay:number,musicians:Musician[]):GameState {
  if(!canUseGangsta(input,'ActGangSecurity')||!canBookCalendar(input,'advert',startDay,7))throw new Error('This booking is unavailable.');
  const s=missionSpend(copy(input),'gangsta',4000);s.money-=4000;s.gangsta.security.push({startDay,duration:7});return s;
}
function removeMusician(s:GameState,id:string){
  s.band=s.band.map(m=>m?.musicianId===id?null:m);const person=s.bandmates.people.find(p=>p.musicianId===id);if(person)person.fired=true;
  s.bandmates.training=s.bandmates.training.filter(t=>t.musicianId!==id||t.completed);
  s.bandmates.modifiers=s.bandmates.modifiers.filter(m=>m.musicianId!==id);
  if(s.scenario)s.scenario.vars['dead:'+id]=true;
}
export function advanceGangsta(input:GameState):GameState {
  if(!input.gangsta)return input;const s=copy(input),g=s.gangsta;
  const other=()=>{const members=s.band.flatMap(b=>b&&b.musicianId!=='RMCPernille'?[b.musicianId]:[]);return members[Math.floor(random(g)*members.length)];};
  for(const event of [...g.pending]){
    if(s.day<event.day)continue;
    if(event.kind==='fans'){
      const amount=g.fans===1?.075:g.fans===2?.05:g.fans===3?.025:-.05;
      queue(g,g.fans<4?'ECOCGangFans01':'ECOCGangFans02');modify(s,g.fans<4?'Fansaregreat':'Fansareassholes',amount,10);
      if(g.fans<4)expose(s,.2,amount,10);
    }else if(/^(scandal|papa)/.test(event.kind)){
      const id=other();if(!id||bandmateOccupied(s,id))continue;
      const variant=String(1+Math.floor(random(g)*5)).padStart(2,'0');
      queue(g,'ECOCGang'+event.kind.replace(/^scandal/,'Scandal').replace(/^papa/,'Papa')+variant,id);
    }else if(/^ActGang/.test(event.kind)){
      const id=event.actorId!;if(bandmateOccupied(s,id))continue;
      const inBand=s.band.some(b=>b?.musicianId===id);removeMusician(s,id);queue(g,'ECOCGang'+event.kind.slice(7)+'01'+(inBand?'':'B'),id);
    }else if(event.kind==='bomb'){
      const concert=s.publicity.concerts.find(c=>!c.completed&&c.startDay===event.day);if(!concert)continue;
      const count=g.bombs;queue(g,count<=3?'ECOCGangBomb01':count===4?'ECOCGangBomb02':'ECOCGangBomb03');
      if(count!==4){concert.completed=true;expose(s,.2,count<=3?.2-.05*count:-.1,20);}
    }
    // The original Chart/Legal cleanup strings use ==, not assignment.
    // Preserve their literal behavior instead of inventing an expiry fix.
    g.pending=g.pending.filter(p=>p!==event);
  }
  if(g.debt>0&&g.loanDeadline>0){
    const days=g.loanDeadline-s.day;
    if(g.loanTier<=3&&days===15)queue(g,'ECOCGangLoan01');
    if(g.loanTier<=3&&days===(g.loanTier===1?10:5))queue(g,'ECOCGangLoan02');
    if(days<=0){const id=other();if(id&&!bandmateOccupied(s,id)){
      if(g.loanTier>=3){g.loanTier=4;removeMusician(s,id);queue(g,'ECOCGangLoan04',id);g.loanDeadline=s.day+30;}
      else{g.away.push({actorId:id,until:s.day+14});queue(g,'ECOCGangLoan03',id);g.loanDeadline=0;}
    }}
  }
  return s;
}
export function resolveGangstaCard(input:GameState,choice='ButtonOK'):GameState {
  const s=copy(input),pending=s.gangsta.queue.shift();if(!pending)return input;
  const card=rules.cards.find(c=>c.ID.toLowerCase()===pending.id.toLowerCase())!;
  const effects=card.buttonEffects[choice as keyof typeof card.buttonEffects];if(!effects)return input;
  if(s.money+effects.money<0)return recordMissionFailure({...s,money:0},'NoMoney');
  s.money+=effects.money;
  for(const e of effects.exposures)expose(s,e.intensity,e.quality,e.duration);
  for(const m of effects.modifiers)modify(s,m.id,m.amount,m.duration);
  return s;
}
export function gangstaSpeech(s:GameState,id?:string):string {
  const g=current(s);
  if(!id)return g.debt?(g.loanDeadline-s.day)/g.loanDays>=.5?'g01ga0300z':'g01ga0400z':g.used?'g01ga0200z':'g01ga0100z';
  if(/^ActGangLoan/.test(id))return 'g01gb0100z';
  if(id==='ActGangRepayDebt')return Math.random()<.5?'g01new01011':'g01new01012';
  if(id==='ActGangStreet')return g.debt?'g01gb0700z':'g01gb0600z';
  if(id==='ActGangChart')return g.debt?'g01gb0700z':'g01gb0400z';
  return g.debt?'g01gb0500z':'g01gb0400z';
}
export function validGangsta(s:GameState):boolean {
  const g=s.gangsta;if(g===undefined)return true;
  const count=(v:number)=>Number.isSafeInteger(v)&&v>=0;
  return Boolean(g&&[g.seed,g.debt,g.loanDeadline,g.loanDays,g.loanTier,g.fans,g.scandals,g.paparazzi,g.bombs].every(count)&&Number.isFinite(g.tamperRating)
    &&[g.used,g.tamper,g.legal].every(v=>typeof v==='boolean')&&Array.isArray(g.pending)&&g.pending.every(p=>p&&typeof p.kind==='string'&&count(p.day))
    &&Array.isArray(g.queue)&&g.queue.every(p=>p&&rules.cards.some(c=>c.ID.toLowerCase()===p.id?.toLowerCase()))
    &&Array.isArray(g.away)&&g.away.every(a=>typeof a.actorId==='string'&&count(a.until))
    &&Array.isArray(g.security)&&g.security.every(a=>count(a.startDay)&&a.duration===7));
}


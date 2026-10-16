import type {GameState,Musician} from './model';
import type {MissionEvent} from './mission-event-types';
import {bandmateOccupied,bandmateStats} from './bandmates';
import {reporterBandLike} from './publicity';
import {missionCards} from './mission-catalog';
import {applyMissionCardActions} from './mission-event-actions';
import type {MissionEventState} from './mission-event-types';
export const initialMission07Events=():MissionEventState=>({version:1,vars:{roycnt:0,orgmemberCnt:0},active:{},queue:[],seen:[],appointments:[],approved:false,outcome:null});
export function initializeMission07Events(state:GameState):GameState {
  const s={...state,scenario:initialMission07Events(),publicity:structuredClone(state.publicity)};
  for(const r of s.publicity.reporters){
    if(['Media01','Media02','Media03','Media04'].includes(r.mediaId))r.avoid=99;
    if(r.mediaId==='Media03')r.mood-=.5;
  }
  return s;
}

/** Original Mission07 triggers and event-card choices. */
export function updateMission07Events(input:GameState,event:MissionEvent,musicians:Musician[]):GameState {
  if(!input.scenario||input.scenario.outcome)return input;
  const state=structuredClone(input),s=state.scenario!,v=s.vars,a=s.active,n=7;
  const full=(suffix:string)=>'ECOCMis'+n+suffix;
  const queue=(suffix:string,speakerId?:string)=>{const id=missionCards.find(c=>c.ID.toLowerCase()===full(suffix).toLowerCase())?.ID;if(id&&!s.queue.some(c=>c.id===id)&&!s.seen.includes(id))s.queue.push({id,...(speakerId?{speakerId}:{})});};
  const chance=(p:number)=>{state.publicity.seed=(Math.imul(state.publicity.seed,1664525)+1013904223)>>>0;return state.publicity.seed/4294967296*100<p;};
  const band=()=>state.band.flatMap(m=>m?[m.musicianId]:[]);
  const randomMember=()=>{const b=band();return b[Math.floor(state.publicity.seed%Math.max(1,b.length))];};
  // FunctionsForParser.getIsWholeBandFreeWhen checks calendar Band resources;
  // this differs from a musician's getIsOccupied/away status on a gig day.
  const free=()=>band().every(id=>!bandmateOccupied(state,id))&&!state.publicity.concerts.some(c=>!c.completed&&c.startDay<=state.day&&state.day<c.startDay+c.duration)&&!s.appointments.some(p=>!p.completed&&!p.actorId&&p.startDay<=state.day&&state.day<p.startDay+p.duration);
  const performance=()=>{const influence:Record<string,number>={Vocals:1,Guitar:.75,Keyboards:.6,Drums:.25,Bass:.5};let total=0,weight=0;for(const b of state.band){if(!b)continue;const m=bandmateStats(state,b.musicianId),w=influence[b.instrument];total+=w*(.5*m.musicality+.4*m.charisma+.6*m.mood)/1.5;weight+=w;}return Math.max(0,Math.min(1,(total/Math.max(weight,.001)-.2)/.55));};
  const timer=(key:string,days:number,run:()=>void)=>{if(a[key]!==undefined&&state.day>=a[key]+days){delete a[key];run();}};
  const leaving=(event.kind==='fire'||event.kind==='action'&&event.actionId==='QuitBand')&&event.actorId;
  if(event.kind==='recording'&&!v.recorded){v.recorded=true;a.tragic=state.day;a.orphanage=state.day;}
  if(state.album&&state.day>=state.album.releaseDay&&a.release===undefined&&!v.released){v.released=true;a.release=state.day;a.cityDis=state.day;}
  if(leaving){
    // Retain the source '=+ 1' assignment; do not silently change it to +=.
    if(['RMCRoy','RMCLina','RMCMartin','RMCMary'].includes(String(leaving)))v.orgmemberCnt=1;
    if(v.orgmemberCnt===2)queue('FailLeaveBand',String(leaving));
    else if(leaving!=='RMCLina'){v.Quitter=String(leaving);queue('LeaveBandLucy',String(leaving));}
  }
  if(event.kind==='concert'){
    const stage=Number(v.royStage??0),probability=stage===0?70:50+10*Number(v.roycnt??0);
    if(stage<6&&stage!==4&&chance(probability)){
      const card=['SpeakerFall',chance(50)?'ArtistFall':'BreakFoot','IndecentExposure','ArtistLost','NudeChock'][stage===5?4:stage];
      if(card)queue(card,'RMCRoy');v.roycnt=0;
      if(stage===3){a.lost=state.day;v.royStage=4;if(event.placeId)v.RoyDisappearPlaceID=event.placeId;}else v.royStage=stage===5?6:stage+1;
    }else v.roycnt=Number(v.roycnt??0)+1;
  }
  if(event.kind==='day'||event.kind==='city'){
    for(const p of s.appointments)if(state.day>=p.startDay+p.duration)p.completed=true;
    if(free()){
      timer('tragic',2,()=>queue('TragicEvent','RMCLina'));
      timer('orphanage',70,()=>queue('LabelOrphanage','RMCLina'));
      timer('orphangig',2,()=>queue(performance()>=.5?'LabelOrphanageGood':'LabelOrphanageBad','RMCLina'));
      timer('cityDis',5,()=>{queue('CityDis',randomMember());a.cityDis2=state.day;});
      timer('cityDis2',7,()=>{queue('CityDis2',randomMember());a.cityDis3=state.day;});
      timer('cityDis3',5,()=>{queue('CityDis3',randomMember());a.upset=state.day;});
      timer('upset',2,()=>{queue('MusicianUpset','RMCMartin');a.lucyDis=state.day;});
      timer('lucyDis',2,()=>{queue('LucyDisCity','RMCLina');a.fm=state.day;});
      timer('fm',2,()=>{queue('FMRevenge','RepFM');v.cityNewsClosed=true;});
      timer('fmGood',7,()=>{queue('FMRevengeGood',randomMember());a.zeroGood=state.day;});
      timer('fmBad',5,()=>{queue('FMRevengeBad','RMCLina');a.zeroBad=state.day;});
      timer('zeroGood',5,()=>{queue('ZeroGoodReview',randomMember());a.succeed=state.day;});
      timer('zeroBad',5,()=>{queue('ZeroBadReview',randomMember());a.badMedia=state.day;});
      timer('badMedia',5,()=>queue('BadMedia',randomMember()));
    }
    timer('release',50,()=>{queue('Nomination',randomMember());a.award=state.day;});
    timer('award',5,()=>{queue(chance(50)?'Award':'NoAward',randomMember());queue('AwardScandal','RMCRoy');});
    if(a.lost!==undefined&&state.day>=a.lost+2&&state.band.some(m=>m?.musicianId==='RMCLina')&&!bandmateOccupied(state,'RMCLina'))queue('ArtistLostLucy','RMCLina');
    timer('lost',3,()=>{queue('ArtistBack','RMCRoy');v.royStage=5;});
    if(a.succeed!==undefined&&state.day>a.succeed&&state.publicity.totalSales>=100000)s.outcome='won';
  }
  if(event.kind==='card'){
    const resolved=applyMissionCardActions(state,event,musicians);if(!resolved)return input;
    const {suffix,ok}=resolved;
    if(suffix==='LabelOrphanage'&&ok)a.orphangig=state.day;
    if(suffix==='FMRevenge'){
      a[ok&&reporterBandLike(state,'Media02')>=.3?'fmGood':'fmBad']=state.day;
    }
    if(['ArtistFall','BreakFoot','ArtistLost'].includes(suffix))s.appointments.push({id:'Roy'+state.day,kind:'hospital',actorId:'RMCRoy',startDay:state.day,duration:suffix==='ArtistLost'?4:5,completed:false});
  }
  return state;
}

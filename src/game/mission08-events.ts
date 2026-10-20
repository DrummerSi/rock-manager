import type {GameState,Musician} from './model';
import type {MissionEvent,MissionEventState} from './mission-event-types';
import {bandmateOccupied,bandmateStats} from './bandmates';
import {missionCards} from './mission-catalog';
import {applyMissionCardActions} from './mission-event-actions';
export const initialMission08Events=():MissionEventState=>({version:1,vars:{roycnt:0,orgmemberCnt:0},active:{},queue:[],seen:[],appointments:[],approved:false,outcome:null});
export function initializeMission08Events(state:GameState):GameState {return {...state,scenario:initialMission08Events(),publicity:structuredClone(state.publicity)};}

/** Original Mission08 triggers and event-card choices. */
export function updateMission08Events(input:GameState,event:MissionEvent,musicians:Musician[]):GameState {
  if(!input.scenario||input.scenario.outcome)return input;
  const state=structuredClone(input),s=state.scenario!,v=s.vars,a=s.active,n=8;
  const full=(suffix:string)=>'ECOCMis'+n+suffix;
  const queue=(suffix:string,speakerId?:string)=>{const id=missionCards.find(c=>c.ID.toLowerCase()===full(suffix).toLowerCase())?.ID;if(id&&!s.queue.some(c=>c.id===id)&&!s.seen.includes(id))s.queue.push({id,...(speakerId?{speakerId}:{})});};
  const band=()=>state.band.flatMap(m=>m?[m.musicianId]:[]);
  const leaving=(event.kind==='fire'||event.kind==='action'&&event.actionId==='QuitBand')&&event.actorId;
  const signed=state.contract?.labelId==='Record03';
  if((event.kind==='city'||event.kind==='day')&&state.contract&&!v.contractSeen){
    if(!signed)queue('WrongContract','HmRecord04');
    else{v.contractSeen=true;v.check=1;v.numberOfBoughtSongs=state.ownedSongs.length;queue('GlobalHint01','HmRecord04');}
  }
  if(v.contractSeen&&!state.contract)queue('LostContract01','HmRecord04');
  if(leaving&&v.contractSeen){queue(!band().length?'LostContract01':v.lostbandmember?'BandShattered02':'BandShattered01','HmRecord02');}
  if(event.kind==='recording'&&v.contractSeen){v.numberOfRecordedSongs=Number(v.numberOfRecordedSongs??0)+1;if(Number(v.numberOfRecordedSongs)>2)queue('TooManyRecordings01');}
  if(event.kind==='city'||event.kind==='day'){
    if(!state.contract&&state.day>20)queue('NoContract01','HmRecord04');
    if(!state.contract&&state.day>30&&s.seen.includes(full('NoContract01')))queue('NoContract02','HmRecord04');
    if(v.contractSeen){
      const sales=state.publicity.totalSales+Number(state.publicity.earlierAlbumSales??0),media=Number(v['spent:media']??0),gangsta=Number(v['spent:gangsta']??0),gifts=Number(v['spent:gifts']??0);
      if(sales>2000)queue('TooManySold01');if(sales>3000)queue('TooManySold02');
      if(Number(v.check)<=2){
        if(media>55000)queue('RainbowCheckFailed01','HmRecord02');else if(gangsta>20000)queue('RainbowCheckFailed02','HmRecord02');else if(gifts>15000)queue('RainbowCheckFailed03','HmRecord02');
        else if(state.money<5000)queue(Number(v.check)===1?(state.album&&state.day>=state.album.releaseDay?'RainbowCheckSucceeded01':'RainbowcheckFailed04'):'RainbowCheckSucceeded02','HmRecord02');
      }else if(state.money<5000)queue('RainbowCheck03','HmRecord02');
      if(state.money>=5000){if(media>30000)queue('TooExpensiveAd01','HmRecord02');if(gangsta>15000)queue('TooExpensiveGangsta01','HmRecord02');if(gifts>10000)queue('TooExpensiveBandgift01','HmRecord02');}
      if(state.ownedSongs.length>Number(v.numberOfBoughtSongs)+2)queue('TooManyBoughtSongs01');
    }
    if(a.youSuck!==undefined&&state.day>a.youSuck+5){const id=band().sort((x,y)=>bandmateStats(state,x).mood-bandmateStats(state,y).mood)[0];if(id&&!bandmateOccupied(state,id)){v.YouSuckMusician=id;queue('YouSuck01',id);delete a.youSuck;}}
    if(a.youSuck2!==undefined&&state.day>a.youSuck2+6){const id=String(v.YouSuckMusician);if(band().includes(id)&&!bandmateOccupied(state,id))queue('YouSuck02',id);delete a.youSuck2;}
  }

  if(event.kind==='card'){
    const resolved=applyMissionCardActions(state,event,musicians);if(!resolved)return input;
    const {suffix,ok}=resolved;
    if(['BandShattered01','TooMAnySold01'].includes(suffix))v.lostbandmember=1;
    if(suffix==='RainbowCheckSucceeded01'){v.check=2;a.youSuck=state.day;}
    if(suffix==='RainbowCheckSucceeded02')v.check=3;
    if(suffix==='YouSuck01')a.youSuck2=state.day;
    if(suffix==='YouSuck02'&&!ok)queue('YouSuck03',String(v.YouSuckMusician));
  }
  return state;
}

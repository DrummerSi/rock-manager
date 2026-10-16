import type {GameState,Musician} from './model';
import type {MissionEvent} from './mission-event-types';
import {missionCards,missionSnapshots} from './mission-catalog';
import {canBookCalendar} from './publicity';
// Original DataDBRest09 timer rules. Delays use a strict > comparison.
const timerRules:Record<string,{afterDays:number;cardId?:string;speakerId?:string;bandFreeAfterDays?:number}>={
  TRMis9Missionstart: {afterDays: 0},
  TRMis9ZeroLikedConcert02: {afterDays: 1,cardId: "ECOCMIS9ZeroLikedConcert",speakerId: "RepZM"},
  TRMis9SalesRecord01: {afterDays: 0},
  TRMis9ZeroWantsInterview01: {afterDays: 2,cardId: "ECOCMis9ZeroWantsInterview01",speakerId: "RepZM",bandFreeAfterDays: 2},
  TRMis9ZeroWantsInterview02: {afterDays: 2,cardId: "ECOCMis9ZeroWantsInterview02",speakerId: "RepZM"},
  TRMis9ZeroWantsInterview03: {afterDays: 2,cardId: "ECOCMis9ZeroWantsInterview03",speakerId: "RepZM"},
  TRMis9AvenueWantsConcert01: {afterDays: 2,cardId: "ECOCMIS9AvenueWantsConcert01",bandFreeAfterDays: 5},
  TRMis9AvenueWantsConcert03: {afterDays: 2,cardId: "ECOCMIS9AvenueWantsConcert03",speakerId: "RepCN"},
  TRMis9RadioWantsConcert01: {afterDays: 2,cardId: "ECOCMIS9RadioWantsConcert01",speakerId: "RepFM",bandFreeAfterDays: 4},
  TRMis9RadioWantsConcert03: {afterDays: 3,cardId: "ECOCMIS9RadioWantsConcert03",speakerId: "RepFM"},
  TRMis9CarCommercial01: {afterDays: 1,cardId: "ECOCMIS9CarCommercial01"},
  TRMis9Catwalk01: {afterDays: 1,cardId: "ECOCMIS9Catwalk01"},
  TRMis9FeatureFilm01: {afterDays: 2,cardId: "ECOCMIS9FeatureFilm01"},
  TRMis9FeatureFilm02: {afterDays: 4,cardId: "ECOCMIS9FeatureFilm02"},
  TRMis9FeatureFilm03: {afterDays: 8,cardId: "ECOCMIS9FeatureFilm03"},
  TRMis9LoveConcert01: {afterDays: 5,cardId: "ECOCMIS9LoveConcert01",bandFreeAfterDays: 0},
  TRMis9CityNewsSpecial01: {afterDays: 1,cardId: "ECOCMIS9CityNewsSpecial01"},
  TRMis9OlympicOpening01: {afterDays: 2,cardId: "ECOCMIS9OlympicOpening01",bandFreeAfterDays: 6},
  TRMis9OlympicOpening02: {afterDays: 5,cardId: "ECOCMIS9OlympicOpening02"},
  TRMis9BandKnighted01: {afterDays: 1,cardId: "ECOCMIS9BandKnighted01",bandFreeAfterDays: 0},
  TRMis9CheopsPyramid01: {afterDays: 1,cardId: "ECOCMIS9CheopsPyramid01",bandFreeAfterDays: 2},
  TRMis9CheopsPyramid02: {afterDays: 2,cardId: "ECOCMIS9CheopsPyramid02"},
  TRMis9SalesRecord02: {afterDays: 1,cardId: "ECOCMIS9SalesRecord02",bandFreeAfterDays: 4},
  TRMis9PerfectTVShow01: {afterDays: 1,cardId: "ECOCMIS9PerfectTVShow01",bandFreeAfterDays: 4},
  TRMis9PerfectTVShow02: {afterDays: 2,cardId: "ECOCMIS9PerfectTVShow02"},
  TRMis9YouthMinister01: {afterDays: 1,cardId: "ECOCMIS9YouthMinister01",speakerId: "RMCKanga"},
  TRMis9ThemePark01: {afterDays: 1,cardId: "ECOCMIS9ThemePark01"},
  TRMis9PeaceEnforcers01: {afterDays: 1,cardId: "ECOCMIS9PeaceEnforcers01"},
  TRMis9PeaceEnforcers02: {afterDays: 1,cardId: "ECOCMIS9PeaceEnforcers02",bandFreeAfterDays: 0},
  TRMis9NobelPrize01: {afterDays: 1,cardId: "ECOCMIS9NobelPrize01"},
  TRMis9SpaceConcert01: {afterDays: 1,cardId: "ECOCMIS9SpaceConcert01"},
  TRMis9SpaceConcert02: {afterDays: 1,cardId: "ECOCMIS9SpaceConcert02",bandFreeAfterDays: 0},
  TRMis9SalesRecord01b: {afterDays: 5,cardId: "ECOCMis9SalesRecord01",speakerId: "RepCN"},
};

export function initializeMission09Events(state:GameState):GameState{
  return {...state,publicity:{...state.publicity,liveReputation:1},scenario:{version:1,vars:{...Object.fromEntries(Object.entries(missionSnapshots.Mission09.Classes.Group).map(([id,g])=>['population:'+id,Number(g.size)])),myBandName:state.bandName,GroupsLikeBoost:1,LiveReachBoost:1,AlbumLikeBoost:1,ConcertLikeBoost:1},active:{},queue:[],seen:[],appointments:[],approved:false,outcome:null}};
}
/** DataDBRest09 trigger delays and DataDBEC09 button commands, without eval. */
export function updateMission09Events(input:GameState,event:MissionEvent,musicians:Musician[]):GameState{
  if(!input.scenario||input.scenario.outcome)return input;
  const state=structuredClone(input),s=state.scenario!,v=s.vars,a=s.active;
  const members=()=>state.band.flatMap(m=>m?[m.musicianId]:[]);
  const queue=(id:string,speakerId?:string,repeat=false)=>{const card=missionCards.find(c=>c.ID.toLowerCase()===id.toLowerCase());if(card&&!s.queue.some(c=>c.id===card.ID)&&(repeat||!s.seen.includes(card.ID)))s.queue.push({id:card.ID,speakerId:speakerId??members()[0]});};
  const freeWhen=(day:number)=>canBookCalendar({...state,day:Math.min(state.day,day-1)},'concert',day);
  const activate=(id:string)=>{a[id]=state.day;};
  const expose=(intensity:number,quality:number,duration:number)=>state.publicity.exposures.push({id:'Mis9Expo'+state.publicity.nextId++,startDay:state.day+1,duration,intensity,reach:Object.fromEntries(state.publicity.groups.map(g=>[g.id,1])),quality:Object.fromEntries(state.publicity.groups.map(g=>[g.id,quality])),albumKey:state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null});
  if(event.kind==='action'&&event.actionId==='HireBandMember')queue('ECOCMis9NewBandmember01','HmRecord04');
  if(event.kind==='fire'||event.kind==='action'&&event.actionId==='QuitBand')queue('ECOCMis9BandmemberQuit01','HmRecord04');
  if(event.kind==='recording'&&state.demo?.songId!=='Sng21')queue('ECOCMis9NewSong01','HmRecord04');
  if(event.kind==='city'||event.kind==='place'){
    if(state.bandName!==v.myBandName){state.bandName=String(v.myBandName);queue('ECOCMis9BandName01','HmRecord04',true);}
    if(state.ownedSongs.length>1)queue('ECOCMis9NewSong02','HmRecord04');
    if(!state.contract)queue('ECOCMis9LostContract01','HmRecord04');
    if(state.album?.selection[1]==='DEDArtists04')queue('ECOCMis9AlbumNoCostumes01','HmRecord04',true);
  }
  if(event.kind==='action'&&event.actionId==='EnterDesign'&&!v.costumes){
    v.costumes=true;queue('ECOCMis9PerfectImage','HmRecord04');
    for(const musicianId of members())state.bandmates.modifiers.push({id:'Mediaexpo',musicianId,stat:'charisma',amount:.7,startDay:state.day,duration:1,constant:true});
  }
  if(event.kind==='concert'&&!v.firstConcert){v.firstConcert=true;activate('TRMis9ZeroLikedConcert02');}
  if(event.kind==='day'||event.kind==='city'){
    if(state.album&&state.day>=state.album.releaseDay&&!v.released){v.released=true;expose(.7,1,30);activate('TRMis9SalesRecord01b');}
    for(const p of s.appointments)if(!p.completed&&state.day>=p.startDay+p.duration){p.completed=true;if(p.id==='mis9radioBookingObj')queue('ECOCMis9RadioWantsConcert02','RepFM');}
    if(v.mis9avenueBookingObj&&state.publicity.concerts.some(c=>c.id===v.mis9avenueBookingObj&&c.completed)){queue('ECOCMis9AvenueWantsConcert02','RepCN');delete v.mis9avenueBookingObj;}
    // Snapshot the active list: newly activated timers wait until the next tick.
    for(const [id,start]of Object.entries({...a})){
      const rule=timerRules[id];if(!rule)continue;
      if(state.day<=start+rule.afterDays)continue;
      if(rule.bandFreeAfterDays!==undefined&&!freeWhen(state.day+rule.bandFreeAfterDays))continue;
      if(rule.cardId)queue(rule.cardId,rule.speakerId);
      delete a[id];
    }
  }
  if(event.kind==='card'){
    const pending=s.queue.find(c=>c.id===event.cardId);if(!pending)return input;
    const card=missionCards.find(c=>c.ID===pending.id)!;
    const command=String((card as unknown as Record<string,{ExecuteThis?:string}>)[event.choice??'ButtonOK']?.ExecuteThis??'');
    s.queue=s.queue.filter(c=>c!==pending);if(!s.seen.includes(card.ID))s.seen.push(card.ID);
    if(/CMission\.failed/i.test(command)){s.outcome='lost';s.failureReason=command.match(/failed\(#(\w+)/i)?.[1];}
    if(/CMission\.succeeded/i.test(command))s.outcome='won';
    for(const m of command.matchAll(/activate\s*\(\s*#(\w+)/gi))activate(m[1]);
    for(const m of command.matchAll(/money\.val\s*\+=\s*(\d+)/gi))state.money+=Number(m[1]);
    for(const m of command.matchAll(/expose\(0,\s*([\d.-]+),\s*([\d.-]+),\s*(\d+)/gi))expose(Number(m[1]),Number(m[2]),Number(m[3]));
    for(const m of command.matchAll(/CreateModifier\s*\(\s*#(\w+),\s*#(\w+),\s*#Mood,\s*([\d.-]+),\s*(\d+)/gi)){
      if(m[2]==='RepZM')state.publicity.reporters.find(r=>r.mediaId==='Media04')?.modifiers.push({amount:Number(m[3]),endDay:state.day+Number(m[4])});
      else for(const musicianId of m[2]==='BandMembers'?members():[m[2]])if(musicians.some(p=>p.id===musicianId))state.bandmates.modifiers.push({id:m[1],musicianId,stat:'mood',amount:Number(m[3]),startDay:state.day,duration:Number(m[4])});
    }
    const dates=command.match(/SetDates\(missionVar.date\s*\+\s*(\d+),\s*(\d+)/i);
    if(dates){
      const startDay=state.day+Number(dates[1]),duration=Number(dates[2]);
      if(/createObj\(#concert\)/i.test(command)){const id='Mis9Avenue'+state.day;state.publicity.concerts.push({id,venueId:'Live04',startDay,duration,completed:false});v.mis9avenueBookingObj=id;}
      else s.appointments.push({id:/mis9radioBookingObj/i.test(command)?'mis9radioBookingObj':card.ID,kind:/AgFmConcert/i.test(command)?'concert':'interview',startDay,duration,completed:false});
    }
  }
  return state;
}

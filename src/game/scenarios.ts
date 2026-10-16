import {initializeScenario78,updateScenario78} from './scenario78';
import type {GameState,Musician} from './model';
import type {ScenarioEvent} from './scenario-types';
import {initialScenario03,updateScenario03,applyScenario03StartingModifiers} from './scenario03';
import {initialScenario04,updateScenario04} from './scenario04';
import {initialScenario06,updateScenario06} from './scenario06';
import {initialScenario05,updateScenario05} from './scenario05';
import {missionCards} from './mission-catalog';
import data from '../generated/game-data.json';
import {PUBLICITY_RULES} from './publicity';
import {isMediaReminder,updateMediaReminders} from './media-reminders';

/** Resolve the Director text tokens used by the recovered scenario cards.
 * A card's pictured human and the musician named in its story can differ.
 */
export function scenarioText(value:string,state:GameState,musicians:Musician[],focusId?:string,cardId?:string):string{
  const variable=(key:string)=>Object.entries(state.scenario?.vars??{}).find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1];
  const placeName=(id:unknown)=>[...PUBLICITY_RULES.venues,...data.tutorialGameplay.studios].find(p=>p.id.toLowerCase()===String(id??'').toLowerCase())?.name;
  const latestConcert=(before=state.day)=>state.publicity.concertResults.filter(c=>c.day<=before).sort((a,b)=>b.day-a.day)[0];
  const person=(reference:string)=>{
    const key=reference.replace(/^¤/,'').toLowerCase();
    const id=key==='tmp'?state.scenario?.vars.HappyGuy??focusId
      :key.startsWith('missionvar.')?Object.entries(state.scenario?.vars??{}).find(([name])=>name.toLowerCase()===key.slice(11))?.[1]
      :key.startsWith('#')?key.slice(1):focusId;
    return musicians.find(m=>m.id.toLowerCase()===String(id??'').toLowerCase());
  };
  return value.replace(/<([^>]+)>/g,(token,expression:string)=>{
    const lookup=expression.match(/^getObjByID\(missionvar\.(\w+)\)\.name$/i);
    if(lookup){
      // Older saves did not retain Roy's venue; recover it from the gig history.
      const id=variable(lookup[1])??(lookup[1].toLowerCase()==='roydisappearplaceid'?latestConcert(state.day-3)?.venueId:undefined);
      return placeName(id)??token;
    }
    if(/^formatCurrency\(tmp\)$/i.test(expression)){
      const concert=state.publicity.concerts.filter(c=>!c.completed&&c.startDay>state.day).sort((a,b)=>a.startDay-b.startDay)[0];
      const venue=PUBLICITY_RULES.venues.find(v=>v.id===concert?.venueId);
      return venue?'$'+Math.round(4*venue.ticketPrice).toLocaleString('en-US'):token;
    }
    const dot=expression.lastIndexOf('.');if(dot<0)return token;
    const ref=expression.slice(0,dot),property=expression.slice(dot+1).toLowerCase();
    if(/^¤?cband$/i.test(ref)&&property==='name')return state.bandName;
    if(/^¤c(?:album|song)$/i.test(ref)&&property==='name')return data.songs.find(s=>s.id===(state.album?.songId??state.demo?.songId??state.selectedSong))?.name??token;
    if(/^¤cRealMusicianDrums$/i.test(ref)&&property==='name')return musicians.find(m=>m.id===state.band.find(b=>b?.instrument==='Drums')?.musicianId)?.name??token;
    if(/^¤cplace$/i.test(ref)&&property==='name')return placeName(/Studiochaos/i.test(cardId??'')?state.demo?.studioId:latestConcert()?.venueId)??token;
    if(/^(?:¤c(?:realmusician|human)|¤#\w+|tmp|missionvar\.\w+)$/i.test(ref)){
      const musician=person(ref);
      if(property==='name')return musician?.name??'the musician';
      if(property==='firstname')return musician?.name.split(' ')[0]??'the musician';
      if(property==='gender')return musician?.gender??'';
    }
    return token;
  }).replace(/\{([xX]);Pron;S3;\[#Gender:([^,\]]*)([^\]]*)\]\}/g,(_token,capital:string,gender:string,options:string)=>{
    const object=/#Object\s*:\s*1/i.test(options),genitive=/#Genitive\s*:\s*1/i.test(options),female=/^female$/i.test(gender),male=/^male$/i.test(gender);
    const word=genitive?(female?'her':male?'his':'their'):female?(object?'her':'she'):male?(object?'him':'he'):(object?'them':'they');
    return capital==='X'?word[0].toUpperCase()+word.slice(1):word;
  }).replaceAll('\\n','\n').replaceAll('\\t','   ').replaceAll('\x96','–').replaceAll('\x94','”').replaceAll('\x93','“').replaceAll('\x92','’').replaceAll('\x91','‘');
}
export function initializeScenario(state:GameState):GameState{
  if(state.missionId==='Mission07'||state.missionId==='Mission08')return initializeScenario78(state);
  if(state.missionId==='Mission03')return applyScenario03StartingModifiers({...state,scenario:initialScenario03(state)});
  if(state.missionId==='Mission04')return {...state,scenario:initialScenario04(state)};
  if(state.missionId==='Mission06')return {...state,scenario:initialScenario06()};
  if(state.missionId==='Mission05')return {...state,scenario:initialScenario05(state)};
  return state;
}
export function scenarioEvent(state:GameState,event:ScenarioEvent,musicians:Musician[]):GameState{
  if(state.missionId==='Mission08'&&event.kind==='card'&&isMediaReminder(event.cardId??''))return updateMediaReminders(state,event,musicians);
  if(state.missionId==='Mission07'||state.missionId==='Mission08')return updateMediaReminders(updateScenario78(state,event,musicians),event,musicians);
  if(state.missionId==='Mission03')return updateScenario03(state,event,musicians);
  if(state.missionId==='Mission04')return updateScenario04(state,event,musicians);
  if(state.missionId==='Mission06')return updateScenario06(state,event,musicians);
  if(state.missionId==='Mission05')return updateScenario05(state,event,musicians);
  return state;
}

export function validScenario(state:GameState):boolean{
  const s=state.scenario;if(state.missionId==='Mission01')return s===undefined;
  if(!s||s.version!==1||!s.vars||!s.active||typeof s.vars!=='object'||typeof s.active!=='object'||Array.isArray(s.vars)||Array.isArray(s.active)||typeof s.approved!=='boolean'||![null,'won','lost'].includes(s.outcome))return false;
  const date=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=365100;
  const card=(id:unknown)=>typeof id==='string'&&missionCards.some(c=>c.ID.toLowerCase()===id.toLowerCase()&&(['ECOCQuitNow','ECOCWantQuit'].includes(id)||state.missionId==='Mission08'&&isMediaReminder(id)||new RegExp('^ec(?:oc|m)mis'+Number(state.missionId.slice(-2)),'i').test(id)));
  return Object.values(s.vars).every(v=>typeof v==='boolean'||typeof v==='string'&&v.length<=2000||typeof v==='number'&&Number.isFinite(v))
    &&Object.values(s.active).every(v=>date(v)&&v<=state.day)&&Array.isArray(s.queue)&&s.queue.length<=100&&s.queue.every(c=>c&&card(c.id)&&(c.speakerId===undefined||typeof c.speakerId==='string'))
    &&Array.isArray(s.seen)&&s.seen.every(card)&&Array.isArray(s.appointments)&&s.appointments.every(a=>a&&typeof a.id==='string'&&['concert','television','hospital','prison','award'].includes(a.kind)&&date(a.startDay)&&Number.isSafeInteger(a.duration)&&a.duration>0&&a.duration<=100&&typeof a.completed==='boolean');
}

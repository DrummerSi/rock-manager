import type {GameState,Musician} from './model';
import type {MissionEvent,MissionEventState} from './mission-event-types';
import {bandmateOccupied} from './bandmates';
import {VIDEO_RULES} from './video';

const NICK='RMCNick';
/** DataDBRest06 / DataDBEC06: Kind of Blue. */
export function initialMission06Events():MissionEventState {
  return {version:1,vars:{},active:{},queue:[],seen:[],appointments:[],approved:false,outcome:null};
}
export function updateMission06Events(input:GameState,event:MissionEvent,musicians:Musician[]):GameState {
  if(!input.scenario||input.scenario.outcome)return input;
  const state=structuredClone(input),s=state.scenario!,v=s.vars,a=s.active;
  const queue=(suffix:string,speakerId=NICK)=>{const id='ECOCMis6'+suffix;if(!s.queue.some(c=>c.id===id)&&!s.seen.includes(id))s.queue.push({id,speakerId});};
  const mod=(id:string,amount:number,duration:number,actor=NICK)=>state.bandmates.modifiers.push({id,musicianId:actor,stat:'mood',amount,startDay:state.day,duration:duration||1,...(duration===0?{constant:true}:{})});
  const chance=(percent:number)=>{state.publicity.seed=(Math.imul(state.publicity.seed,1664525)+1013904223)>>>0;return state.publicity.seed/4294967296*100<percent;};
  const security=()=>state.gangsta?.security.some(e=>e.startDay<=state.day&&state.day<e.startDay+e.duration)??false;
  const expose=()=>state.publicity.exposures.push({id:'Mis6'+state.publicity.nextId++,startDay:state.day+1,duration:1,intensity:.3,reach:Object.fromEntries(state.publicity.groups.map(g=>[g.id,1])),quality:Object.fromEntries(state.publicity.groups.map(g=>[g.id,.3])),albumKey:state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null});
  if(event.kind==='city'&&!v.started){v.started=true;mod('Mission',.6,70);}
  if((event.kind==='fire'||event.kind==='action'&&event.actionId==='QuitBand')&&event.actorId===NICK){s.outcome='lost';s.failureReason='quitband';}
  if(event.kind==='recording'){
    if(state.demo?.songId!=='Sng14')queue('WrongSong');
    if(!v.studioChaos){queue(security()?'NickStudiochaos02':'NickStudiochaos01');v.studioChaos=true;}
    if(a.boredMusician===undefined&&chance(70))a.boredMusician=state.day;
  }
  if(event.kind==='concert'){
    queue(security()?(v.liveChaos?'NickLivechaos04':'NickLivechaos02'):(v.liveChaos?'NickLivechaos03':'NickLivechaos01'));v.liveChaos=true;
  }
  if(event.kind==='training'&&event.actorId===NICK&&event.actionId==='ActTrainVacation'&&a.vacation===undefined&&chance(70))a.vacation=state.day;
  if(event.kind==='gift'&&event.actorId===NICK&&['ActGiftDrink01','ActGiftDrink02'].includes(event.actionId??'')&&a.liquor===undefined)a.liquor=state.day;
  if(event.kind==='action'&&event.actionId==='HireBandMember'&&(musicians.find(m=>m.id===event.actorId)?.style?.Metal??0)>=.7){v.mis6NickDislikesMetalmember=event.actorId!;a.metal=state.day;}
  if(event.kind==='action'&&event.actionId==='BookVideoProduction')queue('NickDislikesVideo01');
  if(event.kind==='day'||event.kind==='city'){
    for(const appointment of s.appointments)if(state.day>=appointment.startDay+appointment.duration)appointment.completed=true;
    if(state.day>5)queue('Zerorequest01','RepZM');
    if(v.zeroRequest&&state.day>6)queue('Zerorequest02');
    if(state.day>17&&!(state.album&&state.album.releaseDay<=state.day)&&!bandmateOccupied(state,NICK))queue('NickBoored01');
    if(a.vacation!==undefined&&state.day>a.vacation+2)queue('NickVacation01');
    if(a.liquor!==undefined&&state.day>a.liquor+1)queue('NickLiquor01');
    if(a.metal!==undefined&&state.day>a.metal+1)queue('NickDislikesMetal01');
    if(a.metalAgain!==undefined&&state.day>a.metalAgain+5&&state.band.some(m=>m?.musicianId===v.mis6NickDislikesMetalmember))queue('NickDislikesMetal02');
    if(a.boredMusician!==undefined&&state.day>a.boredMusician+5){
      const actor=state.band.flatMap(b=>b?[musicians.find(m=>m.id===b.musicianId)!]:[]).sort((a,b)=>(b.charisma??0)-(a.charisma??0))[0];
      if(actor&&actor.id!==NICK&&!bandmateOccupied(state,actor.id)){v.Mis6Booredmusician=actor.id;queue('Musicianboored01',actor.id);}
      delete a.boredMusician;
    }
    if(state.day>35&&state.album&&state.album.releaseDay<=state.day&&state.band.every(m=>!m||!bandmateOccupied(state,m.musicianId,state.day+7)))queue('Award01');
    if(a.award!==undefined&&state.day>a.award+7)queue(security()?'Award02':'Award03');
    if(a.noAward!==undefined&&state.day>a.noAward+7)queue('Award04');
    if((state.publicity.earlierAlbumSales??0)+state.publicity.totalSales>30000)queue('MissionSucceeded01');
  }
  if(event.kind==='card'){
    const id=event.cardId!;s.queue=s.queue.filter(c=>c.id!==id);if(!s.seen.includes(id))s.seen.push(id);
    const ok=event.choice==='ButtonOK';
    if(ok){
      const suffix=id.replace('ECOCMis6','');
      const effects:Record<string,[string,number,number]>={Zerorequest02:['Mediaexposure',-.3,14],NickBoored01:['Boored',-.1,0],NickVacation01:['Mediaexposure',-.05,0],NickLiquor01:['Booze',-.05,0],NickStudiochaos01:['Mediaexposure',-.2,20],NickStudiochaos02:['SkilledManager',.1,0],NickLivechaos01:['Mediaexposure',-.2,20],NickLivechaos02:['SkilledManager',.1,0],NickLivechaos03:['Mediaexposure',-.2,20],NickLivechaos04:['Mediaexposure',-.1,0],NickDislikesMetal02:['SkilledManager',-.2,20],NickDislikesVideo01:['Mediaexposure',-.1,20],Award02:['SkilledManager',.1,20],Award03:['Mediaexposure',-.1,20]};
      if(effects[suffix])mod(...effects[suffix]);
      if(suffix==='Zerorequest01')v.zeroRequest=true;
      if(suffix==='NickDislikesMetal01')a.metalAgain=state.day;
      if(['NickStudiochaos02','NickLivechaos02','NickLivechaos03','NickLivechaos04'].includes(suffix))expose();
      if(['NickLiquor01','NickLivechaos03'].includes(suffix))s.appointments.push({id:'NickHospital'+state.day,kind:'hospital',actorId:NICK,startDay:state.day,duration:4,completed:false});
      if(suffix==='NickDislikesVideo01'&&state.video)state.video={...state.video,bandRequired:false,qualityPenalty:.3};
      if(suffix==='Musicianboored01'&&typeof v.Mis6Booredmusician==='string')state.bandmates.modifiers.push({id:'Boored',musicianId:v.Mis6Booredmusician,stat:'mood',otherId:NICK,amount:-.3,startDay:state.day,duration:1});
      if(suffix==='Award01'){state.money-=10000;a.award=state.day;s.appointments.push({id:'Mis6Award',kind:'award',actorId:NICK,startDay:state.day+7,duration:1,completed:false});}
      if(suffix==='MissionSucceeded01')s.outcome='won';
      if(suffix==='WrongSong')s.outcome='lost';
    }else{
      if(id==='ECOCMis6Award01')a.noAward=state.day;
      if(id==='ECOCMis6NickDislikesVideo01'&&state.video){state.money+=Math.round((VIDEO_RULES.concepts.find(c=>c.id===state.video!.conceptId)?.price??0)/2);state.video=null;}
    }
  }
  return state;
}

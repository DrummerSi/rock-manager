import type {GameState,Musician} from './model';
import type {ScenarioEvent} from './scenario-types';
import {givePressKit,giveVideo} from './publicity';
import cards from './media-reminder-cards.json';

const requests=[
  {id:'ECOCCityRequestCD',media:'Media03',actor:'RepCN',delay:10},
  {id:'ECOCZer0RequestCD',media:'Media04',actor:'RepZM',delay:14},
  {id:'ECOCRadioRequestCD',media:'Media02',actor:'RepFM',delay:16},
];
export const isMediaReminder=(id:string)=>cards.some(c=>c.ID===id);

/** DataDBRest00 reminders explicitly enabled by Mission08.StartTriggers. */
export function updateMediaReminders(input:GameState,event:ScenarioEvent,musicians:Musician[]):GameState {
  if(input.missionId!=='Mission08'||!input.scenario||input.scenario.outcome)return input;
  let state=structuredClone(input);
  const s=state.scenario!,v=s.vars;
  const queue=(id:string,actor?:string)=>{
    if(!s.queue.some(c=>c.id===id))s.queue.push({id,...(actor?{speakerId:actor}:{})});
  };
  if(event.kind==='card'&&event.cardId&&isMediaReminder(event.cardId)){
    if(!s.queue.some(c=>c.id===event.cardId))return input;
    const request=requests.find(r=>r.id===event.cardId);
    if(event.choice==='ButtonOK'){
      if(request){
        const key=state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null;
        if(state.publicity.reporters.find(r=>r.mediaId===request.media)?.kit!==key){
          state=givePressKit(state,request.media,musicians);
          state.money-=10; // Original card's transactMoney(-10), separate from kit delivery.
        }
      }else if(event.cardId==='ECOCTVRequestVideo'){
        if(state.publicity.reporters.find(r=>r.mediaId==='Media01')?.videoKit!==state.video?.albumKey)state=giveVideo(state);
      }
    }
    state.scenario!.queue=state.scenario!.queue.filter(c=>c.id!==event.cardId);
    if(!state.scenario!.seen.includes(event.cardId))state.scenario!.seen.push(event.cardId);
    return state;
  }
  if(event.kind!=='day'&&event.kind!=='city')return input;
  const album=state.album,key=state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null;
  if(album&&key&&state.day>=album.releaseDay){
    for(const r of requests){
      const done=`reminder:${r.id}:${key}`;
      if(!v[done]&&state.day>=album.releaseDay+r.delay){
        v[done]=true;
        if(state.contract?.songId===album.songId&&state.publicity.reporters.find(p=>p.mediaId===r.media)?.kit!==key)queue(r.id,r.actor);
      }
    }
  }
  const video=state.video;
  if(video?.completed&&video.albumKey===key){
    const done=`reminder:video:${key}:${video.startDay}`;
    if(!v[done]&&state.day>=video.startDay+video.duration+8){
      v[done]=true;
      if(state.publicity.reporters.find(p=>p.mediaId==='Media01')?.videoKit!==key)queue('ECOCTVRequestVideo','RepTV');
    }
  }
  if(state.contract){
    const done=`reminder:design:${state.contract.signedDay}`;
    if(!v[done]&&state.day>=state.contract.signedDay+10){v[done]=true;queue('ECOCRecordTellDesign');}
  }
  return state;
}

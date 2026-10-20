import type {GameState,Musician} from './model';
import type {MissionEvent} from './mission-event-types';
import {missionCards} from './mission-catalog';

/** Shared literal card actions used by Missions07 and08. Mutates their cloned state. */
export function applyMissionCardActions(state:GameState,event:MissionEvent,musicians:Musician[]){
  const s=state.scenario!,n=Number(state.missionId.slice(-2));
  const band=()=>state.band.flatMap(m=>m?[m.musicianId]:[]);
  const pending=s.queue.find(c=>c.id.toLowerCase()===event.cardId?.toLowerCase());if(!pending)return null;
  const card=missionCards.find(c=>c.ID===pending.id)!;
  const command=String((card as unknown as Record<string,{ExecuteThis?:string}>)[event.choice??'ButtonOK']?.ExecuteThis??'');
  s.queue=s.queue.filter(c=>c!==pending);if(!s.seen.includes(card.ID))s.seen.push(card.ID);
  const suffix=card.ID.replace(/^ECOCMis[78]/i,''),ok=event.choice==='ButtonOK';
  if(/CMission\.failed/i.test(command))s.outcome='lost';if(/CMission\.succeeded/i.test(command))s.outcome='won';
  for(const match of command.matchAll(/transactMoney\(\s*(-?\d+)/gi))state.money+=Number(match[1]);
  for(const m of command.matchAll(/expose\(0,\s*([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)\)/gi))state.publicity.exposures.push({id:'Mis'+n+state.publicity.nextId++,startDay:state.day+1,intensity:Number(m[1]),duration:Number(m[3]),reach:Object.fromEntries(state.publicity.groups.map(g=>[g.id,1])),quality:Object.fromEntries(state.publicity.groups.map(g=>[g.id,Number(m[2])])),albumKey:state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null});
  for(const m of command.matchAll(/createModifier\(#(\w+),\s*#(\w+),\s*(#Mood|a),\s*([\d.-]+),\s*(\d+)/gi)){
    const ids=m[2].toLowerCase()==='bandmembers'?band():musicians.filter(p=>p.id.toLowerCase()===m[2].toLowerCase()).map(p=>p.id);
    for(const musicianId of ids)state.bandmates.modifiers.push({id:m[1],musicianId,stat:'mood',amount:Number(m[4]),duration:Number(m[5]),startDay:state.day,...(m[3]==='a'?{otherId:'RMCLina'}:{})});
  }
  return {suffix,ok};
}

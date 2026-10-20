import type {GameState} from './model';
import {PLAYABLE_MISSIONS,missionDefinition} from './mission-catalog';
import {evaluateMissionProgress,missionScore} from './mission-progress';

export const CAREER_KEY='rock-manager.career.v1';
export interface Career {version:1;missions:Record<string,{completed:boolean;points?:number}>}
/** ClassPlayer.MissionsInfo: completion survives retries; points are the latest
 * finished attempt, not a high score. DlgMissionChoose excludes Mission09's points. */
export function recordCareer(input:Career,state:GameState):Career {
  const career=structuredClone(input),old=career.missions[state.missionId];
  const status=evaluateMissionProgress(state).missionProgress.status;
  career.missions[state.missionId]={...old,completed:old?.completed===true||status==='won'};
  if(status==='won'||status==='lost')career.missions[state.missionId].points=status==='won'?(missionScore(state).total??0):0;
  return career;
}
export function careerAvailability(career:Career,currentId:string):Set<string>{
  const available=new Set(Object.keys(career.missions));available.add(currentId);
  if(!available.size)available.add('Mission01');
  const last=[...available].sort().at(-1)!;
  if(career.missions[last]?.completed){
    // NextMissions is empty in the shipped campaign; the native code sorts IDs.
    const index=PLAYABLE_MISSIONS.indexOf(last as typeof PLAYABLE_MISSIONS[number]);
    const next=index<0?undefined:PLAYABLE_MISSIONS[index+1];
    if(next)available.add(next);
  }
  return available;
}
export const careerTotal=(career:Career)=>Object.entries(career.missions).reduce((sum,[id,m])=>sum+(id==='Mission09'?0:m.points??0),0);
export function loadCareer(state:GameState):Career{
  let career:Career|undefined;
  try{
    const value=JSON.parse(localStorage.getItem(CAREER_KEY)??'null');
    if(value?.version===1&&value.missions&&typeof value.missions==='object'&&!Array.isArray(value.missions)&&Object.entries(value.missions).every(([id,m]:[string,any])=>missionDefinition(id).id===id&&m&&typeof m.completed==='boolean'&&(m.points===undefined||Number.isSafeInteger(m.points))))career=value;
  }catch{/* Storage may be unavailable. */}
  if(!career){
    career={version:1,missions:{}};
    // Legacy saves contain only the current attempt. Preserve access to the
    // earlier rows without inventing their completion records or lost scores.
    for(const id of PLAYABLE_MISSIONS){career.missions[id]={completed:false};if(id===state.missionId)break;}
  }
  return recordCareer(career,state);
}
export function saveCareer(career:Career):void{try{localStorage.setItem(CAREER_KEY,JSON.stringify(career));}catch{/* Keep session progress in memory. */}}

import catalog from './mission-catalog.json' with {type:'json'};
import reminderCards from './media-reminder-cards.json' with {type:'json'};
export type MissionId='Mission01'|'Mission03'|'Mission04'|'Mission05'|'Mission06'|'Mission07'|'Mission08';
export const PLAYABLE_MISSIONS:MissionId[]=['Mission01','Mission03','Mission04','Mission05','Mission06','Mission07','Mission08'];
export const missionDefinition=(id:string)=>catalog.missions.find(m=>m.id===id)??catalog.missions[0];
export const missionCards=[...catalog.cards,...reminderCards];
export const missionSnapshots=catalog.snapshots;
export const isMissionId=(id:unknown):id is MissionId=>typeof id==='string'&&PLAYABLE_MISSIONS.includes(id as MissionId);

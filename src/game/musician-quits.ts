import {gangstaAway} from './gangsta';
import {videoOccupies} from './video';
import {tourOccupied} from './tour';
import type {GameState,Musician} from './model';
import {bandmateStats} from './bandmates';
import {missionEvent} from './mission-events';

/** Native getIsOccupied excludes normal Concert and DivEvent appointments. */
export function musicianQuitOccupied(state:GameState,id:string):boolean {
  return tourOccupied(state,id)||state.scenario?.appointments.some(a=>a.kind==='hospital'&&a.actorId===id&&a.startDay<=state.day&&state.day<a.startDay+a.duration)||gangstaAway(state,id)||videoOccupies(state,id)||state.bandmates.training.some(t=>!t.completed&&t.musicianId===id&&t.startDay<=state.day&&state.day<t.startDay+t.duration);
}

/** ClassRealMusician.Report queues crucial cards on downward mood crossings.
 * QuitNow itself quits on display (its ExecuteThis), not at this daily check.
 * Scoped to the newly implemented scenarios so legacy Mission01 saves retain
 * their existing simulation behavior. Equality is left above the boundary;
 * exact equal-key insertion behavior still needs original-runtime verification.
 */
export function applyMusicianQuits(input:GameState,_musicians:Musician[]):GameState {
  if(input.missionId==='Mission01'||!input.scenario||input.scenario.outcome)return input;
  const state=structuredClone(input),scenario=state.scenario!;
  for(const member of state.band){
    if(!member||musicianQuitOccupied(state,member.musicianId))continue;
    const person=state.bandmates.people.find(p=>p.musicianId===member.musicianId);
    if(!person)continue;
    const key='lastMood:'+member.musicianId,previous=typeof scenario.vars[key]==='number'?Number(scenario.vars[key]):person.mood;
    const mood=bandmateStats(state,member.musicianId).mood;
    scenario.vars[key]=mood;
    const id=previous>=.01&&mood<.01?'ECOCQuitNow':previous>=.1&&mood<.1?'ECOCWantQuit':null;
    if(id&&!scenario.queue.some(c=>c.id===id&&c.speakerId===member.musicianId))scenario.queue.push({id,speakerId:member.musicianId});
  }
  return state;
}

/** Call when ECOCQuitNow is actually shown. The card stays queued until its OK
 * is acknowledged; native quitBand emits the scenario event immediately and
 * the corresponding mission failure card is queued behind it.
 */
export function completeMusicianQuit(input:GameState,id:string,musicians:Musician[]):GameState {
  if(input.missionId==='Mission01'||!input.scenario||!input.band.some(m=>m?.musicianId===id)||musicianQuitOccupied(input,id)
    ||!input.scenario.queue.some(c=>c.id==='ECOCQuitNow'&&c.speakerId===id))return input;
  const state=structuredClone(input);
  state.band=state.band.map(member=>member?.musicianId===id?null:member);
  const person=state.bandmates.people.find(p=>p.musicianId===id);if(person)person.fired=true;
  state.bandmates.modifiers=state.bandmates.modifiers.filter(m=>m.musicianId!==id);
  state.bandmates.training=state.bandmates.training.filter(t=>t.musicianId!==id||t.completed);
  state.bandmates.pendingBooze=state.bandmates.pendingBooze.filter(t=>t.musicianId!==id);
  return missionEvent(state,{kind:'action',actionId:'QuitBand',actorId:id},musicians);
}

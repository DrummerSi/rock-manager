import type {GameState,Musician} from './model';

export interface MissionQueuedCard {id:string;speakerId?:string}
export interface MissionAppointment {id:string;kind:string;startDay:number;duration:number;actorId?:string;placeId?:string;completed:boolean}
export interface MissionEventState {
  version:1;
  vars:Record<string,number|string|boolean>;
  active:Record<string,number>;
  queue:MissionQueuedCard[];
  seen:string[];
  appointments:MissionAppointment[];
  approved:boolean;
  outcome:'won'|'lost'|null;
  failureReason?:string;
}
export interface MissionEvent {
  kind:'day'|'city'|'recording'|'release'|'gift'|'training'|'fire'|'concert'|'card'|'name'|'place'|'action';
  actorId?:string;
  cardId?:string;
  choice?:string;
  placeId?:string;
  actionId?:string;
  concertId?:string;
}
export type MissionEventHandler=(state:GameState,event:MissionEvent,musicians:Musician[])=>GameState;

import type {GameState,Musician} from './model';

export interface ScenarioCard {id:string;speakerId?:string}
export interface ScenarioAppointment {id:string;kind:string;startDay:number;duration:number;actorId?:string;placeId?:string;completed:boolean}
export interface ScenarioState {
  version:1;
  vars:Record<string,number|string|boolean>;
  active:Record<string,number>;
  queue:ScenarioCard[];
  seen:string[];
  appointments:ScenarioAppointment[];
  approved:boolean;
  outcome:'won'|'lost'|null;
  failureReason?:string;
}
export interface ScenarioEvent {
  kind:'day'|'city'|'recording'|'release'|'gift'|'training'|'fire'|'concert'|'card'|'name'|'place'|'action';
  actorId?:string;
  cardId?:string;
  choice?:string;
  placeId?:string;
  actionId?:string;
  concertId?:string;
}
export type ScenarioHandler=(state:GameState,event:ScenarioEvent,musicians:Musician[])=>GameState;

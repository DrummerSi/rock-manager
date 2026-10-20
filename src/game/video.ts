import type {GameState} from './model';
import {canBookCalendar} from './publicity';
import rules from './video-rules.json' with {type:'json'};

export const VIDEO_RULES=rules;
export interface VideoProduction {
  conceptId:string;albumKey:string;startDay:number;duration:number;
  members:string[];completed:boolean;seen:boolean;
  bandRequired?:boolean;qualityPenalty?:number;
}
export const videoAlbumKey=(state:GameState)=>state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null;
export function currentVideo(state:GameState):VideoProduction|null {
  return state.video?.albumKey===videoAlbumKey(state)?state.video??null:null;
}
export function videoAvailable(state:GameState):boolean {
  // Mission04 IntroduceVideo makes Video01 available on ExitPlace Design01.
  return Boolean(state.contract&&state.album)&&(['Mission05','Mission06','Mission07','Mission08','Mission09','Mission10'].includes(state.missionId)||state.missionId==='Mission04'
    &&Boolean(state.scenario?.queue.some(c=>c.id==='ECOCMis4IntroduceVideo')||state.scenario?.seen.includes('ECOCMis4IntroduceVideo')));
}
export function videoOccupies(state:GameState,id:string,day=state.day):boolean {
  const video=currentVideo(state);
  return Boolean(video&&video.bandRequired!==false&&!video.completed&&video.startDay<=day&&day<video.startDay+video.duration
    &&(video.members.length?video.members.includes(id):state.band.some(b=>b?.musicianId===id)));
}
export function canBookVideo(state:GameState,conceptId:string,startDay:number):boolean {
  const concept=rules.concepts.find(c=>c.id===conceptId);
  return Boolean(concept&&state.demo&&state.contract&&state.contract.songId===state.demo.songId&&!currentVideo(state)
    &&canBookCalendar(state,'video',startDay,concept.duration));
}
export function bookVideo(state:GameState,conceptId:string,startDay:number):GameState {
  const concept=rules.concepts.find(c=>c.id===conceptId);
  if(!videoAvailable(state))throw new Error('This video studio is not available.');
  if(!concept||!canBookVideo(state,conceptId,startDay))throw new Error('The band is unavailable for those shooting dates.');
  if(state.money<concept.price)throw new Error('You cannot afford this video.');
  return {...state,money:state.money-concept.price,video:{conceptId,albumKey:videoAlbumKey(state)!,startDay,duration:concept.duration,members:[],completed:false,seen:false}};
}
export function advanceVideo(state:GameState):GameState {
  const video=currentVideo(state);
  if(!video||video.completed||state.day<video.startDay)return state;
  const members=video.members.length?video.members:state.band.flatMap(b=>b?[b.musicianId]:[]);
  return {...state,video:{...video,members,completed:state.day>=video.startDay+video.duration}};
}
export function validVideo(state:GameState):boolean {
  const v=state.video;if(v===undefined||v===null)return true;
  const concept=rules.concepts.find(c=>c.id===v.conceptId);
  return Boolean(concept&&typeof v.albumKey==='string'&&Number.isSafeInteger(v.startDay)&&v.startDay>=0
    &&(v.bandRequired===undefined||typeof v.bandRequired==='boolean')&&(v.qualityPenalty===undefined||Number.isFinite(v.qualityPenalty)&&v.qualityPenalty>=0&&v.qualityPenalty<=1)
    &&v.duration===concept.duration&&typeof v.completed==='boolean'&&typeof v.seen==='boolean'
    &&(!v.completed||state.day>=v.startDay+v.duration)&&Array.isArray(v.members)&&v.members.every(id=>typeof id==='string'));
}

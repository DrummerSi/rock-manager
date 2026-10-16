import endings from './mission-endings.json' with { type: 'json' };
import type { GameState } from './model';
import {missionDefinition,type MissionId} from './mission-catalog';
import {albumHype} from './publicity';

export type MissionFailure = 'NoMoney' | 'NoSingersLeft' | 'Scenario';
export interface MissionProgress {
  version: 1;
  missionId: MissionId;
  status: 'active' | 'pending' | 'won' | 'lost';
  pendingWinDay: number | null;
  pendingFailure: MissionFailure | null;
  endedDay: number | null;
  failureReason: MissionFailure | null;
  acknowledged: boolean;
}
type ProgressState = GameState & { missionProgress: MissionProgress };
const progressOf = (state: GameState): MissionProgress | undefined => (state as GameState & { missionProgress?: MissionProgress }).missionProgress;
export const MISSION_ENDINGS = endings;
export function defaultMissionProgress(missionId:MissionId='Mission01'): MissionProgress {
  return { version: 1, missionId, status: 'active', pendingWinDay: null, pendingFailure: null, endedDay: null, failureReason: null, acknowledged: false };
}
/** Record-store ChartEnter latches success; TRMis1Succeeded02 waits a full game day. Radio entry never wins. */
export function evaluateMissionProgress(state: GameState): ProgressState {
  const previous = progressOf(state), progress = { ...(previous ?? defaultMissionProgress(state.missionId)) };
  if (progress.status === 'won' || progress.status === 'lost' || progress.pendingFailure) return { ...state, missionProgress: progress };
  if(state.missionId!=='Mission01'){
    if(state.scenario?.outcome){progress.status=state.scenario.outcome;progress.endedDay=state.day;progress.pendingWinDay=progress.status==='won'?state.day:null;progress.failureReason=progress.status==='lost'?'Scenario':null;}
    return {...state,missionProgress:progress};
  }
  if (state.started && state.publicity.top10Day !== null && progress.pendingWinDay === null) progress.pendingWinDay = state.publicity.top10Day + 1;
  if (progress.pendingWinDay !== null) {
    if (state.day >= progress.pendingWinDay) { progress.status = 'won'; progress.endedDay = progress.pendingWinDay; }
    else progress.status = 'pending';
  }
  return { ...state, missionProgress: progress };
}
/** An unaffordable mandatory payment queues the native warning; an exact-zero balance alone is valid. */
export function recordMissionFailure(state: GameState, reason: MissionFailure): ProgressState {
  const next = evaluateMissionProgress(state);
  if (next.missionProgress.status === 'won' || next.missionProgress.status === 'lost' || next.missionProgress.pendingFailure) return next;
  return { ...next, missionProgress: { ...next.missionProgress, status: 'pending', pendingFailure: reason } };
}
/** Original ECOCOutOfMoney / ECOCNoSingersLeft ButtonOK executes Mission.failed(). */
export function confirmMissionFailure(state: GameState): ProgressState {
  const next = evaluateMissionProgress(state);
  if (!next.missionProgress.pendingFailure) return next;
  return { ...next, missionProgress: { ...next.missionProgress, status: 'lost', failureReason: next.missionProgress.pendingFailure, pendingFailure: null, endedDay: state.day, acknowledged: false } };
}
export function acknowledgeMissionResult(state: GameState): ProgressState {
  const next = evaluateMissionProgress(state);
  if (next.missionProgress.status !== 'won' && next.missionProgress.status !== 'lost') return next;
  return { ...next, missionProgress: { ...next.missionProgress, acknowledged: true } };
}
export interface MissionObjective { id: string; text: string; done: boolean }
/** Five original criteria plus the required sleeve/release step from ECOCMis1IntroduceSleeve. */
export function missionObjectives(state: GameState): MissionObjective[] {
  if(state.missionId!=='Mission01'){
    const released=Boolean(state.album&&state.album.releaseDay<=state.day);
    const done=state.missionId==='Mission03'?[state.demo?.songId==='Sng18',Boolean(state.contract?.approved),released,state.money>missionDefinition(state.missionId).startMoney,['RMCLelle','RMCNille'].every(id=>state.band.some(m=>m?.musicianId===id))]
      :state.missionId==='Mission05'?[Boolean(state.contract),released,(state.publicity.earlierAlbumSales??0)+state.publicity.totalSales>=25000,Boolean(state.tour?.completed&&state.tour.results.length>=3)]
      :state.missionId==='Mission09'?[state.scenario?.outcome==='won']
      :state.missionId==='Mission10'?[state.day>=365]
      :state.missionId==='Mission07'?[state.ownedSongs.length>0,Boolean(state.demo),released,state.publicity.totalSales>=100000,state.scenario?.active.succeed!==undefined]
      :state.missionId==='Mission08'?[state.band.some(Boolean),Boolean(state.demo),state.contract?.labelId==='Record03',state.publicity.totalSales+Number(state.publicity.earlierAlbumSales??0)<=3000,state.scenario?.outcome==='won']
      :state.missionId==='Mission06'?[state.band.filter(Boolean).length>1,Boolean(state.demo),released,(state.publicity.earlierAlbumSales??0)+state.publicity.totalSales>30000]
      :[state.band.filter(Boolean).length>1,state.ownedSongs.length>0,released,albumHype(state)>=.15,state.scenario?.outcome==='won'];
    return missionDefinition(state.missionId).objectives.map((text,i)=>({id:'scenario'+i,text,done:Boolean(done[i])}));
  }
  return [
    { id: 'band', text: 'Put a Band Together', done: state.band.some(m => m?.instrument === 'Vocals') },
    { id: 'song', text: 'Get a Song License', done: state.ownedSongs.length > 0 },
    { id: 'demo', text: 'Record a Demo', done: state.demo !== null },
    { id: 'contract', text: 'Sign a Record Contract', done: state.contract !== null },
    { id: 'release', text: 'Design a cover and release the record', done: state.album !== null && state.album.releaseDay <= state.day },
    { id: 'top10', text: 'Make the Top 10', done: state.publicity.top10Day !== null },
  ];
}
export function missionScore(state: GameState): { assets: number; debts: number; economy: number; concertPoints: number; reviewPoints: number; total: number | null } {
  const assets = state.money, debts = Math.max(0, (state.contract?.advance ?? 0) - state.publicity.advanceRepaid), economy = assets - debts;
  const concertPoints = state.publicity.concertResults.reduce((sum, c) => sum + Math.trunc(5 * c.satisfaction) * 10000, 0);
  // Native Rating is the raw quality, not the remake's rounded 0–5 display stars.
  const reviewPoints = state.publicity.reviews.reduce((sum, r) => sum + Math.trunc(5 * r.quality) * 20000, 0);
  const won = evaluateMissionProgress(state).missionProgress.status === 'won';
  return { assets, debts, economy, concertPoints, reviewPoints, total: won ? Math.round((economy + concertPoints + reviewPoints) / 1000) * 1000 : null };
}
export function missionEnding(state: GameState, albumName = '', careerPoints=0) {
  const progress = evaluateMissionProgress(state).missionProgress;
  const success = progress.status === 'won';
  const definition=missionDefinition(state.missionId);
  const sourceText = success ? definition.success : progress.failureReason === 'NoMoney' ? endings.outOfMoney.text : definition.failure;
  const text = sourceText.replace(/<formatInteger\(¤CPlayer.getTotalPoints\(#Mission09\)\)>/gi,Math.round(careerPoints).toLocaleString('en-GB')).replace(/<¤C(?:album|song)\.name>/gi, albumName).replace(/<¤CBand\.name>/gi, state.bandName);
  const stem=state.missionId.toLowerCase();
  const next=state.missionId==='Mission01'?'Mission03':state.missionId==='Mission03'?'Mission04':state.missionId==='Mission04'?'Mission05':state.missionId==='Mission05'?'Mission06':state.missionId==='Mission06'?'Mission07':state.missionId==='Mission07'?'Mission08':state.missionId==='Mission08'?'Mission09':state.missionId==='Mission09'?'Mission10':null;
  return { title: definition.name, text, picture: state.missionId==='Mission01'?(success?endings.successPicture:endings.failurePicture):stem+(success?'_success01':'_failure01'),
    success, score: missionScore(state), originalNextMissionId: success ? (state.missionId==='Mission01'?endings.nativeNextMissionId:next) : null,
    nextPlayableMissionId: success?next:null, sound: success ? 'recorded-demo-loop' : 'a131', acknowledged: progress.acknowledged };
}
export function validMissionProgress(state: GameState): boolean {
  const p = progressOf(state);
  if (p === undefined) return true;
  if (!p || typeof p !== 'object' || p.version !== 1 || p.missionId !== state.missionId || !['active', 'pending', 'won', 'lost'].includes(p.status) || typeof p.acknowledged !== 'boolean') return false;
  const date = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 365001;
  if (p.pendingWinDay !== null && !date(p.pendingWinDay)) return false;
  if (p.endedDay !== null && (!date(p.endedDay) || p.endedDay > state.day)) return false;
  const reason = (value: unknown) => value === null || value === 'NoMoney' || value === 'NoSingersLeft'||value==='Scenario';
  if (!reason(p.pendingFailure) || !reason(p.failureReason)) return false;
  if (p.status === 'active') return p.pendingWinDay === null && p.pendingFailure === null && p.endedDay === null && p.failureReason === null && !p.acknowledged;
  if (p.status === 'pending') return p.endedDay === null && p.failureReason === null && !p.acknowledged && (p.pendingFailure !== null || p.pendingWinDay !== null);
  if (p.status === 'won') return p.pendingFailure === null && p.failureReason === null && p.pendingWinDay !== null && p.endedDay !== null && p.endedDay >= p.pendingWinDay;
  return p.pendingFailure === null && p.failureReason !== null && p.endedDay !== null;
}

import { effectiveMusicians, bandmateOccupied } from './bandmates';
import type { GameState, Instrument, Musician, Song } from './model';
import originalText from './original-text.json' with {type:'json'};

export type Style = Record<string, number>;
export interface ChannelEffects {
  delay: { active: boolean; mix: number; time: number; decay: number };
  timeShift: { active: boolean; mode: boolean; mix: number; depth: number; freq: number };
}
export const defaultEffects = (): ChannelEffects => ({ delay: { active: false, mix: 0.5, time: 0.6, decay: 0.3 },
  timeShift: { active: false, mode: false, mix: 0.5, depth: 0.2, freq: 0.5 } });
const validEffects = (value: ChannelEffects) => value && typeof value === 'object'
  && [value.delay, value.timeShift].every((fx) => fx && typeof fx.active === 'boolean')
  && typeof value.timeShift.mode === 'boolean'
  && [value.delay.mix, value.delay.time, value.delay.decay, value.timeShift.mix, value.timeShift.depth, value.timeShift.freq]
    .every((number) => Number.isFinite(number) && number >= 0 && number <= 1);
export interface MixChannel { musicianId: string | null; instrument: Instrument; loopId: string; volume: number; pan: number; muted: boolean; effects?: ChannelEffects }
export interface Recording { studioId: string; songId: string; channels: MixChannel[] }
export interface Demo extends Recording { quality: number; songType: number; imageStyle: Style; recordedDay: number }
export interface Contract { labelId: string; songId: string; advance: number; royalty: number; albums: number; signedDay: number }
export interface Studio { id: string; name: string; description: string; price: number; quality: number; channels: number; sessionMusicians: string[] }
export interface Target { id: string; style: Style; tolerance: Style; songType: number; songTypeTolerance: number; minimumQuality: number }
export interface Label { id: string; name: string; description: string; albums: number; minimumAdvance: number; maximumAdvance: number; minimumRoyalty: number; maximumRoyalty: number; targets: Target[] }
export interface Loop { id: string; songId: string; instrument: string; file: string; style: Style }
export interface RecordingRules {
  studios: Studio[]; labels: Label[]; loops: Loop[];
  sessionMusicians: { id: string; name: string; price: number; musicality: number }[];
  defaults: { id: string; songType: number; channels: { loopId: string; volume: number; pan: number }[] }[];
}
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const styles = ['Metal', 'rock', 'Punk', 'Pop', 'Dance', 'Boring'];

export function bandStyle(state: GameState, musicians: Musician[]): Style {
  const influence: Record<Instrument, number> = { Vocals: 1, Guitar: 0.75, Keyboards: 0.6, Drums: 0.25, Bass: 0.5 };
  const members = state.band.flatMap((member) => member ? [{ musician: musicians.find((m) => m.id === member.musicianId)!, weight: influence[member.instrument] }] : []);
  const weight = members.reduce((sum, m) => sum + m.weight, 0);
  return Object.fromEntries(styles.map((style) => [style, weight ? members.reduce((sum, m) => sum + (m.musician.style?.[style] ?? 0) * m.weight, 0) / weight : 0]));
}

export function startRecording(state: GameState, rules: RecordingRules, studioId: string, songId: string): GameState {
  const studio = rules.studios.find((s) => s.id === studioId);
  if (!studio || !state.ownedSongs.includes(songId) || !state.band.some(Boolean)) throw new Error('Hire at least one musician and buy a song license before recording.');
  if (state.band.some(member => member && state.bandmates.training.some(t => !t.completed && t.musicianId === member.musicianId && t.startDay <= state.day && state.day < t.startDay + t.duration)))
    throw new Error('A band member is away on training or holiday. Wait until the band is complete before recording.');
  if (state.contract) throw new Error('This demo is already signed to a label.');
  if (state.recording) throw new Error('Finish the current recording session first.');
  if (state.money < studio.price) throw new Error('You cannot afford this studio.');
  const defaults = rules.defaults.find((s) => s.id === songId)!.channels;
  const available = rules.loops.filter((l) => l.songId === songId);
  const used = new Set<string>();
  const members = state.band.flatMap((member) => member ? [member] : []);
  const priority = (instrument: string) => defaults.findIndex((c) => available.find((l) => l.id === c.loopId)?.instrument === instrument);
  members.sort((a, b) => priority(a.instrument) - priority(b.instrument));
  const channels = Array.from({ length: studio.channels }, (_, index): MixChannel => {
    const member = members[index];
    const choices = available.filter((l) => l.instrument === (member?.instrument ?? 'Guitar'));
    const preferred = defaults.find((c) => choices.some((l) => l.id === c.loopId) && !used.has(c.loopId));
    const loop = available.find((l) => l.id === preferred?.loopId) ?? choices.find((l) => !used.has(l.id)) ?? choices[0];
    used.add(loop.id);
    return { musicianId: member?.musicianId ?? null, instrument: loop.instrument as Instrument, loopId: loop.id,
      volume: preferred?.volume ?? 70, pan: preferred?.pan ?? 0, muted: !member };
  });
  return { ...state, selectedSong: songId, money: state.money - studio.price, recording: { studioId, songId, channels } };
}

export function updateChannel(state: GameState, index: number, patch: Partial<Pick<MixChannel, 'volume' | 'pan' | 'muted' | 'loopId' | 'effects'>>, rules: RecordingRules): GameState {
  if (!state.recording || !state.recording.channels[index]) throw new Error('No recording channel selected.');
  const old = state.recording.channels[index];
  if (patch.loopId && !rules.loops.some((l) => l.id === patch.loopId && l.songId === state.recording!.songId && l.instrument === old.instrument)) throw new Error('This track cannot be used on this channel.');
  if (patch.effects !== undefined && !validEffects(patch.effects)) throw new Error('Invalid effect settings.');
  const channel = { ...old, ...patch, volume: Math.round(clamp(patch.volume ?? old.volume, 0, 100)), pan: Math.round(clamp(patch.pan ?? old.pan, -100, 100)) };
  return { ...state, recording: { ...state.recording, channels: state.recording.channels.map((c, i) => i === index ? channel : c) } };
}

export function chooseSessionMusician(state: GameState, rules: RecordingRules, channelIndex: number, id: string | null): GameState {
  const recording = state.recording, channel = recording?.channels[channelIndex];
  const studio = rules.studios.find((s) => s.id === recording?.studioId);
  if (!recording || !channel || !studio) throw new Error('No recording session.');
  const original = state.band.find((b) => b?.instrument === channel.instrument && !recording.channels.some((c, i) => i !== channelIndex && c.musicianId === b.musicianId));
  const musician = rules.sessionMusicians.find((m) => m.id === id && studio.sessionMusicians.includes(m.id));
  if (id !== null && !musician) throw new Error('That session musician is unavailable.');
  if (id === channel.musicianId || id === null && channel.musicianId === original?.musicianId) return state;
  const price = musician?.price ?? 0;
  if (state.money < price) throw new Error('You cannot afford this session musician.');
  return { ...state, money: state.money - price, recording: { ...recording,
    channels: recording.channels.map((c, i) => i === channelIndex ? { ...c, musicianId: musician?.id ?? original?.musicianId ?? null, muted: !musician && !original } : c) } };
}

export function finishRecording(state: GameState, rules: RecordingRules, musicians: Musician[], songs: Song[]): GameState {
  const recording = state.recording;
  if (!recording) throw new Error('No recording session.');
  const studio = rules.studios.find((s) => s.id === recording.studioId)!;
  const song = songs.find((s) => s.id === recording.songId)!;
  musicians = effectiveMusicians(state, musicians);
  const active = recording.channels.filter((c) => c.musicianId && !c.muted && c.volume > 0);
  if (!active.length) throw new Error('Turn up at least one channel with a musician before finishing the demo.');
  let sum = 0, weight = 0;
  for (const channel of active) {
    const musician = musicians.find((m) => m.id === channel.musicianId) ?? rules.sessionMusicians.find((m) => m.id === channel.musicianId)!;
    const w = Math.min(1, channel.volume / 30) * (channel.instrument === 'Vocals' ? 1.3 : 1);
    weight += w; sum += w * musician.musicality;
  }
  // MixerScript.calcAlbumSettings. The preceding effects helper's quality
  // penalties are overwritten in the shipped script; its song-type changes remain.
  const channelBonus = [-0.3, -0.2, -0.1, 0, 0][active.length - 1];
  const quality = clamp(channelBonus + (0.25 * song.quality + sum / weight + 0.25 * studio.quality) / 1.5);
  const count = (instrument: string) => active.filter((c) => c.volume >= 20 && c.instrument === instrument).length;
  let songType = rules.defaults.find((s) => s.id === song.id)!.songType;
  if (!count('Guitar') && !count('Keyboards')) songType -= count('Bass') === 1 ? 0.1 : count('Bass') === 0 ? 0.2 : 0;
  if (count('Bass') >= 3) songType -= 0.1;
  if (!count('Drums')) songType -= 0.1;
  else if (count('Drums') >= 3) songType -= 0.2;
  if (count('Keyboards') >= 3) songType -= 0.15;
  if (!count('Vocals')) songType -= 0.35;
  return { ...state, recording: null, demo: { ...recording, quality, songType, imageStyle: bandStyle(state, musicians), recordedDay: state.day } };
}

export type DemoReasonKind = 'quality' | 'SongType' | 'StyleMix' | 'StyleMixTotal' | 'LiveReputation' | 'NoDemo';
type FeedbackScore = {score:number;path:string[]};
export interface DemoEvaluation {accepted:boolean;like:number;reason:string;targetId:string;reasonKind:DemoReasonKind;reasonPath:string[]}
const feedbackTranslations = new Map(Object.entries(originalText.translations).map(([key,value])=>[key.toLowerCase(),value]));
const feedbackString=(key:string)=>feedbackTranslations.get(key.toLowerCase())??feedbackTranslations.get('sziddemofbhopeless')!;
/** Native DlgRecordRefuseScript selects audio from the worst reason, never the rendered prose. */
export function demoRefusalVoice(labelId:string,reasonKind:DemoReasonKind,alreadyContracted=false):string {
  const suffix=alreadyContracted?'cb0800x':({quality:'cb0300x',LiveReputation:'cb0400x',SongType:'cb0500x',StyleMix:'cb0600x'} as Partial<Record<DemoReasonKind,string>>)[reasonKind]??'cb0200z';
  return 'r'+labelId.slice(-2)+suffix;
}
function nativeDemoFeedback(scores:FeedbackScore[],like:number,penalty:number,labelName:string,reputation:number):string {
  const quality=scores.find(s=>s.path[0]==='quality')!,total=scores.find(s=>s.path[0]==='StyleMixTotal')!;
  const song=scores.find(s=>s.path[0]==='SongType')??{score:.01,path:['SongType','ignore']};
  const style=scores.filter(s=>s.path[0]==='StyleMix').sort((a,b)=>a.score-b.score)[0]??{score:1,path:['StyleMixTotal']};
  const comment=(item:FeedbackScore)=>{
    // comesBeforeValInList returns the first threshold above the score.
    const level=item.score < -10?'Bad3':item.score < -1?'Bad2':item.score < 0?'Bad1':item.score < .5?'Good1':'Good2';
    return feedbackString('szidDemoFb'+item.path.join('')+level);
  };
  let result='';const comments:{kind:'Good'|'Bad';value:string}[]=[];
  if(quality.score>0){
    if(style.score>=0){if(song.score<=0){comments.push({kind:'Good',value:comment(quality.score>total.score?quality:total)},{kind:'Bad',value:comment(song)});}}
    else comments.push({kind:'Good',value:comment(quality)},{kind:'Bad',value:comment(style.score<=song.score?style:song)});
  }else if(style.score>=0)comments.push({kind:'Good',value:comment(total)},{kind:'Bad',value:comment(song.score<quality.score?song:quality)});
  else if(like>-.5){for(const item of [style,song,quality].sort((a,b)=>a.score-b.score).slice(0,2))comments.push({kind:'Bad',value:comment(item)});}
  else result=feedbackString('szidDemoFbHopeless');
  if(comments.length){result=feedbackString('szidDemoFb'+comments.map(c=>c.kind).join(''));const counts={Good:0,Bad:0};for(const c of comments){const key=c.kind.toLowerCase()+(++counts[c.kind]);result=result.replaceAll('<'+key+'>',c.value);}}
  result=result.replaceAll('<¤CPlace.Name>',labelName);
  if(reputation<.3&&penalty>-.3)result+=(result?' ':'')+feedbackString(result?'szidDemoFbLiveReputation':'szidDemoFbLiveReputationOnly');
  return result;
}
export function evaluateDemo(state: GameState, label: Label, musicians: Musician[]): DemoEvaluation {
  if (!state.demo) return { accepted: false, like: 0, reason: 'Record a demo before approaching a label.', targetId: '',reasonKind:'NoDemo',reasonPath:['NoDemo'] };
  const demo = state.demo, music = bandStyle(state, musicians);
  const toleranceScore = (center: number, tolerance: number, actual: number) => tolerance >= 2 ? 1 : 1 - Math.abs(center - actual) / tolerance;
  const results = label.targets.map((target) => {
    const styleScores = styles.filter((s) => target.tolerance[s] > 0).map((s) => ({ score: toleranceScore(target.style[s], target.tolerance[s], (music[s] + demo.imageStyle[s]) / 2), path:['StyleMix',s,(music[s]+demo.imageStyle[s])/2>target.style[s]?'Hi':'Lo'] }));
    const styleScore = styleScores.reduce((sum, s) => sum + s.score, 0) / (styleScores.length || 1);
    const difference = demo.quality - target.minimumQuality;
    const qualityScore = difference < 0 ? difference * 2 : difference / (difference + 0.1);
    const scores:FeedbackScore[] = [...styleScores, { score: styleScore,path:['StyleMixTotal'] },
      { score: qualityScore,path:['quality'] }];
    const likes = [styleScore, qualityScore];
    if (target.songTypeTolerance > 0) {
      const score = toleranceScore(target.songType, target.songTypeTolerance, demo.songType);
      scores.push({ score,path:['SongType',demo.songType>target.songType?'Hi':'Lo'] }); likes.push(score);
    }
    const penalty = scores.reduce((sum, s) => sum + Math.min(0, s.score), 0);
    scores.sort((a, b) => a.score - b.score);
    const accepted=penalty>=-1e-9,like=likes.reduce((sum,s)=>sum+s,0)/likes.length;
    return { accepted,like,reason:accepted?'':nativeDemoFeedback(scores,like,penalty,label.name,state.publicity.liveReputation),targetId:target.id,
      reasonKind:scores[0].path[0] as DemoReasonKind,reasonPath:[...scores[0].path] };
  });
  // Original chooses the target with highest overall liking, not lowest penalty.
  return results.sort((a, b) => b.like - a.like)[0];
}

export function contractOffers(label: Label, like: number): { advance: number; royalty: number }[] {
  const difference = label.maximumAdvance - label.minimumAdvance;
  const center = label.minimumAdvance + difference / 4 + Math.max(0, like) * difference / 2;
  const steps = Math.round((label.maximumRoyalty - label.minimumRoyalty) * 100);
  return Array.from({ length: steps + 1 }, (_, i) => ({
    royalty: Math.round(label.minimumRoyalty * 100 + i) / 100,
    advance: Math.round((steps ? center + difference / 4 - difference / 2 / steps * i : center) / 1000) * 1000,
  }));
}

export function signContract(state: GameState, label: Label, musicians: Musician[], offerIndex: number): GameState {
  if (state.contract || state.recording || !state.demo || !state.band.some(Boolean)) throw new Error('This demo is unavailable for a new contract.');
  const result = evaluateDemo(state, label, musicians);
  if (!result.accepted) throw new Error(result.reason);
  const offer = contractOffers(label, result.like)[offerIndex];
  if (!offer) throw new Error('This contract offer is unavailable.');
  return { ...state, money: state.money + offer.advance,
    contract: { ...offer, labelId: label.id, songId: state.demo.songId, albums: label.albums, signedDay: state.day } };
}

export function validRecordingProgress(state: GameState, musicians: Musician[], rules?: RecordingRules): boolean {
  const checkRecording = (r: Recording) => r && ['Studio01', 'Studio04'].includes(r.studioId) && state.ownedSongs.includes(r.songId)
    && Array.isArray(r.channels) && r.channels.length === (r.studioId === 'Studio01' ? 5 : 4)
    && r.channels.every((c) => c && typeof c.muted === 'boolean' && Number.isInteger(c.volume) && c.volume >= 0 && c.volume <= 100
      && Number.isInteger(c.pan) && c.pan >= -100 && c.pan <= 100
      && (c.musicianId === null || musicians.some((m) => m.id === c.musicianId) || ['Stud02', 'Stud03', 'Stud04'].includes(c.musicianId))
      && typeof c.loopId === 'string' && /^LO\d{2}(Dr[123]|Kb[123]|Bs[123]|Gt[123]|Vc)$/.test(c.loopId)
      && ['Guitar', 'Keyboards', 'Drums', 'Bass', 'Vocals'].includes(c.instrument)
      && (c.effects === undefined || validEffects(c.effects))
      && (!rules || rules.loops.some((l) => l.id === c.loopId && l.songId === r.songId && l.instrument === c.instrument)));
  if (state.recording !== null && !checkRecording(state.recording)) return false;
  if (state.demo !== null && (!checkRecording(state.demo) || !Number.isFinite(state.demo.quality) || state.demo.quality < 0 || state.demo.quality > 1
    || !Number.isFinite(state.demo.songType) || !Number.isInteger(state.demo.recordedDay) || state.demo.recordedDay < 0 || state.demo.recordedDay > state.day
    || !state.demo.imageStyle || styles.some((s) => !Number.isFinite(state.demo!.imageStyle[s]) || state.demo!.imageStyle[s] < 0 || state.demo!.imageStyle[s] > 1))) return false;
  if (state.contract !== null && (!state.demo || state.recording || !['Record01', 'Record03'].includes(state.contract.labelId)
    || state.contract.songId !== state.demo.songId || !Number.isSafeInteger(state.contract.advance) || state.contract.advance < 0
    || !Number.isFinite(state.contract.royalty) || state.contract.royalty < 0.05 || state.contract.royalty > 0.2
    || state.contract.albums !== (state.contract.labelId === 'Record01' ? 3 : 1)
    || !Number.isInteger(state.contract.signedDay) || state.contract.signedDay < state.demo.recordedDay || state.contract.signedDay > state.day)) return false;
  return true;
}

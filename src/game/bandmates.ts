import {missionSpend} from './scenario78';
import {gangstaAway} from './gangsta';
import {videoOccupies} from './video';
import {tourOccupied} from './tour';
import rawRules from './bandmate-rules.json' with { type: 'json' };
import type { GameState, Musician } from './model';

export const BANDMATE_RULES = rawRules;
export type BandmateMood = 'Furious' | 'Angry' | 'Annoyed' | 'normal' | 'Satisfied' | 'Happy';
export type BandmateStat = 'mood' | 'health' | 'musicality' | 'charisma' | 'patience';
export interface BandmateModifier { id: string; musicianId: string; stat: BandmateStat; amount: number; startDay: number; duration: number; otherId?: string;constant?:boolean }
export interface BandmatePerson { musicianId: string; mood: number; health: number; musicality: number; charisma: number; patience: number; needs: Record<string, number>; gifts: string[]; fired: boolean }
export interface BandmateTraining { id: string; musicianId: string; actionId: string; type: string; startDay: number; duration: number; completed: boolean }
export interface BandmateSpeech { musicianId: string; template: string; actionId: string }
export interface BandmatesState { lastDay: number; nextId: number; people: BandmatePerson[]; modifiers: BandmateModifier[]; training: BandmateTraining[]; pendingBooze: { musicianId: string; amount: number }[]; lastSpeech: BandmateSpeech | null; completions: { id: string; musicianId: string; actionId: string; day: number; seen: boolean }[] }
type WithBandmates = GameState & { bandmates: BandmatesState };
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const sourceActor = (id: string) => rawRules.musicians.find(m => m.id === id);
export function defaultBandmates(state?: Pick<GameState, 'day'>, musicians?: Musician[]): BandmatesState {
  return { lastDay: state?.day ?? 0, nextId: 1, people: (musicians ?? rawRules.musicians.filter(m => rawRules.missionMusicians.includes(m.id))).map(m => {
    const original = sourceActor(m.id)!;
    return { musicianId: m.id, mood: original.mood, health: original.health, musicality: original.musicality, charisma: original.charisma, patience: original.patience,
      needs: Object.fromEntries(Object.keys(original.needs).map(n => [n, 0])), gifts: [], fired: false };
  }), modifiers: [], training: [], pendingBooze: [], lastSpeech: null, completions: [] };
}
const current = (state: GameState) => (state as WithBandmates).bandmates ?? defaultBandmates(state);
const copy = (state: GameState): WithBandmates => ({ ...state, bandmates: structuredClone(current(state)) });
const fading = (m: BandmateModifier, day: number) => m.constant?m.amount:m.amount * clamp(1 - (day - m.startDay) / m.duration);
function bandmateAttitude(state: GameState, id: string, otherId: string): number {
  const base = (sourceActor(id)!.attitudes as Record<string, number | undefined>)[otherId] ?? 0;
  const adjustments = current(state).modifiers.filter(m => m.musicianId === id && m.otherId === otherId).reduce((n, m) => n + fading(m, state.day), 0);
  return clamp(base + adjustments, -1, 1);
}
// ClassRealMusician.getIsOccupied excludes ordinary Concert events.
export function bandmateOccupied(state: GameState, id: string, day = state.day): boolean {
  return tourOccupied(state,id,day)||state.scenario?.appointments.some(a=>['hospital','prison','award'].includes(a.kind)&&!a.completed&&(!a.actorId||a.actorId===id)&&a.startDay<=day&&day<a.startDay+a.duration)||gangstaAway(state,id,day)||videoOccupies(state,id,day)||current(state).training.some(t => !t.completed && t.musicianId === id && t.startDay <= day && day < t.startDay + t.duration);
}
export function bandmateStats(state: GameState, id: string): BandmatePerson {
  const saved = current(state).people.find(p => p.musicianId === id);
  if (!saved) throw new Error('Unknown musician.');
  const result = structuredClone(saved);
  if(state.missionId==='Mission04'&&state.band.filter(Boolean).length===1&&state.band.some(m=>m?.musicianId===id))result.mood-=.16;
  for (const modifier of current(state).modifiers.filter(m => m.musicianId === id && !m.otherId)) result[modifier.stat] += fading(modifier, state.day);
  for (const [need, value] of Object.entries(result.needs)) {
    const penalty = Math.max(0, value - .2) * .1;
    result.mood -= penalty;
    if (need === 'NeedVacation') result.health -= penalty;
  }
  for (const member of state.band) {
    if (!member || member.musicianId === id || bandmateOccupied(state, member.musicianId)) continue;
    result.mood += .3 * bandmateAttitude(state, id, member.musicianId);
  }
  for (const stat of ['mood', 'health', 'musicality', 'charisma', 'patience'] as const) result[stat] = clamp(result[stat]);
  return result;
}
export function bandmateMood(state: GameState, id: string): BandmateMood {
  const mood = bandmateStats(state, id).mood;
  return mood <= .1 ? 'Furious' : mood <= .2 ? 'Angry' : mood <= .35 ? 'Annoyed' : mood <= .65 ? 'normal' : mood <= .8 ? 'Satisfied' : 'Happy';
}
export function bandmateGreeting(state: GameState, id: string): string { return `a${sourceActor(id)!.graphics.slice(-2)}rb${['Furious', 'Angry', 'Annoyed'].includes(bandmateMood(state, id)) ? '02' : '01'}00X`; }
interface ConcernModifier { id: string; stat: BandmateStat; amount: number; otherId?: string }
function concernModifiers(state: GameState, id: string): ConcernModifier[] {
  const p = bandmateStats(state, id);
  const modifiers: ConcernModifier[] = current(state).modifiers.filter(m => m.musicianId === id && !m.otherId).map(m => ({ id: m.id, stat: m.stat, amount: fading(m, state.day) }));
  for (const [need, value] of Object.entries(p.needs)) {
    const amount = -.1 * Math.max(0, value - .2);
    modifiers.push({ id: need, stat: 'mood', amount });
    if (need === 'NeedVacation') modifiers.push({ id: need, stat: 'health', amount });
  }
  for (const member of state.band) if (member && member.musicianId !== id && !bandmateOccupied(state, member.musicianId)) {
    modifiers.push({ id: 'Attitude', stat: 'mood', amount: .3 * bandmateAttitude(state, id, member.musicianId), otherId: member.musicianId });
  }
  return modifiers;
}
/** Native rBothersMusician selects two significant modifiers per row: unhappy, happy, unhealthy. */
export function bandmateConcernKeys(state: GameState, id: string): string[][] {
  const modifiers = concernModifiers(state, id);
  return ([['mood', -1], ['mood', 1], ['health', -1]] as const).map(([stat, sign]) => {
    const selected = modifiers.filter(m => m.stat === stat && sign * m.amount > .02).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 2);
    const prefix = stat === 'mood' ? 'szidModMood' : 'szidModHealth';
    return selected.length ? selected.map(m => `${prefix}${m.id}${sign > 0 ? 'P' : 'N'}${Math.abs(m.amount) > .08 ? '2' : '1'}`) : [`${prefix}No${sign > 0 ? 'Pos' : 'Neg'}`];
  });
}
/** Resolves the source localized comments, including actor names and native level fallback. */
export function bandmateConcerns(state: GameState, id: string, musicians: Musician[], translation: Record<string, string>, short = false): string[] {
  const modifiers = concernModifiers(state, id);
  const resolve = (key: string): string => {
    const visited = new Set<string>();
    let value = translation[key] ?? '';
    while (Object.hasOwn(translation, value) && !visited.has(value)) { visited.add(value); value = translation[value]; }
    return value;
  };
  return ([['mood', -1], ['mood', 1], ['health', -1]] as const).map(([stat, sign]) => {
    const prefix = stat === 'mood' ? 'szidModMood' : 'szidModHealth';
    const ranked = modifiers.filter(m => m.stat === stat && sign * m.amount > .02).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const comments: string[] = [];
    for (const modifier of ranked) {
      const key = `${prefix}${modifier.id}${sign > 0 ? 'P' : 'N'}`;
      const level = Math.abs(modifier.amount) > .08 ? '2' : '1';
      let comment = resolve(key + level);
      if (!comment && level === '2') comment = resolve(key + '1');
      if (!comment) continue;
      const firstName = modifier.otherId ? musicians.find(m => m.id === modifier.otherId)?.name.split(/\s+/)[0] ?? '' : '';
      comment = comment.replace(/<TmpName>/gi, firstName);
      comments.push(comment);
      if (comments.length === 2) break;
    }
    const text = comments.length ? comments.join(', ') : resolve(`${prefix}No${sign > 0 ? 'Pos' : 'Neg'}`);
    return short && text.length > 37 ? text.slice(0, 37) + '...' : text;
  });
}
export function effectiveMusicians(state: GameState, musicians: Musician[]): Musician[] {
  return musicians.map(m => { const p = current(state).people.find(p => p.musicianId === m.id); return p ? { ...m, salary: Number(state.scenario?.vars['salary:'+m.id] ?? m.salary), ...Object.fromEntries((['mood', 'health', 'musicality', 'charisma'] as const).map(k => [k, bandmateStats(state, m.id)[k]])) } : m; });
}
function requireMember(state: GameState, id: string) {
  if (!state.band.some(m => m?.musicianId === id)) throw new Error('That musician is not in your band.');
  if (bandmateOccupied(state, id)) throw new Error('This artist is currently away.');
}
function purchase(state: GameState, id: string, actionId: string) {
  requireMember(state, id);
  const action = rawRules.actions.find(a => a.id === actionId);
  if (!action) throw new Error('Unknown bandmate action.');
  if (state.money < action.price) throw new Error('You cannot afford this action.');
  return action;
}
function speech(next: WithBandmates, id: string, actionId: string, suffix: string) { next.bandmates.lastSpeech = { musicianId: id, actionId, template: `a${sourceActor(id)!.graphics.slice(-2)}${suffix}` }; }
function modifier(next: WithBandmates, id: string, name: string, stat: BandmateStat, amount: number, duration: number, otherId?: string) {
  next.bandmates.modifiers.push({ id: name, musicianId: id, stat, amount, startDay: next.day, duration, ...(otherId ? { otherId } : {}) });
}
export function availableBandmateActions(state: GameState, id: string, categoryId: string): typeof rawRules.actions {
  const category = rawRules.categories.find(c => c.id === categoryId);
  const person = current(state).people.find(p => p.musicianId === id);
  if (!person) return [];
  // DlgActionChooseScript iterates ActionIDs in the category's own order.
  return (category?.actions ?? []).map(id => rawRules.actions.find(a => a.id === id)!)
    .filter(a => a && (!a.once || !person.gifts.includes(a.id)));
}
export function giveBandmateGift(state: GameState, id: string, actionId: string, _musicians?: Musician[]): GameState {
  const action = purchase(state, id, actionId);
  if (!rawRules.categories.find(c => c.id === 'ActCatMusicianGifts')!.actions.includes(actionId)) throw new Error('Not a musician gift.');
  const next = missionSpend(copy(state),'gifts',action.price), person = next.bandmates.people.find(p => p.musicianId === id)!;
  if (action.once && person.gifts.includes(actionId)) throw new Error('This artist already received that gift.');
  next.money -= action.price;
  if (action.once) {
    person.gifts.push(actionId);
    const accepted = ((sourceActor(id)!.attitudes as Record<string, number | undefined>)[actionId] ?? 0) >= 0;
    if (accepted) modifier(next, id, 'Gift', 'mood', action.moodBoost, action.boostDays);
    speech(next, id, actionId, accepted ? 'rc0100z' : 'rc0200z');
  } else {
    const beer = actionId === 'ActGiftDrink01', wants = person.needs.NeedParty > 0;
    speech(next, id, actionId, `rc${beer ? wants ? '04' : '07' : wants ? '03' : '06'}00X`);
    next.bandmates.pendingBooze.push({ musicianId: id, amount: beer ? .3 : .5 });
  }
  return next;
}
/** Native booze trigger fires on ExitToCity, after closing the rehearsal room. */
export function applyBandmateExitToCity(state: GameState): GameState {
  if (!current(state).pendingBooze.length) return state;
  const next = copy(state);
  for (const pending of next.bandmates.pendingBooze) {
    const person = next.bandmates.people.find(p => p.musicianId === pending.musicianId)!;
    person.needs.NeedParty = 0;
    modifier(next, person.musicianId, 'NeedPartySatisfied', 'health', -.3 * pending.amount, 3);
    modifier(next, person.musicianId, 'NeedPartySatisfied', 'patience', .2 * pending.amount, 3);
  }
  next.bandmates.pendingBooze = [];
  return next;
}
export function canTrainBandmate(state: GameState, id: string, actionId: string, startDay: number): boolean {
  const action = rawRules.actions.find(a => a.id === actionId && a.trainingType);
  if (!action || !Number.isSafeInteger(startDay) || startDay <= state.day || startDay > state.day + 100 || !state.band.some(m => m?.musicianId === id)) return false;
  for (let day = startDay; day < startDay + action.duration; day++) if (bandmateOccupied(state, id, day)||state.publicity.concerts.some(c=>!c.completed&&c.startDay<=day&&day<c.startDay+c.duration)||state.scenario?.appointments.some(a=>!a.completed&&(!a.actorId||a.actorId===id)&&a.startDay<=day&&day<a.startDay+a.duration)) return false;
  // Native album releases occupy NotOnTour, without the Band resource. Training may overlap.
  return true;
}
export function trainBandmate(state: GameState, id: string, actionId: string, startDay = state.day + 2, _musicians?: Musician[]): GameState {
  const action = purchase(state, id, actionId);
  if (!canTrainBandmate(state, id, actionId, startDay)) throw new Error('The artist cannot attend training on those dates.');
  const stats = bandmateStats(state, id), next = copy(state);
  next.money -= action.price;
  next.bandmates.training.push({ id: `training${next.bandmates.nextId++}`, musicianId: id, actionId, type: action.trainingType!, startDay, duration: action.duration, completed: false });
  const positive = stats.mood >= .3;
  const suffix = action.trainingType === 'Physics' ? `rd${positive ? '03' : '07'}00X` : action.trainingType === 'Musicality' ? `rd${positive ? '01' : '05'}00X` : action.trainingType === 'Media' ? `rd${positive ? '02' : '06'}00X` : action.trainingType === 'Detox' ? `rd${stats.needs.NeedVacation > .2 ? '04' : '08'}00X` : `rc${stats.needs.NeedVacation > .2 ? '05' : '08'}001`;
  speech(next, id, actionId, suffix);
  return next;
}
export function changeBandmateRelations(state: GameState, id: string, actionId: string): GameState {
  const action = purchase(state, id, actionId);
  if (!['ActRelationBackTalk', 'ActRelationFrontTalk'].includes(actionId)) throw new Error('Unknown relationship action.');
  const next = copy(state), praise = actionId === 'ActRelationFrontTalk';
  next.money -= action.price;
  for (const member of state.band) if (member) modifier(next, member.musicianId, praise ? 'Praise' : 'Slander', 'mood', praise ? .3 : -.3, 20, id);
  speech(next, id, actionId, praise ? 're0100X' : 're0200X');
  return next;
}
export function fireBandmate(state: GameState, id: string, _musicians?: Musician[]): GameState {
  requireMember(state, id);
  const next = copy(state);
  for (const member of state.band) {
    if (!member || member.musicianId === id) continue;
    const attitude = bandmateAttitude(state, member.musicianId, id);
    if (attitude > 0) modifier(next, member.musicianId, 'KickedBandMember', 'mood', -.1 * attitude, 20);
  }
  next.band = state.band.map(m => m?.musicianId === id ? null : m);
  next.bandmates.people.find(p => p.musicianId === id)!.fired = true;
  next.bandmates.modifiers = next.bandmates.modifiers.filter(m => m.musicianId !== id);
  next.bandmates.training = next.bandmates.training.filter(t => t.musicianId !== id);
  next.bandmates.completions = next.bandmates.completions.filter(c => c.musicianId !== id);
  next.bandmates.pendingBooze = next.bandmates.pendingBooze.filter(p => p.musicianId !== id);
  next.bandmates.lastSpeech = null;
  return next;
}
export function advanceBandmates(state: GameState, _musicians?: Musician[]): GameState {
  if (current(state).lastDay >= state.day) return state;
  const next = copy(state);
  for (let day = next.bandmates.lastDay + 1; day <= state.day; day++) {
    const dated = { ...next, day };
    for (const member of next.band) {
      if (!member) continue;
      const p = next.bandmates.people.find(p => p.musicianId === member.musicianId)!;
      const original = sourceActor(p.musicianId)!;
      for (const [name, maximum] of Object.entries(original.needs)) if (maximum > 0) p.needs[name] += .1 * maximum * (1 - p.needs[name] / maximum);
      p.patience = Math.max(0, p.patience - .01);
      // Health auto-normalizes to the actor's original health. Age determines native gain/loss.
      const curve = [[8, .7], [15, 1], [23, 1], [30, .8], [40, .7], [60, .5], [80, .2]];
      const high = Math.max(1, curve.findIndex(([age]) => age >= original.age));
      const low = curve[high - 1], upper = curve[high];
      const ageFactor = low[1] + (upper[1] - low[1]) * clamp((original.age - low[0]) / (upper[0] - low[0]));
      if (p.health < original.health) p.health = Math.min(original.health, p.health + .01 * ageFactor);
      else if (p.health > original.health) p.health = Math.max(original.health, p.health - .01 * (1 - ageFactor));
    }
    for (const training of next.bandmates.training) {
      if (training.completed || day < training.startDay + training.duration) continue;
      training.completed = true;
      if (!next.band.some(m => m?.musicianId === training.musicianId)) continue;
      const p = next.bandmates.people.find(p => p.musicianId === training.musicianId)!;
      const stats = bandmateStats(dated, p.musicianId);
      const boost = (stat: BandmateStat, amount: number, duration: number) => {
        const adjusted = Math.min(1 - stats[stat], amount * (1 + .2 * (stats.mood - .5)));
        next.bandmates.modifiers.push({ id: `Train${training.type}`, musicianId: p.musicianId, stat, amount: adjusted, startDay: day, duration });
      };
      if (training.type === 'Musicality') boost('musicality', .2, 90);
      else if (training.type === 'Media') boost('charisma', .2, 90);
      else if (training.type === 'Physics') { boost('health', .2, 30); boost('charisma', .1, 30); }
      else if (training.type === 'Vacation') { p.needs.NeedVacation = 0; modifier(dated, p.musicianId, 'NeedVacationSatisfied', 'patience', .05, 3); }
      else if (training.type === 'Detox') { p.needs.NeedVacation = 0; p.needs.NeedParty = 0; boost('health', .2, 90); modifier(dated, p.musicianId, 'NeedVacationSatisfied', 'patience', .01, 3); }
      next.bandmates.completions.push({ id: training.id, musicianId: p.musicianId, actionId: training.actionId, day, seen: false });
    }
  }
  next.bandmates.modifiers = next.bandmates.modifiers.filter(m => m.constant||m.startDay + m.duration > state.day);
  next.bandmates.lastDay = state.day;
  return next;
}
/** Called after publicity settles gigs, using the state immediately before that settlement. */
export function applyBandmateConcertFeedback(previous: GameState, state: GameState): GameState {
  const previousIds = new Set(previous.publicity.concertResults.map(c => c.id));
  const concerts = state.publicity.concertResults.filter(c => !previousIds.has(c.id));
  if (!concerts.length) return state;
  const next = copy(state);
  for (const concert of concerts) for (const member of next.band) if (member) {
    const person = next.bandmates.people.find(p => p.musicianId === member.musicianId)!;
    if (!concert.cancelled) person.needs.NeedLive = 0;
    // Native Concertstop trigger fires even when a concert is cancelled; need satisfaction requires performance.
    next.bandmates.modifiers.push({ id: 'GigBoost', musicianId: member.musicianId, stat: 'musicality', amount: .03, startDay: concert.day, duration: 20 });
  }
  return next;
}
export function validBandmates(state: GameState, musicians?: Musician[]): boolean {
  const b = (state as WithBandmates).bandmates;
  if (!b || !Number.isSafeInteger(b.lastDay) || b.lastDay < 0 || b.lastDay > state.day || !Number.isSafeInteger(b.nextId) || b.nextId < 1) return false;
  const ids = new Set((musicians ?? rawRules.musicians.filter(m => rawRules.missionMusicians.includes(m.id))).map(m => m.id));
  const int = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 365100;
  if (!Array.isArray(b.people) || b.people.length !== ids.size || b.people.some(p => !p || typeof p !== 'object') || new Set(b.people.map(p => p.musicianId)).size !== b.people.length || !Array.isArray(b.modifiers) || !Array.isArray(b.training) || !Array.isArray(b.pendingBooze) || !Array.isArray(b.completions)) return false;
  if (b.training.some(t => !t || typeof t !== 'object') || new Set(b.training.map(t => t.id)).size !== b.training.length || b.completions.some(c => !c || typeof c !== 'object') || new Set(b.completions.map(c => c.id)).size !== b.completions.length) return false;
  return b.people.every(p => p && ids.has(p.musicianId) && typeof p.fired === 'boolean' && ['mood', 'health', 'musicality', 'charisma', 'patience'].every(k => Number.isFinite(p[k as BandmateStat]) && p[k as BandmateStat] >= 0 && p[k as BandmateStat] <= 1) && p.needs && Object.entries(p.needs).every(([k, v]) => /^Need\w+$/.test(k) && Number.isFinite(v) && v >= -1 && v <= 1) && Array.isArray(p.gifts) && p.gifts.every(g => rawRules.actions.some(a => a.id === g && a.once)) && new Set(p.gifts).size === p.gifts.length)
    && b.modifiers.every(m => m && ids.has(m.musicianId) && ['mood', 'health', 'musicality', 'charisma', 'patience'].includes(m.stat) && Number.isFinite(m.amount) && Math.abs(m.amount) <= (m.otherId?2:1) && int(m.startDay) && int(m.duration) && m.duration > 0 && (m.constant===undefined||typeof m.constant==='boolean') && (!m.otherId || ids.has(m.otherId)))
    && b.training.every(t => t && /^training\d+$/.test(t.id) && ids.has(t.musicianId) && rawRules.actions.some(a => a.id === t.actionId && a.trainingType === t.type && a.duration === t.duration) && int(t.startDay) && typeof t.completed === 'boolean' && (!t.completed || t.startDay + t.duration <= state.day))
    && b.pendingBooze.every(p => p && ids.has(p.musicianId) && [ .3, .5 ].includes(p.amount))
    && b.completions.every(c => c && ids.has(c.musicianId) && int(c.day) && c.day <= state.day && typeof c.seen === 'boolean' && b.training.some(t => t.id === c.id && t.completed && t.musicianId === c.musicianId && t.actionId === c.actionId && t.startDay + t.duration === c.day))
    && (b.lastSpeech === null || (typeof b.lastSpeech === 'object' && ids.has(b.lastSpeech.musicianId) && rawRules.actions.some(a => a.id === b.lastSpeech!.actionId) && /^a\d{2}r[bcde]\d{4}[Xxz1]$/.test(b.lastSpeech.template)));
}

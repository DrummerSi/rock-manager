import { defaultBandmates, advanceBandmates, validBandmates, effectiveMusicians, applyBandmateConcertFeedback, type BandmatesState } from './bandmates';
import { defaultPublicity, advancePublicity, validPublicity, type PublicityState } from './publicity';
import type { Album } from './design';
import { validAlbum } from './design';
import type { Contract, Demo, Recording, RecordingRules, Style } from './recording';
import { validRecordingProgress } from './recording';
import { evaluateMissionProgress, recordMissionFailure, validMissionProgress, type MissionProgress } from './mission-progress';
export const SLOT_INSTRUMENTS = [
  ['Guitar', 'Keyboards'], ['Guitar', 'Keyboards'], ['Drums'], ['Bass'], ['Vocals'],
] as const;
export type Instrument = 'Guitar' | 'Keyboards' | 'Drums' | 'Bass' | 'Vocals';
export const SLOT_NAMES = ['Guitar / keys', 'Guitar / keys', 'Drums', 'Bass', 'Vocals'];

export interface Musician {
  id: string; name: string; gender?: string; age: number; salary: number; description: string; genre: string;
  musicality: number; mood: number; health: number; skills: Record<string, number>;
  instrumentGraphics?: Record<string, string | null>;
  charisma?: number;
  style?: Style;
  smallPortrait?: string;
}
export interface BandMember { musicianId: string; instrument: Instrument }
export interface Song { id: string; name: string; description: string; genre: string; price: number; royalty: number; quality: number; songType?: number }
export interface GameState {
  version: 1; missionId: 'Mission01'; started: boolean; bandName: string; money: number;
  day: number; startDate: string; band: (BandMember | null)[]; muted: boolean; audioVersion?: number;
  ownedSongs: string[]; selectedSong: string | null;
  tutorialEnabled: boolean; seenTutorials: string[];
  tutorialAcknowledgedDays?: Record<string, number>; bandNameChanged?: boolean;
  missionProgress?: MissionProgress;
  recording: Recording | null; demo: Demo | null; contract: Contract | null; album: Album | null; publicity: PublicityState; bandmates: BandmatesState;
}

export function newGame(startMoney: number, date = new Date()): GameState {
  const startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { version: 1, missionId: 'Mission01', started: false, bandName: 'The Unknowns', money: startMoney,
    day: 0, startDate, band: Array.from({ length: 5 }, () => null), muted: false, audioVersion: 1, ownedSongs: [], selectedSong: null,
    tutorialEnabled: true, seenTutorials: [], recording: null, demo: null, contract: null, album: null, publicity: defaultPublicity(), bandmates: defaultBandmates() };
}

export function licenseSong(state: GameState, songs: Song[], id: string): GameState {
  const song = songs.find((s) => s.id === id);
  if (!song || state.ownedSongs.includes(id)) throw new Error('This song is unavailable.');
  if (state.money < song.price) throw new Error('You cannot afford this license.');
  return { ...state, money: state.money - song.price, ownedSongs: [...state.ownedSongs, id], selectedSong: id };
}

export function candidates(state: GameState, musicians: Musician[], slot: number): Musician[] {
  const allowed = SLOT_INSTRUMENTS[slot] as readonly string[] | undefined;
  if (!allowed) return [];
  return musicians.filter((m) => !state.band.some((b) => b?.musicianId === m.id)
    && !state.bandmates?.people.find(p => p.musicianId === m.id)?.fired
    && allowed.some((instrument) => m.skills[instrument] > 0))
    .sort((a, b) => a.salary - b.salary || a.name.localeCompare(b.name));
}

export function recruit(state: GameState, musicians: Musician[], slot: number, id: string, instrument: Instrument): GameState {
  const musician = candidates(state, musicians, slot).find((m) => m.id === id);
  const allowed = SLOT_INSTRUMENTS[slot] as readonly string[] | undefined;
  if (state.band[slot] || !musician || !allowed?.includes(instrument) || !(musician.skills[instrument] > 0)) {
    throw new Error('That musician cannot fill this position.');
  }
  return { ...state, band: state.band.map((member, index) => index === slot ? { musicianId: id, instrument } : member) };
}

export function advanceDay(state: GameState, musicians: Musician[]): { state: GameState; wages: number; unpaid: number } {
  if (state.missionProgress && (['won','lost'].includes(state.missionProgress.status) || state.missionProgress.pendingFailure))
    return {state,wages:0,unpaid:0};
  const day = state.day + 1;
  let money = state.money, wages = 0, unpaid = 0;
  if (day % 7 === 0) {
    for (const member of state.band) {
      if (!member) continue;
      const salary = musicians.find((m) => m.id === member.musicianId)?.salary ?? 0;
      if (money >= salary) { money -= salary; wages += salary; } else { unpaid += salary; }
    }
  }
  const progressed = advanceBandmates({ ...state, day, money }, musicians);
  const settled = advancePublicity(progressed, effectiveMusicians(progressed, musicians));
  const next=applyBandmateConcertFeedback(progressed, settled);
  return { state: unpaid ? recordMissionFailure(next,'NoMoney') : evaluateMissionProgress(next), wages, unpaid };
}

export function calendarDate(state: GameState): string {
  const [year, month, day] = state.startDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + state.day));
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function validSave(value: unknown, musicians: Musician[], songs?: Song[], rules?: RecordingRules): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<GameState>;
  if (s.version !== 1 || s.missionId !== 'Mission01' || typeof s.started !== 'boolean'
    || typeof s.muted !== 'boolean' || typeof s.bandName !== 'string' || s.bandName.length > 28
    || !Number.isSafeInteger(s.money) || s.money! < 0 || !Number.isSafeInteger(s.day) || s.day! < 0 || s.day! > 365000
    || typeof s.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.startDate)
    || !Number.isFinite(Date.parse(s.startDate)) || !Array.isArray(s.band) || s.band.length !== 5) return false;
  const seen = new Set<string>();
  if (s.bandNameChanged !== undefined && typeof s.bandNameChanged !== 'boolean') return false;
  if (s.tutorialAcknowledgedDays !== undefined && (typeof s.tutorialAcknowledgedDays !== 'object' || !s.tutorialAcknowledgedDays || Array.isArray(s.tutorialAcknowledgedDays)
    || Object.entries(s.tutorialAcknowledgedDays).some(([id,day])=>!/^ECOC[A-Za-z0-9]+$/.test(id)||!Number.isSafeInteger(day)||day<0||day>s.day!))) return false;
  if (typeof s.tutorialEnabled !== 'boolean' || !Array.isArray(s.seenTutorials)
    || s.seenTutorials.some((id) => typeof id !== 'string' || !/^ECOC[A-Za-z0-9]+$/.test(id))
    || new Set(s.seenTutorials).size !== s.seenTutorials.length) return false;
  if (!Array.isArray(s.ownedSongs) || new Set(s.ownedSongs).size !== s.ownedSongs.length
    || s.ownedSongs.some((id) => typeof id !== 'string' || (songs && !songs.some((song) => song.id === id)))
    || (s.selectedSong !== null && !s.ownedSongs.includes(s.selectedSong!))) return false;
  if (!validMissionProgress(s as GameState) || !validBandmates(s as GameState, musicians) || !validPublicity(s as GameState) || !validAlbum(s as GameState, musicians) || !validRecordingProgress(s as GameState, musicians, rules)) return false;
  return s.band.every((member, slot) => {
    if (member === null) return true;
    if (!member || typeof member !== 'object') return false;
    const m = musicians.find((x) => x.id === member.musicianId);
    const allowed = SLOT_INSTRUMENTS[slot] as readonly string[];
    if (!m || seen.has(m.id) || !allowed.includes(member.instrument) || !(m.skills[member.instrument] > 0)) return false;
    seen.add(m.id);
    return true;
  });
}

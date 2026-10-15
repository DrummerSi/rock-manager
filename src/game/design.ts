import { canBookCalendar } from './publicity';
import data from '../generated/game-data.json' with { type: 'json' };
import type { BandMember, GameState, Musician } from './model';
import type { Style } from './recording';
export type DesignSelection = string[];
export interface Album {
    songId: string;
    bandName: string;
    band: (BandMember | null)[];
    selection: DesignSelection;
    cost: number;
    quality: number;
    imageStyle: Style;
    designedDay: number;
    releaseDay: number;
}
export const defaultDesign = (): DesignSelection => data.design.categories.map(c => c.elements[0]);
export function designElements(selection: DesignSelection) {
    if (selection.length !== 4 || selection.some((id, i) => !data.design.categories[i].elements.includes(id)))
        throw new Error('This cover selection is unavailable.');
    return selection.map(id => data.design.elements.find(e => e.id === id)!);
}
export const designCost = (selection: DesignSelection) => designElements(selection).reduce((sum, e) => sum + e.price, 0);
export function bookRelease(state: GameState, musicians: Musician[], selection: DesignSelection, releaseDay: number): GameState {
    if (!state.demo || !state.contract || state.demo.songId !== state.contract.songId)
        throw new Error('Sign a record contract before scheduling this album.');
    if (state.album)
        throw new Error('This album already has a cover and release date.');
    if (!Number.isSafeInteger(releaseDay) || releaseDay <= state.day || releaseDay > state.day + 100)
        throw new Error('Choose a release date within the next 100 days.');
    if (!canBookCalendar(state, 'release', releaseDay)) throw new Error('This release date conflicts with another booking.');
    const elements = designElements(selection), cost = designCost(selection);
    if (cost > state.money)
        throw new Error('You cannot afford this cover design.');
    const mode = selection[1];
    const members = state.band.flatMap(member => {
        if (!member)
            return [];
        const musician = musicians.find(m => m.id === member.musicianId);
        if (!musician)
            return [];
        const weight = mode === 'DEDArtists04' ? 0 : member.instrument === 'Vocals' ? (mode === 'DEDArtists01' ? 1 : 2) : mode === 'DEDArtists03' ? 0 : 1;
        return [{ musician, weight }];
    });
    const weight = members.reduce((sum, m) => sum + m.weight, 0);
    const average = (get: (m: Musician) => number) => weight ? members.reduce((sum, m) => sum + get(m.musician) * m.weight, 0) / weight : 0;
    const nonArtist = elements.filter((_, i) => i !== 1), clamp = (n: number) => Math.max(0, Math.min(1, n));
    const quality = clamp(state.demo.quality + nonArtist.reduce((sum, e) => sum + e.quality, 0) + .1 * (average(m => m.charisma ?? 0) - .5));
    const imageStyle = Object.fromEntries(['Metal', 'rock', 'Punk', 'Pop', 'Dance', 'Boring'].map(k => [k, clamp(average(m => m.style?.[k] ?? 0) + nonArtist.reduce((sum, e) => sum + (e.style as Style)[k], 0))]));
    return { ...state, money: state.money - cost, album: { songId: state.demo.songId, bandName: state.bandName, band: structuredClone(state.band), selection: [...selection], cost, quality, imageStyle, designedDay: state.day, releaseDay } };
}
export function validAlbum(state: GameState, musicians: Musician[]): boolean {
    const a = state.album;
    if (a === null || a === undefined)
        return true;
    try {
        if (!state.demo || !state.contract || a.songId !== state.demo.songId || a.songId !== state.contract.songId
            || typeof a.bandName !== 'string' || a.bandName.length > 28 || !Array.isArray(a.band) || a.band.length !== 5
            || a.band.some(m => m && !musicians.some(x => x.id === m.musicianId && x.skills[m.instrument] > 0))
            || !Array.isArray(a.selection) || a.cost !== designCost(a.selection) || !Number.isFinite(a.quality) || a.quality < 0 || a.quality > 1
            || !Number.isSafeInteger(a.designedDay) || a.designedDay < state.contract.signedDay || a.designedDay > state.day
            || !Number.isSafeInteger(a.releaseDay) || a.releaseDay <= a.designedDay || a.releaseDay > a.designedDay + 100
            || !a.imageStyle || ['Metal', 'rock', 'Punk', 'Pop', 'Dance', 'Boring'].some(k => !Number.isFinite(a.imageStyle[k]) || a.imageStyle[k] < 0 || a.imageStyle[k] > 1))
            return false;
        return true;
    }
    catch {
        return false;
    }
}

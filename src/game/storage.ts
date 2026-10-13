import type { GameState, Musician } from './model';
import { validSave } from './model';
import data from '../generated/game-data.json';

export const SAVE_KEY = 'rock-manager.mission01.v1';
export interface SaveStore { load(musicians: Musician[]): GameState | null; save(state: GameState): boolean }

export class BrowserSaveStore implements SaveStore {
  load(musicians: Musician[]): GameState | null {
    try {
      const value = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
      // Preserve bands created before the song system was added.
      if (value && value.version === 1 && value.ownedSongs === undefined) {
        value.ownedSongs = []; value.selectedSong = null;
      }
      if (value && value.version === 1 && value.seenTutorials === undefined) {
        value.seenTutorials = []; value.tutorialEnabled = !value.started;
      }
      if (value && value.version === 1) {
        for (const key of ['recording', 'demo', 'contract']) if (value[key] === undefined) value[key] = null;
      }
      return validSave(value, musicians, data.songs, data.tutorialGameplay) ? value : null;
    } catch { return null; }
  }
  save(state: GameState): boolean {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch { return false; }
  }
}

import type { GameState, Musician } from './model';
import { validSave } from './model';

export const SAVE_KEY = 'rock-manager.mission01.v1';
export interface SaveStore { load(musicians: Musician[]): GameState | null; save(state: GameState): boolean }

export class BrowserSaveStore implements SaveStore {
  load(musicians: Musician[]): GameState | null {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
      return validSave(value, musicians) ? value : null;
    } catch { return null; }
  }
  save(state: GameState): boolean {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch { return false; }
  }
}

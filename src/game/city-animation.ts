export interface CitySequenceEntry { offset: number; pause: number }
export interface CityAnimationState { cursor: number; delay: number; pause: number; offset: number }
export const initialCityAnimation = (): CityAnimationState => ({ cursor: 0, delay: 0, pause: 0, offset: 0 });

// CityAnimScript advances the list only once per three frame-timer ticks.
export function tickCityAnimation(state: CityAnimationState, sequence: CitySequenceEntry[]): CityAnimationState {
  if (!sequence.length) return state;
  if (state.delay) return { ...state, delay: state.delay - 1 };
  if (state.pause) return { ...state, delay: 2, pause: state.pause - 1 };
  const entry = sequence[state.cursor];
  return { cursor: (state.cursor + 1) % sequence.length, delay: 2, pause: entry.pause, offset: entry.offset };
}

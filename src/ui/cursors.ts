import data from '../generated/game-data.json';
export type CursorKind = 'default' | 'active' | 'building';
export function cursorStyle(kind: CursorKind): string {
  const cursor = data.cursors[kind];
  return `url("${import.meta.env.BASE_URL}assets/${cursor.file}") ${cursor.x} ${cursor.y}, ${kind === 'default' ? 'default' : 'pointer'}`;
}

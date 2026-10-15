// Keep compressed originals in memory. decodeAudioData detaches its input,
// so each decoder receives a copy; playback/export can reuse the same download.
const encoded = new Map<string, ArrayBuffer>();
const loading = new Map<string, Promise<ArrayBuffer>>();

export function retainAudioData(path: string, bytes: ArrayBuffer): void { encoded.set(path, bytes); }
export function hasAudioData(path: string): boolean { return encoded.has(path); }

export async function audioData(path: string): Promise<ArrayBuffer> {
  let bytes = encoded.get(path);
  if (!bytes) {
    let pending = loading.get(path);
    if (!pending) {
      pending = fetch(`${import.meta.env?.BASE_URL ?? '/'}assets/${path}`)
        .then(response => { if (!response.ok) throw new Error(`Audio ${response.status}: ${path}`); return response.arrayBuffer(); })
        .then(data => { retainAudioData(path, data); return data; })
        .finally(() => loading.delete(path));
      loading.set(path, pending);
    }
    bytes = await pending;
  }
  return bytes.slice(0);
}

export function audioAssetPaths(feedback: readonly {path:string}[], extra: readonly {path:string}[], music: readonly {file:string}[]): string[] {
  return [...new Set([...feedback, ...extra].map(entry => 'feedback/'+entry.path.split('/').at(-1))
    .concat(music.map(entry => 'music/'+entry.file)))];
}

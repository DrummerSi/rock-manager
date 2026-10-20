import data from '../generated/game-data.json' with {type:'json'};
import sourceAudio from '../generated/source-window-audio.json';
import {missionDefinition} from './mission-catalog';
import type {GameState} from './model';

export function missionPreviewPaths(missionId:string):string[]{
  const songs=new Set(missionDefinition(missionId).availableSongs.map(id=>(id+'Preview').toLowerCase()));
  return [...new Set(sourceAudio.recovered.filter(e=>songs.has(e.key.toLowerCase())).map(e=>'feedback/'+e.path.split('/').at(-1)))];
}

/** All selectable loops for one song, plus existing vocal files for the
 * mission's eligible musicians. Sng21 uses one shared vocal rather than
 * per-singer filenames. Never request a file absent from the recovered audio. */
export function songStemPaths(state:GameState,songId:string):string[]{
  const available=new Set(data.tutorialGameplay.audio.map(a=>a.file));
  const eligible=new Set([...missionDefinition(state.missionId).availableMusicians,...state.band.flatMap(m=>m?[m.musicianId]:[])]);
  const prefixes=data.tutorialGameplay.voicePrefixes as Record<string,string>;
  const voices=new Set([...eligible].map(id=>prefixes[id]).filter(Boolean));voices.add('a01');
  const files=data.tutorialGameplay.loops.filter(l=>l.songId===songId).flatMap(loop=>{
    const direct=loop.file+'.ogg';if(available.has(direct))return [direct];
    return loop.instrument==='Vocals'?[...voices].map(prefix=>loop.file+prefix+'.ogg').filter(file=>available.has(file)):[];
  });
  return [...new Set(files)].map(file=>'music/'+file);
}

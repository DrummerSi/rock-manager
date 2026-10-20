import { defaultBandmates } from './bandmates';
import { defaultPublicity } from './publicity';
import type { GameState, Musician } from './model';
import { validSave } from './model';
import {clearCompletedCoverReminder} from './media-reminders';
import data from '../generated/game-data.json' with { type: 'json' };
import {missionSnapshots} from './mission-catalog';
import {finishRecording} from './recording';
import {designElements,designCost} from './design';
import {defaultMissionProgress} from './mission-progress';

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
        // The old M05 deadline kept running after TRMis5WorldsLoudestOK's
        // qualifying booking. Repair only that proven, impossible source failure.
        const scenario=value.scenario;
        if(value.missionId==='Mission05'&&scenario?.active&&Array.isArray(scenario.queue)&&Array.isArray(scenario.seen)&&(scenario.vars?.loudestBooked||scenario.vars?.loudestDone)){
          delete scenario.active.loudest;
          scenario.queue=scenario.queue.filter((c:any)=>!/^ECOCMis5WorldsLoudest(?:Mad|Fury)$/i.test(c.id));
          if(scenario.outcome==='lost'&&scenario.seen.at(-1)?.toLowerCase()==='ecocmis5worldsloudestfury'&&value.missionProgress?.failureReason==='Scenario'){
            scenario.outcome=null;scenario.seen=scenario.seen.filter((id:string)=>!/^ECOCMis5WorldsLoudestFury$/i.test(id));value.missionProgress=defaultMissionProgress('Mission05');
          }
        }
        // Repair the omitted M05.dat font-category override in existing Firewolf covers.
        if(value.missionId==='Mission05'&&Array.isArray(value.album?.selection)&&value.album.selection.length===4){value.album.selection[3]='DEDFirewolf';value.album.cost=designCost(value.album.selection);}
        // M03.dat grants this licence before play. Repair earlier recreation
        // saves without losing additional songs bought during the mission.
        if(value.missionId==='Mission03'&&Array.isArray(value.ownedSongs)){
          const starting=missionSnapshots.Mission03.Classes.player.player.OwnedSongs;
          value.ownedSongs=[...new Set([...starting,...value.ownedSongs])];
          if(!value.selectedSong)value.selectedSong=starting[0]??null;
        }
        if (value.bandmates === undefined) value.bandmates = defaultBandmates(value, musicians);
        else if(Array.isArray(value.bandmates?.people)){
          for(const person of defaultBandmates(value,musicians).people)if(!value.bandmates.people.some((p:any)=>p?.musicianId===person.musicianId))value.bandmates.people.push(person);
        }
        if (value.audioVersion === undefined) { value.muted = false; value.audioVersion = 1; }
        if (value.publicity === undefined) value.publicity = defaultPublicity(value);
        else if (value.publicity && typeof value.publicity === 'object') {
          for(const reporter of defaultPublicity(value).reporters)if(Array.isArray(value.publicity.reporters)&&!value.publicity.reporters.some((r:any)=>r.mediaId===reporter.mediaId))value.publicity.reporters.push(reporter);
          for (const [key, fallback] of Object.entries(defaultPublicity(value))) if (value.publicity[key] === undefined) value.publicity[key] = fallback;
        }
        for (const key of ['recording', 'demo', 'contract', 'album']) if (value[key] === undefined) value[key] = null;
        // The old five-entry channel bonus serialized NaN quality as null.
        // Recover those recordings from their retained channels before validation.
        if(value.demo?.quality===null&&Array.isArray(value.demo.channels)&&value.demo.channels.filter((c:any)=>c?.musicianId&&!c.muted&&c.volume>0).length>5){
          value.demo.quality=finishRecording({...value,recording:value.demo},data.tutorialGameplay,musicians,data.songs).demo!.quality;
          if(value.album?.quality===null){
            const elements=designElements(value.album.selection),mode=value.album.selection[1];
            let weight=0,charisma=0;
            for(const member of value.album.band){if(!member)continue;const musician=musicians.find(m=>m.id===member.musicianId);if(!musician)continue;
              const w=mode==='DEDArtists04'?0:member.instrument==='Vocals'?(mode==='DEDArtists01'?1:2):mode==='DEDArtists03'?0:1;
              weight+=w;charisma+=w*(musician.charisma??0);
            }
            value.album.quality=Math.max(0,Math.min(1,value.demo.quality+elements.reduce((sum,e,i)=>sum+(i===1?0:e.quality),0)+.1*((weight?charisma/weight:0)-.5)));
          }
        }
      }
      return validSave(value, musicians, data.songs, data.tutorialGameplay) ? clearCompletedCoverReminder(value) : null;
    } catch { return null; }
  }
  save(state: GameState): boolean {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch { return false; }
  }
}

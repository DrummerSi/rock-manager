import type { GameState, Musician } from './model';

export interface Mission01GuidanceContext {
  previousModal?: string | null;
  currentModal?: string | null;
  /** Persist acknowledgment days so a delayed card waits a day after its predecessor, even after reload. */
  acknowledgedDays?: Record<string, number>;
  /** Legacy saves have no original missionVar.changedBandName; this is supplied when retained. */
  bandNameChanged?: boolean;
  unnamedBandName?: string;
}
export interface RehearsalExitGuidance { allowed: boolean; cardId: 'ECOCNeedSinger' | 'ECOCNoSingersLeft' | 'ECOCForgetBandName' | null }
/** Native DlgRehearsal01 ButtonOK guards happen before ExitDialog can introduce the publisher. */
export function mission01RehearsalExit(state: GameState, musicians: Musician[], context: Mission01GuidanceContext = {}): RehearsalExitGuidance {
  if (!state.band.some(member => member?.instrument === 'Vocals')) {
    const vocalistsRemain = musicians.some(m => m.skills.Vocals > 0 && !state.bandmates.people.find(p => p.musicianId === m.id)?.fired);
    return { allowed: false, cardId: vocalistsRemain ? 'ECOCNeedSinger' : 'ECOCNoSingersLeft' };
  }
  const unnamed = [context.unnamedBandName ?? 'The Unknowns', 'Unnamed band'].includes(state.bandName);
  if (unnamed && !context.bandNameChanged && !state.seenTutorials.includes('ECOCForgetBandName')) return { allowed: false, cardId: 'ECOCForgetBandName' };
  return { allowed: true, cardId: null };
}

/** Original event-card IDs in pending order; callers show one card and persist its acknowledgment. */
export function pendingMission01Guidance(state: GameState, context: Mission01GuidanceContext = {}): string[] {
  if (!state.started || !state.tutorialEnabled) return [];
  const unseen = (id: string) => !state.seenTutorials.includes(id);
  const seen = (id: string) => !unseen(id);
  const days = context.acknowledgedDays ?? {};
  const modal = context.currentModal ?? null;
  const previous = context.previousModal ?? null;
  const cards: string[] = [];
  const add = (id: string) => { if (unseen(id) && !cards.includes(id)) cards.push(id); };
  if (modal === 'rehearsal') { add('ECOCMis1IntroduceRehearsal'); return cards; }
  if (modal === 'mixer') {
    if (seen('ECOCMis1IntroduceStudio') || state.recording) add('ECOCMis1IntroduceMixer');
    return cards;
  }
  if (modal === 'publisher') {
    // Native trigger deactivates on first entry even without songs; preserve its useful reminder on re-entry.
    if (state.ownedSongs.length) add('ECOCPublishAlreadyGotSong');
    return cards;
  }
  // Child windows do not constitute leaving the rehearsal room, recording studio, or label.
  if (modal !== null) return [];
  if (state.album) {
    add('ECOCMis1IntroduceMedia');
    if (seen('ECOCMis1IntroduceMedia')) {
      const mediaDay = days.ECOCMis1IntroduceMedia ?? state.album.designedDay;
      if (state.day >= mediaDay + 1) add('ECOCMis1IntroduceChart');
      if (seen('ECOCMis1IntroduceChart')) {
        const chartDay = days.ECOCMis1IntroduceChart ?? mediaDay + 1;
        if (state.day >= chartDay + 1) add('ECOCMis1IntroduceCalendar');
      }
      // Original advance triggers exist but are omitted from Mission01 StartTriggers. This repairs that missing edge.
      if (state.contract && state.publicity.firstMediaVisitDay !== null && state.day >= state.publicity.firstMediaVisitDay + 1) add('ECOCMis1IntroduceAdvance');
    }
    if (state.day >= state.album.releaseDay) {
      const kitKey = state.publicity.albumKey ?? (state.demo ? `${state.album.songId}:${state.demo.recordedDay}` : null);
      for (const [mediaId, delay, cardId] of [['Media03', 10, 'ECOCCityRequestCD'], ['Media04', 14, 'ECOCZer0RequestCD'], ['Media02', 16, 'ECOCRadioRequestCD']] as const) {
        if (state.contract && state.day >= state.album.releaseDay + delay && (!kitKey || state.publicity.reporters.find(r => r.mediaId === mediaId)?.kit !== kitKey)) add(cardId);
      }
    }
    return cards;
  }
  if (state.contract) {
    add('ECOCMis1IntroduceSleeve');
    if (state.day >= state.contract.signedDay + 10) add('ECOCRecordTellDesign');
    return cards;
  }
  if (state.demo) {
    add('ECOCMis1IntroduceLabel');
    if (seen('ECOCMis1IntroduceLabel') && ['label', 'contract', 'rejection'].includes(previous ?? '')) add('ECOCMis1NoContract');
    // Original card exists but its named trigger actually emits NoContract/Sleeve. Expose the omitted useful venue guidance after rejection.
    if (seen('ECOCMis1NoContract')) add('ECOCMis1IntroduceVenue');
    return cards;
  }
  if (state.ownedSongs.length) {
    if (seen('ECOCMis1IntroducePublisher') || previous === 'publisher') add('ECOCMis1IntroduceStudio');
    return cards;
  }
  // Original room exit requires a singer, not five band members. Never move the tutorial forward on an empty room exit.
  if (state.band.some(m => m?.instrument === 'Vocals') && (previous === 'rehearsal' || seen('ECOCMis1IntroduceRehearsal'))) {
    add('ECOCMis1IntroducePublisher');
    return cards;
  }
  add('ECOCMis1IntroduceCity');
  return cards;
}

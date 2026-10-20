import {missionSpend} from './mission-spending';
import { bandmateOccupied } from './bandmates';
import {missionDefinition} from './mission-catalog';
import sourceRules from './publicity-rules.json' with { type: 'json' };
import type { GameState, Musician } from './model';
import { bandStyle, evaluateDemo, type Style } from './recording';

import videoRules from './video-rules.json' with {type:'json'};
const rawRules={...sourceRules,media:[...sourceRules.media,videoRules.media],reporters:[...sourceRules.reporters,videoRules.reporter],adverts:[...sourceRules.adverts,...videoRules.adverts]};
export const PUBLICITY_RULES = rawRules;
export interface GroupPublicity { id: string; bandHype: number; bandExposure: number; albumHype: number; albumExposure: number; willBuy: number; bought: number; likes: number }
export interface ReporterPublicity { mediaId: string; kit: string | null; videoKit?:string|null; albumLike: number; mood: number; bribes: number; ads: number; avoid: number; nextPlaylistDay: number; rotation: number; rotationEndDay: number; modifiers: { amount: number; endDay: number }[] }
export interface ConcertBooking { id: string; venueId: string; startDay: number; duration: number; completed: boolean }
export interface AdvertBooking { id: string; advertId: string; mediaId: string; startDay: number; duration: number; completed: boolean }
export interface ConcertResult { id: string; concertId: string; venueId: string; day: number; audience: number; satisfaction: number; income: number; rent: number; cancelled: boolean }
export interface Review { id: string; mediaId: string; day: number; rating: number; quality: number }
export interface Exposure { id: string; startDay: number; duration: number; intensity: number; reach: Record<string, number>; quality: Record<string, number>; albumKey: string | null }
export interface PublicityState {
  seed: number; lastDay: number; nextId: number; albumKey: string | null; liveReputation: number;
  groups: GroupPublicity[]; reporters: ReporterPublicity[]; concerts: ConcertBooking[]; adverts: AdvertBooking[];
  concertResults: ConcertResult[]; reviews: Review[]; exposures: Exposure[]; seenResults: string[];
  earlierAlbumSales?:number;earlierAlbumRoyalties?:number;
  salesHistory: { day: number; sales: number }[]; totalSales: number; grossRoyalties: number; paidRoyalties: number; advanceRepaid: number;
  chart: number; radioChart: number; chartDay: number; top10Day: number | null;
  chartSongs: { id: string; movementId: string; life: number }[];
  chartPrevious: Record<string, string[]>;
  chartSales: number; chartRotation: number;
  firstMediaVisitDay: number | null;
}
type PublicGame = GameState & { publicity: PublicityState };
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const population=(state:GameState,g:{id:string;size:number})=>Number(state.scenario?.vars['population:'+g.id]??g.size);
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const styleNames = ['Metal', 'rock', 'Punk', 'Pop', 'Dance', 'Boring'];
const keyFor = (state: GameState) => state.demo ? `${state.demo.songId}:${state.demo.recordedDay}` : null;
const freshness = (state: GameState) => clamp(1 - 0.006 * (state.day - (state.demo?.recordedDay ?? state.day)));
const albumQuality = (state: GameState) => state.album?.quality ?? state.demo?.quality ?? 0;
const imageStyle = (state: GameState) => state.album?.imageStyle ?? state.demo?.imageStyle ?? {};
const ordinal = (state: GameState) => Math.floor(Date.parse(`${state.startDate}T00:00:00Z`) / 86400000) + state.day;

// OneGraphScript: the original percentage legend maps raw 0..0.33 to 0..100.
export const displayAlbumHype = (raw: number): number => Math.round(raw / .33 * 100);
export function albumHype(state:GameState):number {
  return Math.max(0,rawRules.groups.reduce((sum,g)=>sum+population(state,g)*(state.publicity.groups.find(v=>v.id===g.id)?.albumHype??0),0)/rawRules.groups.reduce((sum,g)=>sum+population(state,g),0));
}

export function defaultPublicity(state?: Pick<GameState, 'day'>): PublicityState {
  const p: PublicityState = { seed: 0x524f434b, lastDay: state?.day ?? 0, nextId: 1, albumKey: null, liveReputation: 0,
    groups: rawRules.groups.map(g => ({ id: g.id, bandHype: 0, bandExposure: 0, albumHype: 0, albumExposure: 0, willBuy: 0, bought: 0, likes: 0 })),
    reporters: rawRules.reporters.map(r => ({ mediaId: r.mediaId, kit: null, albumLike: 0, mood: r.mood, bribes: 0, ads: 0, avoid: 0, nextPlaylistDay: 0, rotation: 0, rotationEndDay: 0, modifiers: [] })),
    concerts: [], adverts: [], concertResults: [], reviews: [], exposures: [], seenResults: [], salesHistory: [], totalSales: 0,
    grossRoyalties: 0, paidRoyalties: 0, advanceRepaid: 0, chart: 0, radioChart: 0, chartDay: -1, top10Day: null,
    chartSongs: [], chartPrevious: {}, chartSales: 0, chartRotation: 0, firstMediaVisitDay: null };
  prepareCharts(p, false);
  return p;
}

// Seeded sequence replaces Director's process-global RNG so saves replay identically.
function random(p: PublicityState): number { p.seed = (Math.imul(p.seed, 1664525) + 1013904223) >>> 0; return p.seed / 4294967296; }
const newId = (p: PublicityState, prefix: string) => `${prefix}${p.nextId++}`;
type Taste = { style: Style; tolerance: Style; songType?: number; songTypeTolerance?: number; minimumQuality?: number };
function styleScore(taste: Taste, actual: Style): { average: number; scores: number[] } {
  const scores = styleNames.filter(s => taste.tolerance[s] > 0).map(s => taste.tolerance[s] >= 2 ? 1 : 1 - Math.abs(taste.style[s] - (actual[s] ?? 0)) / taste.tolerance[s]);
  return { average: mean(scores), scores };
}
function liking(state: GameState, musicians: Musician[], taste: Taste, imageWeight = 1, useType = true, freshWeight = 0) {
  const music = bandStyle(state, musicians), image = imageStyle(state);
  const combined = Object.fromEntries(styleNames.map(s => [s, ((music[s] ?? 0) + imageWeight * (image[s] ?? 0)) / (1 + imageWeight)]));
  const style = styleScore(taste, combined), diff = albumQuality(state) - (taste.minimumQuality ?? 0);
  const quality = diff < 0 ? 2 * diff : diff / (diff + 0.1);
  const scores = [...style.scores, style.average, quality], averages = [style.average, quality];
  if (useType && (taste.songTypeTolerance ?? 0) > 0) {
    const tolerance = taste.songTypeTolerance!;
    const score = tolerance >= 2 ? 1 : 1 - Math.abs(taste.songType! - (state.demo?.songType ?? 0)) / tolerance;
    scores.push(score); averages.push(score);
  }
  if(state.scenario?.vars.AlbumLikeBoost!==undefined)return {like:1,penalty:0};
  return { like: mean(averages) + freshWeight * (freshness(state) - 1), penalty: scores.reduce((sum, n) => sum + Math.min(n, 0), 0) };
}

function targetReach(target: typeof rawRules.targets[number], group: typeof rawRules.groups[number]) {
  if (group.age.min >= target.age.max || group.age.max <= target.age.min) return 0;
  const ageFraction = Math.max(0, Math.min(group.age.max, target.age.max) - Math.max(group.age.min, target.age.min)) / (group.age.max - group.age.min);
  const scores = [styleScore(target, group.style).average];
  for (const [range, actual] of [[target.education, group.education], [target.economy, group.economy]] as const) {
    const tolerance = (range.max - range.min) / 2;
    if (tolerance > 0) scores.push(tolerance >= 2 ? 1 : 1 - Math.abs(range.min + tolerance - actual) / tolerance);
  }
  if (target.songTypeTolerance > 0) scores.push(target.songTypeTolerance >= 2 ? 1 : 1 - Math.abs(target.songType - group.songType) / target.songTypeTolerance);
  return ageFraction * Math.max(0, mean(scores));
}
function reach(ids: string[]) {
  return Object.fromEntries(rawRules.groups.map(g => [g.id, Math.max(0, ...ids.map(id => {
    const t = rawRules.targets.find(t => t.id === id); return t ? targetReach(t, g) : 0;
  }))]));
}

export function venueAcceptance(state: PublicGame, musicians: Musician[], venueId: string) {
  const venue = rawRules.venues.find(v => v.id === venueId);
  if(missionDefinition(state.missionId).neverPlaces.includes(venueId)&&!(state.missionId==='Mission03'&&venueId==='Live05'&&state.demo))return {accepted:false,like:0,reason:'This venue is unavailable in this mission.'};
  if (!venue || !state.demo || !state.band.some(Boolean)) return { accepted: false, like: 0, reason: 'Put together a band and record a demo before booking a gig.' };
  const targets = venue.targets.map(id => rawRules.targets.find(t => t.id === id)!).map(t => liking(state, musicians, t, 0, true, 0.3)).sort((a, b) => b.like - a.like);
  const best = targets[0], bandHype = mean(state.publicity.groups.map(g => g.bandHype));
  const accepted = best.penalty + 0.2 * state.publicity.liveReputation + 0.01 * bandHype >= -1e-9;
  return { accepted, like: accepted && best.like < 0 ? 0.01 : best.like,
    reason: accepted ? '' : evaluateDemo(state,{name:venue.name,targets:venue.targets.map(id=>rawRules.targets.find(t=>t.id===id)!)},musicians,0).reason };
}

/** DlgLive checks nearest concerts around today's date before opening Book. */
export function venueBookingIssue(state:GameState,musicians:Musician[],venueId:string):{cardId:string;reason?:string}|null {
  if(!state.band.some(Boolean))return {cardId:'ECConcertBookNoBand'};
  if(!state.demo)return {cardId:'ECConcertBookNoDemo'};
  const venue=rawRules.venues.find(v=>v.id===venueId)!;
  if(state.publicity.concerts.some(c=>c.venueId===venueId&&c.startDay<=state.day&&c.startDay>state.day-venue.spacing))return {cardId:'ECOCVenueBookTooSoon'};
  if(state.publicity.concerts.some(c=>c.venueId===venueId&&!c.completed&&c.startDay>state.day&&c.startDay<state.day+venue.spacing))return {cardId:'ECOCVenueBookUpcoming'};
  if(state.money<venue.rent)return {cardId:'ECOCNoMoneyWarning'};
  const accepted=venueAcceptance(state,musicians,venueId);return accepted.accepted?null:{cardId:'ECOCVenueNotLikeStyle',reason:accepted.reason};
}

/** Source resource intersections: concerts and releases both require NotOnTour. Ads require none. */
export function canBookCalendar(state: PublicGame, kind: 'concert' | 'advert' | 'release' | 'video', startDay: number, duration = 1): boolean {
  if (!Number.isSafeInteger(startDay) || !Number.isSafeInteger(duration) || startDay <= state.day || startDay > state.day + 100 || duration < 1 || duration > 100) return false;
  const overlaps = (start: number, days: number, day: number) => start <= day && day < start + days;
  for (let day = startDay; day < startDay + duration; day++) {
    if(kind!=='advert'&&state.tour&&!state.tour.completed&&state.tour.startDay<=day&&day<(state.tour.returnDay??state.tour.startDay+state.tour.duration))return false;
    if((kind==='concert'||kind==='video')&&state.scenario?.appointments.some(a=>!a.completed&&a.startDay<=day&&day<a.startDay+a.duration))return false;
    const concerts = state.publicity.concerts.filter(c => !c.completed && overlaps(c.startDay, c.duration, day));
    const adverts = state.publicity.adverts.filter(a => !a.completed && overlaps(a.startDay, a.duration, day));
    const release = state.album && overlaps(state.album.releaseDay, 1, day) ? 1 : 0;
    if (concerts.length + adverts.length + release + (state.gangsta?.security.filter(e=>overlaps(e.startDay,e.duration,day)).length??0) + (state.video&&!state.video.completed&&overlaps(state.video.startDay,state.video.duration,day)?1:0) >= 4) return false;
    if ((kind === 'concert'||kind==='video') && state.band.some(member => member && bandmateOccupied(state, member.musicianId, day))) return false;
    if (kind !== 'advert' && (concerts.length || (kind!=='video'&&release))) return false;
  }
  return true;
}

export function bookConcert<T extends PublicGame>(state: T, musicians: Musician[], venueId: string, startDay: number): T {
  const venue = rawRules.venues.find(v => v.id === venueId);
  if (!venue) throw new Error('This venue is unavailable in this mission.');
  const acceptance = venueAcceptance(state, musicians, venueId);
  if (!acceptance.accepted) throw new Error(acceptance.reason);
  if (!canBookCalendar(state, 'concert', startDay)) throw new Error('The band or calendar is already occupied on that day.');
  if (venueBookingIssue(state,musicians,venueId)) throw new Error('Venue booking refused.');
  if (state.money < venue.rent) throw new Error('You cannot afford this venue.');
  const p = structuredClone(state.publicity);
  p.concerts.push({ id: newId(p, 'concert'), venueId, startDay, duration: 1, completed: false });
  return { ...state, money: state.money - venue.rent, publicity: p };
}

export function bookAdvert<T extends PublicGame>(state: T, advertId: string, startDay: number, duration: number): T {
  const advert = rawRules.adverts.find(a => a.id === advertId);
  if (!advert || !state.album || !state.contract) throw new Error('Schedule your album release before advertising it.');
  if (!canBookCalendar(state, 'advert', startDay, duration)) throw new Error('That advertising schedule is unavailable.');
  const price = advert.price * duration;
  if (state.money < price) throw new Error('You cannot afford this campaign.');
  const p = structuredClone(state.publicity);
  p.adverts.push({ id: newId(p, 'advert'), advertId, mediaId: advert.mediaId, startDay, duration, completed: false });
  return missionSpend({ ...state, money: state.money - price, publicity: p },'media',price);
}

export function givePressKit<T extends PublicGame>(state: T, mediaId: string, musicians: Musician[] = []): T {
  const source = rawRules.reporters.find(r => r.mediaId === mediaId);
  if (!state.album || !source) throw new Error('Schedule an album release before giving a press kit to this outlet.');
  const p = structuredClone(state.publicity), reporter = p.reporters.find(r => r.mediaId === mediaId)!;
  const key = keyFor(state);
  if (reporter.kit === key) throw new Error('This reporter already has your press kit.');
  reporter.kit = key;
  // Reporter tolerances are zero in source; style average remains zero, quality has min0.
  void musicians;
  reporter.albumLike = (albumQuality(state) / (albumQuality(state) + 0.1)) / 2;
  reporter.nextPlaylistDay = state.day + 1;
  return { ...state, publicity: p };
}

/** ActMediaTVGiveVideoClip: a separate #Video press-kit entry, free, playlist tomorrow. */
export function giveVideo<T extends PublicGame>(state:T,mediaId='Media01'):T {
  const key=keyFor(state),video=state.video;
  if(mediaId!=='Media01'||!video?.completed||video.albumKey!==key)throw new Error('Finish shooting a video before delivering it to TV24.');
  const p=structuredClone(state.publicity),reporter=p.reporters.find(r=>r.mediaId===mediaId)!;
  if(reporter.videoKit===key)throw new Error('TV24 already has this video.');
  reporter.videoKit=key;reporter.nextPlaylistDay=state.day+1;
  return {...state,publicity:p};
}

export function giveGift<T extends PublicGame>(state: T, actionId: string, mediaId: string): T {
  const gift = rawRules.gifts.find(g => g.id === actionId), source = rawRules.reporters.find(r => r.mediaId === mediaId);
  if (!gift || !source || !state.album) throw new Error('This gift or recipient is unavailable.');
  if (state.money < gift.price) throw new Error('You cannot afford this gift.');
  const p = structuredClone(state.publicity), reporter = p.reporters.find(r => r.mediaId === mediaId)!;
  const inverse = 0.4 / (1 - reporter.bribes) - 0.4;
  const next = 1 - 0.4 / (inverse + gift.value + 0.4), difference = next - reporter.bribes;
  const change = difference > 0.6 * (1 - source.bribeSensitivity) ? -0.2 : difference < 0.1 && source.bribeSensitivity >= 0.6 ? -0.1 : 0.5 * difference;
  if (change > 0) reporter.bribes = next;
  reporter.mood += 0.1 * change;
  reporter.modifiers.push({ amount: change, endDay: state.day + 10 });
  return missionSpend({ ...state, money: state.money - gift.price, publicity: p },'media',gift.price);
}

function expose(p: PublicityState, event: Exposure, signed: boolean) {
  for (const group of p.groups) {
    const intensity = (event.reach[group.id] ?? 0) * event.intensity;
    const quality = event.quality[group.id] ?? 0;
    group.bandExposure += intensity;
    group.bandHype = clamp(group.bandHype + intensity * quality * 3 / (10 + group.bandExposure), -1, 1);
    if (signed && event.albumKey === p.albumKey) {
      group.albumExposure += intensity;
      group.albumHype = clamp(group.albumHype + intensity * quality * 3 / (10 + group.albumExposure), -1, 1);
    }
  }
}
function addExposure(p: PublicityState, state: GameState, id: string, duration: number, intensity: number, targets: string[], quality: (g: typeof rawRules.groups[number]) => number) {
  p.exposures.push({ id, startDay: state.day, duration, intensity, reach: reach(targets),
    quality: Object.fromEntries(rawRules.groups.map(g => [g.id, quality(g)])), albumKey: keyFor(state) });
}

type ConcertVenue=Pick<typeof rawRules.venues[number],'id'|'targets'|'size'|'rent'|'ticketPrice'|'royalty'|'regulars'>;
function performConcert(state: PublicGame, musicians: Musician[], concert: ConcertBooking, tour?:{venue:ConcertVenue;populationFactor:number;stageQuality:number}): number {
  const p = state.publicity, venue = tour?.venue??rawRules.venues.find(v => v.id === concert.venueId)!;
  const result: ConcertResult = { id: newId(p, 'result'), concertId: concert.id, venueId: concert.venueId, day: state.day,
    audience: 0, satisfaction: 0, income: 0, rent: venue.rent, cancelled: false };
  concert.completed = true;
  if (!state.demo || !state.band.some(b => b?.instrument === 'Vocals')) { result.cancelled = true; p.concertResults.push(result); return 0; }
  const reaches = reach(venue.targets);
  if(state.scenario?.vars.LiveReachBoost!==undefined)for(const id of Object.keys(reaches))reaches[id]=Math.min(1,reaches[id]+Number(state.scenario.vars.LiveReachBoost));
  const totalReach = Object.values(reaches).reduce((a, b) => a + b, 0);
  const wanted = rawRules.groups.map((g, i) => {
    const guaranteed = totalReach ? venue.size * venue.regulars * reaches[g.id] / totalReach : 0;
    const additional = clamp(reaches[g.id] * (tour?.populationFactor??1) * p.groups[i].bandHype * 0.02 * (1 + 0.3 * p.liveReputation) * freshness(state)) * population(state,g);
    return guaranteed + additional;
  });
  const totalWanted = wanted.reduce((a, b) => a + b, 0), filled = Math.min(1.3, totalWanted / venue.size);
  const crowdFactor = 1 + 0.3 * ((filled > 0.9 ? 1 + (filled - 0.9) / 0.1 : filled < 0.2 ? filled / 0.2 : 1) - 1);
  const influence: Record<string, number> = { Vocals: 1, Guitar: 0.75, Keyboards: 0.6, Drums: 0.25, Bass: 0.5 };
  const members = state.band.flatMap(b => b ? [{ b, m: musicians.find(m => m.id === b.musicianId)! }] : []);
  const weight = members.reduce((sum, v) => sum + influence[v.b.instrument], 0);
  const performance = clamp((members.reduce((sum, v) => sum + influence[v.b.instrument] * (0.5 * v.m.musicality + 0.4 * (v.m.charisma ?? 0) + 0.6 * v.m.mood) / 1.5, 0) / weight - 0.2) / 0.55) * crowdFactor;
  const quality = Object.fromEntries(rawRules.groups.map((g, i) => [g.id, Math.min(1, (4 * performance + liking(state, musicians, g, 1, true, 0.3).like) / 5)]));
  const satisfaction = totalWanted >= 1 ? Math.min(1, rawRules.groups.reduce((sum, g, i) => sum + quality[g.id] * wanted[i] / totalWanted, 0) + (random(p) * 0.2 - 0.1)+Number(state.scenario?.vars.ConcertLikeBoost??0)+.2*(tour?.stageQuality??0)) : 0;
  result.audience = Math.min(venue.size, totalWanted); result.satisfaction = Math.max(0, satisfaction);
  result.income = Math.round(result.audience * venue.ticketPrice * venue.royalty);
  p.liveReputation = clamp(p.liveReputation + clamp((satisfaction - 0.2) * totalWanted / 500, -0.5, 0.5), -1, 1);
  if(!tour)p.exposures.push({ id: newId(p, 'gigExpo'), startDay: state.day, duration: 1, intensity: 1,
    reach: Object.fromEntries(rawRules.groups.map((g, i) => [g.id, totalWanted ? wanted[i] / totalWanted : 0])), quality, albumKey: keyFor(state) });
  p.concertResults.push(result);
  return result.income;
}

export function performTourConcert(state:GameState,musicians:Musician[],city:{ID:string;MediaTargets:string;size:string;PopulationFactor:string;PreferredPriceModel:{UnitPrice:string}},stageQuality:number):ConcertResult {
  const venue={id:city.ID,targets:[...city.MediaTargets.matchAll(/#(\w+)/g)].map(m=>m[1]),size:Number(city.size),rent:0,ticketPrice:Number(city.PreferredPriceModel.UnitPrice),royalty:1,regulars:0};
  performConcert(state,musicians,{id:'tour'+city.ID+state.day,venueId:city.ID,startDay:state.day,duration:1,completed:false},{venue,populationFactor:Number(city.PopulationFactor),stageQuality});
  return state.publicity.concertResults.pop()!;
}

export function reporterBandLike(state:GameState,mediaId:string):number{const r=state.publicity.reporters.find(r=>r.mediaId===mediaId);return r?(r.albumLike+r.mood+r.modifiers.reduce((sum,m)=>sum+m.amount,0))/2+.3*(freshness(state)-1):0;}
function reportersTick(state: PublicGame, musicians: Musician[]) {
  const p = state.publicity;
  if (!state.album) return;
  for (const reporter of p.reporters) {
    const source = rawRules.reporters.find(r => r.mediaId === reporter.mediaId)!, media = rawRules.media.find(m => m.id === reporter.mediaId)!;
    reporter.bribes = Math.max(0, reporter.bribes - 0.01); reporter.ads = Math.max(0, reporter.ads - 0.01); reporter.avoid = Math.max(0, reporter.avoid - 0.01);
    reporter.modifiers = reporter.modifiers.filter(m => m.endDay > state.day);
    const mood = reporter.mood + reporter.modifiers.reduce((sum, m) => sum + m.amount, 0);
    const likes = (reporter.albumLike + mood) / 2 + 0.3 * (freshness(state) - 1);
    if ((media.type==='TV'?reporter.videoKit:reporter.kit) !== keyFor(state) || reporter.avoid > 0) continue;
    if (media.type === 'Paper' && !p.reviews.some(r => r.mediaId === reporter.mediaId) && state.day < state.album.releaseDay + 15) {
      if (1 + Math.floor(random(p) * 100) <= 100 * likes / 15) {
        random(p); // Source computes then overwrites the initial +/-0.1 review result.
        const singer = state.band.find(b => b?.instrument === 'Vocals');
        const ratingQuality = singer ? musicians.find(m => m.id === singer.musicianId)!.musicality + random(p) * 0.4 - 0.2 : random(p);
        const review = { id: newId(p, 'review'), mediaId: media.id, day: state.day, rating: Math.trunc(clamp(ratingQuality) * 5), quality: ratingQuality };
        p.reviews.push(review);
        addExposure(p, state, review.id, 2, 0.3, media.targets, () => ratingQuality);
      }
    }
    if ((media.type === 'Radio'||media.type==='TV') && reporter.nextPlaylistDay > 0 && state.day >= reporter.nextPlaylistDay) {
      const totalHype = Math.max(0, rawRules.groups.reduce((sum, g, i) => sum + population(state,g) * p.groups[i].albumHype, 0) / rawRules.groups.reduce((sum, g) => sum + population(state,g), 0));
      let rotation = likes + (totalHype - source.minimumHype) / (0.5 - source.minimumHype);
      const video=media.type==='TV'&&state.video?.completed&&state.video.albumKey===keyFor(state)?videoRules.concepts.find(v=>v.id===state.video!.conceptId):undefined;
      if(media.type==='TV'&&!video)continue;
      const videoQuality=video?video.quality-(state.video?.qualityPenalty??0):0;
      if(video)rotation=(rotation+.2*videoQuality)/1.2;
      reporter.rotation = rotation >= 0 ? 0.2 * rotation : 0;
      reporter.rotationEndDay = state.day + 7; reporter.nextPlaylistDay = state.day + 7;
      if (rotation >= 0) addExposure(p, state, newId(p, 'rotation'), 7, reporter.rotation, media.targets, g => Math.max(-1, liking(state, musicians, g, 0.2, true, 0.3).like)+videoQuality*.3);
    }
  }
}

export function chartPosition(state: PublicGame): number { return state.publicity.chart; }
export function currentWeekSales(state: PublicGame): number { return state.publicity.salesHistory.filter(s => s.day > state.day - 7 && s.day <= state.day).reduce((sum, s) => sum + s.sales, 0); }
function rank(value: number, thresholds: number[]) { const position = 1 + thresholds.filter(t => t >= value).length; return position <= 10 ? position : 0; }
function chartMovement(id: string) { return rawRules.chartMovements.find(m => m.id === id)!; }
function npcPosition(song: PublicityState['chartSongs'][number], type: string, offset = 0) {
  if (song.life + offset <= 0) return 0;
  const list = (chartMovement(song.movementId).charts as Record<string, number[]>)[type];
  if (!list) return 0;
  const index = song.life + offset - list[0];
  return index >= 0 && index < list.length ? list[index] : 0;
}
function prepareCharts(p: PublicityState, weekly: boolean) {
  if (weekly) for (const song of p.chartSongs) {
    const lifeTime = Math.max(...Object.values(chartMovement(song.movementId).charts).map(v => v[0] + v.length - 1));
    song.life = song.life < lifeTime ? song.life + 1 : 0;
  }
  for (const type of ['TV', 'Radio', 'Store']) {
    let count = p.chartSongs.filter(s => npcPosition(s, type) > 0).length;
    let attempts = 0;
    while (count <= 12 && attempts++ < rawRules.chartSongs.length * 3) {
      const unused = rawRules.chartSongs.filter(s => !p.chartSongs.some(v => v.id === s.id && v.life > 0));
      if (!unused.length) break;
      const source = unused[Math.floor(random(p) * unused.length)];
      const movementId = source.movements[Math.floor(random(p) * source.movements.length)];
      const movement = chartMovement(movementId), list = (movement.charts as Record<string, number[]>)[type];
      if (!list) continue;
      const song = { id: source.id, movementId, life: Math.round(1 + list[0]) };
      const old = p.chartSongs.find(s => s.id === source.id);
      if (old) Object.assign(old, song); else p.chartSongs.push(song);
      count = p.chartSongs.filter(s => npcPosition(s, type) > 0).length;
    }
  }
}
export interface ChartRow { id: string; name: string; bandName: string; position: number; lastWeekPosition: number; mine: boolean; rating: number }
export function chartRows(state: PublicGame, mediaId = 'Media05'): ChartRow[] {
  const media = rawRules.media.find(m => m.id === mediaId);
  if (!media || !media.chartThresholds.length) return [];
  const ordered = state.publicity.chartSongs.filter(s => npcPosition(s, media.type) > 0).sort((a, b) => npcPosition(a, media.type) - npcPosition(b, media.type));
  const rows = ordered.slice(0, media.chartThresholds.length).map((s, i): ChartRow => {
    const source = rawRules.chartSongs.find(v => v.id === s.id)!;
    const last = state.publicity.chartPrevious[mediaId]?.indexOf(s.id) ?? -1;
    return { id: s.id, name: source.name, bandName: source.bandName, position: i + 1, lastWeekPosition: last < 0 ? 0 : last + 1, mine: false, rating: media.chartThresholds[i] };
  });
  let rating = media.type === 'Store' ? state.publicity.chartSales : media.type==='TV'?(state.publicity.reporters.find(r=>r.mediaId===mediaId)?.rotation??0)/.2:state.publicity.chartRotation;
  if(media.type==='Store'&&state.gangsta?.tamper)rating=state.gangsta.tamperRating;
  const eligible = state.album && (media.type !== 'Store' || state.day >= state.album.releaseDay && rating > 0) && (media.type!=='TV'||state.video?.completed&&state.video.albumKey===keyFor(state));
  if (eligible) rows.push({ id: 'playerAlbum', name: rawRules.songs.find(s => s.id === state.album!.songId)?.name ?? state.album!.songId,
    bandName: state.album!.bandName, position: 0, lastWeekPosition: state.publicity.chartPrevious[mediaId]?.includes('playerAlbum') ? state.publicity.chartPrevious[mediaId].indexOf('playerAlbum') + 1 : 0, mine: true, rating });
  return rows.sort((a, b) => b.rating - a.rating || Number(b.mine)-Number(a.mine)).slice(0, 10).map((r, i) => ({ ...r, position: i + 1 }));
}

/** Called after the parent increments day. Repeated calls at the same day are no-ops. */
export function advancePublicity<T extends PublicGame>(state: T, musicians: Musician[]): T {
  const p = structuredClone(state.publicity);
  if (state.day <= p.lastDay) return state;
  let money = state.money;
  for (let day = p.lastDay + 1; day <= state.day; day++) {
    const current = { ...state, day, publicity: p };
    const key = keyFor(current);
    if (p.albumKey !== key) {
      p.albumKey = key;
      for (const g of p.groups) { g.albumHype = 0; g.albumExposure = 0; g.willBuy = 0; g.bought = 0; g.likes = 0; }
      p.reviews = []; p.salesHistory = []; p.totalSales = 0; p.grossRoyalties = 0; p.advanceRepaid = Math.min(current.contract?.advance??0,p.earlierAlbumRoyalties??0); p.chart = 0; p.radioChart = 0;
    }
    for (const c of p.concerts) if (!c.completed && day >= c.startDay + c.duration) money += performConcert(current, musicians, c);
    for (const a of p.adverts) {
      if (a.completed) continue;
      const source = rawRules.adverts.find(v => v.id === a.advertId)!, media = rawRules.media.find(m => m.id === a.mediaId)!;
      if (day === a.startDay) addExposure(p, current, a.id, a.duration, source.intensity, media.targets, g => (source.quality + Math.max(-1, liking(current, musicians, g).like)) / 2);
      if (day >= a.startDay + a.duration) a.completed = true;
    }
    reportersTick(current, musicians);
    for (const e of p.exposures) if (e.startDay <= day && day < e.startDay + e.duration) expose(p, e, !!current.contract);
    const released = !!current.album && day >= current.album.releaseDay && !!current.contract;
    let sales = 0;
    if (released) {
      for (let i = 0; i < p.groups.length; i++) {
        const group = p.groups[i], source = rawRules.groups[i];
        group.likes = liking(current, musicians, source).like;
        group.albumHype = Math.max(0, (group.albumHype - 0.005) * 0.962);
        group.willBuy = Math.max(0, (group.willBuy + source.resistance * group.albumHype - 0.0065) * 0.995);
        const bought = Math.max(group.bought, population(current,source) * Math.max(0, (group.likes + freshness(current)) * Math.min(1, group.willBuy)));
        sales += bought - group.bought; group.bought = bought;
      }
      p.totalSales += sales;
      const songwriter = rawRules.songs.find(s => s.id === current.album!.songId)?.royalty ?? 0;
      p.grossRoyalties = p.totalSales * 18 * (1 - songwriter) * current.contract!.royalty;
      p.advanceRepaid = Math.min(current.contract!.advance, (p.earlierAlbumRoyalties??0)+p.grossRoyalties);
      const entitlement = (p.earlierAlbumRoyalties??0)+p.grossRoyalties - p.advanceRepaid;
      // ClassPlayer.transactMoney rounds the transferred amount, while the label
      // tracks exact entitlement in PayedToPlayer (fractional accounts preserved).
      const payment = Math.max(0, entitlement - p.paidRoyalties); money += Math.round(payment); p.paidRoyalties += payment;
    }
    p.salesHistory.push({ day, sales });
    if (ordinal(current) % 7 === 0 || p.chartDay < 0 && released) {
      for (const mediaId of ['Media01', 'Media02', 'Media05']) p.chartPrevious[mediaId] = chartRows(current, mediaId).map(r => r.id);
      prepareCharts(p, ordinal(current) % 7 === 0);
      const week = p.salesHistory.filter(s => s.day > day - 7).reduce((sum, s) => sum + s.sales, 0);
      const store = rawRules.media.find(m => m.id === 'Media05')!;
      p.chart = released&&current.gangsta?.tamper?1+store.chartThresholds.filter(t=>t>current.gangsta!.tamperRating).length:released && week > 0 ? rank(week, store.chartThresholds) : 0;
      const radio = p.reporters.find(r => r.mediaId === 'Media02')!;
      // Reporter.getAlbumRotation reports normalized rotation, not the 0.2-scaled exposure intensity.
      p.radioChart = current.album ? rank(radio.rotation / 0.2, rawRules.media.find(m => m.id === 'Media02')!.chartThresholds) : 0;
      p.chartSales = released ? week : 0; p.chartRotation = radio.rotation / 0.2;
      p.chartDay = day;
      if (p.chart > 0 && p.top10Day === null) p.top10Day = day;
    }
    p.lastDay = day;
  }
  return { ...state, money, publicity: p };
}

export function validPublicity(state: GameState & { publicity?: PublicityState }): boolean {
  const p = state.publicity;
  if(p&&[p.earlierAlbumSales??0,p.earlierAlbumRoyalties??0].some(n=>!Number.isFinite(n)||n<0))return false;
  if (!p || !Number.isInteger(p.seed) || p.seed < 0 || p.seed > 0xffffffff || !Number.isSafeInteger(p.lastDay) || p.lastDay < 0 || p.lastDay > state.day
    || !Number.isSafeInteger(p.nextId) || p.nextId < 1 || !Number.isFinite(p.liveReputation) || Math.abs(p.liveReputation) > 1) return false;
  if (!Array.isArray(p.groups) || p.groups.length !== rawRules.groups.length || !p.groups.every((g, i) => g.id === rawRules.groups[i].id
    && ['bandHype', 'albumHype', 'likes'].every(k => Number.isFinite(g[k as keyof GroupPublicity]))
    && Math.abs(g.bandHype) <= 1 && Math.abs(g.albumHype) <= 1
    && [g.bandExposure, g.albumExposure, g.willBuy, g.bought].every(n => Number.isFinite(n) && n >= 0))) return false;
  if (!Array.isArray(p.reporters) || p.reporters.length !== rawRules.reporters.length || !p.reporters.every((r, i) => r.mediaId === rawRules.reporters[i].mediaId
    && (r.kit === null || typeof r.kit === 'string') && (r.videoKit===undefined||r.videoKit===null||typeof r.videoKit==='string') && [r.albumLike, r.mood, r.bribes, r.ads, r.avoid, r.rotation].every(Number.isFinite)
    && Array.isArray(r.modifiers) && r.modifiers.every(m => Number.isFinite(m.amount) && Number.isSafeInteger(m.endDay)))) return false;
  if (![p.concerts, p.adverts, p.concertResults, p.reviews, p.exposures, p.salesHistory, p.seenResults].every(Array.isArray)) return false;
  if (!Array.isArray(p.chartSongs) || !p.chartSongs.every(s => rawRules.chartSongs.some(v => v.id === s.id) && rawRules.chartMovements.some(v => v.id === s.movementId) && Number.isSafeInteger(s.life) && s.life >= 0)
    || !p.chartPrevious || typeof p.chartPrevious !== 'object' || !Object.values(p.chartPrevious).every(v => Array.isArray(v) && v.every(id => typeof id === 'string'))) return false;
  const date = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (p.firstMediaVisitDay !== null && (!date(p.firstMediaVisitDay) || p.firstMediaVisitDay > state.day)) return false;
  if (!p.concerts.every(c => typeof c.id === 'string' && rawRules.venues.some(v => v.id === c.venueId) && date(c.startDay) && c.duration === 1 && typeof c.completed === 'boolean')) return false;
  if (!p.adverts.every(a => typeof a.id === 'string' && rawRules.adverts.some(v => v.id === a.advertId && v.mediaId === a.mediaId) && date(a.startDay) && date(a.duration) && a.duration > 0 && a.duration <= 100 && typeof a.completed === 'boolean')) return false;
  if (!p.concertResults.every(r => typeof r.id === 'string' && date(r.day) && [r.audience, r.satisfaction, r.income, r.rent].every(n => Number.isFinite(n) && n >= 0) && typeof r.cancelled === 'boolean')) return false;
  if (!p.reviews.every(r => typeof r.id === 'string' && rawRules.media.some(m => m.id === r.mediaId) && date(r.day) && Number.isInteger(r.rating) && r.rating >= 0 && r.rating <= 5 && Number.isFinite(r.quality))) return false;
  if (!p.exposures.every(e => typeof e.id === 'string' && date(e.startDay) && date(e.duration) && e.duration > 0 && Number.isFinite(e.intensity) && e.intensity >= 0
    && e.reach && e.quality && rawRules.groups.every(g => Number.isFinite(e.reach[g.id]) && e.reach[g.id] >= 0 && Number.isFinite(e.quality[g.id])))) return false;
  if (!p.salesHistory.every(s => date(s.day) && Number.isFinite(s.sales) && s.sales >= 0) || !p.seenResults.every(s => typeof s === 'string')) return false;
  return [p.totalSales, p.grossRoyalties, p.paidRoyalties, p.advanceRepaid, p.chartSales, p.chartRotation].every(n => Number.isFinite(n) && n >= 0)
    && [p.chart, p.radioChart].every(n => Number.isInteger(n) && n >= 0 && n <= 10) && (p.top10Day === null || date(p.top10Day));
}

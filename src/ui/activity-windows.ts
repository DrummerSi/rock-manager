import {currentVideo} from '../game/video';
import { pressReviewWindow } from './press-review-window';
import { concertImage } from './concert-picture';
import type { Musician } from '../game/model';
import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import type { GameState } from '../game/model';
import { PUBLICITY_RULES, albumHype, type ConcertResult, type Review, type AdvertBooking, type ConcertBooking } from '../game/publicity';
import { button, frame, infoFrame, text, title } from './canvas-ui';
import { nativeAgenda, originalImageKey, trainingAgendaFormat, type AgendaEntry } from './agenda';
import { cursorStyle } from './cursors';
import { NativeText } from './native-text';
import { nativeChooser } from './native-chooser';
import {missionDefinition,missionCards as scenarioCards} from '../game/mission-catalog';
import originalText from '../game/original-text.json' with { type: 'json' };
const caption = (s: Phaser.Scene, l: Phaser.GameObjects.Container, x: number, y: number, value: string, size = 11, width?: number) => text(s, l, x, y, value, size, '#eeeeee', width).setFontFamily('Verdana').setFontStyle('').setLineSpacing(1);
// Director formats pictures to a fixed text rectangle. Keep dynamic translated
// strings inside that rectangle rather than allowing Phaser's measured text to
// extend over a neighboring row, price or the window controls.
function fittedCaption(s: Phaser.Scene, l: Phaser.GameObjects.Container, x: number, y: number, value: string, width: number, height: number,
    size = 11, font = 'Verdana', bold = false, tracking = 0) {
    const label = caption(s, l, x, y, value, size, width).setFontFamily(font).setFontStyle(bold ? 'bold' : '').setLineSpacing(0);
    if (label instanceof NativeText && font === 'Verdana' && size === 11) label.setNativeAntialias(false).setLetterSpacing(tracking);
    while ((label.height > height || label.width > width) && size > 10) {
        size -= 0.5;
        label.setFontSize(size);
    }
    return label;
}
const cash = (n: number) => '$' + Math.round(n).toLocaleString('en-GB');
const clean = (value: string) => value.replaceAll('\x96', '–').replaceAll('\\n', '\n');
const pic = (s: Phaser.Scene, l: Phaser.GameObjects.Container, x: number, y: number, name: string) => { const image = s.add.image(x, y, originalImageKey(s, name)).setOrigin(0); l.add(image); return image; };
const iconName = (name: string) => 'activity-' + name.replaceAll(' ', '_').toLowerCase();
const ids = (value: string) => [...value.matchAll(/#(\w+)/g)].map(m => m[1]);
function heading(s: Phaser.Scene, l: Phaser.GameObjects.Container, x: number, y: number, label: string, icon?: string) {
    const start=l.list.length;
    const width = icon ? pic(s, l, x + 2, y, icon).width : 0;
    const cx = x + width + 4;
    const labelObject = caption(s, l, cx, y + 7, label).setFontStyle('bold');
    const backing = frame(s,l,x,y+3,cx+labelObject.width+5-x,labelObject.height+11,'panel',false,'#313131');
    l.moveTo(backing,start);
}
function infoPanel(s: Phaser.Scene, l: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, icon?: string) { heading(s, l, x, y, label, icon); frame(s, l, x, y + 22, width, height - 22, 'outer'); frame(s, l, x + 5, y + 27, width - 10, height - 32, 'inner'); }
function click(image: Phaser.GameObjects.Image, action: () => void, enabled = true) { if (!enabled) {
    image.setAlpha(.4);
    return;
} let pressed = false; image.setInteractive({ cursor: cursorStyle('active') }); image.on('pointerdown', () => { pressed = true; }); image.on('pointerout', () => { pressed = false; }); image.on('pointerup', () => { if (pressed)
    action(); pressed = false; }); }
export function activityEvents(state: GameState): AgendaEntry[] {
    const video=currentVideo(state);
    return [
        ...(state.gangsta?.security??[]).map((e,i)=>({id:'security-'+i,kind:'security' as const,name:'Body Guards',startDay:e.startDay,duration:e.duration})),
        ...(state.tour?[{id:'band-tour',kind:'concert' as const,formatId:'AgFmBandTour',name:'World Tour',startDay:state.tour.startDay,duration:state.tour.duration}]:[]),
        ...(video?[{id:'video-production',kind:'video' as const,name:'Video',startDay:video.startDay,duration:video.duration}]:[]),
        ...(state.scenario?.appointments??[]).map(a=>({id:a.id,kind:'concert' as const,formatId:a.kind==='prison'?'AgFmPrison':a.kind==='hospital'?'AgFmHospital':a.kind==='award'?'AgFmAward':a.kind==='interview'?'AgFmExpoMediaActivity':undefined,name:a.kind==='prison'?'Prison':a.kind==='hospital'?'Hospital':a.kind==='award'?'Award':a.id==='mis9radioBookingObj'?'Radio FM':a.kind==='interview'?'Zer0 Magazine':a.id.startsWith('ECOCMis9')?(scenarioCards.find(c=>c.ID===a.id)?.Headline??a.id):a.kind==='television'?'Stars of Cheese — TV24':'Global Aid — Colosseum',startDay:a.startDay,duration:a.duration})),
        ...state.bandmates.training.map(t => ({id:t.id,kind:'training' as const,formatId:trainingAgendaFormat(t.actionId),name:data.activities.tables.Action.find(a => a.ID===t.actionId)?.name ?? 'Training',startDay:t.startDay,duration:t.duration})),
        ...(state.album ? [{ id: 'album-release', kind: 'release' as const, name: 'Album release', startDay: state.album.releaseDay, duration: 1 }] : []),
        ...state.publicity.concerts.map((c: ConcertBooking) => ({ id: c.id, kind: 'concert' as const, name: PUBLICITY_RULES.venues.find(v => v.id === c.venueId)?.name ?? 'Concert', startDay: c.startDay, duration: c.duration })),
        ...state.publicity.adverts.map((a: AdvertBooking) => ({ id: a.id, kind: 'advert' as const, name: PUBLICITY_RULES.adverts.find(v => v.id === a.advertId)?.name ?? 'Advert', startDay: a.startDay, duration: a.duration })),
    ];
}
export function venueWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, venueId: string, schedule: () => void, close: () => void): void {
    const venue = PUBLICITY_RULES.venues.find(v => v.id === venueId)!;
    frame(scene, layer, 142, 123, 510, 300, 'dialog');
    title(scene, layer, 142, 123, venue.name, iconName('icon_spotlight01'));
    pic(scene, layer, 165, 161, 'frame01');
    pic(scene, layer, 168, 164, venueId.toLowerCase() + '_environment01');
    heading(scene, layer, 412, 165, 'Info', 'icon_spotlight02');
    frame(scene, layer, 412, 187, 224, 157, 'outer');
    frame(scene, layer, 417, 192, 214, 64, 'inner');
    frame(scene, layer, 417, 259, 214, 80, 'inner');
    for (const [i, label, value] of [[0, 'Min. age', venue.minimumAge + ' Years'], [1, 'Max. audience', String(venue.size)], [2, 'Ticket Price', cash(venue.ticketPrice)], [3, 'Cost', cash(venue.rent)]] as const) {
        caption(scene, layer, 425, 198 + i * 14, label).setFontStyle('bold');
        caption(scene, layer, 521, 198 + i * 14, value);
    }
    caption(scene, layer, 425, 265, 'Description').setFontStyle('bold').setLetterSpacing(-1);
    fittedCaption(scene, layer, 425, 279, clean(venue.description), 199, 55, 11, 'Verdana', false, -1).setLineSpacing(1);
    button(scene, layer, 248, 368, 167, 'Schedule Show', schedule, Boolean(state.demo) && state.band.some(Boolean), 33, 'calendar');
    button(scene, layer, 424, 368, 106, 'Cancel', close, true, 33, 'cancel');
}
export function mediaWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, mediaId: string, offset: number, scroll: (offset: number) => void, action: (categoryId: string) => void, close: () => void): void {
    const media = PUBLICITY_RULES.media.find(m => m.id === mediaId)!, source = data.activities.tables.media.find(m => m.ID === mediaId)!;
    frame(scene, layer, 207, 46, 362, 505, 'dialog');
    title(scene, layer, 207, 46, media.name, iconName(source.icon));
    pic(scene, layer, 224, 81, 'frame02 large environment');
    if(mediaId!=='Media01')pic(scene, layer, 227, 84, mediaId.toLowerCase() + '-neutral');
    infoPanel(scene, layer, 227, 310, 317, 56, 'Comment', source.icon.replace(/01$/, '02'));
    fittedCaption(scene, layer, 236, 341, clean(media.description), 298, 17, 11, 'Verdana');
    const categories = ids(source.Actions).map(id => data.activities.tables.ActionCategory.find(c => c.ID === id)!);
    const categoryLabel=caption(scene, layer, 233, 377, 'Category').setFontStyle('bold');
    const categoryHead=frame(scene,layer,227,373,categoryLabel.width+11,categoryLabel.height+8,'panel',false,'#313131');
    layer.moveTo(categoryHead,layer.list.indexOf(categoryLabel));
    frame(scene, layer, 227, 389, 280, 100, 'outer');
    frame(scene, layer, 232, 394, 270, 90, 'inner');
    categories.slice(offset, offset + 2).forEach((category, index) => {
        const y = 396 + index * 44, reporter = state.publicity.reporters.find(r => r.mediaId === mediaId);
        const key=`${state.demo?.songId}:${state.demo?.recordedDay}`;
        const disabled = category.ID === 'ActCatMediaVideo' ? (!currentVideo(state)?.completed||reporter?.videoKit===key) : category.ID === 'ActCatMediaPresskit' && (!state.album || reporter?.kit === key);
        const bitmap = data.activities.bitmaps.find(b => b.name.toLowerCase() === category.Gfx.toLowerCase());
        const icon = pic(scene, layer, 257 - (bitmap?.regX ?? 18), y + 21 - (bitmap?.regY ?? 19), category.Gfx);
        if (disabled)
            icon.setAlpha(.3);
        const name = fittedCaption(scene, layer, 284, y, category.name, 213, 14, 11, 'Verdana', true);
        const description = fittedCaption(scene, layer, 284, y + 14, clean(category.comment).replaceAll('<¤CPlace.name>', media.name), 213, 29, 11, 'Verdana');
        // Source category BG is42px, with first line bold and the complete
        // text block vertically centered. The scroller includes a separator.
        const blockHeight = name.height + description.height;
        name.y = y + Math.max(0, (42 - blockHeight) / 2 - 2);
        description.y = name.y + name.height;
        if (disabled) {
            name.setAlpha(.3);
            description.setAlpha(.3);
        }
        const hit = scene.add.zone(234, y, 268, 44).setOrigin(0);
        layer.add(hit);
        hit.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => scroll(Phaser.Math.Clamp(offset + Math.sign(dy), 0, Math.max(0, categories.length - 2))));
        if (!disabled)
            hit.setInteractive({ cursor: cursorStyle('active') }).on('pointerup', () => action(category.ID));
    });
    const max = Math.max(0, categories.length - 2), next = (amount: number) => scroll(Phaser.Math.Clamp(offset + amount, 0, max));
    click(pic(scene, layer, 509, 380, 'RockScrollArrowUp'), () => next(-1), offset > 0);
    click(pic(scene, layer, 509, 461, 'RockScrollArrowDown'), () => next(1), offset < max);
    pic(scene, layer, 516, 408, 'BehindScrollerPic').setDisplaySize(13, 51);
    const thumb = pic(scene, layer, 513, 406 + (max ? offset / max * 33 : 0), 'RockScrollBarPic');
    if (max) {
        thumb.setInteractive({ cursor: cursorStyle('active'), draggable: true });
        scene.input.setDraggable(thumb);
        thumb.on('drag', (_p: Phaser.Input.Pointer, _x: number, y: number) => { thumb.y = Phaser.Math.Clamp(y, 406, 439); });
        thumb.on('dragend', () => scroll(Math.round((thumb.y - 406) / 33 * max)));
    }
    const wheel = scene.add.zone(227, 389, 317, 100).setOrigin(0).setInteractive();
    layer.addAt(wheel, 2);
    wheel.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => next(Math.sign(dy)));
    button(scene, layer, 349, 499, 76, 'OK', close, true, 33, 'accept');
}
export function advertWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, mediaId: string, advertId: string, duration: number, startDay: number, firstDay: number, change: (direction: number) => void, days: (direction: number) => void, choose: (day: number) => void, scroll: (direction: number) => void, allowed: (day: number) => boolean, confirm: () => void, cancel: () => void): void {
    const media = PUBLICITY_RULES.media.find(m => m.id === mediaId)!, source = data.activities.tables.media.find(m => m.ID === mediaId)!, advert = PUBLICITY_RULES.adverts.find(a => a.id === advertId)!;
    const content = scene.add.container(); layer.add(content);
    const campaign = nativeChooser(scene, content, {x:275,y:132,label:'Select ad type',value:advert.name + ' ' + cash(advert.price * duration),textRight:210,previous:()=>change(1),next:()=>change(-1)});
    const campaignDays = nativeChooser(scene, content, {x:275+campaign.width+10,y:132,label:'No. of days',value:String(duration),textRight:50,previous:()=>days(-1),next:()=>days(1),nextEnabled:duration>1});
    const width = Math.max(600,campaignDays.container.x+campaignDays.width,campaignDays.container.x+campaignDays.head.width)+20-142;
    const surround = frame(scene, content, 142, 96, width, 360, 'dialog'); content.sendToBack(surround);
    title(scene, content, 142, 96, 'Buy Ad', iconName(source.icon));
    pic(scene, content, 163, 137, 'image_' + mediaId.toLowerCase() + '_small01');
    const adSource = data.activities.tables.ExpoAd.find(a=>a.ID===advertId)!;
    caption(scene, content, 277, 188, clean(adSource.comment), 11, 333);
    nativeAgenda(scene, content, state, 163, 235, firstDay, [...activityEvents(state), { id: 'draft-advert', kind: 'advert', name: advert.name, startDay, duration, selected: true }], choose, scroll, allowed);
    const pairWidth = 81+9+109, pairX = 142+(width-20)/2-pairWidth/2;
    button(scene, content, pairX, 403, 81, 'OK', confirm, state.money >= advert.price * duration, 33, 'calendar');
    button(scene, content, pairX+90, 403, 109, 'Cancel', cancel, true, 33, 'cancel');
}
export function concertBookWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, venueId: string, startDay: number, firstDay: number, choose: (day: number) => void, scroll: (direction: number) => void, allowed: (day: number) => boolean, confirm: () => void, cancel: () => void): void {
    const venue = PUBLICITY_RULES.venues.find(v => v.id === venueId)!;
    frame(scene, layer, 160, 90, 477, 345, 'dialog');
    title(scene, layer, 160, 90, 'Schedule Show', 'calendar-title');
    pic(scene, layer, 180, 127, 'image_' + venueId.toLowerCase() + '_small01');
    caption(scene, layer, 281, 125, venue.name).setFontStyle('bold');
    fittedCaption(scene, layer, 281, 151, clean(venue.description), 333, 37);
    caption(scene, layer, 281, 191, `Ticket Price ${cash(venue.ticketPrice)}   Cost ${cash(venue.rent)}`);
    nativeAgenda(scene, layer, state, 180, 214, firstDay, [...activityEvents(state), { id: 'draft-concert', kind: 'concert', name: venue.name, startDay, duration: 1, selected: true }], choose, scroll, allowed);
    button(scene, layer, 304, 382, 77, 'OK', confirm, state.money >= venue.rent, 33, 'calendar');
    button(scene, layer, 385, 382, 109, 'Cancel', cancel, true, 33, 'cancel');
}
export function agendaWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, firstDay: number, scroll: (direction: number) => void, close: () => void): void {
    // Main.dxr DlgAdminScript / DlgAdminData: one combined Admin screen.
    frame(scene,layer,170,80,478,494,'dialog');
    const album=infoFrame(scene,layer,190,113,188,98,'Album Info','cd');
    const objectives=infoFrame(scene,layer,420,113,188,84,'Objectives','activity-icon_effect02');
    const debt=(state.publicity.earlierAlbumRoyalties??0)+state.publicity.grossRoyalties-state.publicity.paidRoyalties-(state.contract?.advance??0);
    const rows:[string,string][]=[
        ['copies sold',state.demo?Math.ceil(state.publicity.totalSales).toLocaleString('en-GB'):'-'],
        ['royalty',state.contract?(state.contract.royalty*100).toFixed(1)+'%':'-'],
        ['Revenue',state.contract&&state.demo?cash(state.publicity.grossRoyalties):'-'],
        ['Advance',state.contract?cash(state.contract.advance):'-'],
        [debt<=0?'Recoup':'Earned',state.demo&&state.contract?cash(debt):'-'],
        ['All albums',(state.publicity.earlierAlbumSales??0)+state.publicity.totalSales?Math.ceil((state.publicity.earlierAlbumSales??0)+state.publicity.totalSales).toLocaleString('en-GB'):'-'],
    ];
    caption(scene,layer,album.x,album.y,state.demo?data.songs.find(s=>s.id===state.demo!.songId)?.name??'-':'-',11,188).setFontStyle('bold');
    rows.forEach(([label,value],i)=>{caption(scene,layer,album.x,album.y+14*(i+1),label);caption(scene,layer,album.x+96,album.y+14*(i+1),value);});
    caption(scene,layer,objectives.x,objectives.y,missionDefinition(state.missionId).objectives.join('\n'),11,188).setLineSpacing(0);
    const key=state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null;
    const history=[...(state.agendaHistory??[]).filter(p=>p.day<state.day),{day:state.day,balance:state.money,albumKey:key,hype:albumHype(state),sales:state.publicity.totalSales}];
    const albumHistory=history.filter(p=>key&&p.albumKey===key);
    const graphs=[{name:'Balance',color:0x276078,points:history.map(p=>({day:p.day,value:p.balance}))},
        ...(state.demo?[
            {name:'CDs sold',color:0x93640c,points:albumHistory.map(p=>({day:p.day,value:p.sales}))},
            {name:'Album hype',color:0xcc3333,percent:true,points:albumHistory.map(p=>({day:p.day,value:p.hype}))},
        ]:[])];
    nativeAgenda(scene,layer,state,190,262,firstDay,activityEvents(state),null,scroll,()=>true,graphs);
    button(scene,layer,379,521,81,'OK',close,true,33,'accept');
}
export function mediaActionWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, mediaId: string, actionId: string, choose: (direction: number) => void, confirm: () => void, cancel: () => void): void {
    const source = data.activities.tables.Action.find(a => a.ID === actionId)!, media = PUBLICITY_RULES.media.find(m => m.id === mediaId)!;
    const video=actionId==='ActMediaTVGiveVideoClip';
    const kit = actionId === 'ActMediaGivePressKit'||video;
    frame(scene, layer, 100, 100, 340, 243, 'dialog');
    title(scene, layer, 100, 100, video?'Video':kit ? 'Press Kit' : 'Gifts', iconName(video?'icon_film01':kit ? 'icon_cd01' : 'icon_present_red01'));
    pic(scene, layer, 119, 139, 'portrait_frame_large01');
    const bitmap = data.activities.bitmaps.find(b => b.name.toLowerCase() === source.Gfx.toLowerCase())!;
    pic(scene, layer, 171 - bitmap.regX!, 190 - bitmap.regY!, source.Gfx);
    const name = caption(scene, layer, 238, 135, source.name.trim(), 11, 182).setFontStyle('bold');
    const person = data.activities.tables.Human.find(h => h.ID === data.activities.tables.media.find(m => m.ID === mediaId)?.Human)?.name ?? data.activities.tables.Reporter.find(r => r.ID === data.activities.tables.media.find(m => m.ID === mediaId)?.Human)?.name ?? media.name;
    const description = caption(scene, layer, 238, name.y+name.height+13, clean(source.comment).replaceAll('<¤CHuman.name>', person), 11, 182);
    if (Number(source.price) > 0)
        caption(scene, layer, 238, description.y + description.height + 13, 'Price: ' + cash(Number(source.price)));
    if (!kit) {
        click(pic(scene, layer, 119, 289, 'ArrowLeft'), () => choose(-1));
        click(pic(scene, layer, 376, 289, 'ArrowRight'), () => choose(1));
    }
    button(scene, layer, 175, 289, 77, 'OK', confirm, state.money >= Number(source.price), 33, 'accept');
    button(scene, layer, 256, 289, 109, 'Cancel', cancel, true, 33, 'cancel');
}
export function resultWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, musicians: Musician[], result: ConcertResult | Review, close: () => void): void {
    if ('venueId' in result) {
        const venue = PUBLICITY_RULES.venues.find(v => v.id === result.venueId)!;
        const originalLayer = layer; layer = scene.add.container(); originalLayer.add(layer);
        const translations = originalText.translations as Record<string,string>;
        const fill = result.audience / venue.size;
        const audienceBucket = fill <= .25 ? 1 : fill <= .75 ? 2 : 3;
        const qualityBucket = result.satisfaction <= .25 ? 1 : result.satisfaction <= .5 ? 2 : result.satisfaction <= .75 ? 3 : 4;
        const commentKey = `szidConcertFb${qualityBucket}${audienceBucket}1${venue.id}`;
        let comment = translations[commentKey] ?? '';
        const visited = new Set<string>();
        while (translations[comment] && !visited.has(comment)) { visited.add(comment); comment = translations[comment]; }
        comment = clean(comment).replace(/<¤Cband\.name>/gi,state.bandName);
        let bottom = 478;
        if (comment && !result.cancelled) {
            const head = caption(scene, layer, 159, 351, translations.szidConcertHeadComment, 11, 231).setFontStyle('bold').setLetterSpacing(-1);
            if (head instanceof NativeText) head.setNativeAntialias(false);
            const body = caption(scene, layer, 159, head.y+head.height+13, comment, 11, 231).setLetterSpacing(-1);
            if (body instanceof NativeText) body.setNativeAntialias(false);
            bottom = Math.max(bottom,body.y+body.height+20);
        }
        const surround = frame(scene, layer, 142, 123, 510, bottom-123, 'dialog'); layer.sendToBack(surround);
        title(scene, layer, 142, 123, venue.name, iconName('icon_spotlight01'));
        pic(scene, layer, 159, 156, 'frame01');
        concertImage(scene, layer, 162, 159, state, musicians, venue.id, result.audience, venue.size);
        infoPanel(scene, layer, 420, 156, 211, 62, 'Quality', 'icon_prize podium02');
        if (result.cancelled)
            caption(scene, layer, 429, 189, 'Cancelled', 11, 194);
        else
            pic(scene, layer, 429, 186, 'meter_stars' + String(Math.trunc(Phaser.Math.Clamp(result.satisfaction,0,1) * 10)).padStart(2, '0'));
        infoPanel(scene, layer, 420, 221, 211, 94, 'Venue', 'icon_spotlight02');
        caption(scene, layer, 429, 254, 'Max. audience: ' + venue.size + '\nMin. age: ' + venue.minimumAge + ' Years\nTicket Price: ' + cash(venue.ticketPrice) + '\nRoyalty: ' + Math.round(venue.royalty * 100) + '%', 11, 194).setFontFamily('Arial').setLineSpacing(0);
        infoPanel(scene, layer, 420, 318, 211, 101, 'Results', 'icon_money02');
        caption(scene, layer, 429, 351, 'Audience: ' + Math.round(result.audience) + '\nTickets Revenue: ' + cash(result.income) + '\nRent: ' + cash(result.rent) + '\nTotal: ' + cash(result.income - result.rent), 11, 194).setFontFamily('Arial').setLineSpacing(0);
        button(scene, layer, 484, 435, 81, 'OK', close, true, 33, 'accept');
    }
    else {
        pressReviewWindow(scene, layer, state, musicians, result, close);
    }
}
export interface ChartRow {
    name: string;
    position: number;
    lastWeekPosition: number;
    mine: boolean;
    rating: number;
}
export function chartWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, mediaId: string, rows: ChartRow[], close: () => void): void {
    const source = data.activities.tables.media.find(m => m.ID === mediaId)!;
    frame(scene, layer, 192, 76, 345, 338, 'dialog');
    title(scene, layer, 192, 76, 'Billboard', iconName('icon_prize podium01'));
    pic(scene, layer, 210, 107, source.ChartPic);
    caption(scene, layer, 329, 119, mediaId === 'Media05' ? 'Sales' : 'Playlist', 12, 170).setColor('#000000').setFontStyle('bold');
    rows.slice(0, 10).forEach((row, index) => { caption(scene, layer, 252, 141 + index * 18, row.name, 11, 210).setColor('#000000').setFontFamily('Arial'); caption(scene, layer, 475, 141 + index * 18, row.lastWeekPosition > 0 ? String(row.lastWeekPosition) : '-', 11).setColor('#000000').setFontFamily('Arial'); if (row.mine)
        pic(scene, layer, 234, 148 + index * 18, 'playlist01_highlight').setOrigin(.5); });
    button(scene, layer, 318, 362, 76, 'OK', close, true, 33, 'accept');
}

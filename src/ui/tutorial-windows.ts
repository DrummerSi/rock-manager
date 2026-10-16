import { NativeText } from './native-text';
import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import business from '../generated/music-business.json';
import {originalImageKey} from './agenda';
import type { GameState, Musician, Song, Instrument } from '../game/model';
import type { Label, MixChannel, Studio } from '../game/recording';
import { button, frame, text, title, infoFrame } from './canvas-ui';
import { cursorStyle } from './cursors';
import { nativeKnob, nativeToggle, registeredImage } from './mixer-controls';
import { nativeChooser } from './native-chooser';
import { defaultEffects, SESSION_INSTRUMENTS } from '../game/recording';
import type { ChannelEffects } from '../game/recording';

const cash = (value: number) => `$${value.toLocaleString('en-GB')}`;
const image = (scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, key: string) => {
  const sprite = scene.add.image(x, y, key).setOrigin(0); layer.add(sprite); return sprite;
};
const caption = (scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, content: string, width?: number) =>
  text(scene, layer, x, y, content, 12, '#cccccc', width).setFontFamily('Courier New');
const clickImage = (sprite: Phaser.GameObjects.Image, action: () => void, enabled = true) => {
  if (!enabled) { sprite.setAlpha(0.4); return; }
  let pressed = false;
  sprite.setInteractive({ cursor: cursorStyle('active') });
  sprite.on('pointerdown', () => { pressed = true; });
  sprite.on('pointerout', () => { pressed = false; });
  sprite.on('pointerup', () => { const activate = pressed; pressed = false; if (activate) action(); });
};

export function studioWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, studio: Studio, songs: Song[], songId: string,
  chooseSong: (id: string) => void, start: () => void, close: () => void): void {
  frame(scene, layer, 125, 140, 555, 310, 'dialog');
  title(scene, layer, 125, 140, studio.name, 'mixer-title');
  image(scene, layer, 149, 178, 'frame01');
  image(scene, layer, 152, 181, `${studio.id.toLowerCase()}_environment01`);
  image(scene, layer, 402, 174, 'ui-mixer');
  caption(scene, layer, 447, 180, 'Studio info').setFontFamily('Verdana').setFontSize(11).setFontStyle('bold');
  frame(scene, layer, 402, 201, 253, 162, 'inner');
  caption(scene, layer, 411, 210, `No. of channels: ${studio.channels}\nPrice: ${cash(studio.price)}`, 237).setFontSize(11);
  caption(scene, layer, 411, 252, 'Description').setFontFamily('Verdana').setFontSize(11).setFontStyle('bold');
  caption(scene, layer, 411, 272, studio.description, 234).setFontFamily('Arial').setFontSize(11).setLineSpacing(1);
  const song = songs.find((s) => s.id === songId);
  const position = songs.findIndex((s) => s.id === songId);
  nativeChooser(scene, layer, {x:150,y:379,label:'Song',value:song?.name ?? 'No licensed song',textRight:200,
    previous:()=>chooseSong(songs[position-1].id),next:()=>chooseSong(songs[position+1].id),
    previousEnabled:position>0,nextEnabled:position>=0&&position<songs.length-1});
  // DlgStudioData: pair centered on InfoDlg, 23px below ChooseSong's top.
  button(scene, layer, 385, 402, 135, 'Record', start, Boolean(song) && state.band.some(Boolean) && state.money >= studio.price, 33, 'microphone');
  button(scene, layer, 526, 402, 132, 'Cancel', close, true, 33, 'cancel');
}

export function mixerWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, musicians: Musician[], studio: Studio, song: Song,
  playing: boolean, master: number, change: (index: number, patch: Partial<MixChannel>) => void,
  settings: (index: number) => void, preview: () => void, stop: () => void, volume: (value: number) => void, finish: () => void): void {
  // ChannelScript and DlgMixerScript positions, with their unscaled original art.
  // Native capture 002: the desk sits inside a 701x417 Director dialog.
  frame(scene, layer, 51, 91, 701, 417, 'dialog');
  title(scene, layer, 51, 92, '', 'mixer-title');
  image(scene, layer, 279, 149, 'background_mixer_rack01');
  image(scene, layer, 279, 418, 'background_mixer_rack01');
  image(scene, layer, 67, 127, 'background_mixer_control01');
  image(scene, layer, 114, 145, `${studio.id.toLowerCase()}_environment01`).setDisplaySize(113, 89);
  caption(scene, layer, 79, 262, song.name, 187).setFontSize(11);
  const skinButton = (x: number, y: number, key: string, action: () => void) => {
    const sprite = registeredImage(scene, layer, x, y, key).setInteractive({ cursor: cursorStyle('active') });
    let pressed = false;
    sprite.on('pointerdown', () => { pressed = true; });
    sprite.on('pointerout', () => { pressed = false; });
    sprite.on('pointerup', () => { if (pressed) action(); pressed = false; });
  };
  skinButton(102, 397, playing ? 'button_playback_play02' : 'button_playback_play01', preview);
  skinButton(153, 397, playing ? 'button_playback_stop01' : 'button_playback_stop02', stop);
  nativeKnob(scene, layer, 286, 370, true, 0, 0.9, master, volume, 'mixer-knob-master');
  state.recording!.channels.forEach((channel, index) => {
    const x = 291 + index * 60;
    image(scene, layer, x, 127, 'background_mixer_channel01');
    const musician = musicians.find((m) => m.id === channel.musicianId);
    const portrait = musician?.smallPortrait ?? (channel.musicianId ? 'portrait_actor00_small' : 'portrait_actorempty_small');
    const portraitInfo = data.tutorialMedia.find((m) => m.key === portrait);
    // City cast portraits use the same centered face anchor; the session
    // placeholder's retained registration point is available in RockMaterial.
    const face = image(scene, layer, x + 37 - (portraitInfo?.regX ?? 23), 161 - (portraitInfo?.regY ?? 25), portrait);
    clickImage(face, () => settings(index));
    // The normal Settings button is already painted into the channel bitmap.
    const settingsHit = scene.add.zone(x + 10, 188, 40, 22).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    layer.add(settingsHit);
    let settingsPressed = false;
    settingsHit.on('pointerdown', () => { settingsPressed = true; });
    settingsHit.on('pointerout', () => { settingsPressed = false; });
    settingsHit.on('pointerup', () => { if (settingsPressed) settings(index); settingsPressed = false; });
    const instrumentKey = { Guitar: 'guitar', Keyboards: 'keyboards', Bass: 'bass', Drums: 'drums', Vocals: 'vocals' }[channel.instrument];
    const registration = data.iconRegistrations[instrumentKey as keyof typeof data.iconRegistrations];
    const icon = image(scene, layer, x + 30 - registration.regX, 223 - registration.regY, `ui-${instrumentKey}`);
    clickImage(icon, () => settings(index));
    nativeKnob(scene, layer, x + 78, 253, false, -100, 100, channel.pan, (pan) => change(index, { pan: Math.round(pan) }), `mixer-knob-pan-${index}`);
    nativeToggle(scene, layer, x + 27, 323, 'button_mute01', 'button_mute02', channel.muted, (muted) => change(index, { muted }));
    const thumb = image(scene, layer, x + 5, 430 - channel.volume * 0.85, 'button_slider01').setInteractive({ cursor: cursorStyle('active') });
    const setVolume = (pointer: Phaser.Input.Pointer) => {
      const value = Math.round(Phaser.Math.Clamp((436 - pointer.y) / 0.85, 0, 100));
      thumb.y = 430 - value * 0.85; change(index, { volume: value });
    };
    scene.input.setDraggable(thumb); thumb.on('drag', setVolume);
    const track = scene.add.rectangle(x + 3, 340, 30, 105, 0xffffff, 0).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    layer.add(track); track.on('pointerdown', setVolume);
    layer.bringToTop(thumb);
  });
  button(scene, layer, 132, 458, 76, 'OK', finish, true, 33, 'accept');
}

function studioMusicianSheet(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  musicians: Musician[], channel: MixChannel, choose?: () => void): Phaser.GameObjects.Container {
  const layer = scene.add.container(x - 117, y - 114); parent.add(layer);
  const member = musicians.find((m) => m.id === channel.musicianId);
  const hired = data.tutorialGameplay.sessionMusicians.find((m) => m.id === channel.musicianId);
  // DlgMixerFXData -> DlgMusicianStudioInfoData: paper, frame, photo, info and two meters.
  image(scene, layer, 117, 114, 'musician_paper01');
  image(scene, layer, 124, 124, 'musician-frame');
  const portrait = image(scene, layer, 127, 127, member ? `portrait-${member.id}` : 'portrait-studio-musician');
  if (channel.instrument !== 'Vocals' && choose) clickImage(portrait, choose);
  caption(scene, layer, 234, 128, (member?.name ?? hired?.name ?? '').split(' ')[0], 160).setColor('#000000').setFontFamily('Verdana').setFontSize(11).setFontStyle('bold');
  // The original GDI labels are aliased glyphs. Preserve their native lettering
  // instead of regenerating these fixed English strings through browser fonts.
  ['age', 'style', 'skill', 'star-quality'].forEach((label, i) => image(scene, layer, 234, 150 + i * 14, `native-studio-label-${label}`));
  caption(scene, layer, 314, 150, String(member?.age ?? hired?.age ?? ''), 80).setColor('#000000').setFontFamily('Verdana').setFontSize(11);
  caption(scene, layer, 314, 164, member?.genre ?? hired?.genre ?? '-', 80).setColor('#000000').setFontFamily('Verdana').setFontSize(11);
  const nativeMeter = (y: number, fraction: number) => {
    const x = 314, bg = data.tutorialMedia.find((m) => m.key === 'meter02_background01')!;
    image(scene, layer, x, y, bg.key);
    const parts = ['left', 'mid', 'right'].map((suffix) => data.tutorialMedia.find((m) => m.key === `meter02_line01${suffix}`)!);
    const middle = Math.max(0, Math.round(65 * Phaser.Math.Clamp(fraction, 0, 1)) - 8);
    const left = x + bg.regX - parts[0].regX;
    image(scene, layer, left, y + bg.regY - parts[0].regY, parts[0].key);
    if (middle) image(scene, layer, left + 3, y + bg.regY - parts[1].regY, parts[1].key).setDisplaySize(middle, parts[1].height);
    image(scene, layer, left + 3 + middle, y + bg.regY - parts[2].regY, parts[2].key);
  };
  for (const object of layer.list) if (object instanceof NativeText) object.setNativeAntialias(false);
  nativeMeter(182, member?.musicality ?? hired?.musicality ?? 0);
  nativeMeter(196, member?.charisma ?? hired?.charisma ?? 0);
  return layer;
}

export function channelSettingsWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, musicians: Musician[],
  channel: MixChannel, availableEffects: string[], change: (effects: ChannelEffects) => void, cycle: (direction: number) => void,
  musician: () => void, preview: () => void, close: () => void): void {
  const hasShift = availableEffects.includes('FXTimeShift');
  const bottom = hasShift ? 448 : 395;
  frame(scene, layer, 102, 77, 312, bottom - 77 + 54, 'dialog');
  title(scene, layer, 102, 77, 'Settings', 'mixer-title');
  studioMusicianSheet(scene, layer, 117, 114, musicians, channel, musician);
  let effects = structuredClone(channel.effects ?? defaultEffects());
  const update = () => change(structuredClone(effects));
  const row = (kind: 'delay' | 'timeShift', y: number) => {
    image(scene, layer, 118, y, kind === 'delay' ? 'background_mixer_effect_delay01' : 'background_mixer_effect_timeshift01');
    nativeToggle(scene, layer, 178, y + 36, 'button_mute01', 'button_mute02', effects[kind].active, (active) => { effects[kind].active = active; update(); });
    nativeKnob(scene, layer, 279, y, false, 0, 1, effects[kind].mix, (mix) => { effects[kind].mix = mix; update(); }, '', true);
    if (kind === 'delay') {
      const notes = ['32', '16T', '16', '8T', '8', '4T', '4'];
      const note = caption(scene, layer, 289, y + 5, notes[Math.round(effects.delay.time * 6)]).setFontSize(10).setColor('#00ff00');
      nativeKnob(scene, layer, 323, y, false, 0, 1, effects.delay.time, (time) => { effects.delay.time = time; note.setText(notes[Math.round(time * 6)]); update(); }, '', true);
      nativeKnob(scene, layer, 388, y, false, 0, 1, effects.delay.decay, (decay) => { effects.delay.decay = decay; update(); }, '', true);
    } else {
      nativeToggle(scene, layer, 270, y + 26, 'button_switch01', 'button_switch02', effects.timeShift.mode, (mode) => { effects.timeShift.mode = mode; update(); });
      nativeKnob(scene, layer, 356, y, false, 0, 1, effects.timeShift.depth, (depth) => { effects.timeShift.depth = depth; update(); }, '', true);
      nativeKnob(scene, layer, 395, y, false, 0, 1, effects.timeShift.freq, (freq) => { effects.timeShift.freq = freq; update(); }, '', true);
    }
  };
  row('delay', 257);
  if (hasShift) row('timeShift', 310);
  const y = hasShift ? 383 : 330;
  const instrumentKey = { Guitar: 'guitar', Keyboards: 'keyboards', Bass: 'bass', Drums: 'drums', Vocals: 'vocals' }[channel.instrument];
  const loop = data.tutorialGameplay.loops.find((l) => l.id === channel.loopId)!;
  const loops = data.tutorialGameplay.loops.filter((l) => l.songId === state.recording!.songId && l.instrument === channel.instrument);
  const loopIndex = loops.findIndex((l) => l.id === channel.loopId);
  nativeChooser(scene,layer,{x:118,y,label:'Loop',value:loop.name,icon:`ui-${instrumentKey}`,textRight:238,
    previous:()=>cycle(-1),next:()=>cycle(1),previousEnabled:loopIndex>0,nextEnabled:loopIndex<loops.length-1});
  button(scene, layer, 147, bottom, 125, 'Preview', preview, true, 33, 'preview');
  button(scene, layer, 275, bottom, 76, 'OK', close, true, 33, 'accept');
}

/** DlgRecordData / DlgRecordNoContractData, at source loc(142,76). */
export function labelWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, label: Label, submit: () => void, close: () => void, choose:(id:string)=>void): void {
  const signed=state.contract?.labelId===label.id;
  const body=text(scene,layer,175,372,label.description,11,'#eeeeee',304).setFontFamily('Verdana').setLineSpacing(0);
  (body as NativeText).setNativeAntialias(false);
  const bodyHeight=Math.max(16,body.height),buttonY=341+bodyHeight+41+14;
  body.setVisible(!signed);
  const border=frame(scene,layer,142,76,signed?366:371,signed?501:buttonY+53-76,'dialog');layer.sendToBack(border);
  title(scene,layer,142,76,label.name,'golden-record');
  image(scene,layer,signed?159:164,signed?111:115,originalImageKey(scene,'frame02 large environment'));
  if(!signed){
    infoFrame(scene,layer,166,341,304,bodyHeight,'Company info','golden-record');layer.bringToTop(body);
    button(scene,layer,195,buttonY,134,'Play Demo',submit,Boolean(state.demo)&&!state.recording,33,'cd');
    button(scene,layer,335,buttonY,130,'Cancel',close,true,33,'cancel');return;
  }
  const heading=caption(scene,layer,168,349,'Category').setFontFamily('Verdana').setFontSize(11).setFontStyle('bold');
  const head=frame(scene,layer,162,345,heading.width+11,heading.height+8,'panel');layer.moveTo(head,layer.list.indexOf(heading));
  frame(scene,layer,162,361,280,143,'outer');frame(scene,layer,167,366,270,133,'inner');
  const ids=business.labels.find(r=>r.id===label.id)!.actions;
  ids.forEach((id,index)=>{
    const entry=data.activities.tables.ActionCategory.find(c=>c.ID===id)??data.activities.tables.Action.find(c=>c.ID===id)!;
    const enabled=id==='ActRecordDemo'?Boolean(state.demo)&&!state.recording&&state.contract?.approved===false:id==='ActRecordSurvey'?Boolean(state.album&&state.album.releaseDay>0&&state.day>=state.album.releaseDay):true;
    const y=368+index*42;
    const key=[entry.Gfx.replaceAll(' ','_').toLowerCase(),'activity-'+entry.Gfx.replaceAll(' ','_').toLowerCase()].find(k=>scene.textures.exists(k));
    if(key){const bitmap=data.activities.bitmaps.find(b=>b.name.toLowerCase()===entry.Gfx.toLowerCase());image(scene,layer,192-(bitmap?.regX??0),y+21-(bitmap?.regY??0),key).setAlpha(enabled?1:.35);}
    const name=caption(scene,layer,219,y,entry.name,213).setFontFamily('Verdana').setFontSize(11).setFontStyle('bold');
    const comment=caption(scene,layer,219,y+14,entry.comment,213).setFontFamily('Verdana').setFontSize(11).setLineSpacing(0);
    const shift=Math.max(0,(42-name.height-comment.height)/2-2);name.y+=shift;comment.y+=shift;
    if(!enabled){name.setAlpha(.35);comment.setAlpha(.35);}else{const hit=scene.add.zone(169,y,266,42).setOrigin(0).setInteractive({cursor:cursorStyle('active')});layer.add(hit);hit.on('pointerup',()=>id==='ActRecordDemo'?submit():choose(id));}
  });
  image(scene,layer,444,352,'scroll-up').setAlpha(.3);image(scene,layer,444,476,'scroll-down').setAlpha(.3);
  image(scene,layer,451,380,originalImageKey(scene,'BehindScrollerPic')).setDisplaySize(13,95);image(scene,layer,448,378,'scroll-thumb');
  button(scene,layer,283,524,81,'OK',close,true,33,'accept');
}

/** DlgRecordContractData: the contract image and two native choosers. */
export function contractWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, _label: Label, offer: { advance: number; royalty: number }, index: number, count: number,
  change: (index: number) => void, sign: () => void, cancel: () => void): void {
  const advance=nativeChooser(scene,layer,{x:485,y:190,label:'Advance',value:cash(offer.advance),icon:'ui-money',textRight:90,previous:()=>change(index-1),next:()=>change(index+1),previousEnabled:index>0,nextEnabled:index<count-1});
  const royalty=nativeChooser(scene,layer,{x:485,y:256,label:'Royalty',value:Math.round(offer.royalty*100)+'%',icon:'ui-cd',textRight:90,previous:()=>change(index+1),next:()=>change(index-1),previousEnabled:index<count-1,nextEnabled:index>0});
  const width=242+Math.max(advance.width,advance.heading.x+advance.heading.width+5,royalty.width,royalty.heading.x+royalty.heading.width+5)+20;
  const border=frame(scene,layer,243,119,width,394,'dialog');layer.sendToBack(border);
  title(scene,layer,243,119,'Contract Proposal','contract');image(scene,layer,271,159,'image_contract01');
  const center=243+(width-20)/2;
  button(scene,layer,center-96,460,77,'OK',sign,true,33,'accept');button(scene,layer,center-13,460,109,'Cancel',cancel,true,33,'cancel');
}

/** DlgRecordSurveyData / DlgSurveyInfoData: three most receptive audience groups. */
export function labelSurveyWindow(scene:Phaser.Scene,layer:Phaser.GameObjects.Container,state:GameState,close:()=>void):void {
  let y=168;
  const contents=scene.add.container();layer.add(contents);
  [...state.publicity.groups].sort((a,b)=>b.likes-a.likes).slice(0,3).forEach(group=>{
    const source=data.activities.tables.Group.find(g=>g.ID===group.id)!;
    const percent=Math.trunc(100*Math.max(0,group.likes));
    const pieIndex=Math.max(0,Math.min(20,20-Math.trunc(percent/5)));
    image(scene,contents,123,y,'pie01_'+String(pieIndex).padStart(4,'0'));
    const description=text(scene,contents,213,y,source.name+'\n'+source.comment+'\nAge: '+source.AgeRange.min+'–'+source.AgeRange.max+'\nGroup size: '+Number(source.size).toLocaleString('en-GB'),11,'#eeeeee',296).setFontFamily('Verdana').setLineSpacing(0);
    (description as NativeText).setNativeAntialias(false);
    const value=text(scene,contents,168,y+57,percent+'%',11,'#eeeeee').setFontFamily('Verdana').setOrigin(.5,0);
    (value as NativeText).setNativeAntialias(false);
    y+=Math.max(67,description.height)+5;
  });
  const contentHeight=y-163,buttonY=132+contentHeight+41+10;
  const border=frame(scene,layer,100,100,439,buttonY+53-100,'dialog');layer.sendToBack(border);
  title(scene,layer,100,100,'Survey','microphone');
  infoFrame(scene,layer,114,132,386,contentHeight,'Target group');layer.bringToTop(contents);
  button(scene,layer,276,buttonY,81,'OK',close,true,33,'accept');
}

export function sessionWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, studio: Studio, channel: MixChannel,
  choose: (id: string | null,instrument:Instrument) => void, close: () => void): void {
  frame(scene, layer, 293, 95, 358, 457, 'dialog');
  title(scene, layer, 293, 95, 'Session musician', 'microphone');
  const currentBandMember = state.band.find((b) => b?.instrument === channel.instrument && !state.recording!.channels.some((c) => c !== channel && c.musicianId === b.musicianId));
  const bandPerson = data.musicians.find((m) => m.id === currentBandMember?.musicianId);
  const options = [...(bandPerson ? [{ id: null, name: bandPerson.name, price: 0 }] : []), ...data.tutorialGameplay.sessionMusicians.filter((m) => studio.sessionMusicians.includes(m.id))];
  let selected = options.find((o) => o.id === channel.musicianId) ?? options[0];
  let instrument=channel.instrument;
  let chooser:Phaser.GameObjects.Container|undefined;
  const instrumentChooser=()=>{
    const available=selected?.id?SESSION_INSTRUMENTS.filter(i=>data.tutorialGameplay.loops.some(l=>l.songId===state.recording!.songId&&l.instrument===i)):[channel.instrument];
    if(!available.includes(instrument))instrument=available[0];
    const instruments=[instrument,...available.filter(i=>i!==instrument)];
    // Preserve the chosen order while using the original Up/Down chooser.
    const draw=(order:Instrument[])=>{
      chooser?.destroy(true);const index=order.indexOf(instrument);
      chooser=nativeChooser(scene,layer,{x:315,y:428,label:'Instrument',value:instrument,textRight:238,
        previous:()=>{instrument=order[index-1];draw(order);},next:()=>{instrument=order[index+1];draw(order);},previousEnabled:index>0,nextEnabled:index<order.length-1}).container;
    };draw(instruments);
  };
  let sheet: Phaser.GameObjects.Container | undefined;
  const rows: Phaser.GameObjects.Rectangle[] = [];
  const select = (option: typeof options[number]) => {
    selected = option;
    sheet?.destroy(true);
    sheet = studioMusicianSheet(scene, layer, 315, 137, data.musicians, { ...channel, musicianId: option.id ?? bandPerson?.id ?? null });
    rows.forEach((row, index) => row.setFillStyle(options[index] === selected ? 0x514a3c : 0x171717));
    instrumentChooser();
  };
  caption(scene, layer, 317, 277, 'Musician').setFontSize(11);
  caption(scene, layer, 504, 277, 'Price').setFontSize(11);
  frame(scene, layer, 315, 290, 240, 132, 'inner');
  options.forEach((option, index) => {
    const y = 295 + index * 30;
    const row = scene.add.rectangle(317, y, 236, 30, 0x171717).setOrigin(0).setInteractive({ cursor: cursorStyle('active') });
    layer.add(row); rows.push(row);
    row.on('pointerup', () => select(option));
    caption(scene, layer, 325, y + 8, option.name, 168).setFontSize(11);
    caption(scene, layer, 502, y + 8, option.price ? cash(option.price) : '', 51).setFontSize(10);
  });
  button(scene, layer, 315, 502, 125, 'OK', () => choose(selected.id,instrument), options.length > 0, 33, 'accept');
  button(scene, layer, 504, 502, 127, 'Cancel', close, true, 33, 'cancel');
  if (selected) select(selected);
}

import Phaser from 'phaser';
import data from '../generated/game-data.json';
import type { GameState, Musician, Song } from '../game/model';
import type { Label, MixChannel, Studio } from '../game/recording';
import { button, frame, text, title } from './canvas-ui';
import { cursorStyle } from './cursors';
import { nativeKnob, nativeToggle, registeredImage } from './mixer-controls';
import { defaultEffects } from '../game/recording';
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
  caption(scene, layer, 150, 379, 'Song').setFontFamily('Verdana').setFontSize(11).setFontStyle('bold');
  frame(scene, layer, 150, 401, 205, 34, 'inner');
  caption(scene, layer, 159, 410, song?.name ?? 'No licensed song', 191).setFontFamily('Verdana').setFontSize(11);
  const position = songs.findIndex((s) => s.id === songId);
  clickImage(image(scene, layer, 358, 400, 'small-arrow-up'), () => chooseSong(songs[(position + songs.length - 1) % songs.length].id), songs.length > 1);
  clickImage(image(scene, layer, 358, 416, 'small-arrow-down'), () => chooseSong(songs[(position + 1) % songs.length].id), songs.length > 1);
  // DlgStudioData: pair centered on InfoDlg, 23px below ChooseSong's top.
  button(scene, layer, 385, 402, 135, 'Record', start, Boolean(song) && state.band.some(Boolean) && state.money >= studio.price && !state.contract, 33, 'microphone');
  button(scene, layer, 526, 402, 132, 'Cancel', close, true, 33, 'cancel');
}

export function mixerWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, musicians: Musician[], studio: Studio, song: Song,
  playing: boolean, master: number, change: (index: number, patch: Partial<MixChannel>) => void,
  settings: (index: number) => void, preview: () => void, stop: () => void, volume: (value: number) => void, finish: () => void): void {
  // ChannelScript and DlgMixerScript positions, with their unscaled original art.
  layer.add(scene.add.rectangle(60, 127, 681, 383, 0x555555).setOrigin(0));
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
  button(scene, layer, 132, 451, 116, 'OK', finish, true, 33, 'accept');
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
  caption(scene, layer, 234, 126, (member?.name ?? hired?.name ?? '').split(' ')[0], 160).setFontFamily('Arial').setFontSize(14).setFontStyle('bold');
  caption(scene, layer, 234, 154, `Age: ${member?.age ?? hired?.age ?? ''}\nStyle: ${member?.genre ?? hired?.genre ?? '-'}\nSkill:\nCharisma:`, 160).setFontFamily('Arial').setFontSize(11).setLineSpacing(1);
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
  nativeMeter(182, member?.musicality ?? hired?.musicality ?? 0);
  nativeMeter(196, member?.charisma ?? hired?.charisma ?? 0);
  return layer;
}

export function channelSettingsWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, musicians: Musician[],
  channel: MixChannel, availableEffects: string[], change: (effects: ChannelEffects) => void, cycle: (direction: number) => void,
  musician: () => void, preview: () => void, close: () => void): void {
  const hasShift = availableEffects.includes('FXTimeShift');
  const bottom = hasShift ? 448 : 395;
  frame(scene, layer, 102, 77, 358, bottom - 77 + 48, 'dialog');
  title(scene, layer, 102, 77, 'Settings', 'mixer-title');
  studioMusicianSheet(scene, layer, 117, 114, musicians, channel, musician);
  let effects = structuredClone(channel.effects ?? defaultEffects());
  const update = () => change(structuredClone(effects));
  const row = (kind: 'delay' | 'timeShift', y: number) => {
    image(scene, layer, 118, y, kind === 'delay' ? 'background_mixer_effect_delay01' : 'background_mixer_effect_timeshift01');
    nativeToggle(scene, layer, 178, y + 36, 'button_mute01', 'button_mute02', effects[kind].active, (active) => { effects[kind].active = active; update(); });
    nativeKnob(scene, layer, 279, y, false, 0, 1, effects[kind].mix, (mix) => { effects[kind].mix = mix; update(); });
    if (kind === 'delay') {
      const notes = ['32', '16T', '16', '8T', '8', '4T', '4'];
      const note = caption(scene, layer, 295, y + 7, notes[Math.round(effects.delay.time * 6)]).setFontSize(10);
      nativeKnob(scene, layer, 323, y, false, 0, 1, effects.delay.time, (time) => { effects.delay.time = time; note.setText(notes[Math.round(time * 6)]); update(); });
      nativeKnob(scene, layer, 388, y, false, 0, 1, effects.delay.decay, (decay) => { effects.delay.decay = decay; update(); });
    } else {
      nativeToggle(scene, layer, 270, y + 26, 'button_switch01', 'button_switch02', effects.timeShift.mode, (mode) => { effects.timeShift.mode = mode; update(); });
      nativeKnob(scene, layer, 356, y, false, 0, 1, effects.timeShift.depth, (depth) => { effects.timeShift.depth = depth; update(); });
      nativeKnob(scene, layer, 395, y, false, 0, 1, effects.timeShift.freq, (freq) => { effects.timeShift.freq = freq; update(); });
    }
  };
  row('delay', 257);
  if (hasShift) row('timeShift', 310);
  const y = hasShift ? 383 : 330;
  caption(scene, layer, 118, y, 'Music loop');
  frame(scene, layer, 118, y + 20, 238, 27, 'inner');
  const loop = data.tutorialGameplay.loops.find((l) => l.id === channel.loopId)!;
  caption(scene, layer, 124, y + 27, loop.name, 226).setFontSize(11);
  const loops = data.tutorialGameplay.loops.filter((l) => l.songId === state.recording!.songId && l.instrument === channel.instrument);
  const loopIndex = loops.findIndex((l) => l.id === channel.loopId);
  clickImage(image(scene, layer, 360, y + 17, 'small-arrow-up'), () => cycle(-1), loopIndex > 0);
  clickImage(image(scene, layer, 360, y + 35, 'small-arrow-down'), () => cycle(1), loopIndex < loops.length - 1);
  button(scene, layer, 118, bottom, 159, 'Preview', preview, true, 33, 'preview');
  button(scene, layer, 297, bottom, 125, 'OK', close, true, 33, 'accept');
}

export function labelWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, label: Label, submit: () => void, close: () => void): void {
  frame(scene, layer, 142, 76, 516, 448, 'dialog');
  title(scene, layer, 142, 76, label.name, 'golden-record');
  const backgroundKey = `${label.id.toLowerCase()}-background01`;
  const background = data.tutorialMedia.find((m) => m.key === backgroundKey)!;
  frame(scene, layer, 164, 115, background.width + 6, background.height + 6, 'inner');
  image(scene, layer, 167, 118, backgroundKey);
  for (const name of ['moves_0003', 'moves_0001']) {
    const key = `${label.id.toLowerCase()}-${name}`;
    const sprite = data.tutorialMedia.find((m) => m.key === key);
    if (sprite) image(scene, layer, 167 + background.regX - sprite.regX, 118 + background.regY - sprite.regY, key);
  }
  caption(scene, layer, 496, 136, state.contract ? `Contract signed\n\nRoyalty\n${Math.round(state.contract.royalty * 100)}%\n\nAdvance\n${cash(state.contract.advance)}`
    : `Record deal\n\n${label.albums} album${label.albums === 1 ? '' : 's'}\n\nRoyalty range\n${Math.round(label.minimumRoyalty * 100)}–${Math.round(label.maximumRoyalty * 100)}%`, 142);
  frame(scene, layer, 166, 346, 463, 99, 'inner');
  image(scene, layer, 166, 322, 'ui-golden-record');
  caption(scene, layer, 194, 335, 'Company info').setFontFamily('Verdana').setFontSize(11).setFontStyle('bold');
  caption(scene, layer, 175, 355, label.description, 444).setFontFamily('Arial').setFontSize(13);
  const song = data.songs.find((s) => s.id === state.demo?.songId);
  caption(scene, layer, 175, 410, state.contract ? `Signed: ${song?.name}` : song ? `Demo: ${song.name}` : 'No demo recorded yet.', 439).setFontSize(11);
  button(scene, layer, 166, 471, 177, state.contract ? 'Signed' : 'Play demo', submit, Boolean(state.demo) && !state.contract && !state.recording, 33, 'cd');
  button(scene, layer, 452, 471, 177, 'Cancel', close, true, 33, 'cancel');
}

export function contractWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, label: Label, offer: { advance: number; royalty: number }, index: number, count: number,
  change: (index: number) => void, sign: () => void, cancel: () => void): void {
  frame(scene, layer, 243, 119, 485, 380, 'dialog');
  title(scene, layer, 243, 119, 'Contract Proposal', 'contract');
  image(scene, layer, 271, 159, 'image_contract01');
  caption(scene, layer, 491, 163, label.name, 208).setFontStyle('bold');
  const advanceIcon = image(scene, layer, 485, 190, 'ui-money'); caption(scene, layer, 489 + advanceIcon.width, 195, 'Advance');
  frame(scene, layer, 485, 220, 153, 29, 'inner'); caption(scene, layer, 491, 227, cash(offer.advance));
  clickImage(image(scene, layer, 641, 216, 'small-arrow-up'), () => change(index - 1), index > 0);
  clickImage(image(scene, layer, 641, 234, 'small-arrow-down'), () => change(index + 1), index < count - 1);
  image(scene, layer, 485, 256, 'ui-cd'); caption(scene, layer, 515, 262, 'Royalty');
  frame(scene, layer, 485, 289, 153, 29, 'inner'); caption(scene, layer, 491, 296, `${Math.round(offer.royalty * 100)}%`);
  clickImage(image(scene, layer, 641, 285, 'small-arrow-up'), () => change(index + 1), index < count - 1);
  clickImage(image(scene, layer, 641, 303, 'small-arrow-down'), () => change(index - 1), index > 0);
  caption(scene, layer, 491, 336, `${label.albums} album${label.albums === 1 ? '' : 's'} under contract.\n\nA larger advance means a lower royalty. Advances are repaid from sales.`, 210).setFontSize(11);
  button(scene, layer, 271, 460, 125, 'OK', sign, true, 33, 'accept');
  button(scene, layer, 544, 460, 165, 'Cancel', cancel, true, 33, 'cancel');
}

export function sessionWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, studio: Studio, channel: MixChannel,
  choose: (id: string | null) => void, close: () => void): void {
  frame(scene, layer, 293, 95, 358, 457, 'dialog');
  title(scene, layer, 293, 95, 'Session musician', 'microphone');
  const currentBandMember = state.band.find((b) => b?.instrument === channel.instrument && !state.recording!.channels.some((c) => c !== channel && c.musicianId === b.musicianId));
  const bandPerson = data.musicians.find((m) => m.id === currentBandMember?.musicianId);
  const options = [...(bandPerson ? [{ id: null, name: bandPerson.name, price: 0 }] : []), ...data.tutorialGameplay.sessionMusicians.filter((m) => studio.sessionMusicians.includes(m.id))];
  let selected = options.find((o) => o.id === channel.musicianId) ?? options[0];
  let sheet: Phaser.GameObjects.Container | undefined;
  const rows: Phaser.GameObjects.Rectangle[] = [];
  const select = (option: typeof options[number]) => {
    selected = option;
    sheet?.destroy(true);
    sheet = studioMusicianSheet(scene, layer, 315, 137, data.musicians, { ...channel, musicianId: option.id ?? bandPerson?.id ?? null });
    rows.forEach((row, index) => row.setFillStyle(options[index] === selected ? 0x514a3c : 0x171717));
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
  caption(scene, layer, 315, 428, 'Instrument');
  frame(scene, layer, 315, 448, 238, 27, 'inner');
  caption(scene, layer, 323, 455, channel.instrument, 222).setFontSize(11);
  button(scene, layer, 315, 502, 125, 'OK', () => choose(selected.id), options.length > 0, 33, 'accept');
  button(scene, layer, 504, 502, 127, 'Cancel', close, true, 33, 'cancel');
  if (selected) select(selected);
}

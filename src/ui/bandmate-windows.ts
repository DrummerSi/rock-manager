import { nativeMeter } from './native-meter';
import { NativeText } from './native-text';
import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import type { Instrument, Musician, GameState } from '../game/model';
import { button, frame, text, title } from './canvas-ui';
import { cursorStyle } from './cursors';
import { nativeAgenda, originalImageKey, trainingAgendaFormat, type AgendaEntry } from './agenda';

const cash = (n: number) => '$' + n.toLocaleString('en-GB');
const clean = (value: string) => value.replaceAll('\x96', '–').trim();
const picture = (scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, name: string) => {
  const sprite = scene.add.image(x, y, originalImageKey(scene, name)).setOrigin(0); layer.add(sprite); return sprite;
};
const caption = (scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, content: string, size = 11, width?: number, color = '#eeeeee') => {
  const label = text(scene, layer, x, y, content, size, color, width).setFontFamily('Verdana').setLineSpacing(0);
  if (label instanceof NativeText) label.setNativeAntialias(false); return label;
};
const hit = (sprite: Phaser.GameObjects.Image, action: () => void, enabled: boolean) => {
  if (!enabled) { sprite.setAlpha(.35); return; }
  let pressed = false;
  sprite.setInteractive({ cursor: cursorStyle('active') }).on('pointerdown', () => { pressed = true; })
    .on('pointerout', () => { pressed = false; }).on('pointerup', () => { if (pressed) action(); pressed = false; });
};

// DlgRehearsal01ArtistData: sheet(22,35), categories(346,36),
// current-mood frame(23,262), and the original paper/photo/meter bitmaps.
export function bandmateWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, musician: Musician,
  instrument: Instrument, concerns: string[], choose: (id: string) => void, close: () => void, longConcerns: string[] = concerns): void {
  // Native auto extent: category frame right677+20; mood frame bottom448+20.
  frame(scene, layer, 100, 100, 597, 368, 'dialog');
  title(scene, layer, 100, 100, musician.name, 'microphone');
  picture(scene, layer, 122, 135, 'background_paper01');
  layer.add(scene.add.image(132, 143, 'musician-frame').setOrigin(0));
  layer.add(scene.add.image(135, 146, `portrait-${musician.id}`).setOrigin(0).setName('bandmate-portrait'));
  caption(scene, layer, 244, 143, musician.name, 11, 175, '#111111').setFontFamily('Verdana').setFontStyle('bold');
  for (const [i, label] of ['Age', 'Instrument', 'Musicality', 'Star quality', 'Style'].entries())
    caption(scene, layer, 244, 163 + i * 16, label, 11, undefined, '#111111').setFontFamily('Verdana').setFontStyle('bold').setLetterSpacing(-1);
  caption(scene, layer, 324, 163, musician.age + ' years', 11, undefined, '#111111').setFontFamily('Verdana');
  caption(scene, layer, 324, 179, instrument.toLowerCase(), 11, undefined, '#111111').setFontFamily('Verdana');
  caption(scene, layer, 324, 227, musician.genre, 11, undefined, '#111111').setFontFamily('Verdana');
  [musician.musicality, musician.charisma ?? 0].forEach((value, i) => nativeMeter(scene, layer, 324, 195 + i * 16, value));
  caption(scene, layer, 137, 254, musician.description, 11, 287, '#242424').setLetterSpacing(-1).setLineSpacing(1);
  const categoryLabel=caption(scene, layer, 452, 140, 'Category').setFontFamily('Verdana').setFontStyle('bold');
  const categoryHead=frame(scene,layer,446,136,categoryLabel.width+11,categoryLabel.height+8,'panel',false,'#313131');
  layer.moveTo(categoryHead,layer.list.indexOf(categoryLabel));
  frame(scene, layer, 446, 152, 231, 234, 'outer');
  frame(scene, layer, 451, 157, 221, 224, 'inner');
  const categories = data.activities.tables.ActionCategory.filter(c => ['ActCatMusicianGifts', 'ActCatMusicianTrain', 'ActCatMusicianRelations', 'ActCatMusicianKick'].includes(c.ID));
  categories.forEach((category, i) => {
    const y = 159 + i * 55;
    const icon = data.activities.bitmaps.find(b => b.name.toLowerCase() === category.Gfx.toLowerCase());
    picture(scene, layer, 475 - (icon?.regX ?? 18), y + 23 - (icon?.regY ?? 19), category.Gfx);
    caption(scene, layer, 496, y + 2, category.name, 11, 169).setFontStyle('bold');
    caption(scene, layer, 496, y + 16, clean(category.comment), 11, 169);
    const zone = scene.add.zone(453, y, 217, 55).setOrigin(0).setName('bandmate-category-' + category.ID);
    layer.add(zone); zone.setInteractive({ cursor: cursorStyle('active') }).on('pointerup', () => choose(category.ID));
  });
  caption(scene, layer, 128, 369, 'Current Mood').setFontFamily('Verdana').setFontStyle('bold');
  const mood = scene.add.container(); layer.add(mood);
  const drawMood = (expanded: boolean) => {
    mood.removeAll(true);
    // Source rich text widths292/535, three lines45px. DlgInfoFrameData
    // contributes19px horizontally and19px below the content.
    const width = expanded ? 554 : 311;
    frame(scene, mood, 123, 384, width, 64, 'outer');
    frame(scene, mood, 128, 389, width - 10, 54, 'inner');
    picture(scene, mood, 132, 397, 'MusicianStatsIcons');
    caption(scene, mood, 154, 393, (expanded ? longConcerns : concerns).join('\n'), 11, width - 41).setLineSpacing(3);
  };
  drawMood(false);
  const moodHit = scene.add.zone(123, 362, 311, 86).setOrigin(0).setInteractive(); layer.add(moodHit);
  moodHit.on('pointerover', () => { drawMood(true); moodHit.setSize(554, 86); });
  moodHit.on('pointerout', () => { drawMood(false); moodHit.setSize(311, 86); });
  button(scene, layer, 525, 415, 81, 'OK', close, true, 33, 'accept');
}

export function bandmateActionWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState,
  categoryId: string, actionId: string, canUse: boolean, change: (direction: number) => void, confirm: () => void, cancel: () => void,
  arrows: {previousEnabled?:boolean;nextEnabled?:boolean;actionCount?:number;price?:number} = {}): void {
  const category = data.activities.tables.ActionCategory.find(c => c.ID === categoryId)!;
  const action = data.activities.tables.Action.find(a => a.ID === actionId)!;
  const price=arrows.price??Number(action.price);
  const x = 112, y = 126;
  frame(scene, layer, x, y, 340, 243, 'dialog');
  title(scene, layer, x, y, category.name, 'activity-' + category.Gfx.replaceAll(' ', '_').toLowerCase());
  picture(scene, layer, x + 19, y + 39, 'portrait_frame_large01');
  const bitmap = data.activities.bitmaps.find(b => b.name.toLowerCase() === action.Gfx.toLowerCase())!;
  picture(scene, layer, x + 71 - (bitmap.regX ?? 0), y + 90 - (bitmap.regY ?? 0), action.Gfx);
  const name = caption(scene, layer, x + 138, y + 35, action.name.trim(), 11, 182).setFontStyle('bold');
  const description = caption(scene, layer, x + 138, name.y + name.height + 13, clean(action.comment), 11, 182);
  if(price!==0)caption(scene,layer,x+138,description.y+description.height+13,(price<0?'Money amount: ':'Price: ')+cash(Math.abs(price)));
  if((arrows.actionCount??[...category.Actions.matchAll(/#(\w+)/g)].length)>1){
    hit(picture(scene, layer, x + 19, y + 189, 'ArrowLeft'), () => change(-1), arrows.previousEnabled!==false);
    hit(picture(scene, layer, x + 276, y + 189, 'ArrowRight'), () => change(1), arrows.nextEnabled!==false);
  }
  button(scene, layer, x + 75, y + 189, 77, 'OK', confirm, canUse && state.money >= price, 33, 'accept');
  button(scene, layer, x + 156, y + 189, 109, 'Cancel', cancel, true, 33, 'cancel');
}

export function bandmateTrainingWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState,
  actionId: string, duration: number, startDay: number, firstDay: number, events: AgendaEntry[],
  choose: (day: number) => void, scroll: (direction: number) => void, allowed: (day: number) => boolean, confirm: () => void, cancel: () => void): void {
  const action = data.activities.tables.Action.find(a => a.ID === actionId)!;
  frame(scene, layer, 160, 90, 477, 345, 'dialog'); title(scene, layer, 160, 90, 'Schedule Training', 'calendar-title');
  const small = 'image_' + action.Gfx.toLowerCase().replaceAll(' ', '_') + '_small01';
  if (scene.textures.exists('activity-' + small)) picture(scene, layer, 180, 127, small);
  else {
    const image = picture(scene, layer, 180, 127, action.Gfx);
    image.setScale(Math.min(77 / image.width, 77 / image.height));
  }
  caption(scene, layer, 281, 125, action.name, 11, 333).setFontStyle('bold');
  caption(scene, layer, 281, 151, clean(action.comment), 11, 333);
  caption(scene, layer, 281, 199, `Cost ${cash(Number(action.price))}`, 11, 333);
  nativeAgenda(scene, layer, state, 180, 214, firstDay, [...events, { id: 'draft-training', kind: 'training', formatId:trainingAgendaFormat(actionId), name: action.name, startDay, duration, selected: true }], choose, scroll, allowed);
  button(scene, layer, 304, 382, 77, 'OK', confirm, state.money >= Number(action.price), 33, 'calendar');
  button(scene, layer, 385, 382, 109, 'Cancel', cancel, true, 33, 'cancel');
}

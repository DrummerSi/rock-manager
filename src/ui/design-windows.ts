import { nativeAgenda, type AgendaEntry } from './agenda';
import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import type { GameState, Musician } from '../game/model';
import { designElements, designCategories, type DesignSelection } from '../game/design';
import { button, frame, text, title } from './canvas-ui';
import { nativeChooser } from './native-chooser';
import { coverImage } from './album-cover';
const pic = (s: Phaser.Scene, l: Phaser.GameObjects.Container, x: number, y: number, key: string) => { const i = s.add.image(x, y, key).setOrigin(0); l.add(i); return i; };
const caption = (s: Phaser.Scene, l: Phaser.GameObjects.Container, x: number, y: number, value: string, size = 11, width?: number) => text(s, l, x, y, value, size, '#cccccc', width).setFontFamily('Verdana');
export function designWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, musicians: Musician[], selection: DesignSelection, change: (index: number, direction: number) => void, done: () => void, close: () => void) {
    const album = state.album;
    if (album) {
        // DlgDesign switches its data to SleeveDone but retains DlgDesign's
        // original loc(91,86); DlgDesignSleeveDoneData has different offsets.
        frame(scene, layer, 91, 86, 354, 422, 'dialog');
        title(scene, layer, 91, 86, 'Design Studio', 'camera');
        pic(scene, layer, 111, 124, 'design-frame_cdcover01');
        coverImage(scene, layer, 114, 127, 300, album.bandName, album.band, musicians, album.selection);
        button(scene, layer, 314, 455, 109, 'Cancel', close, true, 33, 'cancel');
        return;
    }
    const originalLayer = layer; layer = scene.add.container(); originalLayer.add(layer);
    title(scene, layer, 91, 86, 'Design Studio', 'camera');
    pic(scene, layer, 115, 124, 'design-frame_cdcover01');
    coverImage(scene, layer, 118, 127, 300, state.bandName, state.band, musicians, selection);
    const elements = designElements(selection);
    let right = 0;
    designCategories(state.missionId).forEach((category, index) => {
        const chooser = nativeChooser(scene,layer,{x:444,y:123+60*index,label:category.name,icon:'design-'+category.gfx,
            value:elements[index].name+' $'+elements[index].price.toLocaleString('en-GB'),textRight:210,
            previous:()=>change(index,-1),next:()=>change(index,1),
            previousEnabled:category.elements.indexOf(elements[index].id)>0,nextEnabled:category.elements.indexOf(elements[index].id)<category.elements.length-1});
        right = Math.max(right,444+chooser.width,444+chooser.head.width);
    });
    const surround=frame(scene,layer,91,86,right+25-91,373,'dialog');layer.sendToBack(surround);
    button(scene, layer, 466, 404, 98, 'Done', done, Boolean(state.contract), 33, 'calendar');
    button(scene, layer, 571, 404, 106, 'Cancel', close, true, 33, 'cancel');
}
export function releaseWindow(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: GameState, musicians: Musician[], selection: DesignSelection, releaseDay: number, firstDay: number, choose: (day: number) => void, scroll: (direction: number) => void, confirm: () => void, cancel: () => void, events: AgendaEntry[] = [], allowed: (day: number) => boolean = () => true) {
    frame(scene, layer, 160, 90, 477, 345, 'dialog');
    title(scene, layer, 160, 90, 'Schedule Release', 'calendar-title');
    const hasDesign = data.design.categories.some((category,index)=>selection[index]!==category.elements[0]);
    if (hasDesign) {
      pic(scene, layer, 180, 127, 'design-tmpCD_frame');
      coverImage(scene, layer, 182, 129, 70, state.bandName, state.band, musicians, selection);
    } else pic(scene, layer, 180, 127, 'design-image_nodesign01_small01');
    const infoX = hasDesign ? 270 : 281;
    caption(scene, layer, infoX, 125, 'Set a release date for your album.', 11, 343).setFontStyle('bold');
    caption(scene, layer, infoX, 151, 'This date indicates when the record will be available at Record Store. Media and others can be given press kits before this date.', 11, 343).setLineSpacing(2);
    nativeAgenda(scene, layer, state, 180, 214, firstDay,
      [{ id: 'draft-release', kind: 'release', name: 'Album release', startDay: releaseDay, duration: 1, selected: true }, ...events], choose, scroll, allowed);
    button(scene, layer, 304, 382, 77, 'OK', confirm, true, 33, 'calendar');
    button(scene, layer, 385, 382, 109, 'Cancel', cancel, true, 33, 'cancel');
}

import Phaser from 'phaser';
import { frame } from './canvas-ui';
import { nativeText } from './native-text';
import { cursorStyle } from './cursors';

export interface NativeChooserOptions {
  x: number; y: number; label: string; value: string; icon?: string;
  /** Original EnterField inOffsetRect right coordinate (left is9). */
  textRight?: number;
  previous: () => void; next: () => void;
  previousEnabled?: boolean; nextEnabled?: boolean;
}

/** Original DlgChooseKit1Data, DlgHeadlineData and
 * DlgRockTextUpAndDownFramedData, retained in native-dialog-layouts.json.
 * RockSrndStyle/2/Head share RockSrndEdge sprites; only the fill differs.
 */
export function nativeChooser(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, options: NativeChooserOptions) {
  const group = scene.add.container(options.x, options.y); parent.add(group);
  const right = options.textRight ?? 159;
  const icon = options.icon ? scene.add.image(2, 0, options.icon).setOrigin(0) : null;
  const heading = nativeText(scene, 4 + (icon?.width ?? 0), 7, options.label,
    { fontFamily: 'Verdana', fontSize: '11px', fontStyle: 'bold', color: '#eeeeee' }).setNativeAntialias(false);
  const head = frame(scene, group, 0, 3, Math.ceil(heading.x + heading.width + 5), Math.ceil(heading.y + heading.height + 4), 'panel', false, '#313131');
  if (icon) group.add(icon); group.add(heading);
  const value = nativeText(scene, 9, 31, options.value,
    { fontFamily: 'Verdana', fontSize: '11px', color: '#fcfcfc', wordWrap: {width: right - 9, useAdvancedWrap: false} }).setNativeAntialias(false);
  // UpNDown's origin is3px below the text midpoint, with a30px group.
  const arrowY = 31 + value.height / 2 + 3 - 15;
  const up = scene.add.image(right + 8, arrowY, 'small-arrow-up').setOrigin(0);
  const down = scene.add.image(right + 8, arrowY + 30 - scene.textures.get('small-arrow-down').getSourceImage().height, 'small-arrow-down').setOrigin(0);
  const width = Math.ceil(up.x + up.width);
  frame(scene, group, 0, 22, right + 5, 34, 'panel', false, '#000000');
  frame(scene, group, right + 5, 22, width - right - 5, 34, 'panel', false, '#313131');
  group.add([value, up, down]);
  const wire = (sprite: Phaser.GameObjects.Image, action: () => void, enabled: boolean) => {
    if (!enabled) return;
    let pressed = false; sprite.setInteractive({cursor: cursorStyle('active')});
    sprite.on('pointerdown', () => {pressed = true;});
    sprite.on('pointerout', () => {pressed = false;});
    sprite.on('pointerup', () => {if (pressed) action(); pressed = false;});
  };
  wire(up, options.previous, options.previousEnabled !== false);
  wire(down, options.next, options.nextEnabled !== false);
  return {container: group, width, height: 56, value, heading, head};
}

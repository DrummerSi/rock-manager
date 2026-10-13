import Phaser from 'phaser';
import data from '../generated/game-data.json';
import { cursorStyle } from './cursors';

export function registeredImage(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, anchorX: number, anchorY: number, key: string): Phaser.GameObjects.Image {
  const sprite = scene.add.image(0, 0, key).setOrigin(0);
  parent.add(sprite);
  setRegisteredTexture(sprite, anchorX, anchorY, key);
  return sprite;
}
export function setRegisteredTexture(sprite: Phaser.GameObjects.Image, anchorX: number, anchorY: number, key: string): void {
  const info = data.tutorialMedia.find((m) => m.key === key)!;
  sprite.setTexture(key).setPosition(anchorX - info.regX, anchorY - info.regY);
  sprite.setData('anchor', { x: anchorX, y: anchorY });
}
export function nativeKnob(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, anchorX: number, anchorY: number,
  large: boolean, min: number, max: number, initial: number, changed: (value: number) => void, name = ''): void {
  const prefix = `${large ? 'large' : 'small'}_ratt01_`;
  const key = (frame: number) => prefix + String(Math.round(frame)).padStart(4, '0');
  let value = Phaser.Math.Clamp((initial - min) / (max - min) * 64, 0, 63), start = value, startX = 0;
  const sprite = registeredImage(scene, parent, anchorX, anchorY, key(value)).setName(name);
  const first = data.tutorialMedia.find((m) => m.key === prefix + '0000')!;
  // A stationary hit box avoids texture-size changes moving the drag target.
  const hit = scene.add.zone(anchorX - first.regX, anchorY - first.regY, first.width, first.height).setOrigin(0)
    .setInteractive({ cursor: cursorStyle('active') });
  parent.add(hit); scene.input.setDraggable(hit);
  const set = (frame: number) => {
    value = Phaser.Math.Clamp(frame, 0, 63);
    setRegisteredTexture(sprite, anchorX, anchorY, key(value));
    changed(min + value / 63 * (max - min));
  };
  // PotentiometerScript uses horizontal motion, one frame per mouse pixel.
  hit.on('dragstart', (pointer: Phaser.Input.Pointer) => { start = value; startX = pointer.x; });
  hit.on('drag', (pointer: Phaser.Input.Pointer) => set(start + pointer.x - startX));
  hit.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => set(value + (dy < 0 ? 1 : -1)));
}
export function nativeToggle(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, anchorX: number, anchorY: number,
  normal: string, down: string, initial: boolean, changed: (value: boolean) => void): void {
  let value = initial, pressed = false;
  const sprite = registeredImage(scene, parent, anchorX, anchorY, value ? down : normal);
  const info = data.tutorialMedia.find((m) => m.key === normal)!;
  const hit = scene.add.zone(anchorX - info.regX, anchorY - info.regY, info.width, info.height).setOrigin(0)
    .setInteractive({ cursor: cursorStyle('active') });
  parent.add(hit);
  const draw = (isDown: boolean) => setRegisteredTexture(sprite, anchorX, anchorY, isDown ? down : normal);
  hit.on('pointerdown', () => { pressed = true; draw(true); });
  hit.on('pointerout', () => { pressed = false; draw(value); });
  hit.on('pointerup', () => { if (pressed) { value = !value; changed(value); } pressed = false; draw(value); });
}

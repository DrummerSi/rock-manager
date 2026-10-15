import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import { cursorStyle } from './cursors';
import { nativeText } from './native-text';

export const COLORS = { panel: 0x321d2d, cream: '#eee4ce', muted: '#c2b6b3', gold: '#dfc18a', border: 0x6c5864 };

export function text(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  content: string, size = 16, color = COLORS.cream, width?: number): Phaser.GameObjects.Text {
  const label = nativeText(scene, x, y, content, {
    fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color,
    wordWrap: width ? { width, useAdvancedWrap: true } : undefined,
    lineSpacing: 4,
  });
  parent.add(label);
  return label;
}

export function title(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  label: string, icon: string): Phaser.GameObjects.Text {
  const key = `ui-${icon}`;
  const image = scene.add.image(x + 8, y, key).setOrigin(0, 0);
  parent.add(image);
  return text(scene, parent, x + 10 + image.width, y + 5, label, 14, '#ffffff')
    .setFontFamily('Courier New').setFontStyle('bold');
}

export function frame(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  width: number, height: number, kind: 'button' | 'panel' | 'dialog' | 'inner' | 'outer' = 'panel', dimmed = false, fillColor?: string): Phaser.GameObjects.Container {
  const group = scene.add.container(x, y);
  parent.add(group);
  width = Math.round(width); height = Math.round(height);
  const cacheKey = `frame:${kind}:${width}:${height}:${dimmed}:${fillColor ?? 'default'}`;
  if (scene.textures.exists(cacheKey)) {
    group.add(scene.add.image(0, 0, cacheKey).setOrigin(0)); return group;
  }
  const canvas = scene.textures.createCanvas(cacheKey, width, height)!;
  const ctx = canvas.getContext(); ctx.imageSmoothingEnabled = false;
  const textureSize = (side: string) => scene.textures.get(dimmed && kind === 'button' && scene.textures.exists(`button-dark-${side}`)
    ? `button-dark-${side}` : `${kind}-${side}`).getSourceImage() as HTMLImageElement;
  const tl = textureSize('TL'), tr = textureSize('TR'), bl = textureSize('BL'), br = textureSize('BR');
  ctx.fillStyle = fillColor ?? (kind === 'button' || kind === 'inner' ? '#000000' : kind === 'panel' || kind === 'outer' ? '#313131' : '#555555');
  ctx.fillRect(kind === 'button' ? 14 : 3, kind === 'button' ? 2 : kind === 'dialog' ? 25 : 3,
    width - (kind === 'button' ? 32 : 6), height - (kind === 'button' ? 8 : kind === 'dialog' ? 28 : 6));
  const image = (side: string, px: number, py: number, w?: number, h?: number) => {
    const img = textureSize(side);
    if ((w ?? img.width) <= 0 || (h ?? img.height) <= 0) return;
    ctx.drawImage(img, px, py, w ?? img.width, h ?? img.height);
  };
  // Director composes corners first, then stretches the four edge spans.
  image('TL', 0, 0); image('TR', width - tr.width, 0);
  image('BL', 0, height - bl.height); image('BR', width - br.width, height - br.height);
  image('T', tl.width, 0, width - tl.width - tr.width, textureSize('T').height);
  image('B', bl.width, height - textureSize('B').height, width - bl.width - br.width, textureSize('B').height);
  image('L', 0, tl.height, textureSize('L').width, height - tl.height - bl.height);
  image('R', width - textureSize('R').width, tr.height, textureSize('R').width, height - tr.height - br.height);
  canvas.refresh();
  group.add(scene.add.image(0, 0, cacheKey).setOrigin(0));
  return group;
}

export function button(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  width: number, label: string, action: () => void, enabled = true, height = 33, icon?: string): Phaser.GameObjects.Container {
  // The cap pair is 14+19px tall. Oversizing the fixed-size 14px controls
  // opened transparent bands between the caps and their narrow side strips.
  height = Math.min(height, 33);
  const group = frame(scene, parent, x, y, width, height, 'button', !enabled);
  let captionX = 9;
  if (icon && scene.textures.exists(`ui-${icon}`)) {
    const registration = data.iconRegistrations[icon as keyof typeof data.iconRegistrations];
    const image = scene.add.image(8, 13 - (registration?.regY ?? 0), `ui-${icon}`).setOrigin(0).setAlpha(enabled ? 1 : 0.5);
    group.add(image); captionX = 9 + image.width;
  }
  const caption = text(scene, group, captionX, 6, label, 14, enabled ? '#aaaaaa' : '#555555');
  caption.setOrigin(0).setLineSpacing(0);
  caption.setFontFamily('Courier New').setFontStyle('bold');
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setOrigin(0);
  group.add(hit);
  if (enabled) {
    let pressed = false;
    hit.setInteractive({ cursor: cursorStyle('active') });
    hit.on('pointerover', () => caption.setColor('#f5f5f5'));
    hit.on('pointerout', () => { pressed = false; caption.setColor('#aaaaaa'); caption.y = 6; });
    hit.on('pointerdown', () => { pressed = true; caption.y = 7; });
    hit.on('pointerup', () => { const activate = pressed; pressed = false; caption.y = 6; if (activate) action(); });
  }
  return group;
}

export function meter(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  label: string, value: number, width = 184): void {
  text(scene, parent, x, y, label, 13, COLORS.muted);
  parent.add(scene.add.rectangle(x + width - 100, y + 7, 100, 6, 0x141014).setOrigin(0, 0.5));
  parent.add(scene.add.rectangle(x + width - 100, y + 7, 100 * Phaser.Math.Clamp(value, 0, 1), 6, 0xc4a26c).setOrigin(0, 0.5));
}

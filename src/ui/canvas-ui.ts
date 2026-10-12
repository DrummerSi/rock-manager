import Phaser from 'phaser';

export const COLORS = { panel: 0x321d2d, cream: '#eee4ce', muted: '#c2b6b3', gold: '#dfc18a', border: 0x6c5864 };

export function text(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  content: string, size = 16, color = COLORS.cream, width?: number): Phaser.GameObjects.Text {
  const label = scene.add.text(x, y, content, {
    fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color,
    wordWrap: width ? { width, useAdvancedWrap: true } : undefined,
    lineSpacing: 4,
  });
  parent.add(label);
  return label;
}

export function frame(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  width: number, height: number, kind: 'button' | 'panel' = 'panel'): Phaser.GameObjects.Container {
  const group = scene.add.container(x, y);
  parent.add(group);
  group.add(scene.add.rectangle(0, 0, width, height, kind === 'button' ? 0x222222 : COLORS.panel).setOrigin(0));
  const corner = kind === 'button' ? 14 : 8;
  const image = (side: string, px: number, py: number, w?: number, h?: number) => {
    const img = scene.add.image(px, py, `${kind}-${side}`).setOrigin(0);
    if (w !== undefined && h !== undefined) img.setDisplaySize(w, h);
    group.add(img);
  };
  image('T', corner, 0, width - corner * 2, kind === 'button' ? 2 : 5);
  image('B', corner, height - (kind === 'button' ? 7 : 5), width - corner * 2, kind === 'button' ? 7 : 5);
  image('L', 0, corner, kind === 'button' ? 2 : 5, height - corner * 2);
  image('R', width - (kind === 'button' ? 6 : 4), corner, kind === 'button' ? 6 : 4, height - corner * 2);
  image('TL', 0, 0); image('TR', width - (kind === 'button' ? 18 : 7), 0);
  image('BL', 0, height - (kind === 'button' ? 19 : 8));
  image('BR', width - (kind === 'button' ? 18 : 7), height - (kind === 'button' ? 19 : 8));
  return group;
}

export function button(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  width: number, label: string, action: () => void, enabled = true, height = 38): Phaser.GameObjects.Container {
  const group = frame(scene, parent, x, y, width, height, 'button');
  const caption = text(scene, group, width / 2, height / 2 - 1, label, 14, enabled ? COLORS.cream : '#776f72');
  caption.setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setOrigin(0);
  group.add(hit);
  if (enabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => caption.setColor(COLORS.gold));
    hit.on('pointerout', () => { caption.setColor(COLORS.cream); group.setAlpha(1); });
    hit.on('pointerdown', () => group.setAlpha(0.8));
    hit.on('pointerup', () => { group.setAlpha(1); action(); });
  }
  return group;
}

export function meter(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  label: string, value: number, width = 184): void {
  text(scene, parent, x, y, label, 13, COLORS.muted);
  parent.add(scene.add.rectangle(x + width - 100, y + 7, 100, 6, 0x141014).setOrigin(0, 0.5));
  parent.add(scene.add.rectangle(x + width - 100, y + 7, 100 * Phaser.Math.Clamp(value, 0, 1), 6, 0xc4a26c).setOrigin(0, 0.5));
}

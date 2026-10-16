import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { PreloadScene } from './scenes/PreloadScene';

async function boot(): Promise<void> {
await Promise.all(['14px "Courier New"', 'bold 14px "Courier New"', '15px Arial', 'bold 15px Arial',
  '11px Verdana', 'bold 11px Verdana'].map((font) => document.fonts.load(font)));
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 800, height: 600,
  backgroundColor: '#000000',
  render: { antialias: false, roundPixels: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [PreloadScene,GameScene],
});
}
void boot();

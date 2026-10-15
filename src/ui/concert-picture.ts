import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import type { GameState, Musician } from '../game/model';
import { originalImageKey } from './agenda';
export function concertImage(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, state: GameState, musicians: Musician[], venueId: string, audience: number, capacity: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 227;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    const source = (name: string) => scene.textures.get(originalImageKey(scene, name)).getSourceImage() as HTMLImageElement;
    ctx.drawImage(source(venueId.toLowerCase() + '_feedback_background01'), 0, 0);
    const layout = data.activities.liveLayouts.find(l => l.venueId === venueId);
    if (layout) {
        const assigned = new Map<string, NonNullable<GameState['band'][number]>>();
        for (const member of state.band) {
            if (!member)
                continue;
            const choices = member.instrument === 'Drums' ? ['drums01'] : member.instrument === 'Vocals' ? ['vocals01', 'vocals02'] : ['left01', 'left02', 'right01', 'right02'];
            const pos = choices.find(p => layout.positions.some(x => x.position === p && !x.disabled) && !assigned.has(p));
            if (pos)
                assigned.set(pos, member);
        }
        for (const pos of layout.positions) {
            const member = assigned.get(pos.position);
            if (!member)
                continue;
            const musician = musicians.find(m => m.id === member.musicianId)!;
            const actor = musician.smallPortrait?.match(/actor\d+/)?.[0], infix = { Drums: '01', Guitar: '02', Bass: '03', Keyboards: '04', Vocals: '06' }[member.instrument], suffix = { left01: 'l', left02: 'l', right01: 'r', right02: 'r', vocals02: 'z' }[pos.position as 'left01'] ?? '';
            const bitmap = data.design.bitmaps.find(b => b.name === `pose_${actor}_${infix}${suffix}`) ?? data.design.bitmaps.find(b => b.name === 'pose_actor01_02l')!;
            ctx.drawImage(source(bitmap.name), pos.x - bitmap.regX * pos.scale, pos.y - bitmap.regY * pos.scale, bitmap.width * pos.scale, bitmap.height * pos.scale);
        }
    }
    const crowd = 1 + Math.floor(3 * Math.min(1, audience / capacity));
    ctx.drawImage(source(venueId.toLowerCase() + '_feedback_foreground0' + crowd), 0, 0);
    const key = 'concert-result-' + Phaser.Utils.String.UUID();
    scene.textures.addCanvas(key, canvas);
    const image = scene.add.image(x, y, key).setOrigin(0);
    layer.add(image);
    image.once('destroy', () => scene.textures.remove(key));
}

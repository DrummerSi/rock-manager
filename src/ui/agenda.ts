import Phaser from 'phaser';
import type { GameState } from '../game/model';
import { text } from './canvas-ui';
import { cursorStyle } from './cursors';
export type AgendaKind = 'release' | 'concert' | 'advert' | 'training';
export interface AgendaEntry {
    id: string;
    kind: AgendaKind;
    name: string;
    startDay: number;
    duration: number;
    selected?: boolean;
}
export function originalImageKey(scene: Phaser.Scene, name: string): string {
    const normalized = name.replaceAll(' ', '_').toLowerCase();
    const alias: Record<string, string> = { rockscrollarrowup: 'scroll-up', rockscrollarrowdown: 'scroll-down', rockscrollbarpic: 'scroll-thumb', rocksmallarrowup: 'small-arrow-up', rocksmallarrowdown: 'small-arrow-down' };
    const key = [alias[normalized], 'activity-' + normalized, 'design-' + name, normalized, name].find(k => scene.textures.exists(k));
    if (!key)
        throw new Error('Missing recovered bitmap: ' + name);
    return key;
}
const pic = (scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, key: string) => { const image = scene.add.image(x, y, key).setOrigin(0); layer.add(image); return image; };
export function nativeAgenda(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: Pick<GameState, 'startDate' | 'day'>, x: number, y: number, firstDay: number, entries: AgendaEntry[], choose: ((day: number) => void) | null, scroll: (direction: number) => void, allowed: (day: number) => boolean = () => true): void {
    pic(scene, layer, x, y, 'design-agenda_background01');
    const left = x + 6, plotTop = y + 20, dayWidth = 25;
    const date = (day: number) => { const [year, month, dayOfMonth] = state.startDate.split('-').map(Number); return new Date(Date.UTC(year, month - 1, dayOfMonth + day)); };
    for (let i = 0; i < 17; i++) {
        const day = firstDay + i, px = left + i * dayWidth, dt = date(day);
        text(scene, layer, px + 2, y + 9, dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) + ' ' + dt.getUTCDate(), 8, '#cccccc').setFontFamily('Arial').setScale(.6, 1);
        layer.add(scene.add.rectangle(px, y + 5, 1, 13, 0x888888).setOrigin(0));
        if (day === state.day)
            layer.add(scene.add.rectangle(px, plotTop, 25, 103, 0x65171a).setOrigin(0));
        if (choose) {
            const zone = scene.add.zone(px, plotTop, 25, 103).setOrigin(0);
            layer.add(zone);
            if (day > state.day && day <= state.day + 100 && allowed(day))
                zone.setInteractive({ cursor: cursorStyle('active') }).on('pointerup', () => choose(day));
        }
    }
    const rows: number[][] = Array.from({ length: 4 }, () => []);
    const visible = entries.filter(e => e.startDay + e.duration > firstDay && e.startDay < firstDay + 17).sort((a, b) => Number(Boolean(a.selected)) - Number(Boolean(b.selected)) || a.startDay - b.startDay);
    for (const entry of visible) {
        const start = Math.max(firstDay, entry.startDay), end = Math.min(firstDay + 17, entry.startDay + entry.duration);
        const row = rows.findIndex(days => Array.from({ length: end - start }, (_, i) => start + i).every(d => !days.includes(d)));
        if (row < 0)
            continue;
        for (let day = start; day < end; day++)
            rows[row].push(day);
        const width = (end - start) * dayWidth, key = `agenda-item:${entry.kind}:${width}:${Boolean(entry.selected)}`;
        if (!scene.textures.exists(key)) {
            const texture = scene.textures.createCanvas(key, width, 24)!;
            const ctx = texture.getContext();
            const source = (name: string) => scene.textures.get(originalImageKey(scene, name)).getSourceImage() as HTMLImageElement;
            const prefix = (entry.kind === 'concert' ? 'slider03_' : 'slider02_') + (entry.selected ? '1_' : '2_');
            ctx.drawImage(source(prefix + '1'), 0, 0);
            ctx.drawImage(source(prefix + '2'), 7, 0, width - 17, 24);
            ctx.drawImage(source(prefix + '3'), width - 10, 0);
            const icon = source(entry.kind === 'concert' ? 'icon_spotlight02' : entry.kind === 'advert' ? 'icon_megaphone02' : entry.kind === 'training' ? 'icon_guitar01' : 'icon_cd02');
            ctx.drawImage(icon, 3, 1, icon.width / 2, icon.height / 2);
            texture.refresh();
        }
        const image = pic(scene, layer, left + (start - firstDay) * 25, plotTop + 1 + row * 24, key);
        if (entry.selected && choose) {
            image.setInteractive({ cursor: cursorStyle('active'), draggable: true });
            scene.input.setDraggable(image);
            image.on('drag', (_pointer: Phaser.Input.Pointer, px: number) => { image.x = Phaser.Math.Clamp(px, left, left + 400); });
            image.on('dragend', () => { const day = Phaser.Math.Clamp(firstDay + Math.round((image.x - left) / 25), state.day + 1, state.day + 100); if (allowed(day))
                choose(day);
            else
                choose(entry.startDay); });
        }
        else {
            image.setInteractive({ cursor: cursorStyle('active') });
            let tooltip: Phaser.GameObjects.Text | undefined;
            image.on('pointerover', (pointer: Phaser.Input.Pointer) => { tooltip = text(scene, layer, Math.min(pointer.x + 10, 600), Math.min(pointer.y + 12, 530), `${entry.name}\n${date(entry.startDay).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`, 11, '#ffffff', 180).setBackgroundColor('#000000').setPadding(5); });
            image.on('pointerout', () => { tooltip?.destroy(); tooltip = undefined; });
            if (choose)
                image.on('pointerup', (pointer: Phaser.Input.Pointer) => { const day = firstDay + Math.floor((pointer.x - left) / 25); if (day > state.day && allowed(day))
                    choose(day); });
        }
    }
    const arrow = (px: number, name: string, direction: number) => { const image = pic(scene, layer, px, y + 131, 'design-' + name).setInteractive({ cursor: cursorStyle('active') }); let pressed = false; image.on('pointerdown', () => { pressed = true; }); image.on('pointerout', () => { pressed = false; }); image.on('pointerup', () => { if (pressed)
        scroll(direction); pressed = false; }); };
    arrow(x, 'agenda_slider_arrows01Left', -2);
    arrow(x + 397, 'agenda_slider_arrows01Right', 2);
    pic(scene, layer, x + 32, y + 141, originalImageKey(scene, 'BehindScrollerPic')).setDisplaySize(361, 14);
    const thumb = pic(scene, layer, x + 32 + Phaser.Math.Clamp((firstDay - state.day + 23) / 40, 0, 1) * 342, y + 136, 'design-agenda_slider_arrows01').setInteractive({ cursor: cursorStyle('active'), draggable: true });
    scene.input.setDraggable(thumb);
    thumb.on('drag', (_p: Phaser.Input.Pointer, px: number) => { thumb.x = Phaser.Math.Clamp(px, x + 32, x + 374); });
    thumb.on('dragend', () => scroll(Math.round((thumb.x - x - 32) / 342 * 40) + state.day - 23 - firstDay));
}

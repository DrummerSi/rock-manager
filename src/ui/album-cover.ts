import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import type { BandMember, Musician } from '../game/model';
import { designElements, type DesignSelection } from '../game/design';
const tuning = [[-24, 1], [-4, .9306], [-4, .9420], [7, .7471], [-1, .8667], [6, 1.0476], [7, .8767], [13, .9681], [0, 1], [11, .8421], [0, 1], [-1, .8125], [11, .67], [3, .88]];
export function composeCover(scene: Phaser.Scene, name: string, band: (BandMember | null)[], musicians: Musician[], selection: DesignSelection, costumes=false): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgb(50,50,50)';
    ctx.fillRect(0, 0, 300, 300);
    const [bg, artist, fx, font] = designElements(selection);
    const source = (key: string) => scene.textures.get(key).getSourceImage() as HTMLImageElement;
    const full = (gfx: string) => { if (gfx && scene.textures.exists('design-' + gfx))
        ctx.drawImage(source('design-' + gfx), 0, 0, 300, 300); };
    full(bg.gfx);
    if (artist.id !== 'DEDArtists04') {
        const members = band.flatMap(m => m ? [m] : []);
        const pattern = members.map(m => m.instrument === 'Drums' ? 'drums' : m.instrument === 'Vocals' ? 'vocals' : 'other').sort();
        // A partial/reconfigured band need not match one of ActorsDesignData's
        // eight exact patterns. Keep the original full-band positions available
        // instead of silently dropping the entire artist layer.
        const layout = data.design.layouts.find(l => [...l.pattern].sort().join(',') === pattern.join(','))
            ?? data.design.layouts[0];
        if (layout) {
            const assigned = new Map<string, BandMember>();
            for (const m of members) {
                const choices = m.instrument === 'Drums' ? ['drums01'] : m.instrument === 'Vocals' ? [artist.id === 'DEDArtists01' ? 'vocals01' : 'vocals02'] : ['left01', 'left02', 'right01', 'right02'];
                const pos = choices.find(p => layout.positions.some(x => x.position === p) && !assigned.has(p));
                if (pos)
                    assigned.set(pos, m);
            }
            for (const pos of layout.positions) {
                const m = assigned.get(pos.position);
                if (!m || artist.id === 'DEDArtists03' && m.instrument !== 'Vocals')
                    continue;
                const musician = musicians.find(x => x.id === m.musicianId)!;
                const baseActor = musician.smallPortrait?.match(/actor\d+/)?.[0];
                const actor = baseActor+(costumes?'_bear':'');
                const infix = { Drums: '01', Guitar: '02', Bass: '03', Keyboards: '04', Vocals: '06' }[m.instrument];
                const suffix = { L: 'l', R: 'r', Z: 'z', N: '' }[pos.direction];
                const bitmap = data.design.bitmaps.find(b => b.name === `pose_${actor}_${infix}${suffix}`);
                if (bitmap)
                    ctx.drawImage(source(bitmap.key), pos.x - bitmap.regX * pos.scale, pos.y - bitmap.regY * pos.scale, bitmap.width * pos.scale, bitmap.height * pos.scale);
            }
        }
    }
    if (fx.id === 'DEDEfffect02' || fx.id === 'DEDEfffect05') {
        const pixels = ctx.getImageData(0, 0, 300, 300), sepia = data.design.palettes.find(p => p.name === 'SepiaPalette')?.rgb;
        for (let i = 0; i < pixels.data.length; i += 4) {
            const luminance = Math.round(.299 * pixels.data[i] + .587 * pixels.data[i + 1] + .114 * pixels.data[i + 2]);
            for (let c = 0; c < 3; c++)
                pixels.data[i + c] = fx.id === 'DEDEfffect05' && sepia ? sepia[(255 - luminance) * 3 + c] : luminance;
        }
        ctx.putImageData(pixels, 0, 0);
    }
    else
        full(fx.gfx);
    // makeAlbumCover handles list-valued Gfx before the font branch:
    // [#Loc:point(12,-25), #Pic:"firewolflogo01"], copying source rect(0,0,300,300).
    if(font.id==='DEDFirewolf')ctx.drawImage(source('design-firewolflogo01'),12,-25);
    const fontIndex = Number(font.id.match(/(\d+)$/)?.[1]) - 1;
    if (fontIndex >= 0) {
        const f = data.design.fonts[fontIndex], widths = f.widths as Record<string, number>, kern = f.kerning as Record<string, Record<string, number>>;
        const replacement = f.replace as Record<string, number>, glyphs = f.glyphs as Record<string, string | null>, rects = f.glyphRects as unknown as Record<string, {
            sourceRect: number[];
            regY: number;
        }>;
        const accents = data.design.charReplacements as Record<string, number[]>;
        const characters = [...name.replaceAll("'", '«')].map(c => { const n = c.charCodeAt(0); return widths[n] !== undefined || n === 32 ? [n] : accents[n] ?? [replacement[n] ?? n]; });
        const codes = characters.map(c => c[0]);
        const advance = (code: number, next: number | undefined, space: number) => (widths[code] ?? (code === 32 ? Math.trunc(.3 * ((widths[65] ?? 0) + (widths[66] ?? 0) + (widths[67] ?? 0)) / 3) : 0)) + space - (next ? kern[code]?.[next] ?? 0 : 0);
        const baseWidth = codes.reduce((sum, c, i) => sum + advance(c, codes[i + 1], 0), 0);
        const [offset, multiplier] = tuning[fontIndex];
        let scale = .65 * multiplier;
        if (baseWidth * scale > 280)
            scale *= 280 / (baseWidth * scale);
        // RenderFontScript applies char spacing before scaling the glyph positions.
        const lines: number[][] = [[]];
        let width = 0;
        for (const code of codes) {
            const previous = lines.at(-1)!;
            const nextWidth = previous.length ? width + advance(previous.at(-1)!, code, 10 * scale) : 0;
            if (nextWidth * scale > 280 && previous.length) {
                lines.push([]);
                width = 0;
            }
            lines.at(-1)!.push(code);
            width = lines.at(-1)!.length === 1 ? 0 : nextWidth;
        }
        const logo = document.createElement('canvas');
        logo.width = logo.height = 300;
        const lc = logo.getContext('2d')!;
        lines.forEach((line, lineIndex) => {
            const total = line.reduce((sum, c, i) => sum + advance(c, line[i + 1], 10 * scale), 0) * scale;
            let x = (300 - total) / 2;
            const baseline = 40 + offset * scale / multiplier + lineIndex * 100 * scale;
            for (let i = 0; i < line.length; i++) {
                const rect = rects[glyphs[line[i]] ?? ''];
                if (rect) {
                    const [sx, sy, w, h] = rect.sourceRect;
                    lc.drawImage(source(f.key), sx, sy, w, h, x, baseline - rect.regY * scale, w * scale, h * scale);
                    const originalIndex = lines.slice(0, lineIndex).reduce((sum, l) => sum + l.length, 0) + i;
                    for (const accent of characters[originalIndex].slice(1)) {
                        const extra = rects[glyphs[accent] ?? ''];
                        if (extra) {
                            const [ax, ay, aw, ah] = extra.sourceRect;
                            lc.drawImage(source(f.key), ax, ay, aw, ah, x + (w - aw) * scale / 2, baseline - extra.regY * scale, aw * scale, ah * scale);
                        }
                    }
                }
                x += advance(line[i], line[i + 1], 10 * scale) * scale;
            }
        });
        const shadow = document.createElement('canvas');
        shadow.width = shadow.height = 300;
        const sc = shadow.getContext('2d')!;
        sc.drawImage(logo, 0, 0);
        sc.globalCompositeOperation = 'source-in';
        sc.fillStyle = '#000';
        sc.fillRect(0, 0, 300, 300);
        ctx.drawImage(shadow, 4, 4);
        ctx.drawImage(logo, 0, 0);
    }
    return canvas;
}
export function coverImage(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, size: number, name: string, band: (BandMember | null)[], musicians: Musician[], selection: DesignSelection, costumes=false) {
    const key = 'album-cover-' + Phaser.Utils.String.UUID();
    scene.textures.addCanvas(key, composeCover(scene, name, band, musicians, selection, costumes));
    const image = scene.add.image(x, y, key).setOrigin(0).setDisplaySize(size, size);
    layer.add(image);
    image.once('destroy', () => scene.textures.remove(key));
    return image;
}

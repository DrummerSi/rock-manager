import Phaser from 'phaser';
import type { GameState } from '../game/model';
import { text } from './canvas-ui';
import { displayAlbumHype } from '../game/publicity';
import { cursorStyle } from './cursors';
import data from '../generated/game-data.json' with {type:'json'};
import {nativeText} from './native-text';
export type AgendaKind = 'release' | 'concert' | 'advert' | 'training' | 'video' | 'security';
export interface AgendaEntry {
    id: string;
    kind: AgendaKind;
    name: string;
    startDay: number;
    duration: number;
    selected?: boolean;
    formatId?:string;
}
const eventFormats:Record<AgendaKind,string>={release:'AgFmAlbumRelease',concert:'AgFmConcert',advert:'AgFmExpoAd',training:'AgFmTraining',video:'AgFmVideoProduction',security:'AgFmSecurity'};
export function trainingAgendaFormat(actionId:string):string {
    if(actionId==='ActGangSecurity')return 'AgFmSecurity';
    const action=data.activities.tables.Action.find(a=>a.ID===actionId);
    const type=action?.PreExecuteThis?.match(/SetTrainDuration\(me,\s*\d+,\s*#(\w+)\)/i)?.[1];
    const id='AgFm'+type;return data.activities.tables.AgendaEventFormat.some(f=>f.ID===id)?id:'AgFmTraining';
}
/** OnePlannedItem draws to a temporary image; ChannelPlanning then applies white-key ink36. */
export function composeAgendaItem(ctx:CanvasRenderingContext2D,source:(name:string)=>HTMLImageElement,entry:AgendaEntry,width:number,offset=0):void {
    const format=data.activities.tables.AgendaEventFormat.find(f=>f.ID===(entry.formatId??eventFormats[entry.kind]))!;
    const prefix='slider'+format.clr.padStart(2,'0')+'_'+(entry.selected?'1':'2')+'_';
    const left=source(prefix+'1'),middle=source(prefix+'2'),right=source(prefix+'3'),fullWidth=entry.duration*25;
    ctx.clearRect(0,0,width,24);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(left,-offset,0);
    ctx.drawImage(right,fullWidth-right.width-offset,0);
    ctx.drawImage(middle,left.width-offset,0,fullWidth-left.width-right.width,24);
    const icon=source(format.Gfx);ctx.drawImage(icon,3-offset,1,icon.width/2,icon.height/2);
    const pixels=ctx.getImageData(0,0,width,24);
    for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]===255&&pixels.data[i+1]===255&&pixels.data[i+2]===255){pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=pixels.data[i+3]=0;}
    ctx.putImageData(pixels,0,0);
}
export function originalImageKey(scene: Phaser.Scene, name: string): string {
    const normalized = name.replaceAll(' ', '_').toLowerCase();
    const alias: Record<string, string> = { rockscrollarrowup: 'scroll-up', rockscrollarrowdown: 'scroll-down', rockscrollbarpic: 'scroll-thumb', rocksmallarrowup: 'small-arrow-up', rocksmallarrowdown: 'small-arrow-down' };
    const key = [alias[normalized], 'activity-' + normalized, 'design-' + name, 'tour-'+normalized, normalized, name].find(k => scene.textures.exists(k));
    if (!key)
        throw new Error('Missing recovered bitmap: ' + name);
    return key;
}
const pic = (scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, key: string) => { const image = scene.add.image(x, y, key).setOrigin(0); layer.add(image); return image; };
export interface AgendaGraph {name:string;color:number;percent?:boolean;points:{day:number;value:number}[]}
export function nativeAgenda(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, state: Pick<GameState, 'startDate' | 'day'>, x: number, y: number, firstDay: number, entries: AgendaEntry[], choose: ((day: number) => void) | null, scroll: (direction: number) => void, allowed: (day: number) => boolean = () => true, graphs?: AgendaGraph[]): void {
    pic(scene, layer, x, y, graphs ? originalImageKey(scene,'TmpLargeAgendaBG') : 'design-agenda_background01');
    const left = x + 6, plotTop = y + 20, dayWidth = 25;
    const date = (day: number) => { const [year, month, dayOfMonth] = state.startDate.split('-').map(Number); return new Date(Date.UTC(year, month - 1, dayOfMonth + day)); };
    // DatePlotter: calcGoodStep(4 * length("MMM DD") / pixelsPerDay, false).
    const dateWidth=24,dateStep=[1,2,3,5,10].find(step=>step*dayWidth>=dateWidth)!;
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i < 17; i++) {
        const day = firstDay + i, px = left + i * dayWidth, dt = date(day);
        // RockGeneral DatePlotText member142: Arial Narrow9 regular, tracking0.
        const daysToNextMonth=(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,1)-dt.getTime())/86400000;
        if((dt.getUTCDate()-1)%dateStep===0&&dateWidth<daysToNextMonth*dayWidth&&px+dateWidth<=left+17*dayWidth){
            const label=nativeText(scene,px+2,y+5,months[dt.getUTCMonth()]+' '+String(dt.getUTCDate()).padStart(2,'0'),{fontFamily:'Arial Narrow',fontSize:'9px',fontStyle:'',color:'#787878'}).setNativeAntialias(false);
            layer.add(label);
            layer.add(scene.add.rectangle(px, y + 5, 1, 13, 0x888888).setOrigin(0));
        }
        if (day === state.day)
            layer.add(scene.add.rectangle(px, plotTop, 25, graphs?194:103, 0x65171a).setOrigin(0));
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
        const width = (end - start) * dayWidth,offset=(start-entry.startDay)*dayWidth;
        const key = `agenda-item:ink36:${entry.formatId??entry.kind}:${width}:${entry.duration}:${offset}:${Boolean(entry.selected)}`;
        if (!scene.textures.exists(key)) {
            const texture = scene.textures.createCanvas(key, width, 24)!;
            const ctx = texture.getContext();
            const source = (name: string) => scene.textures.get(originalImageKey(scene, name)).getSourceImage() as HTMLImageElement;
            composeAgendaItem(ctx,source,entry,width,offset);
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            texture.refresh();
        }
        const image = pic(scene, layer, left + (start - firstDay) * 25, plotTop + row * 24, key);
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
    if(graphs){
        const top=y+129,height=80;
        const ink=scene.add.graphics();layer.add(ink);
        graphs.forEach((graph,index)=>{
            const points=graph.points.filter(p=>p.day<=state.day).sort((a,b)=>a.day-b.day);
            const max=Math.max(...points.map(p=>Math.abs(p.value)))||1;
            ink.lineStyle(1,graph.color,1);
            for(let i=1;i<points.length;i++){
                const a=points[i-1],b=points[i];
                const start=Math.max(firstDay,a.day),end=Math.min(firstDay+17,b.day);
                if(start>end||a.day===b.day)continue;
                const value=(d:number)=>a.value+(b.value-a.value)*(d-a.day)/(b.day-a.day);
                ink.lineBetween(left+(start-firstDay)*25,top+height-1-value(start)/max*(height-5),left+(end-firstDay)*25,top+height-1-value(end)/max*(height-5));
            }
            const legendX=left+(state.day-firstDay+1)*25+5;
            if(legendX>=left&&legendX<left+320){
                ink.fillStyle(graph.color).fillRect(legendX,top+5+index*15,6,6);
                const value=points.at(-1)?.value??0;
                text(scene,layer,legendX+9,top+2+index*15,graph.name+': '+(graph.percent?displayAlbumHype(value)+'%':Math.round(value).toLocaleString('en-GB')),9,'#aaaaaa').setFontFamily('Arial').setFontStyle('');
            }
        });
    }
    const controlsY=graphs?y+219+20-15:y+131;
    const scrollMinimum=state.day-(graphs?28:23);
    const arrow = (px: number, name: string, direction: number) => { const image = pic(scene, layer, px, controlsY, 'design-' + name).setInteractive({ cursor: cursorStyle('active') }); let pressed = false; image.on('pointerdown', () => { pressed = true; }); image.on('pointerout', () => { pressed = false; }); image.on('pointerup', () => { if (pressed)
        scroll(direction); pressed = false; }); };
    arrow(x, 'agenda_slider_arrows01Left', -2);
    arrow(x + 397, 'agenda_slider_arrows01Right', 2);
    pic(scene, layer, x + 32, controlsY + 10, originalImageKey(scene, 'BehindScrollerPic')).setDisplaySize(361, 14);
    const thumb = pic(scene, layer, x + 32 + Phaser.Math.Clamp((firstDay - scrollMinimum) / 40, 0, 1) * 342, controlsY + 5, 'design-agenda_slider_arrows01').setInteractive({ cursor: cursorStyle('active'), draggable: true });
    scene.input.setDraggable(thumb);
    thumb.on('drag', (_p: Phaser.Input.Pointer, px: number) => { thumb.x = Phaser.Math.Clamp(px, x + 32, x + 374); });
    thumb.on('dragend', () => scroll(Math.round((thumb.x - x - 32) / 342 * 40) + scrollMinimum - firstDay));
}

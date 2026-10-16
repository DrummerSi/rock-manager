import Phaser from 'phaser';
import data from '../generated/game-data.json' with {type:'json'};
import type {Musician} from '../game/model';
import {GANGSTA_RULES,gangstaCategories} from '../game/gangsta';
import {button,frame,text,title} from './canvas-ui';
import {originalImageKey} from './agenda';
import {cursorStyle} from './cursors';

const pic=(s:Phaser.Scene,l:Phaser.GameObjects.Container,x:number,y:number,name:string)=>{const p=s.add.image(x,y,originalImageKey(s,name)).setOrigin(0);l.add(p);return p;};
const caption=(s:Phaser.Scene,l:Phaser.GameObjects.Container,x:number,y:number,value:string,width?:number)=>text(s,l,x,y,value,11,'#eeeeee',width).setFontFamily('Verdana').setFontStyle('').setLineSpacing(0);

/** DlgGangstaData at (142,46). Info is Dummy; the original actor and category scroller follow the frame. */
export function gangstaWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,offset:number,scroll:(offset:number)=>void,choose:(id:string)=>void,close:()=>void):void {
  frame(s,l,142,46,366,486,'dialog');title(s,l,142,46,GANGSTA_RULES.office.name,'activity-icon_gun01');
  pic(s,l,159,81,'frame02 large environment');
  const categoryHeading=caption(s,l,168,318,'Category').setFontStyle('bold');
  const backing=frame(s,l,162,314,categoryHeading.width+11,categoryHeading.height+8,'panel',false,'#313131');l.moveTo(backing,l.list.indexOf(categoryHeading));
  frame(s,l,162,330,280,143,'outer');frame(s,l,167,335,270,133,'inner');
  const categories=gangstaCategories(),max=Math.max(0,categories.length-3);
  const next=(direction:number)=>scroll(Phaser.Math.Clamp(offset+direction,0,max));
  categories.slice(offset,offset+3).forEach((category,index)=>{
    const y=337+index*42,bitmap=data.activities.bitmaps.find(b=>b.name.toLowerCase()===category.Gfx.toLowerCase())!;
    pic(s,l,192-bitmap.regX!,y+21-bitmap.regY!,category.Gfx);
    const label=caption(s,l,219,y,category.name,213).setFontStyle('bold');
    const description=caption(s,l,219,y+14,category.comment,213);
    const shift=Math.max(0,(42-label.height-description.height)/2-2);label.y+=shift;description.y+=shift;
    const hit=s.add.zone(169,y,266,42).setOrigin(0).setInteractive({cursor:cursorStyle('active')});l.add(hit);
    hit.on('pointerup',()=>choose(category.ID)).on('wheel',(_p:unknown,_dx:number,dy:number)=>next(Math.sign(dy)));
  });
  const arrow=(y:number,name:string,direction:number,enabled:boolean)=>{const p=pic(s,l,444,y,name);if(enabled)p.setInteractive({cursor:cursorStyle('active')}).on('pointerup',()=>next(direction));else p.setAlpha(.3);};
  arrow(321,'RockScrollArrowUp',-1,offset>0);arrow(445,'RockScrollArrowDown',1,offset<max);
  pic(s,l,451,349,'BehindScrollerPic').setDisplaySize(13,95);
  const thumb=pic(s,l,448,347+(max?offset/max*77:0),'RockScrollBarPic').setInteractive({cursor:cursorStyle('active'),draggable:true});s.input.setDraggable(thumb);
  thumb.on('drag',(_p:unknown,_x:number,y:number)=>thumb.y=Phaser.Math.Clamp(y,347,424));thumb.on('dragend',()=>scroll(Math.round((thumb.y-347)/77*max)));
  button(s,l,283,479,81,'OK',close,true,33,'accept');
}

/** DlgMusicianChooseScript reuses DlgMerchandiseData, showing only current member's name and portrait. */
export function gangstaTargetWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,musicians:Musician[],index:number,portrait:string,change:(index:number)=>void,confirm:()=>void,cancel:()=>void):void {
  const musician=musicians[index],x=112,y=126;
  frame(s,l,x,y,340,243,'dialog');title(s,l,x,y,'','activity-icon_gun01');pic(s,l,x+19,y+39,'portrait_frame_large01');
  l.add(s.add.image(x+22,y+42,portrait).setOrigin(0));caption(s,l,x+138,y+35,musician?.name??'',182).setFontStyle('bold');
  for(const[dx,name,next]of [[19,'ArrowLeft',index-1],[276,'ArrowRight',index+1]] as const){const p=pic(s,l,x+dx,y+189,name);if(next>=0&&next<musicians.length)p.setInteractive({cursor:cursorStyle('active')}).on('pointerup',()=>change(next));else p.setAlpha(.3);}
  button(s,l,x+75,y+189,77,'OK',confirm,Boolean(musician),33,'accept');button(s,l,x+156,y+189,109,'Cancel',cancel,true,33,'cancel');
}

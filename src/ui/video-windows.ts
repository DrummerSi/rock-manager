import Phaser from 'phaser';
import type {GameState} from '../game/model';
import {VIDEO_RULES} from '../game/video';
import {button,frame,infoFrame,text,title} from './canvas-ui';
import {nativeAgenda,originalImageKey} from './agenda';
import {activityEvents} from './activity-windows';
import {cursorStyle} from './cursors';

const caption=(s:Phaser.Scene,l:Phaser.GameObjects.Container,x:number,y:number,value:string,width?:number)=>text(s,l,x,y,value,11,'#eeeeee',width).setFontFamily('Verdana').setFontStyle('').setLineSpacing(0);
const picture=(s:Phaser.Scene,l:Phaser.GameObjects.Container,x:number,y:number,name:string)=>{const p=s.add.image(x,y,originalImageKey(s,name)).setOrigin(0);l.add(p);return p;};
const price=(n:number)=>'$'+n.toLocaleString('en-GB');

/** DlgVideoData at the DataDialogs00 origin (91,86); original 498x277 storyboards. */
export function videoWindow(scene:Phaser.Scene,layer:Phaser.GameObjects.Container,index:number,change:(index:number)=>void,book:()=>void,close:()=>void):void {
  const concept=VIDEO_RULES.concepts[index],x=91,y=86;
  frame(scene,layer,x,y,530,471,'dialog');
  title(scene,layer,x,y,VIDEO_RULES.studio.name,'activity-icon_film01');
  picture(scene,layer,x+17,y+38,concept.graphic);
  caption(scene,layer,x+17,y+318,'Concept: '+concept.name,273);
  caption(scene,layer,x+17,y+332,concept.description.replaceAll('\x96','–'),273);
  const info=infoFrame(scene,layer,x+300,y+318,188,28,'Info','activity-icon_film02');
  caption(scene,layer,info.x,info.y,'Production time').setFontStyle('bold');
  caption(scene,layer,info.x+106,info.y,concept.duration+' days');
  caption(scene,layer,info.x,info.y+14,'Cost').setFontStyle('bold');
  caption(scene,layer,info.x+106,info.y+14,price(concept.price));
  for(const[dx,name,next]of [[10,'ArrowLeft',index-1],[470,'ArrowRight',index+1]] as const){
    const arrow=picture(scene,layer,x+dx,y+424,name);
    if(next>=0&&next<VIDEO_RULES.concepts.length)arrow.setInteractive({cursor:cursorStyle('active')}).on('pointerup',()=>change(next));
    else arrow.setAlpha(.3);
  }
  const centre=x+17+498/2;
  button(scene,layer,centre-119,y+423,129,'Go Ahead',book,true,33,'calendar');
  button(scene,layer,centre+19,y+423,109,'Cancel',close,true,33,'cancel');
}

/** DlgBookScript reuses DlgLiveBookData with DlgVideoBook labels and origin. */
export function videoBookingWindow(scene:Phaser.Scene,layer:Phaser.GameObjects.Container,state:GameState,index:number,day:number,firstDay:number,choose:(day:number)=>void,scroll:(direction:number)=>void,allowed:(day:number)=>boolean,confirm:()=>void,cancel:()=>void):void {
  const concept=VIDEO_RULES.concepts[index],x=91,y=86;
  frame(scene,layer,x,y,477,345,'dialog');title(scene,layer,x,y,'Book Video Production','activity-icon_film01');
  picture(scene,layer,x+20,y+37,'image_video01_small01');
  caption(scene,layer,x+121,y+35,'Production time').setFontStyle('bold');caption(scene,layer,x+227,y+35,concept.duration+' days');
  caption(scene,layer,x+121,y+49,'Cost').setFontStyle('bold');caption(scene,layer,x+227,y+49,price(concept.price));
  nativeAgenda(scene,layer,state,x+20,y+124,firstDay,[...activityEvents(state),{id:'draft-video',kind:'video',name:concept.name,startDay:day,duration:concept.duration,selected:true}],choose,scroll,allowed);
  button(scene,layer,x+121,y+292,134,'Book Video',confirm,allowed(day),33,'accept');
  button(scene,layer,x+264,y+292,109,'Cancel',cancel,true,33,'cancel');
}

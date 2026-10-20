import Phaser from 'phaser';
import {button,frame,title,uiIconKey} from './canvas-ui';
import {nativeText} from './native-text';
import {renderEventCard,type EventCardBounds} from './event-card';
import {originalImageKey} from './agenda';
import {scenarioPressWindow} from './scenario-press-window';

export interface ScenarioCard {
  ID?:string;
  Headline?:string; comment:string; name:string; Caption?:string; question?:string;
  icon?:string; dataMemberName:string;
  ButtonOK?:{name?:string;Gfx?:string}; ButtonCancel?:{name?:string;Gfx?:string};
  Button3?:{name?:string;Gfx?:string};
}
export interface ScenarioWindowOptions {
  pictureRegistration?:{x:number;y:number};
  portraitKey?:string;actorId?:string;animatePortrait?:boolean; confirm:()=>void; cancel?:()=>void;third?:()=>void; expand:(value:string)=>string;
}
const iconAlias=(value:string|undefined,fallback:string)=>value||fallback;

/** DlgEventCardBaseData + original NoPic/SmallPic/LargePic profile.
 * LargePic differs structurally: its332px text sits BELOW the329×224 frame.
 * DlgEventCardAncestorScript deliberately suppresses LargePic Caption.
 */
export function scenarioWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,card:ScenarioCard,options:ScenarioWindowOptions):EventCardBounds {
  const expand=(value:string|undefined)=>options.expand(value??'').replaceAll('\\n','\n');
  const common={headline:expand(card.Headline)||expand(card.name),text:expand(card.comment),question:expand(card.question),
    windowTitle:expand(card.name),icon:card.icon,confirmLabel:expand(card.ButtonOK?.name)||'OK',cancelLabel:expand(card.ButtonCancel?.name)||'Cancel',
    confirmIcon:iconAlias(card.ButtonOK?.Gfx,'accept'),cancelIcon:iconAlias(card.ButtonCancel?.Gfx,'cancel'),onConfirm:options.confirm,onCancel:options.cancel,
    thirdLabel:expand(card.Button3?.name),thirdIcon:iconAlias(card.Button3?.Gfx,'cancel'),onThird:options.third};
  const profile=card.dataMemberName.toLowerCase();
  if(profile.includes('pressmedia03')||profile.includes('pressmedia04'))return scenarioPressWindow(scene,parent,card,options);
  if(profile!=='dlgeventcardlargepicdata'){
    const result=renderEventCard(scene,parent,{...common,pictureRegistration:options.pictureRegistration,animatedPortrait:options.animatePortrait,portraitKey:profile==='dlgeventcardnopicdata'?undefined:options.portraitKey,caption:expand(card.Caption)});
    parent.setData('sourceLayout',{id:card.dataMemberName,bounds:{x:result.bounds.x,y:result.bounds.y,width:result.bounds.width,height:result.bounds.height},profile:card.dataMemberName,portrait:result.portraitRect});
    return result;
  }
  const content=scene.add.container();
  const makeText=(y:number,value:string,bold=false)=>{
    const text=nativeText(scene,0,y,value,{fontFamily:'Verdana',fontSize:'11px',fontStyle:bold?'bold':'',color:'#f5f5f5',wordWrap:{width:332,useAdvancedWrap:true},lineSpacing:1}).setNativeAntialias(false);
    content.add(text);return text;
  };
  content.add(scene.add.image(0,0,originalImageKey(scene,'frame02 large environment')).setOrigin(0));
  let picture:Phaser.GameObjects.Image|undefined;
  if(!options.actorId&&options.portraitKey&&scene.textures.exists(options.portraitKey)){
    picture=scene.add.image(3,3,options.portraitKey).setOrigin(0);content.add(picture);
  }
  const headline=makeText(227,common.headline,true);
  const body=makeText(headline.y+headline.height+15,common.text);
  let fullHeight=body.y+body.height;
  if(common.question){const question=makeText(fullHeight+15,common.question);fullHeight=question.y+question.height;}
  const measure=(label:string,icon:string)=>{
    const text=nativeText(scene,0,0,label,{fontFamily:'Courier New',fontSize:'14px',fontStyle:'bold'});
    const key=uiIconKey(scene,icon);
    const width=Math.ceil(29+(key?scene.textures.get(key).getSourceImage().width:0)+text.width);text.destroy();return width;
  };
  const okWidth=measure(common.confirmLabel,common.confirmIcon),cancelWidth=options.cancel?measure(common.cancelLabel,common.cancelIcon):0;
  const thirdWidth=options.third?measure(common.thirdLabel,common.thirdIcon):0;
  const pairWidth=okWidth+(options.cancel?cancelWidth+4:0)+(options.third?thirdWidth+4:0),contentWidth=Math.max(332,pairWidth),width=17+contentWidth+20;
  // Original auto-size is retained whenever it fits. Exceptional long content
  // scrolls inside the canvas; fonts and image dimensions stay atsource size.
  const visibleHeight=Math.min(Math.ceil(fullHeight),468),height=46+visibleHeight+13+33+20;
  const x=Math.round(400-width/2),y=Math.round(305-height/2),window=scene.add.container(x,y);parent.add(window);
  frame(scene,window,0,0,width,height,'dialog',false,'#505050');title(scene,window,0,0,common.windowTitle,iconAlias(card.icon,'megaphone'));
  content.setPosition(17,46);window.add(content);
  if(fullHeight>visibleHeight){
    const mask=scene.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(x+17,y+46,contentWidth,visibleHeight);mask.setVisible(false);parent.add(mask);content.setMask(mask.createGeometryMask());
    let offset=0;const hit=scene.add.zone(17,46,contentWidth,visibleHeight).setOrigin(0).setInteractive();window.add(hit);
    hit.on('wheel',(_p:unknown,_dx:number,dy:number)=>{offset=Phaser.Math.Clamp(offset+dy,0,fullHeight-visibleHeight);content.y=46-offset;});
  }
  const buttonY=46+visibleHeight+13,buttonX=17+(contentWidth-pairWidth)/2;
  button(scene,window,buttonX,buttonY,okWidth,common.confirmLabel,options.confirm,true,33,common.confirmIcon);
  if(options.cancel)button(scene,window,buttonX+okWidth+4,buttonY,cancelWidth,common.cancelLabel,options.cancel,true,33,common.cancelIcon);
  const thirdX=buttonX+okWidth+(options.cancel?cancelWidth+4:0)+4;
  if(options.third)button(scene,window,thirdX,buttonY,thirdWidth,common.thirdLabel,options.third,true,33,common.thirdIcon);
  const portraitRect=options.actorId?new Phaser.Geom.Rectangle(x+20,y+49,314,210):picture?new Phaser.Geom.Rectangle(x+20,y+49,picture.displayWidth,picture.displayHeight):undefined;
  parent.setData('eventCardBounds',{x,y,width,height});
  parent.setData('eventCardButtons',{confirm:{x:x+buttonX+okWidth/2,y:y+buttonY+16},...(options.cancel?{cancel:{x:x+buttonX+okWidth+4+cancelWidth/2,y:y+buttonY+16}}:{}),...(options.third?{third:{x:x+thirdX+thirdWidth/2,y:y+buttonY+16}}:{})});
  parent.setData('sourceLayout',{id:card.dataMemberName,bounds:{x,y,width,height},picture:portraitRect,actorId:options.actorId,info:{x:x+17,y:y+273,width:332},captionSuppressed:true,scrollable:fullHeight>visibleHeight});
  return{bounds:new Phaser.Geom.Rectangle(x,y,width,height),buttonY:y+buttonY,buttonCenter:new Phaser.Math.Vector2(x+buttonX+okWidth/2,y+buttonY+16),portraitRect};
}

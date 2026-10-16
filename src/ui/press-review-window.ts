import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import cards from '../game/press-review-cards.json' with { type: 'json' };
import type { GameState, Musician } from '../game/model';
import type { Review } from '../game/publicity';
import { button, frame, text, title } from './canvas-ui';
import { coverImage } from './album-cover';
import { NativeText } from './native-text';
import {nativeText} from './native-text';
import type {EventCardBounds} from './event-card';

export interface PressWindowCard {
  ID?:string; Headline?:string; comment:string; question?:string; Caption?:string;
  name:string; icon?:string; dataMemberName:string;
  ButtonOK?:{name?:string;Gfx?:string}; ButtonCancel?:{name?:string;Gfx?:string};
}
export interface PressWindowOverrides {card?:PressWindowCard;pictureKey?:string;expand?:(value:string)=>string;cancel?:()=>void}

/** DlgECPressScript: nine original paper frames, then album and printed headline. */
export function pressReviewWindow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, state: Pick<GameState,'band'|'album'|'bandName'>, musicians: Musician[], review: Review, close: () => void, overrides:PressWindowOverrides={}):EventCardBounds {
  const magazine = review.mediaId === 'Media04';
  const rating = Math.trunc(Phaser.Math.Clamp(review.quality, 0, 1) * 5);
  const card:PressWindowCard = overrides.card??cards.find(c => c.ID === `ECOC${review.mediaId}Review${rating}`)!;
  const singer = state.band.find(member => member?.instrument === 'Vocals');
  const albumName = data.songs.find(song => song.id === state.album?.songId)?.name ?? '';
  const expand = overrides.expand??((value: string) => value.replace(/<¤calbum.name>/gi, albumName).replace(/<¤cband.name>/gi,state.bandName)
    .replace(/<¤crealmusician.name>/gi,musicians.find(m=>m.id===singer?.musicianId)?.name ?? ''));
  const layer = scene.add.container(); parent.add(layer);
  const line = (x:number,y:number,value:string,width:number,bold=false,size=11,family='Verdana') => {
    const label=text(scene,layer,x,y,expand(value),size,'#cccccc',width).setFontFamily(family).setFontStyle(bold?'bold':'normal').setLineSpacing(0);
    if(label instanceof NativeText)label.setNativeAntialias(false);
    return label;
  };
  const infoY=magazine?250:249;
  const head=line(17,infoY,card.Headline??card.name,346,true);
  const body=line(17,head.y+head.height+13,card.comment,346);
  const question=line(17,body.y+body.height+13,card.question??'',346);
  const buttonY=question.y+question.height+13, height=buttonY+53, width=383;
  const surround=frame(scene,layer,0,0,width,height,'dialog');layer.sendToBack(surround);
  title(scene,layer,0,0,card.name,'activity-'+(card.icon??'icon_newspaper01').replaceAll(' ','_').toLowerCase());
  const okLabel=card.ButtonOK?.name?expand(card.ButtonOK.name):'OK';
  const cancelLabel=card.ButtonCancel?.name?expand(card.ButtonCancel.name):'Cancel';
  const measure=(value:string)=>{const label=nativeText(scene,0,0,value,{fontFamily:'Courier New',fontSize:'14px',fontStyle:'bold'});const result=Math.ceil(label.width+29+scene.textures.get('ui-accept').getSourceImage().width);label.destroy();return result;};
  const okWidth=overrides.card?measure(okLabel):77,cancelWidth=overrides.cancel?measure(cancelLabel):0,pairWidth=okWidth+(overrides.cancel?cancelWidth+4:0),buttonX=(width-pairWidth)/2;
  button(scene,layer,buttonX,buttonY,okWidth,okLabel,close,true,33,'accept');
  if(overrides.cancel)button(scene,layer,buttonX+okWidth+4,buttonY,cancelWidth,cancelLabel,overrides.cancel,true,33,'cancel');
  layer.setPosition(Math.round(400-width/2),Math.round(305-height/2));
  const prefix=magazine?'magazineintro01_':'newsintro01_';
  const anchor={x:magazine?188:187,y:magazine?145:146};
  let paper:Phaser.GameObjects.Image | undefined;
  const showFrame=(index:number)=>{
    const bitmap=data.sourceWindowBitmaps.find(b=>b.name===prefix+String(index).padStart(4,'0'));
    if(!bitmap)return;
    paper?.destroy();paper=scene.add.image(anchor.x-bitmap.regX,anchor.y-bitmap.regY,bitmap.key).setOrigin(0);layer.add(paper);
    const layout=parent.getData('sourceLayout');
    if(layout)layout.paper={frame:index,key:bitmap.key,x:layer.x+paper.x,y:layer.y+paper.y,width:bitmap.width,height:bitmap.height};
  };
  showFrame(0);
  let index=0;
  const timer=scene.time.addEvent({delay:1000/30,repeat:7,callback:()=>{
    showFrame(++index);
    if(index!==8)return;
    const album=state.album;
    if(overrides.pictureKey&&scene.textures.exists(overrides.pictureKey)){
      // DlgECPressScript sets the resolved bitmap image directly, without
      // resizing it to the album-cover thumbnail dimensions.
      const picture=scene.add.image(magazine?59:56,magazine?60:112,overrides.pictureKey).setOrigin(0);layer.add(picture);
      if(!magazine)picture.preFX?.addColorMatrix().grayscale(1);
      parent.getData('sourceLayout').picture={key:overrides.pictureKey,x:layer.x+picture.x,y:layer.y+picture.y,width:picture.width,height:picture.height};
    }else if(album&&!overrides.pictureKey){
      const cover=coverImage(scene,layer,magazine?59:56,magazine?60:112,magazine?92:105,album.bandName,album.band,musicians,album.selection);
      cover.setDisplaySize(magazine?92:105,magazine?94:105);
      // The original newsprint path calls makeGrayscale; Phaser's color matrix preserves the cover composition.
      if(!magazine)cover.preFX?.addColorMatrix().grayscale(1);
    }
    const headline=line(magazine?58:167,0,card.Caption??'',magazine?130:157,true,magazine?12:18,magazine?'Verdana':'Times New Roman');
    headline.setColor('#000000');headline.y=(magazine?184:148)-headline.height;
  }});
  layer.once('destroy',()=>timer.remove(false));
  const confirmPoint={x:layer.x+buttonX+okWidth/2,y:layer.y+buttonY+16};
  parent.setData('sourceLayout',{id:card.dataMemberName,cardId:card.ID,bounds:{x:layer.x,y:layer.y,width,height},close:confirmPoint,reviewText:expand(card.comment),caption:expand(card.Caption??''),...(!overrides.pictureKey?{cover:{x:layer.x+(magazine?59:56),y:layer.y+(magazine?60:112),width:magazine?92:105,height:magazine?94:105}}:{})});
  parent.setData('eventCardBounds',{x:layer.x,y:layer.y,width,height});
  parent.setData('eventCardButtons',{confirm:confirmPoint,...(overrides.cancel?{cancel:{x:layer.x+buttonX+okWidth+4+cancelWidth/2,y:layer.y+buttonY+16}}:{})});
  showFrame(0);
  return{bounds:new Phaser.Geom.Rectangle(layer.x,layer.y,width,height),buttonY:layer.y+buttonY,buttonCenter:new Phaser.Math.Vector2(confirmPoint.x,confirmPoint.y)};
}

import Phaser from 'phaser';
import data from '../generated/game-data.json' with { type: 'json' };
import cards from '../game/press-review-cards.json' with { type: 'json' };
import type { GameState, Musician } from '../game/model';
import type { Review } from '../game/publicity';
import { button, frame, text, title } from './canvas-ui';
import { coverImage } from './album-cover';
import { NativeText } from './native-text';

/** DlgECPressScript: nine original paper frames, then album and printed headline. */
export function pressReviewWindow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, state: GameState, musicians: Musician[], review: Review, close: () => void) {
  const magazine = review.mediaId === 'Media04';
  const rating = Math.trunc(Phaser.Math.Clamp(review.quality, 0, 1) * 5);
  const card = cards.find(c => c.ID === `ECOC${review.mediaId}Review${rating}`)!;
  const singer = state.band.find(member => member?.instrument === 'Vocals');
  const albumName = data.songs.find(song => song.id === state.album?.songId)?.name ?? '';
  const expand = (value: string) => value.replace(/<¤calbum.name>/gi, albumName).replace(/<¤cband.name>/gi,state.bandName)
    .replace(/<¤crealmusician.name>/gi,musicians.find(m=>m.id===singer?.musicianId)?.name ?? '');
  const layer = scene.add.container(); parent.add(layer);
  const line = (x:number,y:number,value:string,width:number,bold=false,size=11,family='Verdana') => {
    const label=text(scene,layer,x,y,expand(value),size,'#cccccc',width).setFontFamily(family).setFontStyle(bold?'bold':'normal').setLineSpacing(0);
    if(label instanceof NativeText)label.setNativeAntialias(false);
    return label;
  };
  const infoY=magazine?250:249;
  const head=line(17,infoY,card.Headline,346,true);
  const body=line(17,head.y+head.height+13,card.comment,346);
  const question=line(17,body.y+body.height+13,card.question,346);
  const buttonY=question.y+question.height+13, height=buttonY+53, width=383;
  const surround=frame(scene,layer,0,0,width,height,'dialog');layer.sendToBack(surround);
  title(scene,layer,0,0,card.name,'activity-'+card.icon.replaceAll(' ','_').toLowerCase());
  button(scene,layer,(width-77)/2,buttonY,77,'OK',close,true,33,'accept');
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
    if(album){
      const cover=coverImage(scene,layer,magazine?59:56,magazine?60:112,magazine?92:105,album.bandName,album.band,musicians,album.selection);
      cover.setDisplaySize(magazine?92:105,magazine?94:105);
      // The original newsprint path calls makeGrayscale; Phaser's color matrix preserves the cover composition.
      if(!magazine)cover.preFX?.addColorMatrix().grayscale(1);
    }
    const headline=line(magazine?58:167,0,card.Caption,magazine?130:157,true,magazine?12:18,magazine?'Verdana':'Times New Roman');
    headline.setColor('#000000');headline.y=(magazine?184:148)-headline.height;
  }});
  layer.once('destroy',()=>timer.remove(false));
  parent.setData('sourceLayout',{id:card.dataMemberName,cardId:card.ID,bounds:{x:layer.x,y:layer.y,width,height},close:{x:layer.x+width/2,y:layer.y+buttonY+16},reviewText:expand(card.comment),caption:expand(card.Caption),cover:{x:layer.x+(magazine?59:56),y:layer.y+(magazine?60:112),width:magazine?92:105,height:magazine?94:105}});
  showFrame(0);
}

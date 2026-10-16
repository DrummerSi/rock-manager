import Phaser from 'phaser';
import { NativeText } from './native-text';
import {button,frame,text,title} from './canvas-ui';
import type {GameState} from '../game/model';
import {missionEnding} from '../game/mission-progress';

const cash=(n:number)=>Math.round(n).toLocaleString('en-GB');
/** Source DlgMissionOutroData: original artwork and relative score-column layout. */
export function missionResultWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,state:GameState,albumName:string,close:()=>void):void {
  const ending=missionEnding(state,albumName),x=100,y=100;
  const label=(px:number,py:number,value:string,width?:number,bold=false)=>{
    const result=text(scene,parent,px,py,value,11,'#fffbf0',width).setFontFamily('Verdana').setFontStyle(bold?'bold':'').setLetterSpacing(-1).setLineSpacing(2) as NativeText;
    return result.setNativeAntialias(false);
  };
  // Text determines the left column's height. Surround uses recovered tiles.
  const body=label(x+23,y+297,ending.text,336);
  const bottom=Math.max(y+346,body.y+body.height+20);
  frame(scene,parent,x,y,635,bottom-y,'dialog');
  // Re-add text after the surround so it is painted above the source background.
  parent.bringToTop(body);
  title(scene,parent,x,y,ending.title,'effect');
  const pic=(px:number,py:number,name:string)=>{const suffix=name.replaceAll(' ','_').toLowerCase(),key=scene.textures.exists('mission-ending-'+suffix)?'mission-ending-'+suffix:'source-window-'+suffix;const image=scene.add.image(px,py,key).setOrigin(0);parent.add(image);return image;};
  pic(x+22,y+49,'frame02 large environment');
  pic(x+32,y+42,ending.picture);
  const score=ending.score,scoreX=x+396,width=219;
  const panel=(py:number,name:string,icon:string,rows:[string,string][],kind:'economy'|'concerts'|'reviews'|'points')=>{
    const textHeight=13+(rows.length-1)*15,height=41+textHeight;
    frame(scene,parent,scoreX,py+22,width,textHeight+19,'outer');
    frame(scene,parent,scoreX+5,py+27,width-10,textHeight+9,'inner');
    const headerIcon=scene.add.image(scoreX+2,py,'mission-ending-'+icon.replaceAll(' ','_').toLowerCase()).setOrigin(0);
    const header=label(scoreX+4+headerIcon.width,py+7,name,undefined,true);
    const headFrame=frame(scene,parent,scoreX,py+3,header.x+header.width+5-scoreX,header.height+11,'panel',false,'#313131');
    parent.moveTo(headFrame,parent.list.indexOf(header));parent.add(headerIcon);
    rows.forEach(([name,value],i)=>{
      label(scoreX+9,py+31+i*15,name,undefined,kind==='points'||kind==='economy'&&i===3);
      label(scoreX+209,py+31+i*15,value,undefined,kind!=='economy'||i===3).setOrigin(1,0);
    });
    return py+height+3;
  };
  let next=panel(y+31,'Economy','icon_money02',[
    ['Assets','$'+cash(score.assets)],['Debts','$'+cash(score.debts)],['',''],['Total','$'+cash(score.economy)],
  ],'economy');
  next=panel(next,'Concerts','icon_star02',[[`${state.publicity.concertResults.length} Concerts`,cash(score.concertPoints)]],'concerts');
  next=panel(next,'Reviews','icon_newspaper02',[[`${state.publicity.reviews.length} Reviews`,cash(score.reviewPoints)]],'reviews');
  next=panel(next,'Points','icon_golden record02',[['Total',score.total===null?'N/A':cash(score.total)]],'points');
  const buttonY=next+12;
  button(scene,parent,scoreX+(width-78)/2,buttonY,78,'OK',close,true,33,'accept');
  parent.setData('eventCardBounds',{x,y,width:635,height:Math.max(bottom,buttonY+38)-y});
  parent.setData('missionResultButtonY',buttonY);
}

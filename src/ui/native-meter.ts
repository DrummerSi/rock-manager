import Phaser from 'phaser';
import data from '../generated/game-data.json';

/** RockMeterBH.setMeter: retain both source end caps even at zero. */
export function nativeMeter(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,x:number,y:number,fraction:number){
  const part=(suffix:string)=>data.sourceWindowBitmaps.find(b=>b.name.toLowerCase()===('meter01_'+suffix).toLowerCase())!;
  const bg=part('background01'),left=part('line01Left'),mid=part('line01Mid'),right=part('line01Right');
  const draw=(entry:typeof bg,px:number,py:number,width=entry.width)=>{if(width<=0)return;const image=scene.add.image(px,py,entry.key).setOrigin(0).setDisplaySize(width,entry.height);parent.add(image);};
  const middleWidth=Math.max(0,Math.round(Phaser.Math.Clamp(fraction,0,1)*(left.width+mid.width+right.width))-left.width-right.width);
  draw(bg,x,y);const start=x+bg.regX-left.regX;
  draw(left,start,y+bg.regY-left.regY);draw(mid,start+left.width,y+bg.regY-mid.regY,middleWidth);draw(right,start+left.width+middleWidth,y+bg.regY-right.regY);
}

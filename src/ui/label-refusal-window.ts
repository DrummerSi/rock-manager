import Phaser from 'phaser';
import { frame, title, button } from './canvas-ui';
import { nativeText } from './native-text';
import { originalImageKey } from './agenda';

/** Main.dxr DlgRecordRefuseScript and original DlgRecordRefuseData. */
export function labelRefusalWindow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, labelId: string, reason: string, close: () => void) {
  const x=162,y=96,content=scene.add.container();parent.add(content);
  const portraitKey=labelId.toLowerCase()+'-background01';
  const picture=scene.add.image(x+29,y+42,portraitKey).setOrigin(0);
  const text=nativeText(scene,x+35,y+296,reason,{fontFamily:'Verdana',fontSize:'11px',color:'#fffbf0',wordWrap:{width:304,useAdvancedWrap:true},lineSpacing:0}).setNativeAntialias(false);
  const infoHeight=41+text.height,buttonY=y+265+infoHeight+14,windowHeight=buttonY+33+20-y;
  frame(scene,content,x,y,375,windowHeight,'dialog');
  title(scene,content,x,y,'Refusal','activity-icon_golden_record01');
  content.add(scene.add.image(x+26,y+39,originalImageKey(scene,'frame02 large environment')).setOrigin(0));
  content.add(picture);
  // DlgInfoFrameData: headline above an outer frame22px down, inner inset5,
  // and the rich-text Pic at9,31. RecordFormatting's original width is304.
  const icon=scene.add.image(x+28,y+265,originalImageKey(scene,'icon_cd02')).setOrigin(0);
  const heading=nativeText(scene,x+30+icon.width,y+272,'Reasons',{fontFamily:'Verdana',fontSize:'11px',fontStyle:'bold',color:'#eeeeee'}).setNativeAntialias(false);
  frame(scene,content,x+26,y+268,heading.x+heading.width+5-(x+26),heading.height+11,'panel',false,'#313131');
  content.add([icon,heading]);
  frame(scene,content,x+26,y+287,323,text.height+19,'outer');
  frame(scene,content,x+31,y+292,313,text.height+9,'inner');
  content.add(text);
  const measure=nativeText(scene,0,0,'Oh, well',{fontFamily:'Courier New',fontSize:'14px',fontStyle:'bold'});
  const buttonWidth=Math.ceil(29+scene.textures.get('ui-accept').getSourceImage().width+measure.width);measure.destroy();
  const buttonX=x+26+(329-buttonWidth)/2;
  button(scene,content,buttonX,buttonY,buttonWidth,'Oh, well',close,true,33,'accept');
  parent.setData('sourceLayout',{id:'DlgRecordRefuse',bounds:{x,y,width:375,height:windowHeight},close:{x:buttonX+buttonWidth/2,y:buttonY+16}});
  parent.setData('eventCardBounds',{x,y,width:375,height:windowHeight});
  parent.setData('eventCardButtons',{confirm:{x:buttonX+buttonWidth/2,y:buttonY+16}});
  return {portraitRect:new Phaser.Geom.Rectangle(x+29,y+42,picture.width,picture.height),buttonCenter:new Phaser.Math.Vector2(buttonX+buttonWidth/2,buttonY+16),buttonY};
}

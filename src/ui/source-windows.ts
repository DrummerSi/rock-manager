import Phaser from 'phaser';
import {button,frame,text,title} from './canvas-ui';
import {NativeText} from './native-text';
import {cursorStyle} from './cursors';
import type {Song} from '../game/model';
import {nativeMeter} from './native-meter';

const label=(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,x:number,y:number,value:string,width?:number,bold=false,size=11,color='#eeeeee')=>
  (text(scene,parent,x,y,value,size,color,width).setFontFamily('Verdana').setFontStyle(bold?'bold':'').setLineSpacing(0) as NativeText).setNativeAntialias(false);
const pic=(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,x:number,y:number,name:string)=>parent.add(scene.add.image(x,y,'source-window-'+name.replaceAll(' ','_').toLowerCase()).setOrigin(0));
const scrollDrags=new WeakMap<Phaser.Scene,{active:boolean;grab:number;id:string}>();
function sourceButtonWidth(scene:Phaser.Scene,value:string,icon:string){
  const measure=text(scene,scene.add.container(),0,0,value,14).setFontFamily('Courier New').setFontStyle('bold');
  const width=Math.ceil(29+scene.textures.get('ui-'+icon).getSourceImage().width+measure.width);const holder=measure.parentContainer;holder?.destroy(true);return width;
}

/** MainMenuScript centers the content-derived surround at(400,320), places
 * Info after logo.width+26 and positions its separate logo by regPoint121,111. */
export function mainMenuWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,options:{headline:string;comment:string;canContinue:boolean;continue:()=>void;newGame:()=>void;quit:()=>void}){
  const labels=['Continue','New game','Web site','Quit'],icons=['accept','effect','globe','skull'],widths=labels.map((value,i)=>sourceButtonWidth(scene,value,icons[i]));
  const logo=scene.textures.get('logo').getSourceImage(),infoLeft=logo.width+26;
  const width=Math.ceil(Math.max(infoLeft+243,13+widths.reduce((a,b)=>a+b,0)+18)+20),height=175,x=Math.round(400-width/2),y=Math.round(320-height/2);
  frame(scene,parent,x,y,width,height,'dialog');parent.add(scene.add.image(x+16,y-111,'logo').setOrigin(0));
  label(scene,parent,x+infoLeft,y+34,options.headline,243);label(scene,parent,x+infoLeft,y+53,options.comment,243).setLineSpacing(0);
  let px=x+13;const actions=[options.continue,options.newGame,()=>{},options.quit];const controls:Record<string,{x:number;y:number}>={};
  labels.forEach((value,i)=>{button(scene,parent,px,y+122,widths[i],value,actions[i],i===0?options.canContinue:i!==2,33,icons[i]);controls[['continue','newGame','website','quit'][i]]={x:px+widths[i]/2,y:y+138};px+=widths[i]+6;});
  parent.setData('sourceLayout',{id:'DlgMainMenu',bounds:{x,y,width,height},...controls});
}

function scrollBar(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,x:number,y:number,height:number,offset:number,max:number,change:(offset:number)=>void){
  const up=scene.add.image(x,y,'scroll-up').setOrigin(0),down=scene.add.image(x,y+height-scene.textures.get('scroll-down').getSourceImage().height,'scroll-down').setOrigin(0);
  const top=y+up.height,bottom=down.y;
  parent.add(scene.add.rectangle(x+7,top,13,bottom-top,0x313131).setOrigin(0));parent.add([up,down]);
  const hit=(image:Phaser.GameObjects.Image,amount:number)=>image.setInteractive({cursor:cursorStyle('active')}).on('pointerup',()=>change(Phaser.Math.Clamp(offset+amount,0,max)));
  hit(up,-1);hit(down,1);
  const thumbHeight=scene.textures.get('scroll-thumb').getSourceImage().height,travel=Math.max(0,bottom-top-thumbHeight);
  const thumb=scene.add.image(x+3,top+(max?offset/max*travel:0),'scroll-thumb').setOrigin(0).setInteractive({cursor:cursorStyle('active')});parent.add(thumb);
  let drag=scrollDrags.get(scene);if(!drag){drag={active:false,grab:0,id:''};scrollDrags.set(scene,drag);}const currentDrag=drag,id=`${x}:${y}`;
  thumb.on('pointerdown',(p:Phaser.Input.Pointer)=>{currentDrag.active=true;currentDrag.id=id;currentDrag.grab=p.y-thumb.y;});
  // Scene handlers survive row repaint and are removed with this window.
  const move=(p:Phaser.Input.Pointer)=>{if(currentDrag.active&&currentDrag.id===id&&p.isDown&&travel)change(Math.round(Phaser.Math.Clamp((p.y-top-currentDrag.grab)/travel,0,1)*max));};
  const release=()=>{currentDrag.active=false;};scene.input.on('pointermove',move);scene.input.on('pointerup',release);
  parent.once('destroy',()=>{scene.input.off('pointermove',move);scene.input.off('pointerup',release);});
  return {x,y,width:up.width,height};
}

/** DlgPublishData at(177,78); native-004 corroborates the496×448 surround.
 * Original Paper(25,45), ScrollView(25,Paper.bottom+5), OkCancel.y395.
 */
export function publisherWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,options:{
  songs:Song[];selectedId:string;offset:number;funds:number;select:(id:string)=>void;scroll:(offset:number)=>void;buy:()=>void;cancel:()=>void;
}){
  const x=177,y=78,selected=options.songs.find(s=>s.id===options.selectedId),max=Math.max(0,options.songs.length-3),offset=Phaser.Math.Clamp(options.offset,0,max);
  frame(scene,parent,x,y,496,448,'dialog');title(scene,parent,x,y,'Melody Publishing','note');pic(scene,parent,x+25,y+45,'d_paper02');
  // PublishFormatting/Publish2Formatting: Verdana14 bold title; Verdana11
  // label/value runs. Source screenshot fixes the90px and68px tab columns.
  if(selected)label(scene,parent,219,135,selected.name,392,true,14,'#000000');
  const description=label(scene,parent,309,159,selected?.description??'Please choose a song from the list below',300,false,11,'#000000');
  label(scene,parent,219,159,'Description',undefined,true,11,'#000000');
  const infoTop=Math.max(180,description.y+description.height+7);
  const row=(px:number,py:number,name:string,value?:string,vx=px+90)=>{label(scene,parent,px,py,name,undefined,true,11,'#000000');if(value!==undefined)label(scene,parent,vx,py,value,undefined,false,11,'#000000');};
  row(219,infoTop,'Style',selected?.genre??'N/A');row(219,infoTop+17,'Hit factor');row(219,infoTop+34,'Quality');
  row(444,infoTop+17,'Price',selected?'$'+selected.price.toLocaleString('en-GB'):'N/A',512);row(444,infoTop+34,'Royalty',selected?(selected.royalty*100).toFixed(1)+'%':'N/A',512);
  nativeMeter(scene,parent,309,infoTop+19,selected?.songType??0);nativeMeter(scene,parent,309,infoTop+36,selected?.quality??0);
  frame(scene,parent,202,321,420,119,'panel');frame(scene,parent,207,326,410,109,'inner');
  for(const [px,name]of [[202,'Title'],[484,'Price'],[562,'Royalty']]as const){
    const heading=label(scene,parent,px+5,309,name,undefined,true);frame(scene,parent,px,305,Math.ceil(heading.width+10),21,'panel',false,'#313131');parent.bringToTop(heading);
  }
  const rows=scene.add.container(0,0);parent.add(rows);
  const mask=scene.make.graphics({x:0,y:0});mask.fillStyle(0xffffff).fillRect(210,329,404,103);mask.setVisible(false);parent.add(mask);rows.setMask(mask.createGeometryMask());
  options.songs.slice(offset,offset+4).forEach((song,i)=>{
    const py=329+i*35,active=selected?.id===song.id;
    const hit=scene.add.rectangle(210,py,404,34,active?0x393939:0x000000).setOrigin(0).setInteractive({cursor:cursorStyle('active')});rows.add(hit);
    hit.on('pointerup',()=>options.select(song.id));hit.on('pointerover',()=>hit.setFillStyle(0x393939));hit.on('pointerout',()=>hit.setFillStyle(active?0x393939:0x000000));
    // Song scroll item icon anchor22,14; original note02 reg16,15.
    rows.add(scene.add.image(216,py-1,'activity-icon_note02').setOrigin(0));
    label(scene,rows,250,py+5,song.name,230);label(scene,rows,488,py+5,'$'+song.price.toLocaleString('en-GB'));label(scene,rows,611,py+5,(song.royalty*100).toFixed(1)+'%').setOrigin(1,0);
  });
  if(!options.songs.length)label(scene,parent,250,334,'No songs available');
  const wheel=scene.add.zone(207,326,410,109).setOrigin(0).setInteractive();parent.add(wheel);wheel.on('wheel',(_p:unknown,_dx:number,dy:number)=>options.scroll(Phaser.Math.Clamp(offset+Math.sign(dy),0,max)));
  // Keep row clicks above the wheel surface.
  parent.bringToTop(rows);
  scrollBar(scene,parent,624,313,127,offset,max,options.scroll);
  button(scene,parent,287,473,147,'Buy License',options.buy,Boolean(selected)&&options.funds>=(selected?.price??0),33,'accept');
  button(scene,parent,438,473,107,'Cancel',options.cancel,true,33,'cancel');
  parent.setData('sourceLayout',{id:'DlgPublish',bounds:{x,y,width:496,height:448},paper:{x:202,y:123,width:455,height:177},list:{x:207,y:326,width:410,height:109},selectRows:options.songs.slice(offset,offset+3).map((s,i)=>({id:s.id,x:400,y:344+i*35})),buy:{x:360,y:489},cancel:{x:490,y:489}});
}

/** Original DlgRehearsal01NameData + NameScript field offset(7,8). */
export function bandNameWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,name:string,save:()=>void,cancel:()=>void){
  frame(scene,parent,260,204,334,146,'dialog');title(scene,parent,260,204,'Change Band Name','rename');pic(scene,parent,275,250,'Rehearsal01NamePic');
  // Main.dxr TestEnterField STXT1926 + Fmap1867: Arial14 bold, RGB16 white.
  label(scene,parent,282,258,name+'|',280,true,14,'#ffffff').setFontFamily('Arial');
  button(scene,parent,327,297,78,'OK',save,Boolean(name.trim()),33,'accept');button(scene,parent,409,297,107,'Cancel',cancel,true,33,'cancel');
  parent.setData('sourceLayout',{id:'DlgRehearsal01Name',bounds:{x:260,y:204,width:334,height:146},field:{x:282,y:258,width:280},ok:{x:366,y:313}});
}

/** Original DlgMixerExitData, source loc223195 and347px text template. */
export function mixerExitWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,content:string,confirm:()=>void,cancel:()=>void,save:()=>void){
  const body=label(scene,parent,232,229,content,347).setLineSpacing(3),buttonY=body.y+body.height+12;
  const okWidth=sourceButtonWidth(scene,'OK','accept'),cancelWidth=sourceButtonWidth(scene,'Cancel','cancel'),saveWidth=sourceButtonWidth(scene,'Save as…','recorder');
  const cancelX=236+okWidth+6,saveX=cancelX+cancelWidth+6,width=Math.max(376,saveX+saveWidth+20-223);
  frame(scene,parent,223,195,width,buttonY+53-195,'dialog');parent.bringToTop(body);title(scene,parent,223,195,'Leave Mixer','recorder');
  button(scene,parent,236,buttonY,okWidth,'OK',confirm,true,33,'accept');button(scene,parent,cancelX,buttonY,cancelWidth,'Cancel',cancel,true,33,'cancel');button(scene,parent,saveX,buttonY,saveWidth,'Save as…',save,true,33,'recorder');
  parent.setData('sourceLayout',{id:'DlgMixerExit',bounds:{x:223,y:195,width,height:buttonY+53-195},ok:{x:236+okWidth/2,y:buttonY+16},cancel:{x:cancelX+cancelWidth/2,y:buttonY+16},saveAs:{x:saveX+saveWidth/2,y:buttonY+16}});
}

/** Original movie Mission01 frame2 score sprites plus DlgMissionIntroData. */
export function missionIntroWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,mission:{name:string;intro:string;objectives:string[]},begin:()=>void){
  const body=label(scene,parent,132,389,mission.intro,338,false,9);
  const bottom=Math.max(430,body.y+body.height+30);
  frame(scene,parent,100,100,632,bottom-100,'dialog');parent.bringToTop(body);title(scene,parent,100,100,mission.name,'effect');
  pic(scene,parent,134,147,'frame02 large environment');pic(scene,parent,124,137,'frame02 large environment_rotated-3');pic(scene,parent,128,139,'mission01_demoillustration01');
  frame(scene,parent,496,173,206,110,'panel');frame(scene,parent,501,178,196,100,'inner');
  parent.add(scene.add.image(498,151,'activity-icon_cd02').setOrigin(0));label(scene,parent,530,158,'Mission objectives:',undefined,true);
  label(scene,parent,504,181,mission.objectives.map(o=>'• '+o).join('\n'),190).setLineSpacing(4);
  const buttonY=bottom-53;button(scene,parent,545,buttonY,78,'OK',begin,true,33,'accept');
  parent.setData('sourceLayout',{id:'DlgMissionIntro',bounds:{x:100,y:100,width:632,height:bottom-100},illustration:{x:128,y:139,width:324,height:228},begin:{x:584,y:buttonY+16}});
}

export function missionChooseWindow(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,missions:{id:string;name:string;comment?:string;gfx?:string}[],offset:number,total:number,start:()=>void,cancel:()=>void,scroll:(offset:number)=>void){
  const ordered=[...missions].sort((a,b)=>a.id.localeCompare(b.id)),max=Math.max(0,ordered.length-3);offset=Phaser.Math.Clamp(offset,0,max);
  frame(scene,parent,160,100,482,440,'dialog');title(scene,parent,160,100,'Choose Mission','effect');
  label(scene,parent,186,154,'Mission',undefined,true);label(scene,parent,527,154,'Points',undefined,true);
  frame(scene,parent,181,166,400,254,'panel');frame(scene,parent,186,171,390,244,'inner');
  const rows=scene.add.container(0,0);parent.add(rows);const mask=scene.make.graphics({x:0,y:0});mask.fillStyle(0xffffff).fillRect(188,173,386,240);mask.setVisible(false);parent.add(mask);rows.setMask(mask.createGeometryMask());
  ordered.slice(offset,offset+3).forEach((m,i)=>{
    const py=173+i*80,available=m.id==='Mission01',row=scene.add.container(188,py);rows.add(row);row.setAlpha(available?1:.5);
    const icon='source-window-'+(m.gfx??m.id.toLowerCase());if(scene.textures.exists(icon))row.add(scene.add.image(4,1,icon).setOrigin(0));
    label(scene,row,100,2,m.name,219,true).setLetterSpacing(-1);label(scene,row,100,18,m.comment??'',219);
    if(available&&total>0)label(scene,row,378,2,total.toLocaleString('en-GB')).setOrigin(1,0);
    if(available){const hit=scene.add.zone(0,0,386,80).setOrigin(0).setInteractive({cursor:cursorStyle('active')});row.add(hit);hit.on('pointerup',start);}
  });
  scrollBar(scene,parent,584,158,262,offset,max,scroll);
  const wheel=scene.add.zone(188,173,386,240).setOrigin(0).setInteractive();parent.add(wheel);wheel.on('wheel',(_p:unknown,_dx:number,dy:number)=>scroll(Phaser.Math.Clamp(offset+Math.sign(dy),0,max)));parent.bringToTop(rows);
  parent.add(scene.add.image(183,427,'activity-icon_effect02').setOrigin(0));label(scene,parent,215,434,'Total score',undefined,true);
  frame(scene,parent,181,449,400,32,'panel');frame(scene,parent,186,454,390,22,'inner');label(scene,parent,191,457,total.toLocaleString('en-GB')+' points');
  button(scene,parent,298,487,78,'OK',start,true,33,'accept');button(scene,parent,380,487,107,'Cancel',cancel,true,33,'cancel');
  parent.setData('sourceLayout',{id:'DlgMissionChoose',bounds:{x:160,y:100,width:482,height:440},start:{x:337,y:503},cancel:{x:433,y:503}});
}

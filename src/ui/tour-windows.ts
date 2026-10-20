import Phaser from 'phaser';
import type {GameState,Musician} from '../game/model';
import {TOUR_RULES,tourQuote,canBookTour,type BandTour} from '../game/tour';
import {button,frame,infoFrame,text,title,uiIconKey} from './canvas-ui';
import {nativeChooser} from './native-chooser';
import {nativeAgenda,originalImageKey} from './agenda';
import {activityEvents} from './activity-windows';
import {cursorStyle} from './cursors';
import {composeCover} from './album-cover';
const money=(n:number)=>'$'+Math.round(n).toLocaleString('en-GB');
const caption=(s:Phaser.Scene,l:Phaser.GameObjects.Container,x:number,y:number,value:string,width?:number)=>text(s,l,x,y,value,11,'#eeeeee',width).setFontFamily('Verdana').setLineSpacing(0);
const pic=(s:Phaser.Scene,l:Phaser.GameObjects.Container,x:number,y:number,name:string)=>{const image=s.add.image(x,y,originalImageKey(s,name)).setOrigin(0);l.add(image);return image;};
export interface TourDraft {cities:string[];stage:string[];expenseId:string;rotation:number}
export const emptyTourDraft=():TourDraft=>({cities:[],stage:[],expenseId:'',rotation:0});

/** Original80-frame EarthAnim, 126px sphere and -19degree axial tilt. */
function globe(s:Phaser.Scene,l:Phaser.GameObjects.Container,x:number,y:number,draft:TourDraft,choose?:(id:string)=>void,tour?:BandTour,day=0) {
  pic(s,l,x+43,y+29,'image_screenshot tour01');
  const rotation=Math.round(draft.rotation/(2*Math.PI)*80)/80*2*Math.PI;
  const frameNo=((Math.trunc((rotation+1.05)*80/(2*Math.PI))-1)%80+80)%80;
  const earthName='globe01_'+String(frameNo).padStart(4,'0'),earthMeta=TOUR_RULES.bitmaps.find(b=>b.name===earthName)!;
  // EarthAnim centers the frame; GlobeMap then pastes at (-4,-7), clipping
  // to its 259x267 sprite canvas before drawing the city markers.
  const earthKey='tour-earth-composite-'+frameNo;
  if(!s.textures.exists(earthKey)){
    const centered=document.createElement('canvas');centered.width=259;centered.height=267;
    centered.getContext('2d')!.drawImage(s.textures.get('tour-'+earthName).getSourceImage() as HTMLImageElement,Math.round(259/2-earthMeta.regX),Math.round(267/2-earthMeta.regY));
    const texture=s.textures.createCanvas(earthKey,259,267)!;
    texture.getContext().drawImage(centered,-4,-7);texture.refresh();
  }
  pic(s,l,x+47,y+47,earthKey);
  const project=(coordinates:string)=>{
    const [longitude,latitude]=JSON.parse(coordinates) as number[],r=126;
    const a=-r*Math.cos(latitude)*Math.sin(longitude),b=r*Math.sin(latitude),c=-r*Math.cos(latitude)*Math.cos(longitude);
    const rx=a*Math.cos(rotation)+c*Math.sin(rotation),rz=c*Math.cos(rotation)-a*Math.sin(rotation),tilt=-19*Math.PI/180;
    return{x:x+47+126+rx*Math.cos(tilt)+b*Math.sin(tilt),y:y+47+126+b*Math.cos(tilt)-rx*Math.sin(tilt),z:rz};
  };
  const route=['TCRockCity',...draft.cities];
  const lines=s.add.graphics().lineStyle(1,0x000000);l.add(lines);
  for(let i=1;i<route.length;i++){const a=project(TOUR_RULES.cities.find(c=>c.ID===route[i-1])!.Coordinates),b=project(TOUR_RULES.cities.find(c=>c.ID===route[i])!.Coordinates);if(a.z<0&&b.z<0)lines.lineBetween(a.x,a.y,b.x,b.y);}
  for(const city of TOUR_RULES.cities.filter(c=>c.Available==='1'||c.ID==='TCRockCity')){
    const p=project(city.Coordinates);if(p.z>=0)continue;
    const dot=s.add.circle(p.x,p.y,3,draft.cities.includes(city.ID)?0xffffff:0x000000).setStrokeStyle(1,0xffffff);l.add(dot);
    if(choose){dot.setInteractive({cursor:cursorStyle('active')});let label:Phaser.GameObjects.Text|undefined;dot.on('pointerover',()=>label=caption(s,l,p.x+5,p.y,city.name).setBackgroundColor('#000000')).on('pointerout',()=>label?.destroy()).on('pointerup',()=>{label?.destroy();choose(city.ID);});}
  }
  return project;
}
const buttonWidth=(s:Phaser.Scene,label:string,icon:string)=>{const t=caption(s,s.add.container(),0,0,label);t.setFontFamily('Courier New').setFontSize(14).setFontStyle('bold');const key=uiIconKey(s,icon),width=29+t.width+(key?s.textures.get(key).getSourceImage().width:0);t.parentContainer.destroy(true);return Math.ceil(width);};

/** DlgTourData at(91,86), using source globe and information panel offsets. */
export function tourWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,state:GameState,draft:TourDraft,choose:(id:string)=>void,rotate:(amount:number)=>void,stage:()=>void,expenses:()=>void,book:()=>void,close:()=>void):void {
  const x=91,y=86,quote=tourQuote(draft.cities,draft.stage,draft.expenseId);
  const labels=['Stage Design','Expenses','Book Tour','Cancel'],icons=['icon_scene01','icon_ice bucket01','icon_calendar01','icon_cancel01'],widths=labels.map((label,i)=>buttonWidth(s,label,icons[i]));
  const width=Math.max(555,widths.reduce((a,b)=>a+b,0)+52);frame(s,l,x,y,width,428,'dialog');title(s,l,x,y,'World Tour','icon_globe01');
  globe(s,l,x,y,draft,choose);
  const route=infoFrame(s,l,x+345,y+30,180,152,'Route','activity-icon_globe02');
  if(!draft.cities.length)caption(s,l,route.x,route.y,'No cities selected',180);
  quote.stops.forEach((stop,i)=>{const city=TOUR_RULES.cities.find(c=>c.ID===stop.id)!;caption(s,l,route.x,route.y+i*15,city.name);caption(s,l,route.x+112,route.y+i*15,money(stop.cost));const hit=s.add.zone(route.x,route.y+i*15,180,15).setOrigin(0).setInteractive({cursor:cursorStyle('active')});l.add(hit);hit.on('pointerup',()=>choose(stop.id));});
  if(draft.cities.length){caption(s,l,route.x,route.y+draft.cities.length*15,'(Return home)');caption(s,l,route.x+112,route.y+draft.cities.length*15,money(quote.home));}
  const total=infoFrame(s,l,x+345,y+239,180,75,'Total','money');
  [['Travel',quote.travel],['Stage',quote.stageCost],['Expenses',quote.expense],['Total',quote.cost]].forEach(([label,value],i)=>{caption(s,l,total.x,total.y+i*15,String(label));caption(s,l,total.x+102,total.y+i*15,money(Number(value)));});
  for(const [dx,name,dir]of [[51,'ArrowTurnLeft',-1],[249,'ArrowTurnRight',1]] as const)pic(s,l,x+dx,y+300,name).setInteractive({cursor:cursorStyle('active')}).on('pointerup',()=>rotate(dir*Math.PI/8));
  let bx=x+20;[stage,expenses,book,close].forEach((action,i)=>{button(s,l,bx,y+380,widths[i],labels[i],action,i!==2||canBookTour(state,draft.cities,draft.stage,draft.expenseId,state.day+3),33,icons[i]);bx+=widths[i]+4;});
}

export function tourCityWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,draft:TourDraft,id:string,confirm:()=>void,cancel:()=>void):void {
  const city=TOUR_RULES.cities.find(c=>c.ID===id)!,remove=draft.cities.includes(id),x=183,y=131;
  const quote=tourQuote([...draft.cities.filter(c=>c!==id),id],draft.stage,draft.expenseId),stop=quote.stops.at(-1)!;
  pic(s,l,x+20,y+35,city.Gfx||'arena01');
  const body=caption(s,l,x+119,y+35,`City: ${city.name}\nMax. audience: ${Number(city.size).toLocaleString('en-GB')}\nTicket price: ${money(Number(city.PreferredPriceModel.UnitPrice))}\nRent: ${money(Number(city.PreferredPriceModel.BasePrice))}\nTrip price: ${money(stop.travelCost)}\n\n${city.comment}`,200);
  const border=frame(s,l,x,y,340,body.height+108,'dialog');l.sendToBack(border);title(s,l,x,y,remove?'Remove City':'Add City','icon_globe01');
  const by=body.y+body.height+7,bw=remove?105:77,bx=x+219-(bw+113)/2;button(s,l,bx,by,bw,remove?'Remove':'Add',confirm,remove||draft.cities.length<8,33,remove?'icon_garbage can01':'accept');button(s,l,bx+bw+4,by,109,'Cancel',cancel,true,33,'cancel');
}

export function tourStageWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,state:GameState,musicians:Musician[],selection:string[],change:(index:number,id:string)=>void,confirm:()=>void,cancel:()=>void):void {
  const x=115,y=50;frame(s,l,x,y,570,387,'dialog');title(s,l,x,y,'Stage Design','icon_scene01');
  const midX=x+13+160,midY=y+32+180;
  const layers:{name:string;order:number}[]=[{name:'stage_small_base01',order:3}];
  selection.forEach(id=>{const element=TOUR_RULES.elements.find(e=>e.ID===id)!;for(const m of element.Gfx.matchAll(/\["([^"]+)",\s*(\d+)\]/g))layers.push({name:m[1],order:Number(m[2])});});
  if(selection[0]==='DESBGName'&&state.album){
    // DlgTourStage.makeComposite's original four-corner sleeve projection.
    const cover=composeCover(s,state.album.bandName,state.album.band,musicians,state.album.selection,state.album.costumes),source=cover.getContext('2d')!.getImageData(0,0,300,300);
    const key='tour-stage-cover-'+Phaser.Utils.String.UUID(),texture=s.textures.createCanvas(key,111,149)!,pixels=texture.getContext().createImageData(111,149);
    const [x0,y0,x1,y1,x2,y2,x3,y3]=[0,0,111,4,111,151,2,123];
    const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3,det=dx1*dy2-dx2*dy1;
    const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det,a=x1-x0+g*x1,b=x3-x0+h*x3,d=y1-y0+g*y1,e=y3-y0+h*y3;
    for(let py=0;py<149;py++)for(let px=0;px<111;px++){
      const aa=a-px*g,bb=b-px*h,dd=d-py*g,ee=e-py*h,den=aa*ee-bb*dd;
      const u=((px-x0)*ee-bb*(py-y0))/den,v=(aa*(py-y0)-(px-x0)*dd)/den;
      if(u<0||v<0||u>=1||v>=1)continue;
      const from=(Math.floor(v*300)*300+Math.floor(u*300))*4,to=(py*111+px)*4;
      pixels.data.set(source.data.subarray(from,from+4),to);
    }
    texture.getContext().putImageData(pixels,0,0);texture.refresh();const image=s.add.image(midX-35,midY-123,key).setOrigin(0);l.add(image);image.once('destroy',()=>s.textures.remove(key));
  }
  layers.sort((a,b)=>a.order-b.order).forEach(entry=>{const key='tour-'+entry.name.toLowerCase(),image=s.textures.exists(key)?s.textures.get(key):undefined;if(!image)return;const meta=TOUR_RULES.bitmaps.find(b=>b.key===key)!;const sprite=s.add.image(midX-meta.regX,midY-meta.regY,key).setOrigin(0);l.add(sprite);
    if(entry.name.endsWith('_0001')){const prefix=key.slice(0,-4),frames=TOUR_RULES.bitmaps.filter(b=>b.key.startsWith(prefix)&&/^\d{4}$/.test(b.key.slice(prefix.length))).sort((a,b)=>a.key.localeCompare(b.key));if(frames.length>1){let index=0;const timer=s.time.addEvent({delay:1000/30,loop:true,callback:()=>{const f=frames[(++index)%frames.length];sprite.setTexture(f.key).setPosition(midX-f.regX,midY-f.regY);}});sprite.once('destroy',()=>timer.remove());}}
  });
  TOUR_RULES.categories.forEach((cat,i)=>{const selected=TOUR_RULES.elements.find(e=>e.ID===selection[i])!,pos=cat.elements.indexOf(selected.ID);nativeChooser(s,l,{x:x+361,y:y+55+i*60,label:cat.name,value:selected.name+' '+money(Number(selected.price)),textRight:159,previous:()=>change(i,cat.elements[pos-1]),next:()=>change(i,cat.elements[pos+1]),previousEnabled:pos>0,nextEnabled:pos<cat.elements.length-1});});
  button(s,l,x+184,y+334,77,'OK',confirm,true,33,'accept');button(s,l,x+269,y+334,109,'Cancel',cancel,true,33,'cancel');
}

export function tourExpenseWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,index:number,change:(index:number)=>void,confirm:()=>void,cancel:()=>void):void {
  const e=TOUR_RULES.expenses[index],x=112,y=126;frame(s,l,x,y,340,243,'dialog');title(s,l,x,y,'Expenses','icon_ice bucket01');
  pic(s,l,x+19,y+39,'portrait_frame_large01');const bitmap=TOUR_RULES.bitmaps.find(b=>b.name===e.Gfx)!;pic(s,l,x+71-bitmap.regX,y+90-bitmap.regY,e.Gfx);
  caption(s,l,x+138,y+35,e.name,182).setFontStyle('bold');caption(s,l,x+138,y+63,e.comment,182);caption(s,l,x+138,y+140,money(Number(e.price)));
  for(const[dx,name,next]of [[19,'ArrowLeft',index-1],[276,'ArrowRight',index+1]] as const){const a=pic(s,l,x+dx,y+189,name);if(next>=0&&next<3)a.setInteractive({cursor:cursorStyle('active')}).on('pointerup',()=>change(next));else a.setAlpha(.3);}
  button(s,l,x+75,y+189,77,'OK',confirm,true,33,'accept');button(s,l,x+156,y+189,109,'Cancel',cancel,true,33,'cancel');
}

export function tourBookingWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,state:GameState,draft:TourDraft,day:number,firstDay:number,choose:(day:number)=>void,scroll:(dir:number)=>void,confirm:()=>void,cancel:()=>void):void {
  const x=91,y=86,quote=tourQuote(draft.cities,draft.stage,draft.expenseId);frame(s,l,x,y,477,345,'dialog');title(s,l,x,y,'Book Tour','icon_globe01');
  pic(s,l,x+20,y+37,'image_training vacation01_small01');caption(s,l,x+121,y+35,'Book a tour for the band.',300);
  nativeAgenda(s,l,state,x+20,y+124,firstDay,[...activityEvents(state),{id:'draft-tour',kind:'concert',formatId:'AgFmBandTour',name:'World Tour',startDay:day,duration:quote.duration,selected:true}],choose,scroll,d=>canBookTour(state,draft.cities,draft.stage,draft.expenseId,d));
  button(s,l,x+121,y+292,134,'Book Tour',confirm,canBookTour(state,draft.cities,draft.stage,draft.expenseId,day),33,'accept');button(s,l,x+264,y+292,109,'Cancel',cancel,true,33,'cancel');
}

export function tourOngoingWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,state:GameState,close:()=>void,cancel:()=>void):void {
  const tour=state.tour!,x=100,y=100;frame(s,l,x,y,601,406,'dialog');title(s,l,x,y,'World Tour','icon_scene01');
  const route=['TCRockCity',...tour.cities],elapsed=Math.max(0,state.day-tour.startDay);
  const leg=Math.min(tour.cities.length,Math.floor(elapsed/2));
  const from=TOUR_RULES.cities.find(c=>c.ID===route[leg])!;
  const to=TOUR_RULES.cities.find(c=>c.ID===(tour.cancelled?'TCRockCity':route[leg+1]??'TCRockCity'))!;
  const globeLayer=s.add.container();l.add(globeLayer);
  const draft={cities:tour.cities,stage:tour.stage,expenseId:tour.expenseId,rotation:0};
  const start=JSON.parse(from.Coordinates) as number[],end=JSON.parse(to.Coordinates) as number[];
  const vector=([lon,lat]:number[])=>[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];
  const a=vector(start),b=vector(end),angle=Math.acos(Phaser.Math.Clamp(a.reduce((v,n,i)=>v+n*b[i],0),-1,1));
  // TourTravelScript follows the great circle and rotates the globe to keep
  // the aircraft visible. Projecting an unseen destination onto a fixed globe
  // made the return flight appear to land somewhere unrelated to Rock City.
  const coordinates=(t:number)=>{
    if(t<=0)return start;if(t>=1)return end;
    const weights=angle<1e-6?[1-t,t]:[Math.sin((1-t)*angle)/Math.sin(angle),Math.sin(t*angle)/Math.sin(angle)];
    const v=a.map((n,i)=>n*weights[0]+b[i]*weights[1]);
    return [Math.atan2(v[2],v[0]),Math.atan2(v[1],Math.hypot(v[0],v[2]))];
  };
  const flying=!tour.completed&&(tour.cancelled||elapsed%2===0);
  const plane=flying?s.add.image(0,0,'tour-plane02_0012'):undefined;
  let lastRotation=NaN,project:ReturnType<typeof globe>;
  const draw=(t:number)=>{
    const coords=coordinates(t),rotation=Math.round(-coords[0]/(2*Math.PI)*80)/80*2*Math.PI;
    if(rotation!==lastRotation){globeLayer.removeAll(true);draft.rotation=rotation;project=globe(s,globeLayer,x,y,draft);lastRotation=rotation;}
    if(plane){
      const pos=project(JSON.stringify(coords)),next=project(JSON.stringify(coordinates(Math.min(1,t+.001))));
      const direction=Math.trunc((((Math.atan2(next.x-pos.x,pos.y-next.y)+2*Math.PI)%(2*Math.PI))*16)/(2*Math.PI));
      plane.setPosition(pos.x,pos.y).setScale(Math.max(.4,Math.min(1,t/.2,(1-t)/.2))).setTexture('tour-plane02_'+String((12+16-direction)%16).padStart(4,'0'));
    }
  };
  draw(0);
  if(plane){l.add(plane);const progress={value:0};s.tweens.add({targets:progress,value:1,duration:1000,ease:'Linear',onUpdate:()=>draw(progress.value)});l.once('destroy',()=>s.tweens.killTweensOf(progress));}

  const info=infoFrame(s,l,x+331,y+70,230,210,'Total Results','activity-icon_spotlight02');
  tour.results.forEach((r,i)=>{caption(s,l,info.x,info.y+i*17,TOUR_RULES.cities.find(c=>c.ID===r.venueId)!.name);caption(s,l,info.x+128,info.y+i*17,money(r.income));});
  const revenue=tour.results.reduce((sum,r)=>sum+r.income,0);caption(s,l,info.x,info.y+155,'Total revenue: '+money(revenue));caption(s,l,info.x,info.y+170,'Prepaid: '+money(tour.cost));caption(s,l,info.x,info.y+185,'Total: '+money(revenue-tour.cost));
  button(s,l,x+390,y+353,tour.completed?81:160,tour.completed?'OK':'Cancel Tour',tour.completed?close:cancel,true,33,tour.completed?'accept':'cancel');
}

/** DlgTourConcertResultData at(150,150); its Info picture is Dummy. */
export function tourResultWindow(s:Phaser.Scene,l:Phaser.GameObjects.Container,state:GameState,index:number,close:()=>void):void {
  const result=state.tour!.results[index],city=TOUR_RULES.cities.find(c=>c.ID===result.venueId)!,x=150,y=150;
  const heading=caption(s,l,0,0,'Satisfaction').setFontStyle('bold'),icon=uiIconKey(s,'activity-icon_prize_podium02');
  const width=Math.max(233,142+heading.width+(icon?s.textures.get(icon).getSourceImage().width:0));heading.destroy();
  frame(s,l,x,y,width,269,'dialog');title(s,l,x,y,city.name,'icon_scene01');pic(s,l,x+14,y+42,city.Gfx||'arena01');
  const star='meter_stars'+String(Math.max(0,Math.min(10,Math.round(result.satisfaction*10)))).padStart(2,'0');
  const satisfaction=infoFrame(s,l,x+113,y+48,90,14,'Satisfaction','activity-icon_prize_podium02');pic(s,l,satisfaction.x,satisfaction.y,star);
  const results=infoFrame(s,l,x+14,y+133,180,42,'Results','money');
  [['Audience',Math.round(result.audience).toLocaleString('en-GB')],['Ticket price',money(Number(city.PreferredPriceModel.UnitPrice))],['Total',money(result.income)]].forEach(([label,value],i)=>{caption(s,l,results.x,results.y+i*14,label);caption(s,l,results.x+95,results.y+i*14,value);});
  button(s,l,x+110,y+216,81,'OK',close,true,33,'accept');
}

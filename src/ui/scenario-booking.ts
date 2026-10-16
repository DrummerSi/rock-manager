import Phaser from 'phaser';
import type {GameState} from '../game/model';
import type {ScenarioAppointment} from '../game/scenario-types';
import originalText from '../game/original-text.json' with {type:'json'};
import {button,frame,title} from './canvas-ui';
import {nativeText} from './native-text';
import {nativeAgenda,type AgendaEntry} from './agenda';
import {activityEvents} from './activity-windows';

/** Original rBookDialog -> DlgBookScript -> DlgLiveBookData.
 * Mission04's offered DivEvent passes Text=szidAgendaBookMediaEvent, and
 * AgFmConcert. Price/venue descriptions are intentionally not invented.
 */
export function scenarioBooking(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,state:GameState,
  appointment:ScenarioAppointment,day:number,firstDay:number,changeDay:(day:number)=>void,scroll:(direction:number)=>void,
  confirm:()=>void,cancel:()=>void,allowed:(day:number)=>boolean=(candidate)=>candidate>=state.day+1):void {
  const label=originalText.translations.szidAgendaBookMediaEvent;
  frame(scene,parent,160,90,477,345,'dialog');title(scene,parent,160,90,label,'calendar-title');
  const candidates=['activity-image_media01_small01','image_media01_small01'];
  const key=candidates.find(key=>scene.textures.exists(key))??'ui-calendar';
  const image=scene.add.image(180,127,key).setOrigin(0);parent.add(image);
  const infoX=180+image.width+10;
  const info=nativeText(scene,infoX,125,label,{fontFamily:'Verdana',fontSize:'11px',color:'#f5f5f5',wordWrap:{width:617-infoX,useAdvancedWrap:true}}).setNativeAntialias(false);parent.add(info);
  const existing=activityEvents(state),current=existing.find(event=>event.id===appointment.id);
  const draft:AgendaEntry={id:appointment.id,kind:'concert',name:current?.name??label,startDay:day,duration:appointment.duration,selected:true};
  nativeAgenda(scene,parent,state,180,214,firstDay,[...existing.filter(event=>event.id!==appointment.id),draft],changeDay,scroll,
    candidate=>candidate>=state.day+1&&allowed(candidate));
  button(scene,parent,304,382,77,'OK',confirm,day>=state.day+1&&allowed(day),33,'calendar');
  button(scene,parent,385,382,109,'Cancel',cancel,true,33,'cancel');
  parent.setData('sourceLayout',{id:'DlgLiveBookData',purpose:'scenario-appointment',appointmentId:appointment.id,bounds:{x:160,y:90,width:477,height:345},
    picture:{key,x:180,y:127,width:image.width,height:image.height},info:{x:infoX,y:125,text:label},
    agenda:{x:180,y:214,firstDay,dayWidth:25,plotX:186,plotY:234},selectedDay:day,
    confirm:{x:342.5,y:398},cancel:{x:439.5,y:398},ok:{x:342.5,y:398}});
}

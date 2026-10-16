import type {GameState,Musician} from './model';
import type {ScenarioEvent,ScenarioState} from './scenario-types';
import {bandmateStats,bandmateOccupied} from './bandmates';
const members=['RMCEddie','RMCAndy','RMCSonny','RMCManny'];
/** DataDBRest05 / M05.dat: Firewolf's farewell record and world tour. */
export function initialScenario05(state:GameState):ScenarioState {
  return {version:1,vars:{myBandName:state.bandName,myHype:.15,andyImune:false,anette:false},active:{},queue:[],seen:[],appointments:[],approved:false,outcome:null};
}
export function updateScenario05(input:GameState,event:ScenarioEvent,musicians:Musician[]):GameState {
  if(!input.scenario||input.scenario.outcome)return input;
  const state=structuredClone(input),s=state.scenario!,v=s.vars,a=s.active;
  const queue=(id:string,speakerId?:string)=>{if(!s.queue.some(c=>c.id.toLowerCase()===id.toLowerCase())&&!s.seen.some(c=>c.toLowerCase()===id.toLowerCase()))s.queue.push({id,...(speakerId?{speakerId}:{})});};
  const mod=(id:string,amount:number,duration:number,actors=members)=>{for(const musicianId of actors)state.bandmates.modifiers.push({id,musicianId,stat:'mood',amount,startDay:state.day,duration});};
  const away=(id:string,kind:string,duration:number)=>s.appointments.push({id:id+state.day,kind,actorId:'RMCAndy',startDay:state.day,duration,completed:false});
  const chance=(percent:number)=>{state.publicity.seed=(Math.imul(state.publicity.seed,1664525)+1013904223)>>>0;return state.publicity.seed/4294967296*100<percent;};
  if((event.kind==='fire'||event.kind==='action'&&event.actionId==='QuitBand')&&members.includes(event.actorId??''))queue('ECOCMis5GameOverLeaveBand',event.actorId);
  if(event.kind==='city'&&state.bandName!==v.myBandName){state.bandName=String(v.myBandName);queue('ECOCmis5NameChange','RMCEddie');}
  if(event.kind==='action'&&event.actionId==='HireBandMember'&&event.actorId){for(const musicianId of members)state.bandmates.modifiers.push({id:'NoNewblood',musicianId,stat:'mood',amount:-.7,startDay:state.day,duration:200,otherId:event.actorId});}
  const abroad=state.tour&&!state.tour.completed&&state.tour.startDay<=state.day;
  if((event.kind==='day'||event.kind==='city')&&!abroad){
    for(const appointment of s.appointments)if(state.day>=appointment.startDay+appointment.duration)appointment.completed=true;
    if(state.publicity.totalSales>=25000&&!v.tourUnlocked){v.tourUnlocked=true;queue('ECOCMis5LockUpTour');}
    if(state.day-Number(v.tourDays??0)>=270)queue('ECOCMis5GameOverTooLong');
    if(state.money<=15000)queue('ECOCMis5InstrumentSponsor');
    // TRMis5WorldsLoudestOK deactivates as soon as a qualifying gig is booked.
    if(a.loudest!==undefined&&(v.loudestBooked||v.loudestDone))delete a.loudest;
    if(a.loudest!==undefined){
      const next=state.publicity.concerts.filter(c=>!c.completed&&c.startDay>state.day).sort((a,b)=>a.startDay-b.startDay)[0];
      if(next&&next.startDay<=a.loudest+21){v.loudestBooked=true;v.andyImune=true;queue('ECOCMis5WorldsLoudestNews');delete a.loudest;}
      else if(next&&next.startDay>a.loudest+21)queue('ECOCMis5WorldsLoudestPlaySooner');
      else if(!next&&state.day===a.loudest+14)queue('ECOCMis5WorldsLoudestMad',chance(50)?'RMCEddie':'RMCSonny');
      else if(!next&&state.day===a.loudest+21)queue('ECOCMis5WorldsLoudestFury','RMCSonny');
    }
    if(!v.andyImune&&!bandmateOccupied(state,'RMCAndy')){
      const andy=bandmateStats(state,'RMCAndy');
      if(a.andyRisk!==undefined&&state.day>=a.andyRisk+10&&andy.health<=.3){queue('ECOCMis5ArtistOD','RMCAndy');delete a.andyRisk;a.andyOD=state.day;away('AndyOD','hospital',5);}
      else if(a.andyRisk!==undefined&&state.day>=a.andyRisk+13&&andy.mood<=.3){queue('ECOCMis5DrugBust','RMCAndy');delete a.andyRisk;away('AndyBust','prison',5);}
      if(a.andyOD!==undefined){
        if(state.day===a.andyOD+5)queue('ECOCMis5ArtistODWell','RMCAndy');
        if(state.day>=a.andyOD+14&&andy.health<=.3){queue('ECOCMis5Detox','RMCAndy');delete a.andyOD;a.andyDetox=state.day;away('AndyDetox','hospital',30);}
      }
      if(a.andyDetox!==undefined){
        if(state.day===a.andyDetox+30)queue('ECOCMis5DetoxBack','RMCAndy');
        if(state.day>=a.andyDetox+37&&andy.health<=.3)queue('ECOCMis5ArtistMoveMom','RMCAndy');
      }
      const concert=state.publicity.concerts.find(c=>!c.completed&&c.startDay>state.day&&c.startDay-state.day<=3);
      if(concert&&andy.mood<=.2&&!s.seen.some(id=>id.toLowerCase()==='ecocmis5sellinstruments')){queue('ECOCMis5SellInstruments','RMCAndy');a.andyRisk??=state.day;}
    }
    if(a.andyPress!==undefined&&state.day>=a.andyPress+3&&!v.andyImune){queue('ECOCMis5DrugbustPress','RMCAndy');a.andyBust=state.day;delete a.andyPress;}
    if(a.andyBust!==undefined&&state.day>=a.andyBust+10&&!v.andyImune){queue(v.LegalSafe||chance(25)?'ECOCMis5JudgeDrugFree':'ECOCMis5JudgeDrugJail','RMCAndy');delete a.andyBust;}
  }
  if(event.kind==='concert'){
    const concert=state.publicity.concertResults.find(c=>c.concertId===event.concertId);
    if(concert&&!v.firstConcert){queue(concert.satisfaction*5>=2?'ECOCMis5WorldsLoudestGood':'ECOCMis5WorldsLoudestBand',chance(50)?'RMCEddie':'RMCSonny');v.firstConcert=true;}
    if(v.loudestBooked&&!v.loudestDone){queue('ECOCMis5WorldsLoudestHappy','RMCManny');v.loudestDone=true;}
  }
  if(state.tour?.completed&&state.tour.results.length>=3)s.outcome='won';
  if(event.kind==='card'){
    const id=event.cardId!.toLowerCase();s.queue=s.queue.filter(c=>c.id.toLowerCase()!==id);if(!s.seen.some(c=>c.toLowerCase()===id))s.seen.push(event.cardId!);
    const ok=event.choice==='ButtonOK';
    if(ok){
      if(/gameover|worldsloudestfury/.test(id))s.outcome='lost';
      if(id==='ecocmis5judgedrugjail')queue('ECOCMis5GameOverLeaveBand','RMCAndy');
      if(id==='ecocmis5drugbust'){a.andyPress=state.day;mod('DrugbustPress',-.1,10,['RMCAndy']);}
      if(id==='ecocmis5sellinstruments')state.money-=5000;
      if(id==='ecocmis5artistod'){
        mod('badmoodOD',-.2,10,['RMCAndy']);state.bandmates.modifiers.push({id:'badHealthOD',musicianId:'RMCAndy',stat:'health',amount:-.1,startDay:state.day,duration:10});
      }
      if(id==='ecocmis5namechange')mod('ArtistpissednameChange',-.2,20);
      if(id==='ecocmis5instrumentsponsor'){state.money+=45000;v.instrumentSponsor=true;mod('Spons',.1,10);}
      if(id==='ecocmis5worldsloudestgood'||id==='ecocmis5worldsloudestband'){state.money-=10000;a.loudest=state.day;}
      if(id==='ecocmis5worldsloudestmad')mod('Nogig',-.1,5);
      if(id==='ecocmis5worldsloudesthappy'){mod('BandLoud',.2,20);mod('zzz',.4,3);v.andyImune=false;}
    }else if(id==='ecocmis5worldsloudestgood'||id==='ecocmis5worldsloudestband')mod('NoGoLoud',-.2,20);
    else if(id==='ecocmis5sellinstruments'){
      const next=state.publicity.concerts.filter(c=>!c.completed&&c.startDay>state.day).sort((a,b)=>a.startDay-b.startDay)[0];if(next)state.publicity.concerts=state.publicity.concerts.filter(c=>c.id!==next.id);
      mod('BadMoodAndyDrugs',-.1,10,members.filter(id=>id!=='RMCAndy'));
      for(const musicianId of ['RMCSonny','RMCEddie','RMCManny','RMCSonny'])state.bandmates.modifiers.push({id:'MadWAndy',musicianId,stat:'mood',otherId:'RMCAndy',amount:-.1,startDay:state.day,duration:10});
    }else if(id==='ecocmis5artistod')state.bandmates.modifiers.push({id:'ArtisOdFeelBad',musicianId:'RMCAndy',stat:'health',amount:-.05,startDay:state.day,duration:10});
  }
  return state;
}

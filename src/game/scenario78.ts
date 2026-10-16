import type {GameState,Musician} from './model';
import type {ScenarioEvent,ScenarioState} from './scenario-types';
import {bandmateOccupied,bandmateStats} from './bandmates';
import {reporterBandLike} from './publicity';
import {missionCards} from './mission-catalog';

export function missionSpend<T extends GameState>(state:T,account:'media'|'gangsta'|'gifts',amount:number):T {
  if(state.missionId!=='Mission08'||!state.scenario||amount<=0)return state;
  const key='spent:'+account;
  return {...state,scenario:{...state.scenario,vars:{...state.scenario.vars,[key]:Number(state.scenario.vars[key]??0)+amount}}};
}
export const initialScenario78=():ScenarioState=>({version:1,vars:{roycnt:0,orgmemberCnt:0},active:{},queue:[],seen:[],appointments:[],approved:false,outcome:null});
export function initializeScenario78(state:GameState):GameState {
  const s={...state,scenario:initialScenario78(),publicity:structuredClone(state.publicity)};
  if(state.missionId==='Mission07')for(const r of s.publicity.reporters){
    if(['Media01','Media02','Media03','Media04'].includes(r.mediaId))r.avoid=99;
    if(r.mediaId==='Media03')r.mood-=.5;
  }
  return s;
}
/** Original DataDBRest07/08 timers and DataDBEC07/08 button actions. */
export function updateScenario78(input:GameState,event:ScenarioEvent,musicians:Musician[]):GameState {
  if(!input.scenario||input.scenario.outcome)return input;
  const state=structuredClone(input),s=state.scenario!,v=s.vars,a=s.active,n=state.missionId==='Mission07'?7:8;
  const full=(suffix:string)=>'ECOCMis'+n+suffix;
  const queue=(suffix:string,speakerId?:string)=>{const id=missionCards.find(c=>c.ID.toLowerCase()===full(suffix).toLowerCase())?.ID;if(id&&!s.queue.some(c=>c.id===id)&&!s.seen.includes(id))s.queue.push({id,...(speakerId?{speakerId}:{})});};
  const chance=(p:number)=>{state.publicity.seed=(Math.imul(state.publicity.seed,1664525)+1013904223)>>>0;return state.publicity.seed/4294967296*100<p;};
  const band=()=>state.band.flatMap(m=>m?[m.musicianId]:[]);
  const randomMember=()=>{const b=band();return b[Math.floor(state.publicity.seed%Math.max(1,b.length))];};
  // FunctionsForParser.getIsWholeBandFreeWhen checks calendar Band resources;
  // this differs from a musician's getIsOccupied/away status on a gig day.
  const free=()=>band().every(id=>!bandmateOccupied(state,id))&&!state.publicity.concerts.some(c=>!c.completed&&c.startDay<=state.day&&state.day<c.startDay+c.duration)&&!s.appointments.some(p=>!p.completed&&!p.actorId&&p.startDay<=state.day&&state.day<p.startDay+p.duration);
  const performance=()=>{const influence:Record<string,number>={Vocals:1,Guitar:.75,Keyboards:.6,Drums:.25,Bass:.5};let total=0,weight=0;for(const b of state.band){if(!b)continue;const m=bandmateStats(state,b.musicianId),w=influence[b.instrument];total+=w*(.5*m.musicality+.4*m.charisma+.6*m.mood)/1.5;weight+=w;}return Math.max(0,Math.min(1,(total/Math.max(weight,.001)-.2)/.55));};
  const timer=(key:string,days:number,run:()=>void)=>{if(a[key]!==undefined&&state.day>=a[key]+days){delete a[key];run();}};
  const leaving=(event.kind==='fire'||event.kind==='action'&&event.actionId==='QuitBand')&&event.actorId;
  if(n===7){
    if(event.kind==='recording'&&!v.recorded){v.recorded=true;a.tragic=state.day;a.orphanage=state.day;}
    if(state.album&&state.day>=state.album.releaseDay&&a.release===undefined&&!v.released){v.released=true;a.release=state.day;a.cityDis=state.day;}
    if(leaving){
      // Retain the source '=+ 1' assignment; do not silently change it to +=.
      if(['RMCRoy','RMCLina','RMCMartin','RMCMary'].includes(String(leaving)))v.orgmemberCnt=1;
      if(v.orgmemberCnt===2)queue('FailLeaveBand',String(leaving));
      else if(leaving!=='RMCLina'){v.Quitter=String(leaving);queue('LeaveBandLucy',String(leaving));}
    }
    if(event.kind==='concert'){
      const stage=Number(v.royStage??0),probability=stage===0?70:50+10*Number(v.roycnt??0);
      if(stage<6&&stage!==4&&chance(probability)){
        const card=['SpeakerFall',chance(50)?'ArtistFall':'BreakFoot','IndecentExposure','ArtistLost','NudeChock'][stage===5?4:stage];
        if(card)queue(card,'RMCRoy');v.roycnt=0;
        if(stage===3){a.lost=state.day;v.royStage=4;if(event.placeId)v.RoyDisappearPlaceID=event.placeId;}else v.royStage=stage===5?6:stage+1;
      }else v.roycnt=Number(v.roycnt??0)+1;
    }
    if(event.kind==='day'||event.kind==='city'){
      for(const p of s.appointments)if(state.day>=p.startDay+p.duration)p.completed=true;
      if(free()){
        timer('tragic',2,()=>queue('TragicEvent','RMCLina'));
        timer('orphanage',70,()=>queue('LabelOrphanage','RMCLina'));
        timer('orphangig',2,()=>queue(performance()>=.5?'LabelOrphanageGood':'LabelOrphanageBad','RMCLina'));
        timer('cityDis',5,()=>{queue('CityDis',randomMember());a.cityDis2=state.day;});
        timer('cityDis2',7,()=>{queue('CityDis2',randomMember());a.cityDis3=state.day;});
        timer('cityDis3',5,()=>{queue('CityDis3',randomMember());a.upset=state.day;});
        timer('upset',2,()=>{queue('MusicianUpset','RMCMartin');a.lucyDis=state.day;});
        timer('lucyDis',2,()=>{queue('LucyDisCity','RMCLina');a.fm=state.day;});
        timer('fm',2,()=>{queue('FMRevenge','RepFM');v.cityNewsClosed=true;});
        timer('fmGood',7,()=>{queue('FMRevengeGood',randomMember());a.zeroGood=state.day;});
        timer('fmBad',5,()=>{queue('FMRevengeBad','RMCLina');a.zeroBad=state.day;});
        timer('zeroGood',5,()=>{queue('ZeroGoodReview',randomMember());a.succeed=state.day;});
        timer('zeroBad',5,()=>{queue('ZeroBadReview',randomMember());a.badMedia=state.day;});
        timer('badMedia',5,()=>queue('BadMedia',randomMember()));
      }
      timer('release',50,()=>{queue('Nomination',randomMember());a.award=state.day;});
      timer('award',5,()=>{queue(chance(50)?'Award':'NoAward',randomMember());queue('AwardScandal','RMCRoy');});
      if(a.lost!==undefined&&state.day>=a.lost+2&&state.band.some(m=>m?.musicianId==='RMCLina')&&!bandmateOccupied(state,'RMCLina'))queue('ArtistLostLucy','RMCLina');
      timer('lost',3,()=>{queue('ArtistBack','RMCRoy');v.royStage=5;});
      if(a.succeed!==undefined&&state.day>a.succeed&&state.publicity.totalSales>=100000)s.outcome='won';
    }
  }else{
    const signed=state.contract?.labelId==='Record03';
    if((event.kind==='city'||event.kind==='day')&&state.contract&&!v.contractSeen){
      if(!signed)queue('WrongContract','HmRecord04');
      else{v.contractSeen=true;v.check=1;v.numberOfBoughtSongs=state.ownedSongs.length;queue('GlobalHint01','HmRecord04');}
    }
    if(v.contractSeen&&!state.contract)queue('LostContract01','HmRecord04');
    if(leaving&&v.contractSeen){queue(!band().length?'LostContract01':v.lostbandmember?'BandShattered02':'BandShattered01','HmRecord02');}
    if(event.kind==='recording'&&v.contractSeen){v.numberOfRecordedSongs=Number(v.numberOfRecordedSongs??0)+1;if(Number(v.numberOfRecordedSongs)>2)queue('TooManyRecordings01');}
    if(event.kind==='city'||event.kind==='day'){
      if(!state.contract&&state.day>20)queue('NoContract01','HmRecord04');
      if(!state.contract&&state.day>30&&s.seen.includes(full('NoContract01')))queue('NoContract02','HmRecord04');
      if(v.contractSeen){
        const sales=state.publicity.totalSales+Number(state.publicity.earlierAlbumSales??0),media=Number(v['spent:media']??0),gangsta=Number(v['spent:gangsta']??0),gifts=Number(v['spent:gifts']??0);
        if(sales>2000)queue('TooManySold01');if(sales>3000)queue('TooManySold02');
        if(Number(v.check)<=2){
          if(media>55000)queue('RainbowCheckFailed01','HmRecord02');else if(gangsta>20000)queue('RainbowCheckFailed02','HmRecord02');else if(gifts>15000)queue('RainbowCheckFailed03','HmRecord02');
          else if(state.money<5000)queue(Number(v.check)===1?(state.album&&state.day>=state.album.releaseDay?'RainbowCheckSucceeded01':'RainbowcheckFailed04'):'RainbowCheckSucceeded02','HmRecord02');
        }else if(state.money<5000)queue('RainbowCheck03','HmRecord02');
        if(state.money>=5000){if(media>30000)queue('TooExpensiveAd01','HmRecord02');if(gangsta>15000)queue('TooExpensiveGangsta01','HmRecord02');if(gifts>10000)queue('TooExpensiveBandgift01','HmRecord02');}
        if(state.ownedSongs.length>Number(v.numberOfBoughtSongs)+2)queue('TooManyBoughtSongs01');
      }
      if(a.youSuck!==undefined&&state.day>a.youSuck+5){const id=band().sort((x,y)=>bandmateStats(state,x).mood-bandmateStats(state,y).mood)[0];if(id&&!bandmateOccupied(state,id)){v.YouSuckMusician=id;queue('YouSuck01',id);delete a.youSuck;}}
      if(a.youSuck2!==undefined&&state.day>a.youSuck2+6){const id=String(v.YouSuckMusician);if(band().includes(id)&&!bandmateOccupied(state,id))queue('YouSuck02',id);delete a.youSuck2;}
    }
  }
  if(event.kind==='card'){
    const pending=s.queue.find(c=>c.id.toLowerCase()===event.cardId?.toLowerCase());if(!pending)return input;
    const card=missionCards.find(c=>c.ID===pending.id)!;
    const command=String((card as unknown as Record<string,{ExecuteThis?:string}>)[event.choice??'ButtonOK']?.ExecuteThis??'');
    s.queue=s.queue.filter(c=>c!==pending);if(!s.seen.includes(card.ID))s.seen.push(card.ID);
    const suffix=card.ID.replace(/^ECOCMis[78]/i,''),ok=event.choice==='ButtonOK';
    if(/CMission\.failed/i.test(command))s.outcome='lost';if(/CMission\.succeeded/i.test(command))s.outcome='won';
    for(const match of command.matchAll(/transactMoney\(\s*(-?\d+)/gi))state.money+=Number(match[1]);
    for(const m of command.matchAll(/expose\(0,\s*([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)\)/gi))state.publicity.exposures.push({id:'Mis'+n+state.publicity.nextId++,startDay:state.day+1,intensity:Number(m[1]),duration:Number(m[3]),reach:Object.fromEntries(state.publicity.groups.map(g=>[g.id,1])),quality:Object.fromEntries(state.publicity.groups.map(g=>[g.id,Number(m[2])])),albumKey:state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null});
    for(const m of command.matchAll(/createModifier\(#(\w+),\s*#(\w+),\s*(#Mood|a),\s*([\d.-]+),\s*(\d+)/gi)){
      const ids=m[2].toLowerCase()==='bandmembers'?band():musicians.filter(p=>p.id.toLowerCase()===m[2].toLowerCase()).map(p=>p.id);
      for(const musicianId of ids)state.bandmates.modifiers.push({id:m[1],musicianId,stat:'mood',amount:Number(m[4]),duration:Number(m[5]),startDay:state.day,...(m[3]==='a'?{otherId:'RMCLina'}:{})});
    }
    if(n===7){
      if(suffix==='LabelOrphanage'&&ok)a.orphangig=state.day;
      if(suffix==='FMRevenge'){
        a[ok&&reporterBandLike(state,'Media02')>=.3?'fmGood':'fmBad']=state.day;
      }
      if(['ArtistFall','BreakFoot','ArtistLost'].includes(suffix))s.appointments.push({id:'Roy'+state.day,kind:'hospital',actorId:'RMCRoy',startDay:state.day,duration:suffix==='ArtistLost'?4:5,completed:false});
    }else{
      if(['BandShattered01','TooMAnySold01'].includes(suffix))v.lostbandmember=1;
      if(suffix==='RainbowCheckSucceeded01'){v.check=2;a.youSuck=state.day;}
      if(suffix==='RainbowCheckSucceeded02')v.check=3;
      if(suffix==='YouSuck01')a.youSuck2=state.day;
      if(suffix==='YouSuck02'&&!ok)queue('YouSuck03',String(v.YouSuckMusician));
    }
  }
  return state;
}

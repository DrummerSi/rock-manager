import type {GameState,Musician} from './model';
import type {ScenarioEvent,ScenarioState} from './scenario-types';
import {bandmateOccupied,bandmateStats} from './bandmates';
import {PUBLICITY_RULES} from './publicity';

type ScenarioGame=GameState&{scenario?:ScenarioState};
const NADIA='RMCPernille';
export function initialScenario04(state:GameState):ScenarioState {
  return {version:1,vars:{HypeCnt:0,noHypeCnt:0,inactiveCnt:0,happycnt:0,MoneyCheck:1,rng:state.publicity.seed,lastDay:state.day},
    active:Object.fromEntries(['SergeiLow','SergeiHigh','SergeiGoodConcert','Rockets01','Media01RqNadia01','GoodGig','MoneyBag','KissMedia04','KissMediaNo','MusicianScared00','MusicianTooHappy','IntroduceVideo','IntroduceActionTraining'].map(id=>[id,state.day])),
    queue:[],seen:[],appointments:[],approved:false,outcome:null};
}
/** Source Hype is population-weighted audience attitude, not chart position. */
function hype(state:GameState){const total=PUBLICITY_RULES.groups.reduce((n,g)=>n+g.size,0);return state.album?Math.max(0,PUBLICITY_RULES.groups.reduce((n,g)=>n+g.size*(state.publicity.groups.find(v=>v.id===g.id)?.albumHype??0),0)/total):0;}
export function updateScenario04(input:GameState,event:ScenarioEvent,musicians:Musician[]):GameState {
  const state={...input,bandmates:structuredClone(input.bandmates),scenario:structuredClone((input as ScenarioGame).scenario??initialScenario04(input))} as ScenarioGame&{scenario:ScenarioState};
  const s=state.scenario,v=s.vars,a=s.active;
  if(s.outcome)return input;
  const number=(key:string)=>Number(v[key]??0),active=(id:string)=>Object.hasOwn(a,id);
  const queue=(id:string,speakerId?:string)=>{if(!s.queue.some(c=>c.id===id))s.queue.push({id,...(speakerId?{speakerId}:{})});};
  const once=(trigger:string,card:string,speakerId?:string)=>{if(active(trigger)){queue(card,speakerId);delete a[trigger];}};
  const chance=(percent:number)=>{let n=(number('rng')>>>0)||1;n^=n<<13;n^=n>>>17;n^=n<<5;v.rng=n>>>0;return (n>>>0)/4294967296<percent/100;};
  const occupied=()=>bandmateOccupied(state,NADIA)||s.appointments.some(e=>!e.completed&&e.actorId===NADIA&&e.startDay<=state.day&&state.day<e.startDay+e.duration);
  const mood=()=>state.bandmates.people.some(p=>p.musicianId===NADIA)?bandmateStats(state,NADIA).mood:.5;
  const mod=(id:string,amount:number,actor=NADIA,duration=10)=>state.bandmates.modifiers.push({id,musicianId:actor,stat:'mood',amount,startDay:state.day,duration});
  const fail=(reason:string)=>{s.outcome='lost';s.failureReason=reason;};
  const randomOther=()=>{const members=state.band.filter(m=>m&&m.musicianId!==NADIA);if(!members.length)return undefined;chance(0);return members[number('rng')%members.length]?.musicianId;};
  if(event.kind==='card'&&event.cardId){
    const id=event.cardId,choice=event.choice??'ButtonOK';
    // Only an actual pending card can execute its original button action.
    if(!s.queue.some(c=>c.id===id))return input;
    s.queue=s.queue.filter(c=>c.id!==id);s.seen.push(id);
    if(choice==='ButtonOK'){
      if(id==='ECOCMis4Complete')s.outcome='won';
      const reasons:Record<string,string>={ECOCMis4NadiaQuitBand:'NadiaQuit',ECOCMis4NoMoney:'NoMoney',ECOCMis4GameOver:'GameOver',ECOCMis4GameOverFireNadia:'FireNadia',ECOCMis4NoNadiaCover:'',ECOCMis4Media01IgnoredGameOver:''};
      if(Object.hasOwn(reasons,id))fail(reasons[id]);
      if(id==='ECOCMis4Media01RqNadia'){
        s.appointments.push({id:'DivEventWin',kind:'television',startDay:state.day+2,duration:1,actorId:NADIA,placeId:'Media01',completed:false});
        a.Media01RqNadia02=state.day;a.Media01RqNadia03=state.day;
      }
      if(id==='ECOCMis4MoneyBag')state.money+=15000;
      if(id==='ECOCMis4StealSongRoyaltyYes'){state.money+=15000;for(const m of state.band)if(m)mod('Allpleased',.1,m.musicianId);}
      if(id==='ECOCMis4JudgeRocketGood'){state.money+=30000;for(const m of state.band)if(m)mod('AllpleasedRockets',.15,m.musicianId);}
      if(id==='ECOCMis4BadConcert')mod('Concert',-.1);
      if(id==='ECOCMis4Passive'||id==='ECOCMis4MoneyLow')mod('NoCash',-.05);
      if(id==='ECOCMis4BadMedia')mod('BadMedia',-.05);
      if(id==='ECOCMis4EnvyGift')mod('EnvyGift',-.025);
      if(id==='ECOCMis4EnvyHoliday')mod('EnvyHoliday',-.05);
      if(id==='ECOCMis4KissMedia04')mod('NadiaInLuv',.15);
      if(id==='ECOCMis4KissMediaNo')mod('NadiaNoLuv',-.15);
      if(id==='ECOCMis4MusicianScared'||id==='ECOCMis4NadiaFight')mod('Scaredshitless',-.1,String(v.ScaredNewMusician));
      if(id==='ECOCMis4MusicianTooHappy')mod('MadWithNadia',-.1,String(v.HappyGuy));
    }
    if(id==='ECOCMis4Media01RqNadia'&&choice==='ButtonCancel')queue('ECOCMis4Media01IgnoredGameOver');
    if(id==='ECMMis4StealSong'){
      if(choice==='ButtonOK')a.Rockets02=state.day;
      if(choice==='ButtonCancel')a.Rockets03=state.day;
      if(choice==='Button3'){
        for(const m of state.band)if(m)mod('Allmad',-.1,m.musicianId);
        // Original Never Mind: expose(0,.3,-.3,1). The parser's first
        // argument is InfluenceWhat, and exposure always begins tomorrow.
        state.publicity=structuredClone(state.publicity);
        state.publicity.exposures.push({id:`Mission04Exposure${state.publicity.nextId++}`,startDay:state.day+1,duration:1,intensity:.3,
          reach:Object.fromEntries(state.publicity.groups.map(g=>[g.id,1])),quality:Object.fromEntries(state.publicity.groups.map(g=>[g.id,-.3])),
          albumKey:state.demo?`${state.demo.songId}:${state.demo.recordedDay}`:null});
      }
    }
    if(id==='ECOCMis4StealSongRoyaltyNo'&&choice==='ButtonOK'||id==='ECOCMis4StealSongRoyaltyYes'&&choice==='ButtonCancel')a.Rockets03=state.day;
  }
  if(event.kind==='fire'&&event.actorId===NADIA)queue('ECOCMis4GameOverFireNadia','HmGangsta01');
  if(event.kind==='action'&&event.placeId==='Gangsta01'&&active('MusicianScared00')){delete a.MusicianScared00;a.MusicianScared01=state.day;}
  if(event.kind==='action'&&event.actionId==='QuitBand'&&event.actorId===NADIA)queue('ECOCMis4NadiaQuitBand','HmGangsta01');
  if(event.kind==='gift'||event.kind==='training'){
    const prefix=event.kind==='gift'?'Gift':'holiday',trigger=event.kind==='gift'?'EnvyGift02':'EnvyHoliday02';
    if(event.actorId===NADIA){v[prefix+'Date']=state.day;delete a[trigger];}
    else if(!occupied()&&number(prefix+'Date')<=state.day-3)a[trigger]=state.day;
  }
  if(event.kind==='place'&&event.placeId==='Design01'){
    if(state.bandmates.modifiers.some(m=>m.id==='SleeveAngry'&&m.musicianId===NADIA))queue('ECOCMis4NoNadiaCover',NADIA);
    if(state.album&&state.album.releaseDay>0&&state.contract)once('IntroduceVideo','ECOCMis4IntroduceVideo');
  }
  if(event.kind==='concert'){
    const result=state.publicity.concertResults.find(c=>c.id===event.concertId||c.concertId===event.concertId);
    if(result&&!result.cancelled){const rating=result.satisfaction*5;
      if(rating<=1)queue('ECOCMis4BadConcert',NADIA);
      if(active('SergeiGoodConcert')&&state.day>=a.SergeiGoodConcert+15&&rating>=4&&chance(30))queue('ECOCMis4GoodConcert',NADIA);
      if(rating>=3)once('GoodGig','ECOCMis4GoodGig',NADIA);
    }
  }
  if(event.kind==='day'&&state.day>number('lastDay')){
    v.lastDay=state.day;
    if(mood()<=.3)once('SergeiLow','ECOCMis4MoodLow','HmGangsta01');
    if(mood()>=.7)once('SergeiHigh','ECOCMis4MoodHigh','HmGangsta01');
    if(state.album){
      v.noHypeCnt=hype(state)<=.05?number('noHypeCnt')+1:0;
      if(number('noHypeCnt')>=14){if(chance(50))queue('ECOCMis4BadMedia',NADIA);v.noHypeCnt=0;}
      v.HypeCnt=hype(state)>=.07?number('HypeCnt')+1:0;
      if(number('HypeCnt')>=14){if(chance(30))queue('ECOCMis4GoodMedia',NADIA);v.HypeCnt=0;}
    }
    if(number('MoneyCheck')===1&&state.money<10000){v.MoneyCheck=0;queue('ECOCMis4MoneyLow',NADIA);}
    // Preserve the original (counterintuitive) comparison: a booking ten or more
    // days away resets inactivity; no bookings also resets it.
    v.inactiveCnt=number('inactiveCnt')+1;
    const upcoming=[...state.publicity.concerts.filter(e=>!e.completed),...s.appointments.filter(e=>!e.completed&&e.kind!=='television')].filter(e=>e.startDay>=state.day);
    if(!upcoming.length||upcoming.some(e=>e.startDay-state.day>=10))v.inactiveCnt=0;
    else if(number('inactiveCnt')>=10)queue('ECOCMis4Passive',NADIA);
    if(active('Media01RqNadia01')&&hype(state)>=.15){delete a.Media01RqNadia01;a.Media01RqNadia01b=state.day;}
    if(active('Media01RqNadia01b')&&state.day>a.Media01RqNadia01b+6&&!occupied())once('Media01RqNadia01b','ECOCMis4Media01RqNadia',NADIA);
    if(state.publicity.chart>0)once('Rockets01','ECMMis4StealSong');
    if(active('Rockets02')&&state.day===a.Rockets02+2){queue(chance(hype(state)>=.1?75:40)?'ECOCMis4StealSongRoyaltyYes':'ECOCMis4StealSongRoyaltyNo',NADIA);delete a.Rockets02;}
    if(active('Rockets03')&&state.day===a.Rockets03+7){queue(number('LegalSafe')===1||chance(50)?'ECOCMis4JudgeRocketGood':'ECOCMis4JudgeRocketBad',NADIA);delete a.Rockets03;}
    if(active('IntroduceActionTraining')&&state.day===a.IntroduceActionTraining+1)once('IntroduceActionTraining','ECOCMis4IntroduceActionTraining');
    if(active('EnvyGift02')&&state.day===a.EnvyGift02+2)once('EnvyGift02','ECOCMis4EnvyGift',NADIA);
    if(active('EnvyHoliday02')&&state.day===a.EnvyHoliday02+5)once('EnvyHoliday02','ECOCMis4EnvyHoliday',NADIA);
    if(active('KissMedia04')&&state.day>=a.KissMedia04+40&&!occupied()) {if(hype(state)<=.1)queue('ECOCMis4KissMedia04',NADIA);delete a.KissMedia04;}
    if(active('KissMediaNo')&&!occupied()){if(hype(state)>=.1)queue('ECOCMis4KissMediaNo',NADIA);delete a.KissMediaNo;}
    if(active('MoneyBag')&&state.day<=a.MoneyBag+15){if(!occupied()&&state.money<=5000)once('MoneyBag','ECOCMis4MoneyBag',NADIA);else if(occupied())delete a.MoneyBag;}
    if(active('MusicianScared01')&&state.day>=a.MusicianScared01+3){const id=randomOther();if(id){v.ScaredNewMusician=id;once('MusicianScared01','ECOCMis4MusicianScared',id);a.MusicianScared02=state.day;}}
    if(active('MusicianScared02')&&state.day===a.MusicianScared02+2&&state.band.some(m=>m?.musicianId===v.ScaredNewMusician)){once('MusicianScared02','ECOCMis4NadiaFight',NADIA);a.MusicianScared03=state.day;}
    if(active('MusicianScared03')&&state.day===a.MusicianScared03+5){const id=String(v.ScaredNewMusician);if(state.bandmates.people.some(p=>p.musicianId===id)){once('MusicianScared03','ECOCMis4MusicianDisappear',id);state.band=state.band.map(m=>m?.musicianId===id?null:m);state.bandmates.people.find(p=>p.musicianId===id)!.fired=true;v['dead:'+id]=true;}}
    if(active('MusicianTooHappy')&&state.day>=a.MusicianTooHappy+10&&!occupied()){
      const happiest=state.band.filter(m=>m&&state.bandmates.people.some(p=>p.musicianId===m.musicianId)).map(m=>({id:m!.musicianId,mood:bandmateStats(state,m!.musicianId).mood})).sort((x,y)=>y.mood-x.mood)[0];
      if(happiest&&happiest.id!==NADIA){if(happiest.mood>=.6){v.HappyGuy=happiest.id;queue('ECOCMis4MusicianTooHappy',happiest.id);v.happycnt=number('happycnt')+1;a.MusicianTooHappy=state.day;}else if(number('happycnt')>=1)delete a.MusicianTooHappy;}
    }
    for(const appointment of s.appointments)if(!appointment.completed&&state.day>appointment.startDay){appointment.completed=true;queue('ECOCMis4Complete','HmGangsta01');delete a.Media01RqNadia02;delete a.Media01RqNadia03;}
  }
  return state;
}

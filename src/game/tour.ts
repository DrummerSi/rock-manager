import type {GameState,Musician} from './model';
import {bandmateOccupied,effectiveMusicians} from './bandmates';
import {performTourConcert,type ConcertResult} from './publicity';
import rules from './tour-rules.json' with {type:'json'};
export const TOUR_RULES=rules;
export interface BandTour {
  cities:string[];stage:string[];expenseId:string;startDay:number;duration:number;cost:number;
  members:string[];results:ConcertResult[];completed:boolean;cancelled:boolean;seen:boolean;
  seenResults?:number;
  returnDay?:number;
}
export const tourAvailable=(s:GameState)=>s.missionId==='Mission10'||s.missionId==='Mission09'&&Boolean(s.album)||s.missionId==='Mission05'&&Boolean(s.scenario?.vars.tourUnlocked);
export const tourOccupied=(s:GameState,id:string,day=s.day)=>Boolean(s.tour&&!s.tour.completed&&s.tour.startDay<=day&&day<(s.tour.returnDay??s.tour.startDay+s.tour.duration)&&s.tour.members.includes(id));
const city=(id:string)=>rules.cities.find(c=>c.ID===id)!;
/** DlgTour.calcTimeAndCost uses spherical distance, rounded to500, plus4000. */
export function tourFlight(from:string,to:string):{cost:number;days:number}{
  const a=JSON.parse(city(from).Coordinates) as number[],b=JSON.parse(city(to).Coordinates) as number[];
  const angle=Math.acos(Math.max(-1,Math.min(1,Math.sin(a[1])*Math.sin(b[1])+Math.cos(a[1])*Math.cos(b[1])*Math.cos(a[0]-b[0]))));
  return {cost:4000+Math.trunc(.5*angle*40000/(2*Math.PI)/500)*500,days:1};
}
export function tourQuote(cities:string[],stage:string[],expenseId:string){
  let previous='TCRockCity',travel=0;
  const stops=cities.map(id=>{const flight=tourFlight(previous,id);previous=id;const cost=flight.cost+Number(city(id).PreferredPriceModel.BasePrice);travel+=cost;return{id,cost,travelCost:flight.cost};});
  const home=tourFlight(previous,'TCRockCity').cost;travel+=home;
  const stageCost=stage.reduce((sum,id)=>sum+Number(rules.elements.find(e=>e.ID===id)?.price??0),0);
  const expense=Number(rules.expenses.find(e=>e.ID===expenseId)?.price??0);
  return {stops,home,travel,stageCost,expense,cost:travel+stageCost+expense,duration:cities.length*2+1};
}
export function canBookTour(s:GameState,cities:string[],stage:string[],expenseId:string,startDay:number):boolean {
  if(!tourAvailable(s)||!cities.length||cities.length>8||new Set(cities).size!==cities.length||cities.some(id=>id==='TCRockCity'||!rules.cities.some(c=>c.ID===id&&c.Available==='1')))return false;
  if(stage.length!==rules.categories.length||stage.some((id,i)=>!rules.categories[i].elements.includes(id))||!rules.expenses.some(e=>e.ID===expenseId))return false;
  if(s.tour&&!s.tour.completed||!s.band.some(Boolean)||!Number.isInteger(startDay)||startDay<=s.day||startDay>s.day+100)return false;
  const quote=tourQuote(cities,stage,expenseId);if(s.money<quote.cost)return false;
  for(let day=startDay;day<startDay+quote.duration;day++)if(s.album?.releaseDay===day||s.publicity.concerts.some(c=>!c.completed&&c.startDay<=day&&day<c.startDay+c.duration)||s.band.some(m=>m&&bandmateOccupied(s,m.musicianId,day)))return false;
  return true;
}
export function bookTour(s:GameState,cities:string[],stage:string[],expenseId:string,startDay:number):GameState{
  if(!canBookTour(s,cities,stage,expenseId,startDay))throw new Error('Choose an affordable tour with a stage, expenses and free dates for the whole band.');
  const quote=tourQuote(cities,stage,expenseId);
  return {...s,money:s.money-quote.cost,tour:{cities:[...cities],stage:[...stage],expenseId,startDay,duration:quote.duration,cost:quote.cost,members:s.band.flatMap(m=>m?[m.musicianId]:[]),results:[],completed:false,cancelled:false,seen:false}};
}
export function advanceTour(input:GameState,musicians:Musician[]):GameState {
  const t=input.tour;if(!t||t.completed||input.day<t.startDay)return input;
  const s=structuredClone(input),tour=s.tour!;
  const elapsed=s.day-tour.startDay;
  const stageQuality=tour.stage.reduce((sum,id)=>sum+Number(rules.elements.find(e=>e.ID===id)?.quality??0),0);
  for(let i=tour.results.length;!tour.cancelled&&i<tour.cities.length&&elapsed>=(i+1)*2;i++){
    const result=performTourConcert(s,effectiveMusicians(s,musicians),city(tour.cities[i]),stageQuality);tour.results.push(result);s.money+=result.income;
  }
  if(s.day>=(tour.returnDay??tour.startDay+tour.duration)){tour.completed=true;s.bandmates.modifiers=s.bandmates.modifiers.filter(m=>m.id!=='Travel');}
  else{
    const luxury=Number(rules.expenses.find(e=>e.ID===tour.expenseId)!.LuxuryFactor),amount=-.1*(1-luxury)-.02*(Math.floor(elapsed/2)+1);
    s.bandmates.modifiers=s.bandmates.modifiers.filter(m=>m.id!=='Travel');
    for(const id of tour.members)s.bandmates.modifiers.push({id:'Travel',musicianId:id,stat:'mood',amount,startDay:s.day,duration:1});
    // DlgTourOngoing postpones mission triggers while the band is abroad.
    if(s.scenario)for(const id of Object.keys(s.scenario.active))s.scenario.active[id]++;
  }
  if(s.scenario)s.scenario.vars.tourDays=Number(s.scenario.vars.tourDays??0)+1;
  return s;
}
export function cancelTour(s:GameState):GameState {
  if(!s.tour||s.tour.completed)return s;
  return {...s,tour:{...s.tour,cancelled:true,returnDay:s.day+1,seen:false}};
}
export function validTour(s:GameState):boolean {
  const t=s.tour;if(t===undefined||t===null)return true;
  return Array.isArray(t.cities)&&t.cities.length>0&&t.cities.length<=8&&t.cities.every(id=>rules.cities.some(c=>c.ID===id))&&Array.isArray(t.stage)&&t.stage.length===4&&t.stage.every((id,i)=>rules.categories[i].elements.includes(id))&&rules.expenses.some(e=>e.ID===t.expenseId)
    &&Number.isSafeInteger(t.startDay)&&t.startDay>=0&&t.duration===t.cities.length*2+1&&Number.isFinite(t.cost)&&t.cost>=0&&Array.isArray(t.members)&&t.members.every(id=>typeof id==='string')&&Array.isArray(t.results)&&t.results.length<=t.cities.length&&t.results.every(r=>Number.isFinite(r.income)&&Number.isFinite(r.audience)&&Number.isFinite(r.satisfaction))&&typeof t.completed==='boolean'&&typeof t.cancelled==='boolean'&&typeof t.seen==='boolean'
    &&(t.seenResults===undefined||Number.isSafeInteger(t.seenResults)&&t.seenResults>=0&&t.seenResults<=t.results.length)
    &&(t.returnDay===undefined||t.cancelled&&Number.isSafeInteger(t.returnDay)&&t.returnDay>=0&&t.returnDay<=t.startDay+t.duration);
}

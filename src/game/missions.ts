import {newGame,type GameState,type Musician,type Instrument} from './model';
import {defaultBandmates} from './bandmates';
import {missionDefinition,missionSnapshots,type MissionId} from './mission-catalog';
import {initializeMissionEvents} from './mission-events';

/** Original RockScript loads Mxx.dat, then resets cash to Mission.StartMoney. */
export function newMission(id:MissionId,musicians:Musician[],date=new Date()):GameState{
  const definition=missionDefinition(id);
  let state=newGame(definition.startMoney,date,id);
  state.bandmates=defaultBandmates(state,musicians);
  if(id==='Mission01')return state;
  const snapshot=(missionSnapshots as Record<string,unknown>)[id] as any,classes=snapshot?.Classes??{};
  state.bandName=classes.Band?.Band?.name??classes.Band?.Band?.ancestor?.name??state.bandName;
  state.bandNameChanged=Boolean(classes.Band?.Band?.name??classes.Band?.Band?.ancestor?.name);
  state.ownedSongs=[...(classes.player?.player?.OwnedSongs??[])];
  state.selectedSong=state.ownedSongs[0]??null;
  for(const[actorId,value]of Object.entries(classes.RealMusician??{})){
    const actor=value as any;
    if(actor.InBand)state.band[Number(actor.spatialPos)-1]={musicianId:actorId,instrument:actor.NowPlaying as Instrument};
    const person=state.bandmates.people.find(p=>p.musicianId===actorId)!;
    person.mood=Number(actor.Mood?.Current??person.mood);person.health=Number(actor.Health?.Current??person.health);
    person.musicality=Number(actor.ancestor?.ancestor?.Musicality?.Current??person.musicality);
    person.charisma=Number(actor.ancestor?.Charisma??person.charisma);person.patience=Number(actor.ancestor?.ancestor?.Patience?.Current??person.patience);
    const needs=actor.save?.Needs??actor.Needs?.save??{};
    for(const key of Object.keys(person.needs))if(needs[key]?.Current!==undefined)person.needs[key]=Number(needs[key].Current);
  }
  if(id==='Mission03'||id==='Mission09'){
    const player=classes.player.player,price=player.CPContractPriceModel;
    state.contract={labelId:player.CPContractor,songId:state.selectedSong!,advance:Number(classes.Record.Record04.Advance??0),royalty:Number(price.Royalty),albums:1,signedDay:0,prearranged:true,approved:false};
  }
  state=initializeMissionEvents(state);
  for(const[actorId,value]of Object.entries(classes.RealMusician??{}))if((value as any).WantedSalary!==undefined)state.scenario!.vars['salary:'+actorId]=Number((value as any).WantedSalary);
  return state;
}

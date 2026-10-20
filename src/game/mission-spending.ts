import type {GameState} from './model';

export function missionSpend<T extends GameState>(state:T,account:'media'|'gangsta'|'gifts',amount:number):T {
  if(state.missionId!=='Mission08'||!state.scenario||amount<=0)return state;
  const key='spent:'+account;
  return {...state,scenario:{...state.scenario,vars:{...state.scenario.vars,[key]:Number(state.scenario.vars[key]??0)+amount}}};
}

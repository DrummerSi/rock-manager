import type {GameState} from './model';
export function initializeMission10Events(state:GameState):GameState {return {...state,scenario:{version:1,vars:{},active:{},queue:[],seen:[],appointments:[],approved:false,outcome:null}};}
/** Original TRMis10Succeeded: one year of free play. */
export function updateMission10Events(state:GameState):GameState {return state.day>=365&&state.scenario?{...state,scenario:{...state.scenario,outcome:'won'}}:state;}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/generated/game-data.json';
import {newMission} from '../src/game/missions';
import {CAREER_KEY,loadCareer,saveCareer,recordCareer,careerAvailability,careerTotal,type Career} from '../src/game/career';
import {defaultMissionProgress} from '../src/game/mission-progress';
test('fresh campaign offers First Steps; implementing missions does not unlock them',()=>{
  const s=newMission('Mission01',data.allMusicians),career=recordCareer({version:1,missions:{}},s);
  assert.deepEqual([...careerAvailability(career,s.missionId)],['Mission01']);
});
test('War on Rainbow stays locked until Space Cadets is completed',()=>{
  const s=newMission('Mission07',data.allMusicians);let c=recordCareer({version:1,missions:{}},s);
  assert.equal(careerAvailability(c,s.missionId).has('Mission08'),false);
  s.missionProgress={...defaultMissionProgress('Mission07'),status:'lost',failureReason:'Scenario',endedDay:0};
  c=recordCareer(c,s);assert.equal(careerAvailability(c,s.missionId).has('Mission08'),false);
  s.missionProgress={...defaultMissionProgress('Mission07'),status:'won',pendingWinDay:0,endedDay:0};
  c=recordCareer(c,s);assert.equal(careerAvailability(c,s.missionId).has('Mission08'),true);
});
test('points are per mission; totals exclude Mission09, and replay does not accumulate duplicate scores',()=>{
  let c:Career={version:1,missions:{Mission01:{completed:true,points:120000},Mission03:{completed:true,points:306000},Mission09:{completed:true,points:999000}}};
  assert.equal(careerTotal(c),426000);
  const s=newMission('Mission03',data.allMusicians);c=recordCareer(c,s);
  assert.equal(c.missions.Mission03.points,306000);assert.equal(c.missions.Mission01.points,120000);
  s.missionProgress={...defaultMissionProgress('Mission03'),status:'lost',failureReason:'Scenario',endedDay:0};
  c=recordCareer(c,s);assert.equal(c.missions.Mission03.points,0);assert.equal(c.missions.Mission03.completed,true);
  assert.equal(careerTotal(c),120000);
});
test('career history survives replacing the active mission; legacy migration invents no earlier scores',()=>{
  const previous=globalThis.localStorage,cache=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>cache.get(k)??null,setItem:(k:string,v:string)=>cache.set(k,v)}});
  try{
    const legacy=loadCareer(newMission('Mission07',data.allMusicians));
    assert.equal(legacy.missions.Mission06.points,undefined);assert.equal(legacy.missions.Mission06.completed,false);
    assert.equal(careerAvailability(legacy,'Mission07').has('Mission08'),false);
    legacy.missions.Mission06={completed:true,points:426000};saveCareer(legacy);assert.ok(cache.has(CAREER_KEY));
    const loaded=loadCareer(newMission('Mission01',data.allMusicians));
    assert.deepEqual(loaded.missions.Mission06,{completed:true,points:426000});
    assert.equal(loaded.missions.Mission01.points,undefined);
  }finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:previous});}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/generated/game-data.json';
import {newGame,recruit,licenseSong} from '../src/game/model';
import {startRecording,finishRecording,evaluateDemo,demoRefusalVoice,type Label} from '../src/game/recording';

function fixture(){
 let state=newGame(100000,new Date(2001,2,13));
 state=recruit(state,data.musicians,0,'RMCJerka','Guitar');
 state=licenseSong(state,data.songs,'Sng01');
 state=finishRecording(startRecording(state,data.tutorialGameplay,'Studio01','Sng01'),data.tutorialGameplay,data.musicians,data.songs);
 const label=structuredClone(data.tutorialGameplay.labels[0]) as Label;
 label.targets=[{...label.targets[0],minimumQuality:0,songType:0,songTypeTolerance:2,
  tolerance:{Metal:2,rock:2,Punk:2,Pop:2,Dance:2,Boring:2}}];
 return {state,label};
}
test('quality refusal uses original quality feedback and stable native voice metadata',()=>{
 const {state,label}=fixture();label.targets[0].minimumQuality=1;
 const result=evaluateDemo(state,label,data.musicians);
 assert.equal(result.accepted,false);assert.equal(result.reasonKind,'quality');assert.deepEqual(result.reasonPath,['quality']);
 assert.match(result.reason,/recording (sounds horrible|stinks)/);assert.ok(result.reason.includes(label.name));
 assert.equal(demoRefusalVoice('Record03',result.reasonKind),'r03cb0300x');
});
test('song refusal retains direction and selects source SongType cue independently of text',()=>{
 const {state,label}=fixture();label.targets[0].songType=1;label.targets[0].songTypeTolerance=.1;
 const result=evaluateDemo({...state,demo:{...state.demo!,songType:0}},label,data.musicians);
 assert.equal(result.accepted,false);assert.equal(result.reasonKind,'SongType');assert.deepEqual(result.reasonPath,['SongType','Lo']);
 assert.match(result.reason,/song is too alternative/);assert.equal(demoRefusalVoice(label.id,result.reasonKind),'r01cb0500x');
});
test('style refusal retains native style direction; accepted demos have no rejection prose',()=>{
 const {state,label}=fixture();
 const accepted=evaluateDemo(state,label,data.musicians);assert.equal(accepted.accepted,true);assert.equal(accepted.reason,'');
 label.targets[0].style.rock=0;label.targets[0].tolerance.rock=.1;
 const rejected=evaluateDemo(state,label,data.musicians);assert.equal(rejected.accepted,false);assert.equal(rejected.reasonKind,'StyleMix');
 assert.deepEqual(rejected.reasonPath,['StyleMix','rock','Hi']);assert.match(rejected.reason,/rockish/);
 assert.equal(demoRefusalVoice(label.id,rejected.reasonKind),'r01cb0600x');
 assert.equal(demoRefusalVoice('Record01','StyleMixTotal'),'r01cb0200z');
 assert.equal(demoRefusalVoice('Record01','quality',true),'r01cb0800x');
});

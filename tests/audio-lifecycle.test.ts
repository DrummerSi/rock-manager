import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FeedbackAudio} from '../src/game/feedback-audio';
import {RecordingAudio} from '../src/game/recording-audio';
import {defaultEffects, type MixChannel} from '../src/game/recording';
import {audioData, retainAudioData} from '../src/game/audio-data';

class Node {
 gain={value:1,setTargetAtTime(value:number){this.value=value}};
 pan={value:0};delayTime={value:0};frequency={value:0};playbackRate={value:1};
 loop=false;loopEnd=0;loopStart=0;buffer:unknown;type='';fftSize=4;onended?:()=>void;starts=0;stops=0;
 connect<T>(node:T):T{return node;}disconnect(){}start(){this.starts++;}stop(){this.stops++;this.onended?.();}
 getFloatTimeDomainData(samples:Float32Array){samples.fill(0.1);}
}
class Context {
 static instances:Context[]=[];
 currentTime=0;state='running';destination=new Node();sources:Node[]=[];gains:Node[]=[];
 constructor(){Context.instances.push(this);}
 resume(){return Promise.resolve();}close(){return Promise.resolve();}
 decodeAudioData(){return Promise.resolve({duration:2,length:2,numberOfChannels:1,sampleRate:1,getChannelData:()=>new Float32Array([.1,.2]),copyFromChannel(){},copyToChannel(){}} as AudioBuffer);}
 createGain(){const n=new Node();this.gains.push(n);return n;}
 createBufferSource(){const n=new Node();this.sources.push(n);return n;}
 createAnalyser(){return new Node();}createStereoPanner(){return new Node();}createDelay(){return new Node();}createOscillator(){return new Node();}createBiquadFilter(){return new Node();}
}
const response=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}) as Response;
const channel:MixChannel={musicianId:'RMCJerka',instrument:'Guitar',loopId:'test',volume:70,pan:0,muted:false,effects:defaultEffects()};

test('preloaded audio survives decoder buffer detachment and needs no network for a second decoder',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw new Error('Network must not be used after preload');};
  retainAudioData('test/preloaded.mp3',new Uint8Array([1,2,3]).buffer);
  const first=await audioData('test/preloaded.mp3');
  structuredClone(first,{transfer:[first]});assert.equal(first.byteLength,0);
  assert.deepEqual([...new Uint8Array(await audioData('test/preloaded.mp3'))],[1,2,3]);
 }finally{globalThis.fetch=previous;}
});
function environment(){const oldContext=globalThis.AudioContext,oldFetch=globalThis.fetch;globalThis.AudioContext=Context as unknown as typeof AudioContext;Context.instances=[];return()=>{globalThis.AudioContext=oldContext;globalThis.fetch=oldFetch;};}

test('replacing/stopping voice does not cancel an independently loading event effect; mute preserves active playback',async()=>{
 const restore=environment();try{
  let resolveEffect!:(r:Response)=>void;
  globalThis.fetch=async(input)=>String(input).includes('_EventCard')?await new Promise<Response>(resolve=>{resolveEffect=resolve;}):response();
  const audio=new FeedbackAudio(),effect=audio.play('_EventCard',true);
  await audio.play('Tick');audio.stop();resolveEffect(response());await effect;
  const context=Context.instances[0];assert.equal(context.sources.length,2);assert.equal(context.sources[1].starts,1);
  await audio.play('Tick');const voice=context.sources.at(-1)!;audio.setMuted(true);assert.equal(voice.stops,0);assert.equal(audio.playback.playing,true);audio.setMuted(false);assert.equal(voice.stops,0);
  audio.destroy();assert.ok(voice.stops>0);
 }finally{restore();}
});
test('place ambience survives speech replacement and stops only at explicit place release',async()=>{
 const restore=environment();try{
  globalThis.fetch=async()=>response();const audio=new FeedbackAudio();await audio.playPlace('Live01');
  const place=Context.instances[0].sources[0];await audio.play('Tick');audio.stop();assert.equal(place.stops,0);assert.equal(audio.diagnostics.place,'Live01');
  await audio.playPlace('Live01');assert.equal(Context.instances[0].sources.length,2,'Same place does not restart on redraw');
  audio.stopPlace();assert.equal(place.stops,1);audio.destroy();
 }finally{restore();}
});
test('superseded music load failure cannot reject into a caller and stop a newer successful mix',async()=>{
 const restore=environment();try{
  let rejectOld!:(reason:Error)=>void;
  globalThis.fetch=async(input)=>String(input).includes('old.ogg')?await new Promise<Response>((_,reject)=>{rejectOld=reject;}):response();
  const context=new Context(),audio=new RecordingAudio(context as unknown as AudioContext);
  const old=audio.play([channel],['old.ogg']);await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(await audio.play([channel],['new.ogg']),true);rejectOld(new Error('Old request failed'));
  assert.equal(await old,false);assert.equal(audio.playing,true);assert.equal(context.sources.at(-1)!.stops,0);
  audio.setMuted(true);assert.equal(audio.playing,true);audio.setMuted(false);audio.destroy();
 }finally{restore();}
});
test('registered original narration/previews use their exact prepared file and source gain; repaint does not replay place audio',async()=>{
 const restore=environment();try{
  const requests:string[]=[];globalThis.fetch=async input=>{requests.push(String(input));return response();};
  const audio=new FeedbackAudio();audio.registerSources([{key:'Sng01Preview',path:'media/source-window-audio/Sng01Preview.wav'},{key:'Studio01',path:'media/source-window-audio/Studio01.mp3'}]);
  await audio.play('sng01preview',false,.6);
  assert.equal(requests[0],'/assets/feedback/Sng01Preview.wav');assert.equal(audio.playback.key,'Sng01Preview');
  const context=Context.instances[0];assert.equal(context.gains.at(-1)!.gain.value,.6);
  await audio.playPlace('Studio01');await audio.playPlace('Studio01');assert.equal(context.sources.length,2);
  assert.equal(context.gains.at(-1)!.gain.value,.85);audio.destroy();
 }finally{restore();}
});

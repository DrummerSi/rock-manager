import {RecordingAudio} from './recording-audio';
import type {MixChannel} from './recording';

/** Browser equivalent of MixerExit.createMixDown/FileCopy. Uses the same
 * reconstructed WebAudio effects as playback, not the original Xtra DSP. */
export async function renderMixWav(channels:MixChannel[],files:(string|null)[],bpm:number,bars:number,beatsPerBar:number,sourceEnds:(number|null)[],master:number):Promise<Blob>{
  const sampleRate=44100,duration=bars*beatsPerBar*60/bpm,lead=Math.round(.05*sampleRate),frames=Math.ceil(duration*sampleRate);
  const context=new OfflineAudioContext(2,frames+lead,sampleRate),audio=new RecordingAudio(context);
  try{
    await audio.play(channels,files,bpm,{bars,beatsPerBar,sourceEnds});audio.update(channels,master);
    const rendered=await context.startRendering(),bytes=new ArrayBuffer(44+frames*4),view=new DataView(bytes);
    const ascii=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
    ascii(0,'RIFF');view.setUint32(4,36+frames*4,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,frames*4,true);
    const left=rendered.getChannelData(0),right=rendered.getChannelData(1);
    for(let i=0;i<frames;i++)for(let channel=0;channel<2;channel++){const sample=Math.max(-1,Math.min(1,(channel?right:left)[i+lead]??0));view.setInt16(44+i*4+channel*2,Math.round(sample*(sample<0?32768:32767)),true);}
    return new Blob([bytes],{type:'audio/wav'});
  }finally{audio.stop();}
}

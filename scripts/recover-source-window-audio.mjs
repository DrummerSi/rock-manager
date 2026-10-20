import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root='analysis/original',installed='E:/Games/Rock Manager';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// In this environment the sandbox's optical-drive view is incomplete. Fail
// before overwriting retained evidence unless the actual host CD is readable.
if(!fs.existsSync('V:/Sound/Intro01_01.swa'))throw new Error('Original CD audio is not readable in this execution. Run with authorized host CD reads; retained evidence was not changed.');
const cdInfo=fs.readFileSync('V:/RockCD.INF');
if(!/Language=English/i.test(cdInfo.toString()))throw new Error('Expected original English CD');
const metadata=JSON.parse(fs.readFileSync(`${root}/scripts/cd/Mission.dxr/metadata.json`));
const source=`${installed}/Mission.dxr`,bytes=fs.readFileSync(source);
if(sha(bytes)!==metadata.sha256)throw new Error('Installed Mission.dxr differs from retained original metadata');
const map=metadata.chunks.find(c=>c.fourCC==='mmap').data.mapArray;
const entry=map.find(c=>c.fourCC==='VWSC'),score=bytes.subarray(entry.offset+8,entry.offset+8+entry.len);
const listStart=score.readUInt32BE(8),indexStart=listStart+12,base=indexStart+score.readUInt32BE(listStart+4)*4;
const detail=id=>score.subarray(base+score.readUInt32BE(indexStart+id*4),base+score.readUInt32BE(indexStart+(id+1)*4));
const state=Buffer.alloc(50000),frames=[];let at=base+20;
for(let frame=1;frame<=8;frame++){
 const start=at,end=start+score.readUInt16BE(at);at+=2;
 while(at<end){const length=score.readUInt16BE(at),offset=score.readUInt16BE(at+2);at+=4;score.copy(state,offset,at,at+length);at+=length;}
 const sprites=[];
 for(let channel=1;channel<=150;channel++){
  const offset=288+(channel-1)*48,raw=state.subarray(offset,offset+48);
  if(!raw[0]||!raw.readUInt16BE(6))continue;
  const info=raw.readUInt32BE(8),behavior=info?detail(info+1):Buffer.alloc(0);
  const behaviors=[];
  for(let p=0;p+8<=behavior.length;p+=8){const initializer=behavior.readUInt32BE(p+4);behaviors.push({castLib:behavior.readUInt16BE(p),member:behavior.readUInt16BE(p+2),initializer,parameters:initializer?detail(initializer).toString('latin1').replaceAll('\0',''):''});}
  sprites.push({channel,castLib:raw.readUInt16BE(4),member:raw.readUInt16BE(6),registrationLoc:[raw.readInt16BE(14),raw.readInt16BE(12)],height:raw.readInt16BE(16),width:raw.readInt16BE(18),ink:raw[1]&63,behaviors,rawRecordHex:raw.toString('hex')});
 }
 frames.push({frame,scorePayloadRange:[start,end],sound1Cast:[state.readUInt16BE(192),state.readUInt16BE(194)],sound2Cast:[state.readUInt16BE(144),state.readUInt16BE(146)],sprites});
}
const first=frames[1].sprites.find(s=>s.channel===17),narrator=first.behaviors.find(b=>b.member===23);
if(!narrator?.parameters.includes('Intro01_01'))throw new Error('Mission01 narration initializer changed');
const expected=[{key:'Intro01_01',kind:'mission01Narration',filename:'Intro01_01.swa',relative:'Sound/Intro01_01.swa',volumeSetting:'Speak',rule:'Mission01 starts at frame2; SoundFX behavior sprite17 begins narration from sound root and waits for completion; no Face speaker required.'},
 ...['Sng01','Sng02','Sng10','Sng11','Sng17'].map(id=>({key:id+'Preview',kind:'publisherPreview',songId:id,filename:id.slice(-2)+'pre.wav',relative:'Sound/Music/'+id.slice(-2)+'pre.wav',volumeSetting:'PreviewMusicVol60',rule:'DlgPublishScript.playSong uses last2digits of SongID + pre.wav; CD music path is Sound/Music. Replace on song selection, stop on publisher close.'})),
 {key:'Snare',kind:'pressReviewEffect',filename:'Snare.swa',relative:'Sound/Snare.swa',volumeSetting:'FXVol70',rule:'DataDBEC00 review cards ECOCMedia03Review0..5 and04Review0..5 ExecuteThis playsound(snare.swa); independent effect, not speech.'},
 {key:'A131',kind:'missionFailureEffect',filename:'A131.swa',relative:'Sound/A131.swa',volumeSetting:'FXVol70',rule:'DlgMissionOutroScript starts a131 at failure, kills owned sound on ending close.'},
 ...[1,2,3,4].map(n=>({key:'Studio0'+n,kind:'placeAmbience',filename:'Studio0'+n+'.swa',relative:'Sound/Studio0'+n+'.swa',volumeSetting:'PlaceVol85',rule:'DlgRockAncestor starts PlaceID sound on first focus. Default non-looping; stop at focus loss/close.'})),
 {key:'StudioNoise',kind:'studioNoiseUnwired',filename:'StudioNoise.wav',relative:'Sound/StudioNoise.wav',volumeSetting:'unresolved',rule:'MixerScript declares/kills m_noiseSndObj but recovered active script does not instantiate it. Retain source; do not invent playback mapping.'}];
function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
const installedAudio=walk(installed).filter(p=>/\.(wav|swa|mp3|ogg|cue)$/i.test(p));
const retainedAudio=[...walk(`${root}/media`),...walk('public/assets/music'),...walk('public/assets/feedback')].filter(p=>/\.(wav|swa|mp3|ogg)$/i.test(p));
const recovered=[];
function formatInfo(input){
 if(input.toString('ascii',0,4)==='RIFF'){
  const fmt=input.indexOf(Buffer.from('fmt ')),data=input.indexOf(Buffer.from('data'));
  if(fmt<0||data<0)throw new Error('Incomplete original WAVE');
  const formatTag=input.readUInt16LE(fmt+8),byteRate=input.readUInt32LE(fmt+16);
  return {container:'RIFF/WAVE',formatTag,codec:formatTag===1?'PCM':formatTag===85?'MPEG LayerIII':'other',sampleRate:input.readUInt32LE(fmt+12),channels:input.readUInt16LE(fmt+10),bitsPerSample:input.readUInt16LE(fmt+22),durationSeconds:input.readUInt32LE(data+4)/byteRate};
 }
 let position=0,samples=0,frames=0,sampleRate=0;const rates=[44100,48000,32000],bitrates=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
 while(position+4<=input.length){const h=input.readUInt32BE(position);if((h>>>21)!==2047||((h>>>19)&3)!==3||((h>>>17)&3)!==1){position++;continue;}const rate=rates[(h>>>10)&3],bitrate=bitrates[(h>>>12)&15];if(!rate||!bitrate){position++;continue;}const length=Math.floor(144000*bitrate/rate)+((h>>>9)&1);if(position+length>input.length)break;frames++;samples+=1152;sampleRate=rate;position+=length;}
 if(!frames)throw new Error('Missing valid MPEG1 LayerIII frames');return {container:'raw MPEG audio',codec:'MPEG1 LayerIII',sampleRate,frames,durationSeconds:samples/sampleRate};
}
for(const item of expected){
 const paths=[`${installed}/${item.relative}`,`V:/${item.relative}`,...retainedAudio.filter(p=>p.split('/').at(-1).toLowerCase()===item.filename.toLowerCase())];
 const found=paths.find(p=>fs.existsSync(p));item.candidates=paths;item.available=Boolean(found);
 if(!found)continue;
 const input=fs.readFileSync(found),extension=input.toString('ascii',0,4)==='RIFF'?'wav':item.filename.endsWith('.swa')?'mp3':item.filename.split('.').at(-1);
 const path=`media/source-window-audio/${item.key}.${extension}`;fs.mkdirSync(`${root}/media/source-window-audio`,{recursive:true});fs.writeFileSync(`${root}/${path}`,input);
 const decode=spawnSync('C:/Program Files/ImageMagick-7.1.1-Q16-HDRI/ffmpeg.exe',['-hide_banner','-v','error','-i',`${root}/${path}`,'-f','null','-'],{encoding:'utf8',timeout:30000});
 if(decode.status!==0)throw new Error(`Original audio decode failed ${item.key}: ${decode.stderr}`);
 recovered.push({key:item.key,path,source:found,sha256:sha(input),bytes:input.length,format:formatInfo(input),decodeVerification:{decoder:'ffmpeg',status:decode.status,stderr:decode.stderr},rule:'Exact bytes copied; SWA receives MP3 extension only.'});
}
const result={schemaVersion:1,source,sourceSHA256:sha(bytes),cdSettings:{source:'V:/RockCD.INF',sha256:sha(cdInfo),language:'English'},scorePayloadSHA256:sha(score),scoreChunkRange:[entry.offset,entry.offset+entry.len+8],mission01:{labelFrame:2,nextMissionLabelFrame:9,narration:narrator,frames},expected,recovered,installedAudioFileCount:installedAudio.length,installedAudioFiles:installedAudio,
 sources:['scripts/cd/Mission.dxr/00021-SoundFX.lingo','scripts/cd/Mission.dxr/00001-Dir.lingo','scripts/cd/Main.dxr/00029-DlgPublishScript.lingo','scripts/cd/Main.dxr/00039-DlgMissionOutroScript.lingo'],limitations:['Installed game contains no external audio; mounted CD reads require host execution in this environment. Original source bytes recovered without editing CD or running game. Decoder validation uses ffmpeg; browser AudioContext decoding remains an integration check. No prepare-assets executed.'],narrationVolume:{literalSetting:'Speak',fallbackPercent:100,reason:'SoundFX requests #Speak, while UsefulScript defaults define #SpeakVol70. DirSoundHandler.getVolSetting returns100 for missing symbols; do not silently claim MissionIntroVol70 is used here.'}};
fs.writeFileSync(`${root}/source-window-audio-evidence.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({narration:narrator.parameters,installedAudioFiles:installedAudio.length,expected:expected.map(e=>({key:e.key,available:e.available})),recovered:recovered.length}));

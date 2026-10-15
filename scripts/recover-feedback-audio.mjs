import fs from 'node:fs';
import crypto from 'node:crypto';

const root='analysis/original', destination=`${root}/media/feedback-audio`;
fs.mkdirSync(destination,{recursive:true});
const sha=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');
const cdInfo=fs.readFileSync('V:/RockCD.INF');
if(!/Language=English/i.test(cdInfo.toString()))throw new Error('Expected original English disc');
const recovered=[],semanticCues={},lipSync=[];
function mp3Info(bytes){
  let offset=0,totalSamples=0,frames=0,rate=0,channels=0,firstBitrate=0;
  const rates=[44100,48000,32000],bitrates=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
  while(offset+4<=bytes.length){
    const header=bytes.readUInt32BE(offset);
    if((header>>>21)!==0x7ff || ((header>>>19)&3)!==3 || ((header>>>17)&3)!==1){offset++;continue;}
    const bitrate=bitrates[(header>>>12)&15],sampleRate=rates[(header>>>10)&3];
    if(!bitrate||!sampleRate){offset++;continue;}
    const length=Math.floor(144000*bitrate/sampleRate)+((header>>>9)&1);
    if(offset+length>bytes.length)break;
    if(!frames){rate=sampleRate;channels=((header>>>6)&3)===3?1:2;firstBitrate=bitrate;}
    frames++;totalSamples+=1152;offset+=length;
  }
  if(!frames)throw new Error('No complete MPEG1LayerIII frames');
  return {container:'raw MPEG audio',codec:'MPEG-1 Layer III',sampleRate:rate,channels,firstBitrateKbps:firstBitrate,frames,durationSeconds:totalSamples/rate};
}
function recover(source,key){
  const bytes=fs.readFileSync(source);let format,extension;
  if(bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WAVE'){
    extension='wav';const fmt=bytes.indexOf(Buffer.from('fmt ')),data=bytes.indexOf(Buffer.from('data'));
    const sampleRate=bytes.readUInt32LE(fmt+12),byteRate=bytes.readUInt32LE(fmt+16);
    format={container:'RIFF/WAVE',codec:bytes.readUInt16LE(fmt+8)===1?'PCM':'unknown',channels:bytes.readUInt16LE(fmt+10),sampleRate,bitsPerSample:bytes.readUInt16LE(fmt+22),durationSeconds:bytes.readUInt32LE(data+4)/byteRate};
  }else {extension='mp3';format=mp3Info(bytes);}
  const path=`media/feedback-audio/${key}.${extension}`;
  fs.writeFileSync(`${root}/${path}`,bytes);
  recovered.push({key,path,source,sourceSHA256:sha(bytes),outputSHA256:sha(bytes),bytes:bytes.length,format,rule:'Exact original bytes retained; SWA contains raw MP3 and receives browser-playable .mp3 extension, PCM RIFF retains .wav.'});
  return key;
}
const musicians=JSON.parse(fs.readFileSync(`${root}/data/mission01-recovered.json`)).availableMusicians;
const musicianPrefixes=musicians.map(m=>`a${m.Gfx.slice(-2)}`);
const voices=fs.readdirSync('V:/Sound/Voice/Swa').filter(name=>/^(m0[2-5](?:m[ab]|new)|r0[1-4]c[abc])\d+\.swa$/i.test(name)||musicianPrefixes.some(prefix=>new RegExp(`^${prefix}[re].*\\.swa$`,'i').test(name)));
for(const name of voices)recover(`V:/Sound/Voice/Swa/${name}`,name.replace(/\.swa$/i,''));
const keys=new Set(recovered.map(r=>r.key.toLowerCase()));
const list=(pattern)=>recovered.filter(r=>pattern.test(r.key)).map(r=>r.key);
for(let n=2;n<=5;n++){
  const id=`Media0${n}`,prefix=`m0${n}m`;
  semanticCues[id]={
    greeting:{normal:list(new RegExp(`^${prefix}a0100[1-3]$`)),Satisfied:list(new RegExp(`^${prefix}a0200[1-3]$`)),Happy:list(new RegExp(`^${prefix}a0200[1-3]$`)),Angry:list(new RegExp(`^${prefix}a0300[1-3]$`)),Annoyed:list(new RegExp(`^${prefix}a0300[1-3]$`)),Furious:list(new RegExp(`^${prefix}a0300[1-3]$`))},
    gift:{BribeLo:list(new RegExp(`^${prefix}b0600[1-5]$`)),BribeHi:list(new RegExp(`^${prefix}b0700[1-5]$`)),otherwise:list(new RegExp(`^${prefix}b0400[1-5]$`))},
    pressKit:list(new RegExp(`^${prefix}b0400[1-5]$`)),
    action:{Happy:list(new RegExp(`^${prefix}b0100[1-3]$`)),Angry:list(new RegExp(`^${prefix}b0200[1-3]$`))},
    rule:'ClassHuman prefix first place char plus final2digits; getSpeechFile media adds m plus a(greeting)/b(action); normal01 happy/satisfied02 angry/annoyed/furious03, random1..3. Explicit gift and presskit speak suffixZ resolves random1..5.'
  };
}
for(let n=1;n<=4;n++){
  const id=`Record0${n}`,prefix=`r0${n}c`;
  const speech=(infix)=>list(new RegExp(`^${prefix}${infix}00[1-3]$`));
  semanticCues[id]={greeting:{normal:speech('a01'),Happy:speech('a02'),Angry:speech('a03')},contractGreeting:{Happy:speech('a04'),Angry:speech('a05'),Concert:speech('a06')},contract:{Happy:speech('b01'),Angry:speech('b02')},nextContract:{Happy:speech('b07'),Angry:speech('b08')},action:{Happy:speech('c01'),Angry:speech('c02')}};
}
for(const musician of musicians){
  const prefix=`a${musician.Gfx.slice(-2)}r`,speech=(suffix)=>list(new RegExp(`^${prefix}${suffix}00[1-3]$`));
  const actorId=musician.Gfx.toLowerCase();
  semanticCues[musician.ID]={actorId,musicianId:musician.ID,prefix,greeting:{normal:speech('a01'),Happy:speech('a01'),Angry:speech('a01')},confirmation:speech('a02'),action:{Happy:speech('c01'),Angry:speech('c02')},status:{Happy:speech('b01'),Satisfied:speech('b01'),normal:speech('b01'),Annoyed:speech('b02'),Angry:speech('b02'),Furious:speech('b02'),Ill:speech('b03'),VeryIll:speech('b04'),Quarrel:speech('b05'),NeedMoney:speech('b06'),NeedParty:speech('b07'),NeedLive:speech('b08'),NeedExpo:speech('b09'),NeedVacation:speech('b10')}};
}
const crowd=[];
for(const name of fs.readdirSync('V:/Sound').filter(name=>/^A(?:Live06-)?[1-3][1-3]1\.swa$/i.test(name))){
  const key=name.replace(/\.swa$/i,'');recover(`V:/Sound/${name}`,key);
  const numbers=/([1-3])([1-3])1$/.exec(key);crowd.push({key,venue:/Live06/i.test(key)?'Live06':null,satisfactionBand:Number(numbers[1]),audienceBand:Number(numbers[2])});
}
for(const name of ['Tick.wav','_EventCard.wav','Live01.swa','Live02.swa','Live03.swa','Live04.swa','Live05.swa','Live06.swa'])recover(`V:/Sound/${name}`,name.replace(/\.(wav|swa)$/i,''));
for(const name of fs.readdirSync('V:/Sound/Voice').filter(name=>/^_[mr]0[1-5]All\.cue$/i.test(name)||musicianPrefixes.some(prefix=>name.toLowerCase()===`_${prefix.slice(0,3)}all.cue`))){
  const source=`V:/Sound/Voice/${name}`,bytes=fs.readFileSync(source);
  const entries=Object.fromEntries(bytes.toString('latin1').split(/\r?\n/).map(line=>/^([\w]+):\s*(\[[\d, ]*\])/.exec(line)).filter(Boolean).filter(m=>keys.has(m[1].toLowerCase())).map(m=>[m[1],JSON.parse(m[2])]));
  if(Object.keys(entries).length)lipSync.push({source,sourceSHA256:sha(bytes),entries});
}
const sources=[
 'analysis/original/scripts/installed/RockUtil.cxt/00096-unnamed.lingo',
 'analysis/original/scripts/installed/RockGeneral.cxt/00126-FunctionsForParserScript.lingo',
 'analysis/original/scripts/cd/Main.dxr/00019-DlgConcertResultScript.lingo',
 'analysis/original/scripts/installed/RockUtil.cxt/00079-DateDisplayScript.lingo',
 'analysis/original/scripts/installed/RockUtil.cxt/00084-DlgEventCardAncestorScript.lingo',
 'analysis/original/scripts/installed/RockUtil.cxt/00048-DlgRockAncestorScript.lingo',
 'analysis/original/scripts/installed/RockUtil.cxt/00015-UsefulScript.lingo',
].map(path=>({path,sha256:sha(fs.readFileSync(path))}));
fs.writeFileSync(`${root}/feedback-audio-evidence.json`,JSON.stringify({schemaVersion:1,language:{name:'English',source:'V:/RockCD.INF',sourceSHA256:sha(cdInfo)},recovered,semanticCues,crowd,lipSync,sources,
 crowdRule:{satisfactionThresholds:[0.25,0.75,10],audienceFractionThresholds:[0.25,0.75,10],filename:'A'+ '<venue>-<satisfactionBand><audienceBand>1.swa, fallback A<bands>1.swa',sourceHandler:'DlgConcertResultScript.generateComment',note:'Original uses comesBeforeValInList; preserve its threshold comparator from VeryGeneral before deciding exact boundary equality.'},
 ui:{dateTick:'Tick',eventCard:'_EventCard',genericClick:null,error:null,note:'DateDisplayScript explicitly plays Tick.wav at date update; DlgEventCardAncestor plays _EventCard at open. No generic button-click/error audio reference established in the inspected DialogButtonScript and category paths; do not invent mappings.'},
 volumeDefaults:{speech:70,effects:70,placeAmbience:85,dateTick:25,cityAmbience:35},publisher:{greeting:null,note:'getSpeechFile has no Publish branch; DlgPublishScript inspected has music preview but no character greeting. No publisher voice mapped.'},
 observations:['SWA headers are MPEG1 LayerIII audio, not a proprietary sound container. Browser MP3 extension changes no bytes. Files provide5 variants while getSpeechFile greetings choose1..3. Action suffixZ requests1..5.','Audio language follows original CD Settings Language=English; no transcript/semantic listening attribution claimed.']},null,2));
console.log(`Recovered ${recovered.length} original audio files and ${lipSync.length} cue sheets.`);

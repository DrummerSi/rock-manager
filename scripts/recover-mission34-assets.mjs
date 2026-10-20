import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {indexedCast,bitmap,digest,xmedStyle} from './director-cast.mjs';

const root='analysis/original',out=root+'/media/Mission34';
const priorEvidence=fs.existsSync(root+'/mission34-assets.json')?JSON.parse(fs.readFileSync(root+'/mission34-assets.json')):null;
const storyGraphics=[...new Set([...([3,4,5,6,7,8,9].flatMap(n=>JSON.parse(fs.readFileSync(`${root}/data/DataDBEC0${n}.json`)).data.EventCardOKCancel.Gfx).filter(name=>typeof name==='string'&&name&&!/[<>]/.test(name)&&!/^human$/i.test(name))),'ECcourt01'])];
// EventCard LargePic/SmallPic #Pic uses default Copy ink. Only text
// explicitly uses ink36; white artwork must remain visible.
const storyInk=name=>storyGraphics.some(g=>g.toLowerCase()===name.toLowerCase())?0:36;
if(process.argv.includes('--story-only')){
  if(!priorEvidence)throw new Error('Existing mission asset evidence required');
  const casts=[indexedCast(root+'/rockmaterial-current-index.json'),indexedCast(root+'/scripts/cd/Mission.dxr/metadata.json','E:/Games/Rock Manager/Mission.dxr')];
  let count=0;
  for(const entry of priorEvidence.recovered){
    if(storyInk(entry.name)!==0)continue;
    const cast=casts.find(c=>c.source===entry.source);if(!cast)throw new Error('Unknown story cast '+entry.source);
    const member=cast.members.find(m=>m.id===entry.memberId);if(!member)throw new Error('Missing story member '+entry.name);
    const {bytes,...metadata}=bitmap(cast,member,0);fs.writeFileSync(root+'/'+entry.path,bytes);Object.assign(entry,metadata);count++;
  }
  priorEvidence.rules.storyPictures='DlgEventCardLargePicData/SmallPicData #Pic uses Copy ink (default0); preserve whites and enabled native alpha. Text uses ink36 explicitly.';
  fs.writeFileSync(root+'/mission34-assets.json',JSON.stringify(priorEvidence,null,2)+'\n');
  console.log(JSON.stringify({storyPictures:count}));process.exit(0);
}
const cast=indexedCast(root+'/scripts/cd/Mission.dxr/metadata.json','E:/Games/Rock Manager/Mission.dxr');
const map=cast.metadata.chunks.find(c=>c.fourCC==='mmap').data.mapArray;
const scoreEntry=map.find(c=>c.fourCC==='VWSC'),score=cast.chunk(map.indexOf(scoreEntry));
const list=score.readUInt32BE(8),index=list+12,base=index+score.readUInt32BE(list+4)*4;
const detail=id=>score.subarray(base+score.readUInt32BE(index+id*4),base+score.readUInt32BE(index+(id+1)*4));
const header=base+score.readUInt32BE(index),length=score.readUInt32BE(header),recordSize=score.readUInt16BE(header+14);
if(recordSize!==48)throw new Error('Unsupported score channel size');
const state=Buffer.alloc(288+score.readUInt16BE(header+16)*recordSize),frames=[];
let position=header+score.readUInt32BE(header+4);
while(position<header+length){
  const start=position,end=start+score.readUInt16BE(position);position+=2;
  while(position<end){const count=score.readUInt16BE(position),offset=score.readUInt16BE(position+2);position+=4;score.copy(state,offset,position,position+count);position+=count;}
  const sprites=[];
  for(let channel=1;channel<=150;channel++){
    const raw=state.subarray(288+(channel-1)*48,288+channel*48);if((!raw[0]||!raw.readUInt16BE(6))&&!raw.readUInt32BE(8))continue;
    const lib=raw.readUInt16BE(4),slot=raw.readUInt16BE(6),member=lib===1?cast.members.find(m=>m.id===cast.slots[slot-1]):null;
    const info=raw.readUInt32BE(8),beh=info?detail(info+1):Buffer.alloc(0),behaviors=[];
    for(let p=0;p+8<=beh.length;p+=8){const initializer=beh.readUInt32BE(p+4),behaviorLib=beh.readUInt16BE(p),behaviorSlot=beh.readUInt16BE(p+2);
      const behaviorMember=behaviorLib===1?cast.members.find(m=>m.id===cast.slots[behaviorSlot-1]):null;
      behaviors.push({castLib:behaviorLib,memberSlot:behaviorSlot,name:behaviorMember?.data.info?.name,initializer,parameters:initializer?detail(initializer).toString('latin1').replaceAll('\0',''):''});
    }
    sprites.push({channel,castLib:lib,memberSlot:slot,name:member?.data.info?.name,anchor:[raw.readInt16BE(14),raw.readInt16BE(12)],width:raw.readInt16BE(18),height:raw.readInt16BE(16),ink:raw[1]&63,behaviors,rawRecordHex:raw.toString('hex')});
  }
  frames.push({frame:frames.length+1,sprites});
}
fs.mkdirSync(out,{recursive:true});
const relevant=frames.filter(f=>f.sprites.some(s=>s.behaviors.some(b=>/Intro(?:0[3-9]|10)_/i.test(b.parameters))||/^mission(?:0[3-9]|10)_/.test(s.name??'')));
const internalSlots=new Set(relevant.flatMap(f=>f.sprites.filter(s=>s.castLib===1&&s.channel>10&&s.channel<120&&s.name!=='Dummy').map(s=>s.memberSlot)));
const recovered=[],scenarioFormatting=[];
for(const c of [cast,indexedCast(root+'/rockmaterial-current-index.json')]){
  for(const member of c.members){const name=member.data.info?.name??'';
    if(member.data.type===15&&/^EventCard(?:LargePic|SmallPic|NoPic)(?:Caption)?Formatting$/.test(name)){const style=xmedStyle(c,member);if(style)scenarioFormatting.push(style);}
    const castSlot=c.slots.indexOf(member.id)+1;
    if(member.data.type!==1||!(c===cast&&(internalSlots.has(castSlot)||/^ship01_/.test(name))||storyGraphics.some(g=>g.toLowerCase()===name.toLowerCase())||/^(mission(?:0[3-9]|10))(?:_|$)/i.test(name)||/^frame02 large environment/.test(name)))continue;
    const result=bitmap(c,member,storyInk(name));if(!result)continue;const{bytes,...entry}=result,path='media/Mission34/'+name.replaceAll(' ','_')+'__m'+member.id+'.png';
    fs.writeFileSync(root+'/'+path,bytes);recovered.push({name,castSlot,path,key:'mission34-'+name.toLowerCase().replaceAll(' ','_')+'-'+member.id,...entry});
  }
}
for(const frame of frames)for(const sprite of frame.sprites){const asset=recovered.find(a=>a.castSlot===sprite.memberSlot&&sprite.castLib===1&&a.source===cast.source);if(asset){sprite.key=asset.key;sprite.nativeRegistration=[asset.regX,asset.regY];sprite.nativeDimensions=[asset.width,asset.height];sprite.nativeSizeRect={x:sprite.anchor[0]-asset.regX,y:sprite.anchor[1]-asset.regY,width:asset.width,height:asset.height};if(sprite.width===asset.width&&sprite.height===asset.height)sprite.rect={...sprite.nativeSizeRect};else sprite.geometryLimitation='Score stage dimensions differ from native bitmap. Preserve anchor and dimensions; scaled registration rounding requires Director runtime confirmation.';}}
const audioNames=[...new Set(relevant.flatMap(f=>f.sprites.flatMap(s=>s.behaviors.flatMap(b=>b.parameters.match(/Intro(?:0[3-9]|10)_[a-z0-9]+/gi)??[]))))];
const scoreAudioNames=[...new Set(score.toString('latin1').match(/intro(?:0[3-9]|10)_[a-z0-9]+/gi)??[])];
const voiceDirectory='V:/Sound/Voice/Swa';
const cdAudioNames=fs.existsSync(voiceDirectory)?fs.readdirSync(voiceDirectory).filter(n=>/^intro(?:0[3-9]|10)_.*\.swa$/i.test(n)).map(n=>n.slice(0,-4)):(priorEvidence?.cdAudioNames??[]);
const seenParameters=new Set(),sequence=[];
for(const frame of relevant)for(const sprite of frame.sprites)for(const behavior of sprite.behaviors){
  if(!behavior.parameters||seenParameters.has(behavior.parameters))continue;seenParameters.add(behavior.parameters);
  if(!/Intro(?:0[3-9]|10)_/i.test(behavior.parameters))continue;
  sequence.push({frame:frame.frame,channel:sprite.channel,name:sprite.name,anchor:sprite.anchor,stageDimensions:[sprite.width,sprite.height],nativeDimensions:sprite.nativeDimensions,nativeRegistration:sprite.nativeRegistration,rect:sprite.rect,key:sprite.key,parameters:behavior.parameters});
}
const filmLoops=cast.members.filter(m=>m.data.type===2&&m.data.info?.name==='ship wateranim01').map(member=>{
  const key=cast.keys.find(k=>k.castID===member.id&&k.fourCC==='SCVW'),bytes=cast.chunk(key.sectionID),path='media/Mission34/ship_wateranim01.SCVW';fs.writeFileSync(root+'/'+path,bytes);
  return{name:member.data.info.name,memberId:member.id,castSlot:cast.slots.indexOf(member.id)+1,path,sha256:digest(bytes),chunkId:key.sectionID,source:cast.source,sourceSHA256:cast.sourceSHA256,limitation:'Original film-loop SCVW retained. Four ship01 bitmap frames recovered; internal loop timing/registration not decoded.'};
});
const audio=[];
function audioFormat(bytes){
  const rates=[44100,48000,32000],bitrates=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
  let offset=0,frames=0,sampleRate=0,channels=0;
  while(offset+4<=bytes.length){const h=bytes.readUInt32BE(offset);if((h>>>21)!==2047||((h>>>19)&3)!==3||((h>>>17)&3)!==1){offset++;continue;}
    const rate=rates[(h>>>10)&3],bitrate=bitrates[(h>>>12)&15];if(!rate||!bitrate){offset++;continue;}const size=Math.floor(144000*bitrate/rate)+((h>>>9)&1);if(offset+size>bytes.length)break;
    frames++;sampleRate=rate;channels=((h>>>6)&3)===3?1:2;offset+=size;
  }
  if(!frames)throw new Error('Unsupported original narration audio header');return{container:'raw MPEG audio',codec:'MPEG1 LayerIII',sampleRate,channels,frames,durationSeconds:frames*1152/sampleRate};
}
for(const name of [...new Set([...scoreAudioNames,...cdAudioNames])]){const source=['V:/Sound/'+name+'.swa',voiceDirectory+'/'+name+'.swa'].find(p=>fs.existsSync(p));if(!source)continue;
  const bytes=fs.readFileSync(source),path='media/Mission34/'+name+'.mp3';fs.writeFileSync(root+'/'+path,bytes);
  const decode=spawnSync('C:/Program Files/ImageMagick-7.1.1-Q16-HDRI/ffmpeg.exe',['-hide_banner','-i',root+'/'+path,'-f','null','-'],{encoding:'utf8',timeout:30000});
  if(decode.status!==0)throw new Error('Narration decode failed '+name);
  audio.push({key:name,path,source,sha256:digest(bytes),bytes:bytes.length,format:audioFormat(bytes),decoder:'ffmpeg',decodeStatus:decode.status,decoderReport:decode.stderr});
}
for(const entry of priorEvidence?.audio??[])if(!audio.some(a=>a.key===entry.key)&&fs.existsSync(root+'/'+entry.path))audio.push(entry);
const missionTable=JSON.parse(fs.readFileSync(root+'/data/missions.json'));
const missions=missionTable.missions.filter(m=>['Mission03','Mission04','Mission05','Mission06','Mission07','Mission08','Mission09','Mission10'].includes(m.ID));
const result={schemaVersion:1,source:cast.source,sourceSHA256:cast.sourceSHA256,scorePayloadSHA256:digest(score),scoreChunkRange:[scoreEntry.offset,scoreEntry.offset+8+scoreEntry.len],frameCount:frames.length,
  catalog:missionTable.missions.map(m=>({id:m.ID,name:m.name})),missions,frames:relevant,sequence,recovered,filmLoops,audioNames,scoreAudioNames,cdAudioNames,audio,scenarioFormatting,storyGraphics:storyGraphics.map(name=>({name,available:recovered.some(r=>r.name.toLowerCase()===name.toLowerCase())})),
  rules:{storyPictures:'DlgEventCardLargePicData/SmallPicData #Pic uses Copy ink (default0); preserve whites and enabled native alpha. Text uses ink36 explicitly.',selection:'ClassPlayerScript.getAvailableMissions sorts real Mission IDs; initialMission01, completed highest available unlocks next actual sortedID. There is no Mission02 record. DlgMissionChooseScript sorts IDs and dims unavailable rows.',outro:'DlgMissionOutroScript selects MissionID_success01 or MissionID_failure01; success loops rendered mixdown with1second fadein, failure playsA131. Outro OK returns MainMenu NoContinue plusMissionChoose.',calendar:'RockDateScript.new initializes from the systemDate. ClassMissionScript.start captures current gRock.m_date.getDateAsList(), setsDayZeroDate and Vars.StartDate; mission table StartDateAsList is empty. No fixed2001 mission start date.',timing:'SoundFX/Sound/WaitSpeaker behaviors hold frames for completion; WaitTime uses actual NumSecs parameter. Recovered initializer parameters retained per sprite; do not infer duration from score frame count.'},
  sources:['scripts/cd/Main.dxr/00040-DlgMissionChooseScript.lingo','scripts/installed/RockGeneral.cxt/00038-ClassPlayerScript.lingo','scripts/installed/RockGeneral.cxt/00045-ClassMissionScript.lingo','scripts/cd/Main.dxr/00039-DlgMissionOutroScript.lingo'],limitations:[...new Set([...scoreAudioNames,...cdAudioNames])].every(name=>audio.some(a=>a.key===name))?[]:['CD audio not fully readable in this execution; rerun with authorized host CD access.']};
fs.writeFileSync(root+'/mission34-assets.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({catalog:result.catalog,recovered:recovered.map(r=>({name:r.name,width:r.width,height:r.height})),frames:relevant.map(f=>f.frame),audioNames,audio:audio.map(a=>a.key)}));

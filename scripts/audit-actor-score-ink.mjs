import fs from 'node:fs';
import crypto from 'node:crypto';

// Read-only audit of the original Director7+ score. Retain source bytes/ranges
// and decoded fields so recovery does not confuse ink8 Matte with ink36.
const source='V:/Movies/Main.dxr';
const bytes=fs.readFileSync(source);
const root='analysis/original';
const metadata=JSON.parse(fs.readFileSync(`${root}/scripts/cd/Main.dxr/metadata.json`));
const entry=metadata.chunks.find(c=>c.fourCC==='mmap').data.mapArray.find(c=>c.fourCC==='VWSC');
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
if(sha(bytes)!==metadata.sha256)throw new Error('Original Main.dxr no longer matches recovered metadata');
const payloadOffset=entry.offset+8;
const score=bytes.subarray(payloadOffset,payloadOffset+entry.len);
const listStart=score.readUInt32BE(8),numEntries=score.readUInt32BE(listStart),listSize=score.readUInt32BE(listStart+4);
const indexStart=listStart+12,frameDataOffset=indexStart+listSize*4;
const headerOffset=frameDataOffset+score.readUInt32BE(indexStart);
const streamLength=score.readUInt32BE(headerOffset),firstFrameOffset=score.readUInt32BE(headerOffset+4);
const declaredFrames=score.readUInt32BE(headerOffset+8),framesVersion=score.readUInt16BE(headerOffset+12);
const spriteRecordSize=score.readUInt16BE(headerOffset+14),numChannels=score.readUInt16BE(headerOffset+16),displayedChannels=score.readUInt16BE(headerOffset+18);
if(spriteRecordSize!==48||firstFrameOffset!==20)throw new Error('Unsupported score record/header layout');
const mainChannelsSize=288,state=Buffer.alloc(mainChannelsSize+numChannels*spriteRecordSize);
const white=JSON.parse(fs.readFileSync(`${root}/director-windows-palette.json`)).rgb.slice(0,3);
if(white.some(c=>c!==255))throw new Error('Unexpected palette0 background color');
const frames=[];
let position=headerOffset+firstFrameOffset;
while(position<headerOffset+streamLength) {
 const start=position,size=score.readUInt16BE(position),end=start+size;
 if(size<2||end>headerOffset+streamLength)throw new Error('Invalid score frame range');
 position+=2;
 const deltas=[];
 while(position<end) {
  const length=score.readUInt16BE(position),channelOffset=score.readUInt16BE(position+2);
  position+=4;
  if(position+length>end||channelOffset+length>state.length)throw new Error('Invalid score channel delta');
  score.copy(state,channelOffset,position,position+length);
  deltas.push({channelOffset,length,scorePayloadRange:[position,position+length],originalFileRange:[payloadOffset+position,payloadOffset+position+length]});
  position+=length;
 }
 const actors=Array.from({length:5},(_,i)=>{
  const channel=120+i,offset=mainChannelsSize+(channel-1)*spriteRecordSize,raw=state.subarray(offset,offset+spriteRecordSize);
  const spriteType=raw[0],ink=raw[1]&0x3f,colorFlags=raw[20];
  const active=spriteType!==0&&raw.readUInt16BE(6)!==0;
  const result={channel,active,scoreChannelOffset:offset,rawRecordHex:raw.toString('hex'),spriteType,inkData:raw[1],ink,foreColorIndex:raw[2],backColorIndex:raw[3],colorFlags,backColorIsRGB:Boolean(colorFlags&0x20),backColorRGBBytes:[raw[3],raw[25],raw[27]],castLib:raw.readInt16BE(4),castMember:raw.readUInt16BE(6)};
  if(active&&(ink!==36||raw[3]!==0||(colorFlags&0x20)))throw new Error(`Frame${frames.length+1} channel${channel} no longer uses expected source ink36/index0`);
  return result;
 });
 frames.push({frame:frames.length+1,scorePayloadRange:[start,end],originalFileRange:[payloadOffset+start,payloadOffset+end],deltas,actors});
}
if(position!==headerOffset+streamLength||frames.length!==declaredFrames)throw new Error('Score frame count/range mismatch');
const holdSource=`${root}/scripts/cd/Main.dxr/00005-GoTheFrame.lingo`,holdBytes=fs.readFileSync(holdSource);
if(!/on exitFrame[\s\S]*go\(the frame\)/.test(holdBytes.toString()))throw new Error('Original score hold script changed');
const activeRecords=frames.flatMap(f=>f.actors.filter(a=>a.active));
const evidence={schemaVersion:1,kind:'Static original Director score audit; no runtime execution or original-file modification',source,sourceSHA256:sha(bytes),chunk:{fourCC:'VWSC',originalFileRange:[entry.offset,entry.offset+8+entry.len],payloadRange:[payloadOffset,payloadOffset+entry.len],payloadSHA256:sha(score)},
 decoder:{listStart,numEntries,listSize,indexStart,frameDataOffset,headerOffset,streamLength,firstFrameOffset,declaredFrames,framesVersion,spriteRecordSize,numChannels,displayedChannels,mainChannelsSize,frameChannelFields:{spriteType:0,inkData:1,backColorIndex:3,castLib:4,castMember:6,colorFlags:20,backColorGreen:25,backColorBlue:27}},
 parserReferences:[{url:'https://github.com/scummvm/scummvm/blob/master/engines/director/score.cpp',functions:['Score::loadFrames','Score::readOneFrame']},{url:'https://github.com/scummvm/scummvm/blob/master/engines/director/frame.cpp',functions:['Frame::readChannelD7','readSpriteDataD7']}],
 originalSources:[{path:holdSource,sha256:sha(holdBytes),rule:'exitFrame goes to the current frame'},{path:`${root}/scripts/installed/RockUtil.cxt/00063-RenderMusicianScript.lingo`,rule:'Every display member is copied with ink36 and base registration minus member registration'},{path:`${root}/scripts/installed/RockUtil.cxt/00066-FaceScript.lingo`,rule:'Layers BG/Body/Eyes/Mouth occupy channels120/121/122/123; assignments change members without overriding score ink'},{path:`${root}/scripts/installed/RockUtil.cxt/00096-unnamed.lingo`,rule:'CPshowFace positions channels120..124 using shared registration anchor; no ink override'}],
 paletteBackground:{index:0,rgb:white},frames,
 result:{frameCount:frames.length,activeRecordCount:activeRecords.length,activeFrames:frames.filter(f=>f.actors.some(a=>a.active)).map(f=>f.frame),allActiveRecordsInk36:true,allActiveBackColorsIndexedWhite0:true,inactiveFrames:frames.filter(f=>f.actors.every(a=>!a.active)).map(f=>f.frame),rule:'Use BackgroundTransparent exact white key throughout active animation layers; all pixels of background color are transparent, irrespective of connectivity. Cleared score records on later frames are inactive and do not establish another compositing profile.'}};
for(const original of evidence.originalSources)original.sha256=sha(fs.readFileSync(original.path));
fs.writeFileSync(`${root}/actor-score-ink-evidence.json`,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence.result));

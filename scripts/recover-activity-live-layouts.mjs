import fs from 'node:fs';
import crypto from 'node:crypto';
import { DirectorFile } from 'file:///C:/Users/blink/AppData/Local/Temp/rock-manager-director-tools/node_modules/projectorrays/dist/pkg/node.es.js';

const source='V:/Movies/Main.dxr';
const sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const file=await DirectorFile.readFromPath(source),chunks=file.dumpJSON();
const member=chunks.find(c=>c.fourCC==='CASt'&&c.data.info?.name==='ActorsLiveField');
const key=chunks.find(c=>c.fourCC==='KEY*').data.entries.find(k=>k.castID===member.id&&k.fourCC==='STXT');
const bytes=Buffer.from(file.getChunk('STXT',key.sectionID).data),rawText=bytes.subarray(12,12+bytes.readUInt32BE(4)).toString('latin1');
const layouts=[];
for(const venue of rawText.matchAll(/#(live\d+):\s*\[(.*?)(?=,\s*#live\d+:|\]\s*$)/gs)) {
  const positions=[...venue[2].matchAll(/#(\w+):\s*\[#(\w+),\s*point\((-?\d+),\s*(-?\d+)\),\s*([\d.]+)\]/g)].map((p,renderOrder)=>({position:p[1],direction:p[2],x:Number(p[3]),y:Number(p[4]),scale:Number(p[5]),renderOrder,disabled:Number(p[3])===0&&Number(p[4])===0&&Number(p[5])===1}));
  if(positions.length!==7)throw new Error(`Unexpected layout ${venue[1]} ${positions.length}`);
  layouts.push({venueId:venue[1].replace('live','Live'),positions});
}
if(layouts.length!==6)throw new Error(`Unexpected venue count ${layouts.length}`);
const instruments=JSON.parse(fs.readFileSync('analysis/original/data/DataInstruments00.json'));
const columns=instruments.data.InstrumentInfo;
const instrumentPoseInfo=columns.ID.map((id,i)=>({id,designEditorInfix:Number(columns.DesignEditorInfix[i]),possibleSpatialPos:columns.PossibleSpatialPos[i],source:instruments.source,sourceSha256:instruments.sha256}));
fs.writeFileSync('analysis/original/activity-live-layouts-evidence.json',JSON.stringify({method:'Static original STXT extraction and bounded position parsing; no runtime execution',source,sourceSha256,member:'ActorsLiveField',castChunkId:member.id,textChunkId:key.sectionID,rawText,layouts,instrumentPoseInfo,renderRules:{sourceScript:'Main.dxr 00049-unnamed.lingo blitMusicians/decideBandPositions/makeConcertPic',slotCandidatePositions:{1:['left01','left02','right01','right02'],2:['left01','left02','right01','right02'],3:['drums01'],4:['left01','left02','right01','right02'],5:['vocals01','vocals02']},suffixByPosition:{left01:'l',left02:'l',right01:'r',right02:'r',vocals02:'z'},poseName:'pose_ + musician.Gfx + _ + pad2(InstrumentInfo.DesignEditorInfix) + suffixByPosition',fallback:'pose_actor01_02l',selection:'Remove disabled positions; process band members in stored order, choose first still-unoccupied position allowed by spatialPos; sort rendering by position property order.',destinationRect:'[x-regX*scale, y-regY*scale, x+(width-regX)*scale, y+(height-regY)*scale]',foreground:'1 + integer(3 * filledFraction) chooses LiveNN_feedback_foreground01..04 after band rendering'}},null,2));
file.destroy();
console.log(`Recovered ${layouts.length} venue layouts, ${instrumentPoseInfo.length} instrument mappings.`);

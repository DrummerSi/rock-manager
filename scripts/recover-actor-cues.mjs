import fs from 'node:fs';
import crypto from 'node:crypto';
const root='analysis/original';
const feedback=JSON.parse(fs.readFileSync(`${root}/feedback-audio-evidence.json`));
const path=`${root}/actor-animation-evidence.json`,actor=JSON.parse(fs.readFileSync(path));
const keys=new Set(feedback.recovered.map(r=>r.key.toLowerCase()));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
actor.cues??={};
const sources=[];let merged=0;
for(const sheet of feedback.lipSync){
  if(process.argv.includes('--verify-original')){
    const bytes=fs.readFileSync(sheet.source);
    if(sha(bytes)!==sheet.sourceSHA256)throw new Error(`Cue source changed: ${sheet.source}`);
    const originals=Object.fromEntries(bytes.toString('latin1').split(/\r?\n/).map(line=>/^([\w]+):\s*(\[[\d, ]*\])/.exec(line)).filter(Boolean).map(m=>[m[1],JSON.parse(m[2])]));
    for(const[key,values]of Object.entries(sheet.entries))if(JSON.stringify(originals[key])!==JSON.stringify(values))throw new Error(`Cue samples changed: ${key}`);
  }
  for(const[key,values]of Object.entries(sheet.entries)){
    if(!keys.has(key.toLowerCase())||!Array.isArray(values)||!values.every(v=>Number.isInteger(v)&&v>=0&&v<=100))throw new Error(`Invalid retained cue: ${key}`);
    actor.cues[key]=values;merged++;
  }
  sources.push({source:sheet.source,sourceSHA256:sheet.sourceSHA256,entries:Object.keys(sheet.entries).length});
}
actor.cueSources=sources;
actor.cueMerge={feedbackEvidenceSHA256:sha(fs.readFileSync(`${root}/feedback-audio-evidence.json`)),rule:'Original cue arrays copied without resampling; merge by exact clip key and preserve prior actor art/cues.',originalSourcesVerified:process.argv.includes('--verify-original')};
fs.writeFileSync(path,JSON.stringify(actor,null,2));
console.log(JSON.stringify({merged,total:Object.keys(actor.cues).length,sources:sources.length}));

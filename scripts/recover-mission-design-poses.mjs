import fs from 'node:fs';
import {indexedCast,bitmap,digest} from './director-cast.mjs';

// Incremental recovery: never rewrite prior source bitmaps, fonts, or metadata.
const root='analysis/original';
const evidencePath=`${root}/design-assets-evidence.json`;
const evidence=JSON.parse(fs.readFileSync(evidencePath));
const cast=indexedCast(`${root}/scripts/cd/city01.cxt/metadata.json`,'E:/Games/Rock Manager/city01.cxt');
const normalize=s=>new TextDecoder('macintosh').decode(Buffer.from(s,'latin1'));
const existing=new Set(evidence.recovered.map(x=>x.name.toLowerCase()));
const before=evidence.recovered.map(x=>({path:x.path,sha256:digest(fs.readFileSync(`${root}/${x.path}`))}));
const added=[];
for(const member of cast.members){
  const name=normalize(member.data.info?.name??'');
  if(member.data.type!==1||!/^pose_actor\d+_/i.test(name)||existing.has(name.toLowerCase()))continue;
  const image=bitmap(cast,member,36);if(!image)continue;
  const slot=cast.slots.indexOf(member.id)+1;
  const path=`media/Design/city01/${String(slot).padStart(4,'0')}-${name}.png`;
  fs.mkdirSync(`${root}/media/Design/city01`,{recursive:true});
  fs.writeFileSync(`${root}/${path}`,image.bytes);
  const {bytes,...metadata}=image;
  const entry={key:`city01:${slot}`,name,rawName:member.data.info.name,path,...metadata,castSlot:slot,alpha:'original populated alpha with Director ink36 white transparency',recoveryRule:'Original city01 BITD and registration; Director ink36 makes white transparent.'};
  added.push(entry);existing.add(name.toLowerCase());
}
for(const item of before)if(digest(fs.readFileSync(`${root}/${item.path}`))!==item.sha256)throw new Error(`Existing asset changed: ${item.path}`);
evidence.recovered.push(...added);
evidence.additionalMissionPoses={source:cast.source,sourceSHA256:cast.sourceSHA256,actors:[...new Set(evidence.recovered.filter(x=>/^pose_actor\d+_/i.test(x.name)).map(x=>x.name.match(/^pose_(actor\d+)_/i)[1]))].sort(),priorAssetsVerified:before.length,added:added.map(x=>x.key)};
fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2));
console.log(JSON.stringify({added:added.length,actors:evidence.additionalMissionPoses.actors,actor29:added.filter(x=>x.name.startsWith('pose_actor29_')).map(x=>({name:x.name,width:x.width,height:x.height,regX:x.regX,regY:x.regY,path:x.path})),priorAssetsVerified:before.length},null,2));

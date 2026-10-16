import fs from 'node:fs';
import {decodeDirectorVList} from './director-vlist.mjs';

// Bounded recovery of one original table; no executable expressions are run.
const source=decodeDirectorVList(process.argv[2]??'V:/Data/DataVideoConcepts00.dat');
const table=source.data.VideoConcept;
const studio=JSON.parse(fs.readFileSync('analysis/original/data/DataBuildings00.json')).data.video;
const row=(value,index)=>Array.isArray(value)?value[index]:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,row(v,index)]));
const tables=JSON.parse(fs.readFileSync('analysis/original/activity-rules-evidence.json')).tables;
const media=tables.media.find(m=>m.ID==='Media01');
const reporter=tables.Reporter.find(r=>r.ID===media.Reporter);
const numbers=v=>Object.fromEntries(Object.entries(v).map(([k,n])=>[k,Number(n)]));
const ids=v=>[...v.matchAll(/#(\w+)/g)].map(m=>m[1]);
const ec=JSON.parse(fs.readFileSync('analysis/original/data/DataDBEC00.json')).data;
const cards=Object.values(ec).flatMap(t=>t.ID.map((_,i)=>row(t,i))).filter(c=>['ECOCVideoDone','ECOCVideoNoAlbum','ECOCVideoTwo'].includes(c.ID));
if(cards.length!==3||table.ID.length!==11)throw new Error('Unexpected original video data');
const rules={source:source.source,sourceSHA256:source.sha256,
  studio:{id:studio.ID[0],name:studio.name[0]},
  scripts:['Main.dxr/00028-DlgVideoScript','RockGeneral.cxt/00068-ClassVideoProductionScript','RockGeneral.cxt/00021-ClassReporterScript'],
  concepts:table.ID.map((id,i)=>{const r=row(table,i);return{id,name:r.name,description:r.comment,graphic:r.Gfx,price:Number(r.price),duration:Number(r.ProductionTime),quality:Number(r.quality)};}),
  media:{id:media.ID,name:media.name,description:media.comment,type:media.MediaType,reporterId:media.Reporter,targets:ids(media.MediaTargets),adverts:ids(media.AdvertisingIDs),chartThresholds:JSON.parse(media.ChartPosToRating)},
  reporter:{id:reporter.ID,name:reporter.name,mediaId:media.ID,style:numbers(reporter.MusicStyle),tolerance:numbers(reporter.MusicStyleTolerance),mood:Number(reporter.Mood),bribeSensitivity:Number(reporter.BribeSensitivity),minimumHype:Number(reporter.MinHype)},
  adverts:tables.ExpoAd.filter(a=>a.MediaID===media.ID).map(a=>({id:a.ID,name:a.name,mediaId:a.MediaID,price:Number(a.price),intensity:Number(a.Intensity),quality:Number(a.quality)})),
  speech:(()=>{
    const recovered=JSON.parse(fs.readFileSync('src/generated/feedback-audio.json')).recovered;
    const keys=(suffix)=>recovered.filter(r=>new RegExp('^m01m'+suffix+'$','i').test(r.key)).map(r=>r.key);
    return {greeting:{normal:keys('a0100[1-3]'),Happy:keys('a0200[1-3]'),Angry:keys('a0300[1-3]')},gift:{BribeLo:keys('b0600[1-5]'),BribeHi:keys('b0700[1-5]'),otherwise:keys('b0400[1-5]')},pressKit:keys('b0400[1-5]')};
  })(),
  cards,
};
fs.writeFileSync('src/game/video-rules.json',JSON.stringify(rules,null,2)+'\n');
console.log(`Recovered ${rules.concepts.length} original concepts, TV24 rules and ${cards.length} video cards.`);

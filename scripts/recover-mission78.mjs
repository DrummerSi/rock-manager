import fs from 'node:fs';
import {decodeDirectorVList} from './director-vlist.mjs';
const root='analysis/original';
const row=(v,i)=>Array.isArray(v)?v[i]:v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,c])=>[k,row(c,i)])):v;
const rows=t=>(t.ID??[]).map((_,i)=>row(t,i));
const missions=JSON.parse(fs.readFileSync(root+'/data/missions.json')).missions;
const recovered={};
for(const n of ['07','08']){
  const rest=JSON.parse(fs.readFileSync(root+'/data/DataDBRest'+n+'.json'));
  const cards=JSON.parse(fs.readFileSync(root+'/data/DataDBEC'+n+'.json'));
  const snapshot=decodeDirectorVList('.local/original-runtime/Plugins/Swedish/M'+n+'.dat');
  fs.writeFileSync(root+'/mission'+n+'-autoload-evidence.json',JSON.stringify(snapshot,null,2)+'\n');
  recovered['Mission'+n]={mission:missions.find(m=>m.ID==='Mission'+n),triggers:rows(rest.data.Trigger),cards:Object.values(cards.data).flatMap(rows),sources:[rest,cards].map(({source,sha256})=>({source,sha256})),snapshotSource:snapshot.source,snapshotSHA256:snapshot.sha256};
}
fs.writeFileSync(root+'/mission78-rules-evidence.json',JSON.stringify(recovered,null,2)+'\n');
console.log('Recovered original Mission07/08 starting saves, triggers and event cards.');

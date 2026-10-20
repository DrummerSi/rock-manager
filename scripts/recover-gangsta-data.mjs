import fs from 'node:fs';
const row=(v,i)=>Array.isArray(v)?v[i]:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,row(x,i)]));
const read=name=>JSON.parse(fs.readFileSync('analysis/original/data/'+name+'.json'));
const rest=read('DataDBRest00'),ec=read('DataDBEC00');
const triggers=rest.data.Trigger.ID.map((_,i)=>row(rest.data.Trigger,i)).filter(t=>/^TRGang/i.test(t.ID));
const cards=Object.values(ec.data).flatMap(t=>t.ID.map((_,i)=>row(t,i))).filter(c=>/^ECOCGang/i.test(c.ID));
// Extract only the observed, literal button effects. Never evaluate Lingo.
const effects=script=>({
  exposures:[...String(script).matchAll(/expose\(0,\s*([-.\d]+),\s*([-.\d]+),\s*(\d+)\)/gi)].map(m=>({intensity:+m[1],quality:+m[2],duration:+m[3]})),
  modifiers:[...String(script).matchAll(/createModifier\(#(\w+),\s*#Bandmembers,\s*#Mood,\s*([-.\d]+),\s*(\d+)\)/gi)].map(m=>({id:m[1],amount:+m[2],duration:+m[3]})),
  money:[...String(script).matchAll(/transactMoney\(\s*([-.\d]+)\)/gi)].reduce((sum,m)=>sum+Number(m[1]),0),
});
const source=read('DataBuildings00'),office=row(source.data.Gangsta,source.data.Gangsta.ID.indexOf('Gangsta01'));
const metadata=JSON.parse(fs.readFileSync('analysis/original/scripts/installed/RockMaterial.cxt/metadata.json'));
const member=metadata.chunks.find(c=>c.fourCC==='CASt'&&c.data.info?.name==='live smashed demo01');
const chunk=metadata.chunks.find(c=>c.fourCC==='mmap').data.mapArray[member.id];
const bytes=fs.readFileSync('E:/Games/Rock Manager/RockMaterial.cxt');
const raw=bytes.subarray(chunk.offset+8,chunk.offset+8+chunk.len),header=raw.subarray(12+member.data.infoLen);
const artwork={'live smashed demo01':{regX:header.readInt16BE(20),regY:header.readInt16BE(18)}};
fs.writeFileSync('src/game/gangsta-rules.json',JSON.stringify({
  sources:[{path:rest.source,sha256:rest.sha256},{path:ec.source,sha256:ec.sha256}],office,artwork,
  triggers,cards:cards.map(c=>({...c,buttonEffects:Object.fromEntries(['ButtonOK','ButtonCancel','Button3'].map(key=>[key,effects(c[key]?.ExecuteThis)]))})),
},null,2)+'\n');
console.log(`Recovered ${triggers.length} Sergey triggers and ${cards.length} original event cards.`);

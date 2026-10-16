import fs from 'node:fs';
import {indexedCast,bitmap} from './director-cast.mjs';
const root='analysis/original',row=(v,i)=>Array.isArray(v)?v[i]:v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,row(x,i)])):v;
const rows=t=>t.ID.map((_,i)=>row(t,i)),read=n=>JSON.parse(fs.readFileSync(root+'/data/'+n+'.json'));
const source=read('DataTourStuff00'),design=read('DataDesignAndStage00');
const categories=rows(design.data.DesignCategory).filter(c=>c.ID.startsWith('DCStage')).map(c=>({...c,elements:[...c.elements.matchAll(/#(\w+)/g)].map(m=>m[1])}));
const elementIds=new Set(categories.flatMap(c=>c.elements)),elements=rows(design.data.DesignElement).filter(e=>elementIds.has(e.ID));
const wanted=new Set([...rows(source.data.TourCity).map(c=>c.Gfx),...rows(source.data.TourExpense).map(c=>c.Gfx),...categories.map(c=>c.Gfx),...elements.map(e=>e.Gfx),'image_screenshot tour01','ArrowTurnLeft','ArrowTurnRight','MapPlacePic']);
wanted.delete('');wanted.add('stage_small_base01');wanted.add('image_training vacation01_small01');
for(const element of elements)for(const match of element.Gfx.matchAll(/"([^"]+)"/g))wanted.add(match[1]);
const animated=[...wanted].filter(name=>name.endsWith('_0001')).map(name=>name.slice(0,-4));
const recovered=[];fs.mkdirSync(root+'/media/Tour',{recursive:true});
for(const name of ['RockMaterial','city01']){
  const cast=indexedCast(name==='RockMaterial'?root+'/rockmaterial-current-index.json':root+'/scripts/cd/city01.cxt/metadata.json','E:/Games/Rock Manager/'+name+'.cxt');
  for(const member of cast.members){const name=member.data.info?.name??'';if(member.data.type!==1||!(/^(globe01_|plane02_)/i.test(name)||wanted.has(name)||animated.some(prefix=>name.startsWith(prefix)&&/^\d{4}$/.test(name.slice(prefix.length)))))continue;
    const image=bitmap(cast,member,name.startsWith('stage_small_')?0:36);if(!image)continue;const{bytes,...info}=image;
    const key='tour-'+name.replaceAll(' ','_').toLowerCase(),path='media/Tour/'+key+'.png';fs.writeFileSync(root+'/'+path,bytes);recovered.push({...info,name,key,path});
  }
}
const rules={sources:[source,design].map(({source,sha256})=>({source,sha256})),cities:rows(source.data.TourCity),expenses:rows(source.data.TourExpense),categories,elements,bitmaps:recovered.map(({name,key,regX,regY,width,height})=>({name,key,regX,regY,width,height})),cards:Object.values(read('DataDBEC00').data).flatMap(rows).filter(c=>['ECOCTourComplete','ECOCBandTourCancel','ECOCBandIncomplete','ECOCIntroduceWorldTour'].includes(c.ID))};
fs.writeFileSync('src/game/tour-rules.json',JSON.stringify(rules,null,2)+'\n');
fs.writeFileSync(root+'/tour-assets-evidence.json',JSON.stringify({sources:rules.sources,recovered},null,2)+'\n');
console.log('Recovered '+rules.cities.length+' tour cities, '+elements.length+' stage elements and '+recovered.length+' original tour images.');

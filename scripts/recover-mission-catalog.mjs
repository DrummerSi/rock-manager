import fs from 'node:fs';
import crypto from 'node:crypto';
const base='analysis/original',read=name=>JSON.parse(fs.readFileSync(`${base}/data/${name}.json`));
const ids=value=>[...String(value).matchAll(/#(\w+)/g)].map(m=>m[1]);
const row=(value,index)=>Array.isArray(value)?value[index]:value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,child])=>[key,row(child,index)])):value;
const clean=value=>String(value??'').replaceAll('\\n','\n').replaceAll('\\t','   ').replaceAll('\x96','–').replaceAll('\x85','…');
const raw=JSON.parse(fs.readFileSync(`${base}/data/missions.json`)).missions;
const playable=['Mission01','Mission03','Mission04','Mission05','Mission06','Mission07','Mission08'];
const catalog=raw.filter(m=>m.name).map(m=>({id:m.ID,name:m.name,comment:clean(m.comment),gfx:m.Gfx,intro:clean(m.IntroText),success:clean(m.SucceedText),failure:clean(m.FailText),
  objectives:clean(m.CriteriaText).split('\n').map(t=>t.replace(/^[\s\x95•]+/,'').trim()).filter(Boolean),startMoney:Number(m.StartMoney),availableMusicians:ids(m.AvailableMusicians),neverMusicians:ids(m.NeverAvailableMusicians),
  availableSongs:ids(m.AvailableSongs),availablePlaces:ids(m.AvailablePlaces),neverPlaces:ids(m.NeverAvailablePlaces),playable:playable.includes(m.ID)}));
const snapshots={Mission03:JSON.parse(fs.readFileSync(`${base}/mission03-autoload-evidence.json`)).data,
  Mission04:JSON.parse(fs.readFileSync(`${base}/mission04-recovered.json`)).autoLoad.data,
  Mission05:JSON.parse(fs.readFileSync(`${base}/mission05-autoload-evidence.json`)).data,
  Mission06:JSON.parse(fs.readFileSync(`${base}/mission06-autoload-evidence.json`)).data,
  Mission07:JSON.parse(fs.readFileSync(`${base}/mission07-autoload-evidence.json`)).data,
  Mission08:JSON.parse(fs.readFileSync(`${base}/mission08-autoload-evidence.json`)).data};
const cards=['03','04','05','06','07','08'].flatMap(n=>Object.values(read('DataDBEC'+n).data).flatMap(table=>table.ID.map((_,i)=>row(table,i))));
cards.push(...Object.values(read('DataDBEC00').data).flatMap(table=>(table.ID??[]).map((_,i)=>row(table,i))).filter(card=>['ECOCQuitNow','ECOCWantQuit'].includes(card.ID)));
fs.writeFileSync('src/game/mission-catalog.json',JSON.stringify({missions:catalog,snapshots,cards},null,2)+'\n');
const sources=['missions','DataDBEC03','DataDBEC04','DataDBEC05','DataDBEC06','DataDBEC07','DataDBEC08'].map(name=>`${base}/data/${name}.json`).concat(`${base}/mission03-autoload-evidence.json`,`${base}/mission04-recovered.json`,`${base}/mission05-autoload-evidence.json`,`${base}/mission06-autoload-evidence.json`,`${base}/mission07-autoload-evidence.json`,`${base}/mission08-autoload-evidence.json`);
fs.writeFileSync(`${base}/mission-catalog-evidence.json`,JSON.stringify({sources:sources.map(path=>({path,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')})),note:'Catalog skips Mission02. Original decoded data copied without executing any original expressions. Swedish autoload snapshots provide structural state; English original tables provide localized text.'},null,2)+'\n');
console.log(`Retained ${catalog.length} original missions, ${cards.length} scenario cards and ${Object.keys(snapshots).length} starting snapshots.`);

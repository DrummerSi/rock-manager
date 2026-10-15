import fs from 'node:fs';
import crypto from 'node:crypto';

// Read retained cast indexes against the actual installed bytes. Never execute Lingo.
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function parse(text){
  let offset=0;
  const ws=()=>{while(/\s/.test(text[offset]??'')&&offset<text.length)offset++;};
  function value(){
    ws();const c=text[offset++];
    if(c==='['){
      ws();if(text[offset]===']'){offset++;return [];}
      if(text[offset]===':'){offset+=2;return {};}
      const first=value();ws();
      if(text[offset]===':'){
        const result={};let key=first;
        while(true){offset++;result[key]=value();ws();if(text[offset++]===']')return result;key=value();ws();if(text[offset]!==':')throw new Error('Expected property colon');}
      }
      const result=[first];while(true){ws();const end=text[offset++];if(end===']')return result;if(end!==',')throw new Error('Expected list separator');result.push(value());}
    }
    if(c==='"'){let s='';while(offset<text.length){const q=text[offset++];if(q==='"')return s;if(q==='\\'&&text[offset]==='"'){s+='"';offset++;}else s+=q;}throw new Error('Unterminated string');}
    if(c==='#'){const m=/^[\w]+/.exec(text.slice(offset));if(!m)throw new Error('Invalid symbol');offset+=m[0].length;return m[0];}
    offset--;const n=/^-?(?:\d+\.?\d*|\.\d+)/.exec(text.slice(offset));if(n){offset+=n[0].length;return Number(n[0]);}
    const ctor=/^(rect|point|rgb)\s*\(/i.exec(text.slice(offset));if(ctor){offset+=ctor[0].length;const args=[];while(true){args.push(value());ws();const end=text[offset++];if(end===')')return args;if(end!==',')throw new Error('Invalid coordinate constructor');}}
    const boolean=/^(TRUE|FALSE)\b/i.exec(text.slice(offset));if(boolean){offset+=boolean[0].length;return boolean[0].toUpperCase()==='TRUE';}
    throw new Error(`Unsupported static token at ${offset}: ${text.slice(offset,offset+35)}`);
  }
  const result=value();ws();if(offset!==text.length)throw new Error(`Unconsumed text at${offset}`);return result;
}
const layouts=[];
for(const [index,sourceOverride]of [['analysis/original/scripts/installed/RockMaterial.cxt/metadata.json'],['analysis/original/scripts/installed/RockUtil.cxt/metadata.json'],['analysis/original/scripts/cd/Mixer.dxr/metadata.json','E:/Games/Rock Manager/Mixer.dxr']]){
  const metadata=JSON.parse(fs.readFileSync(index)),source=sourceOverride??metadata.source;
  const file=fs.readFileSync(source),sourceSHA256=hash(file);
  if(metadata.sha256&&metadata.sha256!==sourceSHA256)throw new Error(`Cast index hash mismatch: ${source}`);
  const map=metadata.chunks.find(c=>c.fourCC==='mmap').data.mapArray;
  const keys=metadata.chunks.find(c=>c.fourCC==='KEY*').data.entries;
  const chunk=id=>{const c=map[id];return file.subarray(c.offset+8,c.offset+8+c.len);};
  for(const member of metadata.chunks.filter(c=>c.fourCC==='CASt'&&c.data.type===3)){
    const name=member.data.info?.name??'',key=keys.find(k=>k.castID===member.id&&k.fourCC==='STXT');
    if(!key)continue;const raw=chunk(key.sectionID),text=raw.subarray(12,12+raw.readUInt32BE(4)).toString('latin1');
    if(!/^\s*\[#items\s*:/.test(text))continue;
    layouts.push({name,source,sourceSHA256,memberId:member.id,chunkId:key.sectionID,sha256:hash(raw),text,data:parse(text)});
  }
}
const result={method:'Bounded static Lingo data parser; original STXT bytes and hashes, no Lingo execution',layouts};
fs.writeFileSync('analysis/original/native-dialog-layouts.json',JSON.stringify(result,null,2));
console.log(`Recovered ${layouts.length} original dialog definitions.`);

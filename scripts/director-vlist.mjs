import fs from 'node:fs';
import crypto from 'node:crypto';
/** Bounded decoder for observed uncompressed Director vList values. Never executes expressions. */
export function decodeDirectorVList(input) {
  const bytes=Buffer.isBuffer(input)?input:fs.readFileSync(input);
  let offset=92, nodes=0; const references=new Map(); let dictionary=[];
  const u32=()=>{if(offset+4>bytes.length)throw new Error(`Truncated vList at${offset}`);const n=bytes.readUInt32BE(offset);offset+=4;return n;};
  const read=(depth=0)=>{
    if(depth>150||++nodes>500000)throw new Error('vList bounds exceeded');
    const at=offset,type=u32();
    if(type===1)return u32()|0;
    if(type===2){const id=u32();if(!dictionary[id-1])throw new Error(`Unknown symbol${id} at${at}`);return dictionary[id-1];}
    if(type===259||type===3){const length=u32();if(length>bytes.length-offset)throw new Error('String out of bounds');const value=bytes.subarray(offset,offset+length).toString('latin1').replace(/\0$/,'');offset+=length;return value;}
    if(type===6){if(offset+8>bytes.length)throw new Error('Float out of bounds');const value=bytes.readDoubleBE(offset);offset+=8;return value;}
    if(type===7||type===10){const count=u32(),id=u32();if(count>100000)throw new Error('Container out of bounds');const result=type===7?[]:{};references.set(id,result);for(let n=0;n<count;n++){if(type===7)result.push(read(depth+1));else {const key=read(depth+1);if(typeof key!=='string'&&typeof key!=='number')throw new Error(`Unsupported property key at${offset}`);result[key]=read(depth+1);}}return result;}
    throw new Error(`Unsupported vList type${type} at${at}`);
  };
  dictionary=read();if(!Array.isArray(dictionary)||!dictionary.every(x=>typeof x==='string'))throw new Error('Expected leading symbol dictionary');
  const payloadStart=offset;const data=read();
  return {source:typeof input==='string'?input:null,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),method:'Bounded static uncompressed Director vList decoder; expression strings are data only',dictionary,payloadStart,payloadEnd:offset,uninterpretedTrailerHex:bytes.subarray(offset).toString('hex'),data};
}


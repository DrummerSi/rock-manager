import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
export const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
export function indexedCast(metadataPath,sourceOverride){
  const metadata=JSON.parse(fs.readFileSync(metadataPath)),source=sourceOverride??metadata.source,file=fs.readFileSync(source),sourceSHA256=digest(file);
  if(metadata.sha256&&metadata.sha256!==sourceSHA256)throw new Error(`Cast index does not match original bytes: ${source}`);
  const map=metadata.chunks.find(c=>c.fourCC==='mmap').data.mapArray,keys=metadata.chunks.find(c=>c.fourCC==='KEY*').data.entries,slots=metadata.chunks.find(c=>c.fourCC==='CAS*').data.memberIDs;
  const chunk=id=>{const c=map[id];return file.subarray(c.offset+8,c.offset+8+c.len);};
  return {metadata,source,sourceSHA256,keys,slots,chunk,members:metadata.chunks.filter(c=>c.fourCC==='CASt')};
}
export function bitmap(cast,member,ink){
  const key=cast.keys.find(k=>k.castID===member.id&&k.fourCC==='BITD');if(!key)return null;
  const rawCast=cast.chunk(member.id),h=rawCast.subarray(12+rawCast.readUInt32BE(4));
  const width=h.readUInt16BE(8),height=h.readUInt16BE(6),depth=h[23],stride=h.readUInt16BE(0)&0x7fff,regX=h.readInt16BE(20),regY=h.readInt16BE(18),paletteId=h.readInt16BE(26)-1;
  const raw=cast.chunk(key.sectionID),isRaw=raw.length===stride*height;let pixels=raw;
  if(!isRaw){const decoded=[];for(let offset=0;offset<raw.length;){const count=raw[offset++];if(count<128)for(let i=0;i<=count;i++)decoded.push(raw[offset++]);else if(count>128){const v=raw[offset++];for(let i=0;i<257-count;i++)decoded.push(v);}}pixels=Buffer.from(decoded);}
  if(pixels.length!==stride*height)throw new Error(`Unexpected BITD size: ${member.data.info.name}`);
  let palette=JSON.parse(fs.readFileSync('analysis/original/director-windows-palette.json')).rgb;
  const clut=cast.keys.find(k=>k.fourCC==='CLUT'&&cast.slots.indexOf(k.castID)===paletteId);
  if(clut){const b=cast.chunk(clut.sectionID);palette=Array.from({length:b.length/6},(_,i)=>[b[i*6],b[i*6+2],b[i*6+4]]).flat();}
  if(paletteId===-3)palette=Array.from({length:256},(_,i)=>[255-i,255-i,255-i]).flat();
  const png=new PNG({width,height});let hasAlpha=false;
  if(depth===32)for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[y*stride+(isRaw?x*4:x)]!==0)hasAlpha=true;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const row=y*stride,i=(y*width+x)*4;let rgb;
    if(depth===32)rgb=isRaw?[...pixels.subarray(row+x*4+1,row+x*4+4)]:[pixels[row+width+x],pixels[row+2*width+x],pixels[row+3*width+x]];
    else if(depth===16){const v=isRaw?pixels.readUInt16BE(row+x*2):(pixels[row+x]<<8)|pixels[row+width+x];rgb=[(v>>10)&31,(v>>5)&31,v&31].map(v=>Math.floor(v*255/31));}
    else if(depth===8)rgb=palette.slice(pixels[row+x]*3,pixels[row+x]*3+3);else throw new Error(`Unsupported bitmap depth${depth}`);
    png.data.set(rgb,i);png.data[i+3]=ink===36&&rgb.every(v=>v===255)?0:hasAlpha?pixels[row+(isRaw?x*4:x)]:255;
  }
  const bytes=PNG.sync.write(png);
  return {bytes,width,height,regX,regY,depth,ink,source:cast.source,sourceSHA256:cast.sourceSHA256,memberId:member.id,chunkId:key.sectionID,bitdSHA256:digest(raw),pngSHA256:digest(bytes)};
}
export function xmedStyle(cast,member){
  const key=cast.keys.find(k=>k.castID===member.id&&k.fourCC==='XMED');if(!key)return null;
  const raw=cast.chunk(key.sectionID),sections=new Map([...raw.toString('latin1').matchAll(/\x03([0-9a-f]{4})([0-9a-f]{8})([0-9a-f]{8})/gi)].map(m=>[parseInt(m[1],16),{count:parseInt(m[3],16),bytes:raw.subarray(m.index+21,m.index+21+parseInt(m[2],16))}]));
  const numbers=b=>{const r=[];for(let i=0;i<b.length;){const t=b[i++];if(t===3)continue;if(t===0x81||t===0x82){r.push(0);continue;}if(t===0xc1||t===0xc2){r.push(...Array(b[i++]).fill(0));continue;}if(t!==1&&t!==2)throw new Error('Unsupported XMED tag');let v='';while(i<b.length&&/[0-9a-f-]/i.test(String.fromCharCode(b[i])))v+=String.fromCharCode(b[i++]);r.push(parseInt(v,16));}return r;};
  if(!sections.has(6)||!sections.has(8))return null;
  const fb=sections.get(8).bytes,fontNames=[];for(let i=0;i<fb.length-4;i++)if(fb.subarray(i,i+3).toString()==='40,'){const n=fb[i+3];if(n>0&&n<64)fontNames.push(fb.subarray(i+4,i+4+n).toString('latin1'));}
  const values=numbers(sections.get(6).bytes),count=sections.get(6).count;if(values.length!==1+77*count)throw new Error('Unknown XMED style width');
  const styles=Array.from({length:count},(_,i)=>{const f=values.slice(1+77*i,1+77*(i+1));return {fontFamily:fontNames[f[0]],fontSize:f[18]/65536,bold:f[39]===1,letterSpacing:f[23]/65536,rawValues:f};});
  const runs=numbers(sections.get(4)?.bytes??Buffer.alloc(0));
  const h=cast.chunk(member.id).subarray(12+member.data.infoLen);
  return {name:member.data.info.name,source:cast.source,sourceSHA256:cast.sourceSHA256,memberId:member.id,payloadSHA256:digest(raw),defaultStyle:values[0],styles,runs:Array.from({length:runs.length/2},(_,i)=>({offset:runs[i*2],style:runs[i*2+1]})),width:h.readUInt32BE(52),height:h.readUInt32BE(48)};
}

import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { DirectorFile } from 'file:///C:/Users/blink/AppData/Local/Temp/rock-manager-director-tools/node_modules/projectorrays/dist/pkg/node.es.js';

const root = 'analysis/original';
const windowsPalette = JSON.parse(fs.readFileSync(`${root}/director-windows-palette.json`)).rgb;
const mac = new TextDecoder('macintosh');
const normalized = (name) => mac.decode(Buffer.from(name, 'latin1'));
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const recovered = [], texts = [], palettes = [], fonts = [];
const names = new Set(['tegelvägg01','lövskog01','ridå01','högtalarstack01','cityscape01','desert01','eldvägg01','moneywall01','moon01','tvnoise01','abomb01','graveyard01','rainbow01','firewolflogo01','lensflare01','videoraster01','scratches01','image_nodesign01_small01']);
for (const name of ['frame_cdcover01','agenda_background01','agenda_slider_arrows01Left','agenda_slider_arrows01Right','agenda_slider_arrows01','agenda_slider_background01','tmpCD_frame','icon_cd02','image_release01_small01']) names.add(name);
names.add('BehindScrollerPic');
for (const name of ['slider02_1_1','slider02_1_2','slider02_1_3']) names.add(name);
const sources = ['E:/Games/Rock Manager/RockMaterial.cxt','E:/Games/Rock Manager/RockUtil.cxt','V:/Movies/Main.dxr','V:/Movies/VeryGeneral.cxt','V:/Movies/city01.cxt', ...Array.from({length:14},(_,i)=>`V:/Movies/Font${String(i+1).padStart(2,'0')}.cxt`)];
// Poses are in RockMaterial, but also search actor casts for linked candidates.
for (const a of JSON.parse(fs.readFileSync(`${root}/data/mission01-recovered.json`)).availableMusicians) sources.push(`V:/Movies/Actor${a.Gfx.slice(-2)}.cxt`);
const actors = JSON.parse(fs.readFileSync(`${root}/data/mission01-recovered.json`)).availableMusicians.map(a=>a.Gfx.toLowerCase());
for (const source of sources) {
  const bytes=fs.readFileSync(source), sourceSHA256=digest(bytes), director=await DirectorFile.readFromPath(source);
  const chunks=director.dumpJSON(), keys=chunks.find(c=>c.fourCC==='KEY*').data.entries, slots=chunks.find(c=>c.fourCC==='CAS*')?.data.memberIDs ?? [];
  const font=/Font\d+\.cxt$/i.test(source), cast=source.split('/').at(-1).replace(/\.\w+$/,'');
  const chunk=(type,id)=>Buffer.from(director.getChunk(type,id).data);
  for(const member of chunks.filter(c=>c.fourCC==='CASt'&&c.data.type===3)) {
    const name=normalized(member.data.info.name), key=keys.find(k=>k.castID===member.id&&k.fourCC==='STXT');
    if(!key || !(font || /CharReplacements|ActorsDesignData|DlgDesign.*Data|DlgChooseKit1Data|DlgHeadline.*Data|DlgRockTextUpAndDown.*Data|DlgRockUpDownSetData|RockSrnd[23]Style/.test(name)))continue;
    const raw=chunk('STXT',key.sectionID), text=raw.subarray(12,12+raw.readUInt32BE(4)).toString('latin1');
    texts.push({name,text,source,sourceSHA256,memberId:member.id,chunkId:key.sectionID});
  }
  let castPalette=windowsPalette;
  for(const key of keys.filter(k=>k.fourCC==='CLUT')) {
    const raw=chunk('CLUT',key.sectionID), owner=chunks.find(c=>c.fourCC==='CASt'&&c.id===key.castID), name=normalized(owner?.data.info?.name??'');
    const rgb=Array.from({length:raw.length/6},(_,i)=>[raw[i*6],raw[i*6+2],raw[i*6+4]]).flat();
    if(font||/Actor/i.test(cast))castPalette=rgb;
    if(name==='SepiaPalette')palettes.push({name,rgb,source,sourceSHA256,chunkId:key.sectionID});
  }
  const seen=new Set();
  for(const member of chunks.filter(c=>c.fourCC==='CASt'&&c.data.type===1).sort((a,b)=>slots.indexOf(a.id)-slots.indexOf(b.id))) {
    const name=normalized(member.data.info.name), rawName=member.data.info.name;
    if(!font && !names.has(name) && !/^icon_(spotlight|text|foreground|effect|camera|calendar)0[12](_dimmed)?$/i.test(name) && !actors.some(a=>name.toLowerCase().startsWith(`pose_${a}_`)))continue;
    if(seen.has(name))continue;seen.add(name);
    const key=keys.find(k=>k.castID===member.id&&k.fourCC==='BITD');if(!key)continue;
    const rawCast=chunk('CASt',member.id), h=rawCast.subarray(12+rawCast.readUInt32BE(4));
    const width=h.readUInt16BE(8),height=h.readUInt16BE(6),depth=h[23],stride=h.readUInt16BE(0)&0x7fff,regX=h.readInt16BE(20),regY=h.readInt16BE(18);
    const paletteId=h.length>=28?h.readInt16BE(26)-1:0;
    // Director built-in palette -3 is grayscale, index0 white/index255 black.
    // Bitmap-specific reference takes precedence over movie Windows palette.
    const bitmapPalette=paletteId===-3?Array.from({length:256},(_,i)=>[255-i,255-i,255-i]).flat():castPalette;
    if(!width||!height)continue;
    const raw=chunk('BITD',key.sectionID),isRaw=raw.length===stride*height;
    let pixels=raw;
    if(!isRaw){const decoded=[];for(let o=0;o<raw.length;){const count=raw[o++];if(count<128)for(let i=0;i<=count;i++)decoded.push(raw[o++]);else if(count>128){const value=raw[o++];for(let i=0;i<257-count;i++)decoded.push(value);}}pixels=Buffer.from(decoded);}
    if(pixels.length!==stride*height)throw new Error(`BITD size mismatch ${cast}/${name}`);
    const png=new PNG({width,height});
    let hasAlpha=false;if(depth===32)for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[y*stride+(isRaw?x*4:x)]!==0)hasAlpha=true;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const row=y*stride,index=(y*width+x)*4;let rgb;
      if(depth===32)rgb=isRaw?[...pixels.subarray(row+x*4+1,row+x*4+4)]:[pixels[row+width+x],pixels[row+width*2+x],pixels[row+width*3+x]];
      else if(depth===16){const v=isRaw?pixels.readUInt16BE(row+x*2):(pixels[row+x]<<8)|pixels[row+width+x];rgb=[(v>>10)&31,(v>>5)&31,v&31].map(v=>Math.floor(v*255/31));}
      else if(depth===8)rgb=bitmapPalette.slice(pixels[row+x]*3,pixels[row+x]*3+3);
      else if(depth===1)rgb=((pixels[row+(x>>3)]>>(7-(x&7)))&1)?[0,0,0]:[255,255,255];
      else throw new Error(`Unsupported depth ${depth}`);
      png.data[index]=rgb[0];png.data[index+1]=rgb[1];png.data[index+2]=rgb[2];
      png.data[index+3]=hasAlpha?pixels[row+(isRaw?x*4:x)]:rgb.every(v=>v===255)&&!names.has(name)?0:255;
    }
    const path=`media/Design/${cast}/${String(slots.indexOf(member.id)+1).padStart(4,'0')}-${name.replace(/[^a-zA-Z0-9_-]/g,'_')||'unnamed'}.png`;
    fs.mkdirSync(`${root}/media/Design/${cast}`,{recursive:true});const output=PNG.sync.write(png);fs.writeFileSync(`${root}/${path}`,output);
    recovered.push({key:`${cast}:${slots.indexOf(member.id)+1}`,name,rawName,path,width,height,regX,regY,depth,stride,paletteId,paletteRule:paletteId===-3?'Director built-in grayscale (0 white,255 black)':'cast custom CLUT or Windows palette',castSlot:slots.indexOf(member.id)+1,memberId:member.id,chunkId:key.sectionID,source,sourceSHA256,bitdSHA256:digest(raw),pngSHA256:digest(output),alpha:hasAlpha?'populated-original':names.has(name)?'opaque':'white-matte',encoding:isRaw?'raw':'packbits'});
  }
  director.destroy();
}
for(const info of texts.filter(t=>/^Font\d+FontInfo$/.test(t.name))){
  const cast=info.name.replace('FontInfo',''), entries=recovered.filter(r=>r.source===info.source), first=/firstMember:\s*"([^"]+)"/.exec(info.text)?.[1], firstSlot=entries.find(r=>r.name===first)?.castSlot;
  const property=(name)=>{const content=new RegExp(`#${name}:\\s*\\[([^\\]]*)\\]`).exec(info.text)?.[1]??'';return Object.fromEntries([...content.matchAll(/(\d+):\s*(-?\d+(?:\.\d+)?)/g)].map(m=>[m[1],Number(m[2])]));};
  const offsets=property('MemberOffsets'),kerning={};
  const kernText=info.text.slice(info.text.indexOf('#Kern:'));
  for(const match of kernText.matchAll(/(\d+):\s*\[([^\]]*)\]/g))kerning[match[1]]=Object.fromEntries([...match[2].matchAll(/(\d+):\s*(-?\d+(?:\.\d+)?)/g)].map(m=>[m[1],Number(m[2])]));
  const glyphs=Object.fromEntries(Object.entries(offsets).map(([code,offset])=>[code,offset<0?null:entries.find(r=>r.castSlot===firstSlot+offset)?.key??null]));
  const used=entries.filter(e=>Object.values(glyphs).includes(e.key)),atlasWidth=1024,placements=[];let x=1,y=1,rowHeight=0;
  for(const e of used){if(x+e.width+1>atlasWidth){x=1;y+=rowHeight+2;rowHeight=0;}placements.push({e,x,y});x+=e.width+2;rowHeight=Math.max(rowHeight,e.height);}
  const atlasHeight=y+rowHeight+1,atlas=new PNG({width:atlasWidth,height:atlasHeight});
  const glyphRects={};for(const p of placements){const image=PNG.sync.read(fs.readFileSync(`${root}/${p.e.path}`));PNG.bitblt(image,atlas,0,0,p.e.width,p.e.height,p.x,p.y);glyphRects[p.e.key]={sourceRect:[p.x,p.y,p.e.width,p.e.height],width:p.e.width,height:p.e.height,regX:p.e.regX,regY:p.e.regY,castSlot:p.e.castSlot,memberId:p.e.memberId};}
  const atlasPath=`media/Design/${cast}/atlas.png`,atlasBytes=PNG.sync.write(atlas);fs.writeFileSync(`${root}/${atlasPath}`,atlasBytes);
  fonts.push({id:cast,firstMember:first,firstSlot,widths:property('Widths'),kerning,replace:property('Replace'),memberOffsets:offsets,glyphs,glyphRects,atlas:{path:atlasPath,width:atlasWidth,height:atlasHeight,sha256:digest(atlasBytes)},charSpace:Number(/#CharSpace:\s*([\d.]+)/.exec(info.text)?.[1]??0.1),stats:property('Stats'),rawMetrics:info.text});
}
const replacementsText=texts.find(t=>t.name==='CharReplacements')?.text??'';
const charReplacements=Object.fromEntries(replacementsText.split('\r').filter(s=>s.length>1).map(s=>[s.charCodeAt(0),[...s.slice(1)].map(c=>c.charCodeAt(0))]));
fs.writeFileSync(`${root}/design-assets-evidence.json`,JSON.stringify({schemaVersion:1,rule:'Source bound BITD PackBits/channel planes or raw interleaved; preserve populated alpha; otherwise white matte for glyphs/poses/icons and opaque cover background/effects; MacRoman cast names normalized to Unicode.',recovered,texts,palettes,fonts,charReplacements,paletteDirection:'Director grayscale uses index0 white to index255 black. SepiaPalette shares this direction.',spacingRule:'advance(left,right) = Widths[left] + integer(CharSpace) - Kern[left][right]; source glyph = firstMember slot + MemberOffsets[code]. Space offset -1 has no image.',logoRule:'createLogo defaults scale0.65 times element extraScale; fits width280; overrides render CharSpace10; shadow pass offset(4,4).'},null,2));
console.log(`Recovered ${recovered.length} bitmaps, ${fonts.length} fonts, ${texts.length} text members, ${palettes.length} palettes.`);

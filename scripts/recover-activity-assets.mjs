import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { DirectorFile } from 'file:///C:/Users/blink/AppData/Local/Temp/rock-manager-director-tools/node_modules/projectorrays/dist/pkg/node.es.js';

const root = 'analysis/original';
const windowsPalette = JSON.parse(fs.readFileSync(`${root}/director-windows-palette.json`)).rgb;
const mac = new TextDecoder('macintosh');
const normalized = (name) => mac.decode(Buffer.from(name, 'latin1'));
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const recovered = [], texts = [], palettes = [], fonts = [], formatting = [];
const names = new Set(['background01','moves_0001','moves_0003','moves_0063']);
for (const table of [JSON.parse(fs.readFileSync(`${root}/data/DataDBRest00.json`)).data.Action, JSON.parse(fs.readFileSync(`${root}/data/DataActionCategories00.json`)).data.ActionCategory]) for(const name of table.Gfx??[]) if(name)names.add(name);
for (const name of ['frame_cdcover01','agenda_background01','agenda_slider_arrows01Left','agenda_slider_arrows01Right','agenda_slider_arrows01','agenda_slider_background01','tmpCD_frame','icon_cd02','image_release01_small01']) names.add(name);
names.add('BehindScrollerPic');
names.add('Paper01');
names.add('MusicianStatsIcons');
for(const gfx of JSON.parse(fs.readFileSync(`${root}/data/DataDBRest00.json`)).data.Action.Gfx??[]) if(gfx) names.add('image_'+gfx+'_small01');
names.add('paper01');
for(let i=0;i<=10;i++)names.add(`meter_stars${String(i).padStart(2,'0')}`);
for(const name of ['slider03_2_1','slider03_2_2','slider03_2_3'])names.add(name);
for(const name of JSON.parse(fs.readFileSync(`${root}/data/DataBuildings00.json`)).data.media.ChartPic??[])if(name)names.add(name);
names.add('playlist01_highlight');
for (const name of ['slider02_1_1','slider02_1_2','slider02_1_3']) names.add(name);
for (const name of ['slider03_1_1','slider03_1_2','slider03_1_3','slider02_2_1','slider02_2_2','slider02_2_3','icon_megaphone02','frame02 large environment']) names.add(name);
const sources = ['E:/Games/Rock Manager/RockMaterial.cxt','E:/Games/Rock Manager/RockUtil.cxt','V:/Movies/Main.dxr','V:/Movies/VeryGeneral.cxt','V:/Movies/media02.cxt','V:/Movies/Media03.cxt','V:/Movies/media04.cxt','V:/Movies/media05.cxt'];
// Poses are in RockMaterial, but also search actor casts for linked candidates.
const actors = [];
for (const source of sources) {
  const bytes=fs.readFileSync(source), sourceSHA256=digest(bytes), director=await DirectorFile.readFromPath(source);
  const chunks=director.dumpJSON(), keys=chunks.find(c=>c.fourCC==='KEY*').data.entries, slots=chunks.find(c=>c.fourCC==='CAS*')?.data.memberIDs ?? [];
  const font=/Font\d+\.cxt$/i.test(source), cast=source.split('/').at(-1).replace(/\.\w+$/,'');
  const chunk=(type,id)=>Buffer.from(director.getChunk(type,id).data);
  for(const member of chunks.filter(c=>c.fourCC==='CASt'&&c.data.type===15)) {
    const name=normalized(member.data.info.name);
    if(!/^(Gift|Media|MediaAd|LiveInfo[12]|Headline|MediaChart|MediaChartHeadline)Formatting$|^ScrollItem(Category|CategoryThin|Right)?Field$/.test(name))continue;
    const key=keys.find(k=>k.castID===member.id&&k.fourCC==='XMED');if(!key)continue;
    const raw=chunk('XMED',key.sectionID);
    const fontNames=[...new Set([...raw.toString('latin1').matchAll(/Arial|Verdana|Courier New|Times New Roman/g)].map(m=>m[0]))];
    formatting.push({name,source,sourceSHA256,memberId:member.id,chunkId:key.sectionID,sha256:digest(raw),bytes:raw.length,payloadBase64:raw.toString('base64'),fontNames,
      limitation:'Font names are present in the XMED font table; active rich-text runs, sizes and line spacing have not been decoded. Do not infer active font from table presence alone.'});
  }
  for(const member of chunks.filter(c=>c.fourCC==='CASt'&&c.data.type===3)) {
    const name=normalized(member.data.info.name), key=keys.find(k=>k.castID===member.id&&k.fourCC==='STXT');
    if(!key || !(font || /^Dlg.*Data$|Rock.*Style|.*Formatting/.test(name)))continue;
    const raw=chunk('STXT',key.sectionID), text=raw.subarray(12,12+raw.readUInt32BE(4)).toString('latin1');
    texts.push({name,text,source,sourceSHA256,memberId:member.id,chunkId:key.sectionID});
  }
  let castPalette=windowsPalette;
  const customPalettes=new Map();
  for(const key of keys.filter(k=>k.fourCC==='CLUT')) {
    const raw=chunk('CLUT',key.sectionID), owner=chunks.find(c=>c.fourCC==='CASt'&&c.id===key.castID), name=normalized(owner?.data.info?.name??'');
    const rgb=Array.from({length:raw.length/6},(_,i)=>[raw[i*6],raw[i*6+2],raw[i*6+4]]).flat();
    customPalettes.set(slots.indexOf(key.castID)+1,rgb);
    if(font||/Actor|Media/i.test(cast))castPalette=rgb;
    if(name==='SepiaPalette')palettes.push({name,rgb,source,sourceSHA256,chunkId:key.sectionID});
  }
  const seen=new Set();
  for(const member of chunks.filter(c=>c.fourCC==='CASt'&&c.data.type===1).sort((a,b)=>slots.indexOf(a.id)-slots.indexOf(b.id))) {
    const name=normalized(member.data.info.name), rawName=member.data.info.name;
    if(!font && !names.has(name) && !/^(live0[1-4]_.*|media0[2-5]_environment.*|image_(live|media).*|icon_.*|frame0[12]|portrait_frame.*|Rock.*Edge.*|background_paper.*|ColorPic|Dummy)$/i.test(name))continue;
    if(seen.has(name))continue;seen.add(name);
    const key=keys.find(k=>k.castID===member.id&&k.fourCC==='BITD');if(!key)continue;
    const rawCast=chunk('CASt',member.id), h=rawCast.subarray(12+rawCast.readUInt32BE(4));
    const width=h.readUInt16BE(8),height=h.readUInt16BE(6),depth=h[23],stride=h.readUInt16BE(0)&0x7fff,regX=h.readInt16BE(20),regY=h.readInt16BE(18);
    const paletteId=h.length>=28?h.readInt16BE(26)-1:0;
    // Director built-in palette -3 is grayscale, index0 white/index255 black.
    // Bitmap-specific reference takes precedence over movie Windows palette.
    const bitmapPalette=paletteId===-3?Array.from({length:256},(_,i)=>[255-i,255-i,255-i]).flat():customPalettes.get(paletteId+1)??castPalette;
    if(!width||!height)continue;
    const raw=chunk('BITD',key.sectionID),isRaw=raw.length===stride*height;
    let pixels=raw;
    if(!isRaw){const decoded=[];for(let o=0;o<raw.length;){const count=raw[o++];if(count<128)for(let i=0;i<=count;i++)decoded.push(raw[o++]);else if(count>128){const value=raw[o++];for(let i=0;i<257-count;i++)decoded.push(value);}}pixels=Buffer.from(decoded);}
    if(pixels.length!==stride*height)throw new Error(`BITD size mismatch ${cast}/${name}`);
    const png=new PNG({width,height});
    // WndAPI createWnd copies native surround edges with ink36 (white matte),
    // including 32-bit members whose unused/stored alpha is entirely opaque.
    // RockFrame1Style explicitly requests Depth8, Alpha0. Source-white corners
    // must therefore be keyed even when the BITD alpha plane is populated.
    const edgeWhiteMatte=/^Rock(?:Frame[12]|Srnd|Dialog|Button(?:Dark)?)Edge/.test(name) || name === 'MusicianStatsIcons';
    let hasAlpha=false;if(depth===32)for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[y*stride+(isRaw?x*4:x)]!==0)hasAlpha=true;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const row=y*stride,index=(y*width+x)*4;let rgb;
      if(depth===32)rgb=isRaw?[...pixels.subarray(row+x*4+1,row+x*4+4)]:[pixels[row+width+x],pixels[row+width*2+x],pixels[row+width*3+x]];
      else if(depth===16){const v=isRaw?pixels.readUInt16BE(row+x*2):(pixels[row+x]<<8)|pixels[row+width+x];rgb=[(v>>10)&31,(v>>5)&31,v&31].map(v=>Math.floor(v*255/31));}
      else if(depth===8)rgb=bitmapPalette.slice(pixels[row+x]*3,pixels[row+x]*3+3);
      else if(depth===1)rgb=((pixels[row+(x>>3)]>>(7-(x&7)))&1)?[0,0,0]:[255,255,255];
      else throw new Error(`Unsupported depth ${depth}`);
      png.data[index]=rgb[0];png.data[index+1]=rgb[1];png.data[index+2]=rgb[2];
      png.data[index+3]=edgeWhiteMatte&&rgb.every(v=>v===255)?0:hasAlpha?pixels[row+(isRaw?x*4:x)]:rgb.every(v=>v===255)&&!/_environment|background01$|feedback_background/i.test(name)?0:255;
    }
    const path=`media/Activities/${cast}/${String(slots.indexOf(member.id)+1).padStart(4,'0')}-${name.replace(/[^a-zA-Z0-9_-]/g,'_')||'unnamed'}.png`;
    fs.mkdirSync(`${root}/media/Activities/${cast}`,{recursive:true});const output=PNG.sync.write(png);fs.writeFileSync(`${root}/${path}`,output);
    recovered.push({key:`${cast}:${slots.indexOf(member.id)+1}`,name,rawName,path,width,height,regX,regY,depth,stride,paletteId,paletteRule:paletteId===-3?'Director built-in grayscale (0 white,255 black)':customPalettes.has(paletteId+1)?`custom CLUT at cast slot ${paletteId+1}`:'cast custom CLUT or Windows palette',castSlot:slots.indexOf(member.id)+1,memberId:member.id,chunkId:key.sectionID,source,sourceSHA256,bitdSHA256:digest(raw),pngSHA256:digest(output),alpha:edgeWhiteMatte?(name === 'MusicianStatsIcons' ? 'DlgRehearsal01ArtistScript.showStats copyPixels ink36 white matte' : 'WndAPI createWnd ink36 white-matte, preserving other original alpha'):hasAlpha?'populated-original':/_environment|background01$|feedback_background/i.test(name)?'opaque':'white-matte',encoding:isRaw?'raw':'packbits'});
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
  const atlasPath=`media/Activities/${cast}/atlas.png`,atlasBytes=PNG.sync.write(atlas);fs.writeFileSync(`${root}/${atlasPath}`,atlasBytes);
  fonts.push({id:cast,firstMember:first,firstSlot,widths:property('Widths'),kerning,replace:property('Replace'),memberOffsets:offsets,glyphs,glyphRects,atlas:{path:atlasPath,width:atlasWidth,height:atlasHeight,sha256:digest(atlasBytes)},charSpace:Number(/#CharSpace:\s*([\d.]+)/.exec(info.text)?.[1]??0.1),stats:property('Stats'),rawMetrics:info.text});
}
const replacementsText=texts.find(t=>t.name==='CharReplacements')?.text??'';
const charReplacements=Object.fromEntries(replacementsText.split('\r').filter(s=>s.length>1).map(s=>[s.charCodeAt(0),[...s.slice(1)].map(c=>c.charCodeAt(0))]));
const composites=[];
for(const id of ['Media02','Media03','Media04','Media05']) {
  const background=recovered.find(e=>e.source.toLowerCase().endsWith(`/${id.toLowerCase()}.cxt`)&&e.name==='background01'),body=recovered.find(e=>e.source===background?.source&&e.name==='moves_0003');
  if(!background||!body)continue;
  const destination=PNG.sync.read(fs.readFileSync(`${root}/${background.path}`)),image=PNG.sync.read(fs.readFileSync(`${root}/${body.path}`));
  const dx=background.regX-body.regX,dy=background.regY-body.regY;
  for(let y=0;y<body.height;y++)for(let x=0;x<body.width;x++){
    const tx=x+dx,ty=y+dy;if(tx<0||ty<0||tx>=destination.width||ty>=destination.height)continue;
    const si=(y*body.width+x)*4,di=(ty*destination.width+tx)*4,a=image.data[si+3]/255;
    for(let c=0;c<3;c++)destination.data[di+c]=Math.round(image.data[si+c]*a+destination.data[di+c]*(1-a));destination.data[di+3]=255;
  }
  const path=`media/Activities/${id.toLowerCase()}/neutral-composite.png`,output=PNG.sync.write(destination);fs.writeFileSync(`${root}/${path}`,output);
  composites.push({key:`${id.toLowerCase()}-neutral`,name:`${id.toLowerCase()}-neutral`,path,width:destination.width,height:destination.height,sha256:digest(output),source:background.source,sourceSHA256:background.sourceSHA256,layers:[{key:background.key,offset:[0,0]},{key:body.key,offset:[dx,dy]}],rule:'CPshowFace LeftTop adds background regPoint; FaceScript setPos1 selects first moves member+2 body (moves_0003). Normal mouth2 uses Dummy. Eyes2 uses moves_0063, zero-dimension empty CASt with no BITD, so omitted. All layers share source registration anchor.'});
}
fs.writeFileSync(`${root}/activity-assets-evidence.json`,JSON.stringify({schemaVersion:1,rule:'Source bound BITD PackBits/channel planes or raw interleaved; surround edges always apply source WndAPI createWnd ink36 white matte, preserving other alpha. Other assets preserve populated alpha; otherwise white matte for actors/icons and opaque environment backgrounds. Bitmap palette reference selects exact CLUT cast slot or built-in grayscale.',recovered,texts,formatting,palettes,composites},null,2));
console.log(`Recovered ${recovered.length} bitmaps, ${fonts.length} fonts, ${texts.length} text members, ${palettes.length} palettes.`);

const tables={},sourceRecords=[];
const atRow=(column,index)=>Array.isArray(column)?column[index]:column&&typeof column==='object'?Object.fromEntries(Object.entries(column).map(([k,v])=>[k,atRow(v,index)]).filter(([,v])=>v!==undefined)):column;
for(const [filename,selected] of [
  ['DataBuildings00',['Live','media']],['DataHumans00',['Human','Reporter']],['DataActionCategories00',['ActionCategory']],
  ['DataMediaActivities00',['MediaActivity']],['DataMediaEvents00',['ExpoAd']],['DataMediaTargets00',['MediaTarget']],
  ['DataDBRest00',['Action']],['DataDialogs00',['Dialog']],['DataAudience00',['Group']],['DataAgendaFormat00',['AgendaEventFormat']],
]){
  const document=JSON.parse(fs.readFileSync(`${root}/data/${filename}.json`));
  const original=fs.readFileSync(document.source);
  if(digest(original)!==document.sha256)throw new Error(`Changed original data ${filename}`);
  sourceRecords.push({file:filename,source:document.source,sourceSHA256:document.sha256,decodedPayloadStart:document.payloadStart,decodedPayloadEnd:document.payloadEnd,method:document.method});
  for(const tableName of selected){const columns=document.data[tableName];if(!columns?.ID)continue;tables[tableName]=columns.ID.map((id,index)=>({...atRow(columns,index),source:document.source,sourceSHA256:document.sha256,rowIndex:index}));}
}
fs.writeFileSync(`${root}/activity-rules-evidence.json`,JSON.stringify({schemaVersion:1,rule:'Columnar recovered vList data converted to rows recursively without numeric coercion or formula interpretation. Source SHA256 checked against mounted originals. All field values retained; original empty columns omit absent fields.',sources:sourceRecords,tables},null,2));

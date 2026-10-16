import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { DirectorFile } from 'file:///C:/Users/blink/AppData/Local/Temp/rock-manager-director-tools/node_modules/projectorrays/dist/pkg/node.es.js';

const root = 'analysis/original';
const introOnly=process.argv.includes('--intro');
const additional = introOnly||process.argv.includes('--additional');
const decodedLayers=new Map(),emptyBackgrounds=new Map();
const prior = additional ? JSON.parse(fs.readFileSync(`${root}/actor-animation-evidence.json`)) : null;
const windowsPalette = JSON.parse(fs.readFileSync(`${root}/director-windows-palette.json`)).rgb;
const mac = new TextDecoder('macintosh');
const normalized = (name) => mac.decode(Buffer.from(name, 'latin1'));
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function backgroundTransparentInk(png) {
  // RenderMusicianScript.X uses ink36, not ink8. White is keyed everywhere,
  // including islands enclosed by eyes/mouth/body; the lower layer shows through.
  let removed=0;
  for(let i=0;i<png.data.length;i+=4) {
    if(png.data[i]===255&&png.data[i+1]===255&&png.data[i+2]===255) {
      if(png.data[i+3])removed++;
      png.data[i+3]=0;
    }
  }
  return removed;
}
const recovered = additional ? [...prior.recovered] : [], texts = [], palettes = [], fonts = [], formatting = [];
const actors = [];
const musicianTable=JSON.parse(fs.readFileSync(root+'/data/DataMusicians00.json')).data.RealMusician;
const musicians=additional ? musicianTable.ID.map((ID,i)=>({ID,Gfx:musicianTable.Gfx[i]})) : JSON.parse(fs.readFileSync(root+'/data/mission01-recovered.json')).availableMusicians;
const sources = introOnly ? ['mission03_globalboss02','mission03_brother01','mission03_brother02','mission04_gangsta02','mission05_guitarist01','mission05_singer01','mission06_nicke01','mission06_nicke02','mission07_spacecadet_roy01','mission07_spacecadet_lina01'].filter(id=>!prior.portraits.some(p=>p.id===id)).map(id=>'V:/Movies/'+id+'.cxt') : additional ? ['E:/Games/Rock Manager/city01.cxt',...musicians.filter(m=>!prior.portraits.some(p=>p.id===m.Gfx.toLowerCase())).map(m=>'E:/Games/Rock Manager/Actor'+m.Gfx.slice(-2)+'.cxt'),...['Media01','Gangsta01','ECcourt01'].filter(id=>!prior.portraits.some(p=>p.id===id.toLowerCase())).map(id=>['E:/Games/Rock Manager/'+id+'.cxt','V:/Movies/'+id+'.cxt'].find(path=>fs.existsSync(path))).filter(Boolean)]
  : ['E:/Games/Rock Manager/RockMaterial.cxt','V:/Movies/city01.cxt','V:/Movies/media02.cxt','V:/Movies/Media03.cxt','V:/Movies/media04.cxt','V:/Movies/media05.cxt',...Array.from({length:4},(_,i)=>'V:/Movies/Record0'+(i+1)+'.cxt'),...musicians.map(m=>'V:/Movies/Actor'+m.Gfx.slice(-2)+'.cxt')];
const names = new Set(['background01']);
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
    const staticPortrait=musicians.some(m=>new RegExp(`^(Portrait_${m.Gfx}_(?:Angry|Annoyed|Bored|Happy|normal|Sad|Satisfied)_(?:Large|Medium)|portrait_${m.Gfx}_small|${m.Gfx}_background_(?:large|medium|small))$`,'i').test(name));
    if(name!=='background01' && !/^moves(?:01)?_00(?:[0-6][0-9]|70)$/.test(name)&&!staticPortrait)continue;
    if(seen.has(name))continue;seen.add(name);
    if(introOnly&&name==='background01'){
      const raw=chunk('CASt',member.id),header=raw.subarray(12+raw.readUInt32BE(4));
      if(!header.readUInt16BE(8)||!header.readUInt16BE(6)){
        // Brother02 uses a zero-sized transparent background. Its score
        // sprite has a314x210 canvas; keep the original registration.
        emptyBackgrounds.set(source,{width:314,height:210,regX:header.readInt16BE(20),regY:header.readInt16BE(18),sourceSHA256,nativeWidth:0,nativeHeight:0});continue;
      }
    }
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
    const edgeWhiteMatte=/^Rock(?:Frame[12]|Srnd|Dialog|Button(?:Dark)?)Edge/.test(name);
    let hasAlpha=false;if(depth===32)for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[y*stride+(isRaw?x*4:x)]!==0)hasAlpha=true;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const row=y*stride,index=(y*width+x)*4;let rgb;
      if(depth===32)rgb=isRaw?[...pixels.subarray(row+x*4+1,row+x*4+4)]:[pixels[row+width+x],pixels[row+width*2+x],pixels[row+width*3+x]];
      else if(depth===16){const v=isRaw?pixels.readUInt16BE(row+x*2):(pixels[row+x]<<8)|pixels[row+width+x];rgb=[(v>>10)&31,(v>>5)&31,v&31].map(v=>Math.floor(v*255/31));}
      else if(depth===8)rgb=bitmapPalette.slice(pixels[row+x]*3,pixels[row+x]*3+3);
      else if(depth===1)rgb=((pixels[row+(x>>3)]>>(7-(x&7)))&1)?[0,0,0]:[255,255,255];
      else throw new Error(`Unsupported depth ${depth}`);
      png.data[index]=rgb[0];png.data[index+1]=rgb[1];png.data[index+2]=rgb[2];
      png.data[index+3]=(h[22]&0x10)&&hasAlpha?pixels[row+(isRaw?x*4:x)]:255;
    }
    const alphaFlag=h[22],activeMemberAlpha=(alphaFlag&0x10)!==0;
    const mattePixelsRemoved=(name==='background01'||/^moves/i.test(name))?backgroundTransparentInk(png):0;
    const path=`media/ActorAnimation/${cast}/${String(slots.indexOf(member.id)+1).padStart(4,'0')}-${name.replace(/[^a-zA-Z0-9_-]/g,'_')||'unnamed'}.png`;
    const output=PNG.sync.write(png);
    if(introOnly)decodedLayers.set(path,png);else{fs.mkdirSync(`${root}/media/ActorAnimation/${cast}`,{recursive:true});fs.writeFileSync(`${root}/${path}`,output);}
    recovered.push({key:`${cast}:${slots.indexOf(member.id)+1}`,name,rawName,path,width,height,regX,regY,depth,stride,paletteId,alphaFlag,activeMemberAlpha,mattePixelsRemoved,matteRule:staticPortrait?'Original static portrait preserved; unused alpha ignored':'Source RenderMusicianScript.X ink36: every exactwhite pixel transparent, including enclosed islands; enabled member alpha retained for nonwhite pixels',paletteRule:paletteId===-3?'Director built-in grayscale (0 white,255 black)':customPalettes.has(paletteId+1)?`custom CLUT at cast slot ${paletteId+1}`:'cast custom CLUT or Windows palette',castSlot:slots.indexOf(member.id)+1,memberId:member.id,chunkId:key.sectionID,source,sourceSHA256,bitdSHA256:digest(raw),pngSHA256:digest(output),alpha:mattePixelsRemoved?'source ink36 white color-key with original enabled alpha':activeMemberAlpha&&hasAlpha?'enabled-original-alpha':'opaque RGB; unused stored alpha ignored',encoding:isRaw?'raw':'packbits'});
  }
  director.destroy();
}
const portraits=additional ? [...prior.portraits] : [];
for(const source of sources.filter(s=>/(?:Actor\d+|Record\d+|Media\d+|Gangsta\d+|ECcourt\d+|mission0[3-8]_(?:globalboss02|brother0[12]|gangsta02|guitarist01|singer01|nicke0[12]|spacecadet_(?:roy|lina)01))\.cxt$/i.test(s))){
  const frames=recovered.filter(r=>r.source===source);
  if(introOnly&&!frames.some(r=>r.name==='background01')&&!emptyBackgrounds.has(source)){
    const id=source.split('/').at(-1).replace(/\.cxt$/i,'');
    const scene=JSON.parse(fs.readFileSync(root+'/mission34-assets.json')).sequence.find(s=>s.parameters.includes('"'+id+'"'));
    if(scene?.nativeDimensions&&scene.nativeRegistration)emptyBackgrounds.set(source,{width:scene.nativeDimensions[0],height:scene.nativeDimensions[1],regX:scene.nativeRegistration[0],regY:scene.nativeRegistration[1],sourceSHA256:digest(fs.readFileSync(source)),nativeWidth:0,nativeHeight:0});
  }
  const background=frames.find(r=>r.name==='background01')??emptyBackgrounds.get(source);
  if(!background)throw new Error(`No actor background ${source}`);
  const id=source.split('/').at(-1).replace(/\.cxt$/i,'').toLowerCase(),atlasWidth=1024,placements=[];let x=1,y=1,rowHeight=0;
  for(const e of frames){if(x+e.width+1>atlasWidth){x=1;y+=rowHeight+2;rowHeight=0;}placements.push({e,x,y});x+=e.width+2;rowHeight=Math.max(rowHeight,e.height);}
  const atlasHeight=y+rowHeight+1,atlas=new PNG({width:atlasWidth,height:atlasHeight}),atlasFrames={};
  for(const p of placements){const image=decodedLayers.get(p.e.path)??PNG.sync.read(fs.readFileSync(`${root}/${p.e.path}`));PNG.bitblt(image,atlas,0,0,p.e.width,p.e.height,p.x,p.y);atlasFrames[p.e.name]={sourceRect:[p.x,p.y,p.e.width,p.e.height],width:p.e.width,height:p.e.height,regX:p.e.regX,regY:p.e.regY,castSlot:p.e.castSlot,sourceSHA256:p.e.sourceSHA256};}
  const path=`media/ActorAnimation/${id}-atlas.png`,bytes=PNG.sync.write(atlas);fs.writeFileSync(`${root}/${path}`,bytes);
  portraits.push({id,kind:id.startsWith('mission')||id.startsWith('media')||id.startsWith('gangsta')||id.startsWith('eccourt')?'media':id.startsWith('record')?'label':'musician',atlas:{path,width:atlasWidth,height:atlasHeight,textureKey:`actor-atlas-${id}`,sha256:digest(bytes)},background:'background01',width:background.width,height:background.height,anchor:[background.regX,background.regY],frames:atlasFrames,source,sourceSHA256:background.sourceSHA256,...(emptyBackgrounds.has(source)?{transparentBackground:emptyBackgrounds.get(source)}:{})});
}
// Original CPshowFace normal pose1: background,body3,eyes63; mouth2 isDummy.
// Retain full registered office compositions for source LargePic human cards.
for(const portrait of portraits.filter(p=>!introOnly&&p.kind!=='musician')){
  const entries=recovered.filter(e=>e.source===portrait.source),background=entries.find(e=>e.name==='background01');
  if(!background)continue;
  const output=new PNG({width:background.width,height:background.height});
  const layers=['background01','moves_0003','moves_0063'].map(name=>entries.find(e=>e.name===name||e.name===name.replace('moves_','moves01_'))).filter(Boolean);
  for(const entry of layers){const image=PNG.sync.read(fs.readFileSync(`${root}/${entry.path}`)),dx=background.regX-entry.regX,dy=background.regY-entry.regY;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const tx=x+dx,ty=y+dy;if(tx<0||ty<0||tx>=output.width||ty>=output.height)continue;
      const si=(y*image.width+x)*4,di=(ty*output.width+tx)*4,a=image.data[si+3]/255,b=output.data[di+3]/255,alpha=a+b*(1-a);if(!alpha)continue;
      for(let c=0;c<3;c++)output.data[di+c]=Math.round((image.data[si+c]*a+output.data[di+c]*b*(1-a))/alpha);output.data[di+3]=Math.round(alpha*255);
    }
  }
  const path=`media/ActorAnimation/${portrait.id}-neutral-scene.png`,bytes=PNG.sync.write(output);fs.writeFileSync(`${root}/${path}`,bytes);
  portrait.neutralScene={path,textureKey:`actor-scene-${portrait.id}-normal`,width:output.width,height:output.height,regX:background.regX,regY:background.regY,pngSHA256:digest(bytes),layers:layers.map(e=>({name:e.name,memberId:e.memberId,regX:e.regX,regY:e.regY,sourceSHA256:e.sourceSHA256})),rule:'Source CPshowFace normal pose1: body3 eyes63 mouth2Dummy; white-key ink36 layers at backgroundReg-layerReg'};
}
const feedback=JSON.parse(fs.readFileSync(`${root}/feedback-audio-evidence.json`));
const cues=Object.assign({},...feedback.lipSync.map(s=>s.entries));
let introCueSource;
if(introOnly){
  const source='V:/Sound/Voice/_intAll.cue',bytes=fs.readFileSync(source);
  for(const match of bytes.toString('latin1').matchAll(/^(intro0[3-8]_\w+):\s*(\[[\d, ]*\])/gim))cues[match[1].toLowerCase()]=JSON.parse(match[2]);
  introCueSource={source,sha256:digest(bytes),keys:Object.keys(cues).filter(k=>/^intro0[3-8]_/.test(k)),cueRateHz:12};
}

const staticPortraits=recovered.flatMap(entry=>{
  const actorId=/actor\d+/i.exec(entry.name)?.[0].toLowerCase(),musician=musicians.find(m=>m.Gfx.toLowerCase()===actorId);
  if(!musician||/^moves_|background01$/i.test(entry.name))return [];
  const size=/(large|medium|small)$/i.exec(entry.name)?.[1].toLowerCase();if(!size)return [];
  const mood=/_background_/i.test(entry.name)?'occupied':size==='small'?'independent':/_([^_]+)_(large|medium)$/i.exec(entry.name)?.[1].toLowerCase();
  if(!mood)return [];
  return [{musicianId:musician.ID,actorId,mood,size,name:entry.name,path:entry.path,textureKey:`actor-static-${actorId}-${mood}-${size}`,width:entry.width,height:entry.height,regX:entry.regX,regY:entry.regY,source:entry.source,sourceSHA256:entry.sourceSHA256,memberId:entry.memberId,chunkId:entry.chunkId,pngSHA256:entry.pngSHA256,alphaFlag:entry.alphaFlag}];
});
fs.writeFileSync(`${root}/actor-animation-evidence.json`,JSON.stringify({schemaVersion:1,...(introCueSource?{introCueSource}:prior?.introCueSource?{introCueSource:prior.introCueSource}:{}),portraits,staticPortraits:[...new Map(staticPortraits.map(p=>[p.textureKey,p])).values()],staticPortraitRule:{source:"ClassRealMusicianScript.getCurrentPic / MusicianPortaitScript.redraw",hudSize:"medium",defaultSize:"large",smallMoodIndependent:true,furiousFallback:"angry",occupied:"actorNN_background_size",alpha:"Use member enabled-alpha flag; unused stored alpha plane ignored; source live FaceAnim ink36 keys every exactwhite pixel in all animation layers, including backdrop and enclosed areas"},recovered:[...new Map(recovered.filter(r=>!decodedLayers.has(r.path)).map(r=>[r.key,r])).values()],cues:{...prior?.cues,...cues},cueRateHz:12,moodStates:{Furious:{eyes:0,mouth:3},Angry:{eyes:0,mouth:3},Annoyed:{eyes:0,mouth:2},normal:{eyes:2,mouth:2},Satisfied:{eyes:2,mouth:1},Happy:{eyes:2,mouth:0},Sad:{eyes:4,mouth:3},Cool:{eyes:0,mouth:2},Superior:{eyes:3,mouth:1},Bored:{eyes:2,mouth:3},Apologetic:{eyes:3,mouth:1},Malicious:{eyes:0,mouth:0}},componentLimitation:'Initial component follows pose1 and retained12Hz cue samples; full original body transitions and frameTimer-dependent mouth-alternation cadence remain unimplemented.',rules:{source:'RockUtil 00066-FaceScript / 00067-CueScript / 00096-unnamed CPshowFace',cueIndex:'floor(positionSeconds*12), original cues are0..100 values',pose1:'body moves_0003; eyes moves_(0061+eyesState); idle mouth2 is Dummy, otherwise moves_(0001+mouthState)',talkingMouth:'mouthBaseFrame=firstMember+4; mouth index round(cue/33), original alternating middle cue uses offset0or3 for13..27frames (random15+12); moves_(0005+offset+round(cue/33))',registration:'All layers share background registration anchor; topLeft=portraitTopLeft+backgroundReg-layerReg',coverage:'Retained first70 move layers across6static poses, their mouths and eyes. Continuous body transitions/moving-speech layers beyond70 not reproduced by this initial portrait component.'}},null,2));
console.log(`Recovered ${portraits.length} actor atlases and ${recovered.length} source layers.`);

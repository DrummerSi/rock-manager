import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';

const directory='public/assets',output=directory+'/atlases',manifestPath='src/generated/sprite-atlases.json';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
const limit=2048,padding=2;
const group=key=>/^(actor-static-|portrait-|icon-RMC)/.test(key)?'portraits':/^tour-/.test(key)?'tour':/^(background_mixer|button_(mute|slider|playback|switch)|small_ratt|large_ratt)/.test(key)?'studio':/^(source-window-|mission34-)/.test(key)?'story':/^(city|city-)/.test(key)?'city':'shared';

/** Deterministic, lossless packing. Never rotate, rescale, trim or color-key. */
export function buildSpriteAtlases(){
  fs.mkdirSync(output,{recursive:true});
  const {images}=JSON.parse(fs.readFileSync('src/generated/game-data.json'));
  const byFile=new Map();
  for(const [key,file] of Object.entries(images)){
    if(!byFile.has(file))byFile.set(file,{file,aliases:[]});
    byFile.get(file).aliases.push(key);
  }
  const groups=new Map(),standalone=[],pages=[];
  let sourceBytes=0,packedPixels=0;
  const inputs=[hash(fs.readFileSync(import.meta.filename)),JSON.stringify(images)];
  for(const item of byFile.values()){
    const bytes=fs.readFileSync(path.join(directory,item.file));sourceBytes+=bytes.length;inputs.push(item.file+':'+hash(bytes));
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    // Already-packed actor/font atlases expose subframes to other systems.
    // Large backgrounds remain standalone instead of wasting atlas space.
    // Studio photos use fractional scaling: retain their original texture
    // to avoid changing nearest-neighbor sampling on half-pixel boundaries.
    if(item.aliases.some(k=>/^(actor-atlas-|native-font-|design-font-|studio\d+_environment)/.test(k))||width+padding*2>limit||height+padding*2>limit){
      standalone.push({...item,version:hash(bytes)});continue;
    }
    const name=group(item.aliases[0]);if(!groups.has(name))groups.set(name,[]);
    groups.get(name).push({...item,width,height,bytes});packedPixels+=width*height;
  }
  const inputVersion=hash(Buffer.from(inputs.join('\n')));
  if(fs.existsSync(manifestPath)){
    const previous=JSON.parse(fs.readFileSync(manifestPath));
    if(previous.inputVersion===inputVersion&&previous.pages.every(p=>fs.existsSync(directory+'/'+p.image)&&fs.existsSync(directory+'/'+p.json))){
      console.log(JSON.stringify({...previous.summary,cached:true}));return;
    }
  }
  for(const [name,items] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
    const packed=[];
    items.sort((a,b)=>b.height-a.height||b.width-a.width||a.file.localeCompare(b.file));
    for(const item of items){
      const w=item.width+padding*2,h=item.height+padding*2;
      let page,shelf;
      for(const candidate of packed){
        shelf=candidate.shelves.find(row=>h<=row.height&&row.x+w<=limit);
        if(shelf){page=candidate;break;}
        if(candidate.height+h<=limit){page=candidate;break;}
      }
      if(!page){page={height:0,width:0,shelves:[],items:[]};packed.push(page);}
      if(!shelf){shelf={x:0,y:page.height,height:h};page.shelves.push(shelf);page.height+=h;}
      page.items.push({...item,x:shelf.x+padding,y:shelf.y+padding});shelf.x+=w;page.width=Math.max(page.width,shelf.x);
    }
    for(const [index,page] of packed.entries()){
      const png=new PNG({width:page.width,height:page.height}),frames={},aliases={};
      // pngjs starts transparent. Extrude edge pixels into the padding so
      // adjacent frames cannot bleed when the game canvas is scaled.
      for(const item of page.items){
        const source=PNG.sync.read(item.bytes);
        for(let y=-padding;y<item.height+padding;y++)for(let x=-padding;x<item.width+padding;x++){
          const sx=Math.max(0,Math.min(item.width-1,x)),sy=Math.max(0,Math.min(item.height-1,y));
          source.data.copy(png.data,((item.y+y)*png.width+item.x+x)*4,(sy*source.width+sx)*4,(sy*source.width+sx)*4+4);
        }
        frames[item.file]={frame:{x:item.x,y:item.y,w:item.width,h:item.height},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:item.width,h:item.height},sourceSize:{w:item.width,h:item.height}};
        for(const key of item.aliases)aliases[key]=item.file;
      }
      const bytes=PNG.sync.write(png),stem=name+'-'+String(index).padStart(2,'0'),image=stem+'.png',json=stem+'.json';
      const data=JSON.stringify({frames,meta:{image,size:{w:png.width,h:png.height},scale:'1'}});
      // Stable filenames avoid accumulating obsolete generated pages. Version
      // queries change whenever contents change, including frame metadata.
      const version=hash(Buffer.concat([bytes,Buffer.from(data)]));
      fs.writeFileSync(output+'/'+image,bytes);fs.writeFileSync(output+'/'+json,data);
      pages.push({key:'packed-'+stem,image:'atlases/'+image,json:'atlases/'+json,version,aliases});
    }
  }
  const atlasBytes=pages.reduce((sum,p)=>sum+fs.statSync(directory+'/'+p.image).size+fs.statSync(directory+'/'+p.json).size,0);
  const standaloneBytes=standalone.reduce((sum,p)=>sum+fs.statSync(directory+'/'+p.file).size,0);
  const summary={originalKeys:Object.keys(images).length,uniqueImages:byFile.size,atlasPages:pages.length,standaloneImages:standalone.length,imageRequestsBefore:Object.keys(images).length,imageRequestsAfter:pages.length*2+standalone.length,sourceBytes,bundledBytes:atlasBytes+standaloneBytes,packedPixels};
  fs.writeFileSync(manifestPath,JSON.stringify({inputVersion,pages,standalone,summary}));
  // Only this generator's page files in its own output directory are disposable.
  const current=new Set(pages.flatMap(p=>[path.basename(p.image),path.basename(p.json)]));
  for(const file of fs.readdirSync(output)){
    if(!/^(city|portraits|shared|story|studio|tour)-\d+\.(png|json)$/.test(file)||current.has(file))continue;
    const target=path.resolve(output,file);
    if(path.dirname(target)!==path.resolve(output))throw new Error('Invalid atlas output path');
    fs.unlinkSync(target);
  }
  console.log(JSON.stringify(summary));
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))buildSpriteAtlases();

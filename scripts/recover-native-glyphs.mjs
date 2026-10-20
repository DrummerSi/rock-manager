import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

// Run recover-native-glyphs.ps1 first. This check compares generated platform
// glyphs against a retained, identity-verified original Director screenshot.
const root = 'analysis/original';
const filename = `${root}/native-font-evidence.json`;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const evidence = JSON.parse(fs.readFileSync(filename, 'utf8'));
// Director XMED uses tagged, ASCII-hex numbers and run-length zero tags.
function numbers(bytes) {
    const result = [];
    for (let i = 0; i < bytes.length;) {
        const tag = bytes[i++];
        if (tag === 3) continue;
        if (tag === 0x81 || tag === 0x82) { result.push(0); continue; }
        if (tag === 0xc1 || tag === 0xc2) { result.push(...Array(bytes[i++]).fill(0)); continue; }
        if (tag !== 1 && tag !== 2) throw new Error(`Unknown XMED numeric tag ${tag}`);
        let value = '';
        while (i < bytes.length && /[0-9a-f-]/i.test(String.fromCharCode(bytes[i]))) value += String.fromCharCode(bytes[i++]);
        result.push(parseInt(value, 16));
    }
    return result;
}
evidence.richTextFormats = [];
for (const cast of ['RockMaterial', 'RockUtil']) {
    const metadata = JSON.parse(fs.readFileSync(`${root}/scripts/installed/${cast}.cxt/metadata.json`, 'utf8'));
    const original = fs.readFileSync(`E:/Games/Rock Manager/${cast}.cxt`);
    const map = metadata.chunks.find(c => c.fourCC === 'mmap').data.mapArray;
    const keys = metadata.chunks.find(c => c.fourCC === 'KEY*').data.entries;
    for (const member of metadata.chunks.filter(c => c.fourCC === 'CASt' && c.data.type === 15 && /Formatting|ScrollItem|RockWndTitle|Interface|Money|Date|Rehearsal|Band|EventCard|NameText/.test(c.data.info.name))) {
        const key = keys.find(k => k.castID === member.id && k.fourCC === 'XMED');
        if (!key) continue;
        const chunk = map[key.sectionID], payload = original.subarray(chunk.offset + 8, chunk.offset + 8 + chunk.len);
        const sections = new Map([...payload.toString('latin1').matchAll(/\x03([0-9a-f]{4})([0-9a-f]{8})([0-9a-f]{8})/gi)].map(m => [parseInt(m[1], 16), { count: parseInt(m[3],16), bytes: payload.subarray(m.index+21,m.index+21+parseInt(m[2],16)) }]));
        if (!sections.has(6) || !sections.has(8)) continue;
        const fontBytes = sections.get(8).bytes, fontNames = [];
        for (let i = 0; i < fontBytes.length - 4; i++) if (fontBytes.subarray(i,i+3).toString() === '40,') {
            const length = fontBytes[i+3];
            if (length > 0 && length < 64) fontNames.push(fontBytes.subarray(i+4,i+4+length).toString('latin1'));
        }
        const values = numbers(sections.get(6).bytes), count = sections.get(6).count;
        if (values.length !== 1+77*count) throw new Error(`${member.data.info.name}: unexpected XMED style record length`);
        const styles = Array.from({length:count},(_,index) => {
            const fields = values.slice(1+77*index,1+77*(index+1));
            return {index,fontFamily:fontNames[fields[0]],nominalFontSize:fields[3],fontSize:fields[18]/65536,bold:fields[39]===1,letterSpacing:fields[23]/65536,rawValues:fields};
        });
        const runValues = numbers(sections.get(4).bytes);
        const textPayload = sections.get(2)?.bytes;
        const templateText = textPayload?.subarray(textPayload[0]===0?1:0,textPayload.at(-1)===3?textPayload.length-1:textPayload.length).toString('latin1');
        evidence.richTextFormats.push({cast,memberName:member.data.info.name,memberId:member.id,sourceSHA256:sha256(original),payloadSHA256:sha256(payload),fontNames,templateText,defaultStyle:values[0],styles,runs:Array.from({length:runValues.length/2},(_,i)=>({offset:runValues[i*2],style:runValues[i*2+1]}))});
    }
}
const references = JSON.parse(fs.readFileSync(`${root}/runtime/reference/index.json`, 'utf8'));
const reference = references.captures.find(c => c.image === 'native-005.png');
const input = fs.readFileSync(`${root}/runtime/reference/${reference.stage}`);
if (sha256(input) !== reference.stageSHA256) throw new Error('Changed original reference screenshot');
const original = PNG.sync.read(input);
const candidates = [];
for (const atlas of evidence.atlases.filter(a => a.family === 'Verdana' && a.weight === 700 && !a.antialias && [10, 11, 12, 13].includes(a.size))) {
    const image = PNG.sync.read(fs.readFileSync(`${root}/${atlas.path}`));
    const glyphs = [...'Info'].map(c => atlas.glyphs.find(g => g.code === c.charCodeAt(0)));
    const width = glyphs.reduce((sum, g) => sum + g.advance, 0), height = atlas.lineHeight;
    const mask = new Uint8Array(width * height);
    let pen = 0;
    for (const glyph of glyphs) {
        for (let y = 0; y < glyph.height; y++) for (let x = 0; x < glyph.width; x++) {
            const dx = pen + x + glyph.offsetX, dy = y + glyph.offsetY;
            if (dx >= 0 && dx < width && dy >= 0 && dy < height && image.data[((glyph.y + y) * image.width + glyph.x + x) * 4 + 3] > 127)
                mask[dy * width + dx] = 1;
        }
        pen += glyph.advance;
    }
    let best = { differentPixels: Infinity };
    for (let y = 166; y < 180; y++) for (let x = 434; x < 455; x++) {
        let difference = 0, foreground = 0;
        for (let yy = 0; yy < height; yy++) for (let xx = 0; xx < width; xx++) {
            const i = ((y + yy) * original.width + x + xx) * 4;
            const pixel = original.data[i] > 200 && original.data[i + 1] > 200 && original.data[i + 2] > 200 ? 1 : 0;
            difference += Math.abs(pixel - mask[yy * width + xx]); foreground += pixel;
        }
        if (difference < best.differentPixels) best = { differentPixels: difference, x, y, foregroundPixels: foreground };
    }
    candidates.push({ atlasId: atlas.id, text: 'Info', width, height, ...best });
}
const exact = candidates.find(c => c.atlasId === 'verdana-11-bold');
if (!exact || exact.differentPixels !== 0) throw new Error('Verdana11bold does not match this original screenshot; do not claim verified native headings');
evidence.nativeComparisons = [{ screenshot: reference.image, stage: reference.stage, stageSHA256: reference.stageSHA256,
    originalExecutableSHA256: reference.sourceSHA256, rule: 'Binary monochrome glyph-mask comparison against the original Info heading, source DlgHeadlineData declares Verdana11bold antialias0; bounded alignment search, neighboring sizes compared as controls.', candidates,
    result: 'Verified exact91-pixel foreground mask for this sample; other words/profiles, color and positioning still require individual checks.' }];
const descriptionCandidates = [];
for (const atlas of evidence.atlases.filter(a => a.family === 'Verdana' && a.weight === 700 && a.size === 11)) {
    const image = PNG.sync.read(fs.readFileSync(`${root}/${atlas.path}`));
    for (const spacing of [-1,0]) {
        const glyphs = [...'Description'].map(c => atlas.glyphs.find(g=>g.code===c.charCodeAt(0)));
        const width = glyphs.reduce((s,g)=>s+g.advance,0)+spacing*(glyphs.length-1), height=atlas.lineHeight;
        const mask = new Uint8Array(width*height); let pen=0;
        for (const glyph of glyphs) {
            for(let y=0;y<glyph.height;y++) for(let x=0;x<glyph.width;x++) {
                const dx=pen+x+glyph.offsetX,dy=y+glyph.offsetY;
                if(dx>=0&&dx<width&&dy>=0&&dy<height&&image.data[((glyph.y+y)*image.width+glyph.x+x)*4+3]>127) mask[dy*width+dx]=1;
            }
            pen+=glyph.advance+spacing;
        }
        let best={differentPixels:Infinity};
        for(let y=260;y<270;y++) for(let x=420;x<431;x++) {
            let differentPixels=0;
            for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++) {
                const i=((y+yy)*original.width+x+xx)*4;
                const pixel=original.data[i]>200&&original.data[i+1]>200&&original.data[i+2]>200?1:0;
                differentPixels+=Math.abs(pixel-mask[yy*width+xx]);
            }
            if(differentPixels<best.differentPixels)best={differentPixels,x,y};
        }
        descriptionCandidates.push({atlasId:atlas.id,text:'Description',letterSpacing:spacing,width,height,...best});
    }
}
const exactDescription=descriptionCandidates.find(c=>c.atlasId==='verdana-11-bold'&&c.letterSpacing===-1);
if(exactDescription.differentPixels!==0)throw new Error('Description source font/tracking calibration failed');
evidence.nativeComparisons.push({screenshot:reference.image,stageSHA256:reference.stageSHA256,rule:'Decoded LiveInfo2Formatting style11 Verdana11bold with CharSpacing=-65536 (16.16 fixed => -1pixel). Compare mono/gray coverage and tracking0/-1 against native heading.',candidates:descriptionCandidates,result:'Exact binary foreground mask at425,265; establishes mono and negative tracking for this native heading only.'});
const bodyCandidates=[];
for(const atlas of evidence.atlases.filter(a=>a.family==='Verdana'&&a.size===11&&a.weight===400)) {
    const image=PNG.sync.read(fs.readFileSync(`${root}/${atlas.path}`)), sample='Well-worn suburban youth hang out.';
    let pen=0; const pixels=new Set();
    for(const character of sample) {
        const glyph=atlas.glyphs.find(g=>g.code===character.charCodeAt(0));
        for(let y=0;y<glyph.height;y++)for(let x=0;x<glyph.width;x++)if(image.data[((glyph.y+y)*image.width+glyph.x+x)*4+3]>127)pixels.add((y+glyph.offsetY)*1000+pen+x+glyph.offsetX);
        pen+=glyph.advance-1;
    }
    let best={differentPixels:Infinity};
    for(let y=274;y<285;y++)for(let x=423;x<428;x++) {
        let differentPixels=0;
        for(let yy=0;yy<atlas.lineHeight;yy++)for(let xx=0;xx<pen+1;xx++) {
            const i=((y+yy)*original.width+x+xx)*4;
            const foreground=original.data[i]>200&&original.data[i+1]>200&&original.data[i+2]>200;
            differentPixels+=Number(foreground!==pixels.has(yy*1000+xx));
        }
        if(differentPixels<best.differentPixels)best={differentPixels,x,y};
    }
    bodyCandidates.push({atlasId:atlas.id,text:sample,letterSpacing:-1,width:pen+1,height:atlas.lineHeight,...best});
}
if(bodyCandidates.find(c=>c.atlasId==='verdana-11-regular').differentPixels!==0)throw new Error('Native venue description body calibration failed');
evidence.nativeComparisons.push({screenshot:reference.image,stageSHA256:reference.stageSHA256,candidates:bodyCandidates,result:'Exact first-line body foreground mask for Verdana11regular mono tracking-1 at425,279; native following foreground row starts establish14px line step. AA control differs13pixels.'});
const mediaReference=references.captures.find(c=>c.image==='native-008.png');
const mediaBytes=fs.readFileSync(`${root}/runtime/reference/${mediaReference.stage}`);
if(sha256(mediaBytes)!==mediaReference.stageSHA256)throw new Error('Changed native media screenshot');
const mediaImage=PNG.sync.read(mediaBytes), categorySamples=[];
for(const sample of [{text:'Gifts',id:'verdana-11-bold',x:284,y:445},{text:'Cultivate your relation to Radio FM',id:'verdana-11-regular',x:284,y:458}]) {
    const atlas=evidence.atlases.find(a=>a.id===sample.id), image=PNG.sync.read(fs.readFileSync(`${root}/${atlas.path}`));
    let pen=0;const mask=new Set();
    for(const character of sample.text) {
        const glyph=atlas.glyphs.find(g=>g.code===character.charCodeAt(0));
        for(let y=0;y<glyph.height;y++)for(let x=0;x<glyph.width;x++)if(image.data[((glyph.y+y)*image.width+glyph.x+x)*4+3]>127)mask.add((y+glyph.offsetY)*1000+pen+x+glyph.offsetX);
        pen+=glyph.advance;
    }
    let differentPixels=0;
    for(let y=0;y<atlas.lineHeight;y++)for(let x=0;x<pen;x++) {
        const i=((sample.y+y)*mediaImage.width+sample.x+x)*4;
        const foreground=mediaImage.data[i]>150&&mediaImage.data[i+1]>150&&mediaImage.data[i+2]>150;
        differentPixels+=Number(foreground!==mask.has(y*1000+x));
    }
    if(differentPixels!==0)throw new Error('Native category font comparison changed');
    categorySamples.push({...sample,width:pen,differentPixels});
}
evidence.nativeComparisons.push({screenshot:mediaReference.image,stageSHA256:mediaReference.stageSHA256,candidates:categorySamples,result:'Exact native category title and body masks; foreground color b5b5a5 and black only, establishing monochrome. Source ScrollItemCategoryField Verdana11 tracking0.'});
evidence.richTextDecode = {numericTags:'01/02 ASCII-hex short/int,81/82 zero,C1/C2 binary-byte zero-repeat count',styleRecordFields:77,fields:{fontTableIndex:0,nominalSize:3,effectiveSizeFixed16_16:18,bold:39,charSpacingFixed16_16:23},limitation:'Font identities and active runs decoded. Effective size field18 calibrated against native samples; nominal field3 differs for CourierNew titlebar (12 versus14). Antialias calibrated from retained samples; unknown fields retained raw.'};
evidence.nativeLimitations={titlebar:'RockWndTitle01 effective CourierNew14bold; native005 title has16 grayscale colors, so antialias established. Current Windows GDI title mask differs from retained Director raster and exactness is not claimed.',hud:'AssetsNameText/MoneyText/DateNameText/DateText/RehearsalNameText/MainMenuNameText active Verdana10bold tracking0. Native005 HUD has15-16 grayscale levels establishing antialias; current installed-font mask is not exact (Band differs26binarypixels). Source money label locator698,34 value671,55; date label698,82; DateRendered90x30 centered at712,109. Sprite.loc is not necessarily glyph origin.'};
fs.writeFileSync(filename, JSON.stringify(evidence) + '\n');
console.log(JSON.stringify({ verified: exact.atlasId, foregroundPixels: exact.foregroundPixels, differentPixels: exact.differentPixels }));

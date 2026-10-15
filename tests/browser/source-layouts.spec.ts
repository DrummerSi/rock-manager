import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {newGame,recruit,licenseSong,type GameState} from '../../src/game/model';
import {startRecording,finishRecording,signContract} from '../../src/game/recording';
import {bookRelease} from '../../src/game/design';

const require=createRequire(import.meta.url);
const data:typeof import('../../src/generated/game-data.json')=require('../../src/generated/game-data.json');
const {PNG}=require('pngjs');
const pressCards:typeof import('../../src/game/press-review-cards.json')=require('../../src/game/press-review-cards.json');
const base=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174';
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).__rockManager.snapshot());
async function click(page:Page,x:number,y:number){await page.mouse.click(x,y);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}
async function boot(page:Page,state:GameState){
  await page.addInitScript(value=>localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value)),state);
  await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);
  if(state.recording)await click(page,170,371);else await page.keyboard.press('Escape');
  if((await snapshot(page)).running)await page.keyboard.press('Space');
}
function fixture(){return {...newGame(100000),started:true,tutorialEnabled:false,bandName:'Source Audit',bandNameChanged:true};}
test.afterEach(async({page})=>{if(!page.isClosed())await page.goto('about:blank');});

test('publisher paper and fixed label masks agree with original native004',async({page},info)=>{
  await boot(page,fixture());await click(page,230,460);
  const state=await snapshot(page);expect(state.modal).toBe('publisher');
  expect(state.sourceLayout.bounds).toEqual({x:177,y:78,width:496,height:448});
  expect(state.sourceLayout.paper).toEqual({x:202,y:123,width:455,height:177});
  expect(state.sourceLayout.list).toEqual({x:207,y:326,width:410,height:109});
  const bytes=await page.screenshot({path:info.outputPath('publisher-source.png')});
  const actual=PNG.sync.read(bytes),native=PNG.sync.read(readFileSync('analysis/original/runtime/reference/stage/native-004.png'));
  // Blank paper pixels exclude all text, gauges, shadow and folded corner.
  let compared=0,mismatched=0;
  for(let y=240;y<270;y++)for(let x=230;x<580;x++){
    const i=(y*800+x)*4;compared++;
    if([0,1,2].some(c=>Math.abs(actual.data[i+c]-native.data[i+c])>2))mismatched++;
  }
  expect(mismatched/compared,'original d_paper02 fill must retain source RGB').toBeLessThan(.001);
  const masks=[];
  for(const [name,x,y,w,h]of [['Description',219,160,80,13],['Style',219,180,70,13],['Hit factor',219,198,80,13],['Quality',219,215,80,13],['Price',444,198,60,13],['Royalty',444,215,60,13]]as const){
    let union=0,different=0;
    for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
      const i=(py*800+px)*4,a=actual.data[i]<50&&actual.data[i+1]<50&&actual.data[i+2]<50,b=native.data[i]<50&&native.data[i+1]<50&&native.data[i+2]<50;
      if(a||b)union++;if(a!==b)different++;
    }
    masks.push({name,union,different,ratio:different/Math.max(1,union)});
  }
  writeFileSync(info.outputPath('publisher-label-mask-comparison.json'),JSON.stringify(masks,null,2));
  for(const mask of masks){expect(mask.union,mask.name).toBeGreaterThan(20);expect(mask.ratio,mask.name+' original black glyph mask').toBeLessThan(.12);}
});

test('mission chooser, briefing illustration and rename expose original layout coordinates',async({page},info)=>{
  await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);
  await click(page,320,371);let s=await snapshot(page);
  expect(s.sourceLayout.id).toBe('DlgMissionChoose');
  expect(s.sourceLayout.bounds).toEqual({x:160,y:100,width:482,height:440});
  await page.screenshot({path:info.outputPath('mission-chooser-source.png')});
  await click(page,s.sourceLayout.start.x,s.sourceLayout.start.y);s=await snapshot(page);
  expect(s.modal).toBe('briefing');expect(s.sourceLayout.id).toBe('DlgMissionIntro');
  expect(s.sourceLayout.illustration).toEqual({x:128,y:139,width:324,height:228});
  await expect.poll(async()=>(await snapshot(page)).speechPlayback.key).toBe('Intro01_01');
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  const narration=(await snapshot(page)).speechPlayback;expect(narration.duration).toBeGreaterThan(30);expect(narration.duration).toBeLessThan(35);
  await page.waitForTimeout(700);
  const ongoing=(await snapshot(page)).speechPlayback;expect(ongoing.playing).toBe(true);expect(ongoing.startedAt).toBe(narration.startedAt);expect(ongoing.positionSeconds).toBeGreaterThan(narration.positionSeconds+.4);
  await page.screenshot({path:info.outputPath('mission-intro-source.png')});
  await click(page,s.sourceLayout.begin.x,s.sourceLayout.begin.y);
  expect((await snapshot(page)).speechPlayback.key).not.toBe('Intro01_01');
});

test('rename uses the original paper field',async({page},info)=>{
  await boot(page,fixture());await click(page,306,40);await click(page,150,517);
  const s=await snapshot(page);expect(s.sourceLayout.id).toBe('DlgRehearsal01Name');
  expect(s.sourceLayout.bounds).toEqual({x:260,y:204,width:334,height:146});
  expect(s.sourceLayout.field).toEqual({x:282,y:258,width:280});
  const capture=PNG.sync.read(await page.screenshot({path:info.outputPath('rename-source.png')}));
  let visibleNamePixels=0;
  for(let y=258;y<276;y++)for(let x=282;x<500;x++){const i=(y*800+x)*4;if(capture.data[i]>100&&capture.data[i+1]>100&&capture.data[i+2]>100)visibleNamePixels++;}
  expect(visibleNamePixels,'original field must show the editable name against its black background').toBeGreaterThan(25);
});

test('venue ambience is audible and city ambience returns after a song preview',async({page},info)=>{
  let state:GameState=fixture();
  for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  state=licenseSong(state,data.songs,'Sng01');
  state=finishRecording(startRecording(state,data.tutorialGameplay,'Studio01','Sng01'),data.tutorialGameplay,data.musicians,data.songs);
  await boot(page,state);await click(page,76,335);
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.placePlaying).toBe(true);
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.0001);
  await page.screenshot({path:info.outputPath('venue-place-audio.png')});
  await page.keyboard.press('Escape');await click(page,306,40);await click(page,550,516);
  await expect.poll(async()=>(await snapshot(page)).previewPlaying).toBe(true);
  expect((await snapshot(page)).recordingPlayback.mode).toBe('mix');
  await expect.poll(async()=>(await snapshot(page)).cityAudio.playing).toBe(false);
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await snapshot(page)).modal).toBe(null);
  await expect.poll(async()=>(await snapshot(page)).cityAudio?.playing).toBe(true);
});

test('closing FX restarts the full mix rather than retaining solo preview',async({page},info)=>{
  let state:GameState=fixture();
  for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  state=licenseSong(state,data.songs,'Sng01');state=startRecording(state,data.tutorialGameplay,'Studio01','Sng01');
  await boot(page,state);
  await expect.poll(async()=>(await snapshot(page)).modal).toBe('mixer');
  await click(page,320,199);expect((await snapshot(page)).modal).toBe('settings');
  const studio=data.tutorialGameplay.studios.find(s=>s.id==='Studio01')!;
  await click(page,205,studio.availableEffects.includes('FXTimeShift')?464:411);
  await expect.poll(async()=>(await snapshot(page)).recordingPlayback.mode).toBe('instrument');
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await snapshot(page)).modal).toBe('mixer');
  await expect.poll(async()=>(await snapshot(page)).previewPlaying).toBe(true);
  expect((await snapshot(page)).recordingPlayback.mode).toBe('mix');
  expect((await snapshot(page)).recordingPlayback.tracks).toHaveLength(5);
  await page.screenshot({path:info.outputPath('fx-close-full-mix.png')});
});

test('native mixer Save as downloads a real audible WAV',async({page},info)=>{
  test.setTimeout(120000);
  let state:GameState=fixture();
  for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  state=licenseSong(state,data.songs,'Sng01');state=startRecording(state,data.tutorialGameplay,'Studio01','Sng01');
  await boot(page,state);await click(page,170,474);
  const s=await snapshot(page);expect(s.sourceLayout.id).toBe('DlgMixerExit');
  await page.screenshot({path:info.outputPath('mixer-exit-save-as.png')});
  const downloadPromise=page.waitForEvent('download',{timeout:90000});
  await click(page,s.sourceLayout.saveAs.x,s.sourceLayout.saveAs.y);
  const download=await downloadPromise;expect(download.suggestedFilename()).toBe('Song.wav');
  const target=info.outputPath('Song.wav');await download.saveAs(target);
  const wav=readFileSync(target);expect(wav.subarray(0,4).toString()).toBe('RIFF');expect(wav.subarray(8,12).toString()).toBe('WAVE');
  let pos=12,rate=0,channels=0,bits=0,format=0,samples:Buffer|undefined;
  while(pos+8<=wav.length){const id=wav.subarray(pos,pos+4).toString(),size=wav.readUInt32LE(pos+4),body=pos+8;
    if(id==='fmt '){format=wav.readUInt16LE(body);channels=wav.readUInt16LE(body+2);rate=wav.readUInt32LE(body+4);bits=wav.readUInt16LE(body+14);}
    if(id==='data')samples=wav.subarray(body,body+size);pos=body+size+(size%2);
  }
  expect(format).toBe(1);expect(bits).toBe(16);expect(channels).toBe(2);expect(rate).toBeGreaterThan(0);expect(samples).toBeTruthy();
  const duration=samples!.length/(rate*channels*bits/8);expect(duration).toBeGreaterThan(10);
  let energy=0;for(let i=0;i<samples!.length;i+=2){const sample=samples!.readInt16LE(i)/32768;energy+=sample*sample;}
  const rms=Math.sqrt(energy/(samples!.length/2));expect(rms).toBeGreaterThan(.001);
  writeFileSync(info.outputPath('wav-validation.json'),JSON.stringify({rate,channels,bits,duration,rms,bytes:wav.length},null,2));
});

for(const mediaId of ['Media03','Media04']as const)test(`original ${mediaId} press review uses its printed paper and source text`,async({page},info)=>{
  let state:GameState=fixture();
  for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  state=licenseSong(state,data.songs,'Sng01');state=finishRecording(startRecording(state,data.tutorialGameplay,'Studio01','Sng01'),data.tutorialGameplay,data.musicians,data.songs);
  state=signContract(state,data.tutorialGameplay.labels.find(l=>l.id==='Record01')!,data.musicians,4);
  state=bookRelease(state,data.musicians,['DEDBGFire','DEDArtists01','DEDEfffect01','DEDFont01'],2);
  state.publicity.reviews.push({id:'source-review-'+mediaId,mediaId,day:0,rating:3,quality:.6});
  await boot(page,state);await expect.poll(async()=>(await snapshot(page)).modal).toBe('activity-result');
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.key).toBe('Snare');
  expect((await snapshot(page)).feedbackAudio.rms).toBeGreaterThan(.001);
  const card=pressCards.find(c=>c.ID===`ECOC${mediaId}Review3`)!;
  await expect.poll(async()=>(await snapshot(page)).sourceLayout.paper?.frame).toBe(8);
  const s=await snapshot(page),layout=s.sourceLayout;
  expect(layout.id).toBe(card.dataMemberName);expect(layout.cardId).toBe(card.ID);expect(layout.bounds.width).toBe(383);
  const song=data.songs.find(song=>song.id===state.album!.songId)!;
  const expected=card.comment.replace(/<¤calbum.name>/gi,song.name).replace(/<¤cband.name>/gi,state.bandName);
  expect(layout.reviewText).toBe(expected);expect(layout.caption).toBe(card.Caption);
  expect(layout.cover).toEqual(mediaId==='Media03'?{x:layout.bounds.x+56,y:layout.bounds.y+112,width:105,height:105}:{x:layout.bounds.x+59,y:layout.bounds.y+60,width:92,height:94});
  expect(layout.paper.key).toContain(mediaId==='Media03'?'newsintro01_0008':'magazineintro01_0008');
  await page.screenshot({path:info.outputPath(mediaId.toLowerCase()+'-original-review.png')});
  await click(page,layout.close.x,layout.close.y);
  expect((await snapshot(page)).publicity.seenResults).toContain('source-review-'+mediaId);
});

test('original publisher preview survives repaint and scrolling, then stops on exit',async({page},info)=>{
  await boot(page,fixture());await click(page,230,460);
  let s=await snapshot(page);const first=s.sourceLayout.selectRows[0];await click(page,first.x,first.y);
  await expect.poll(async()=>(await snapshot(page)).speechPlayback.key).toBe(first.id+'Preview');
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  const start=(await snapshot(page)).speechPlayback;
  await page.waitForTimeout(400);await page.mouse.move(400,380);await page.mouse.wheel(0,200);await page.waitForTimeout(250);
  s=await snapshot(page);expect(s.speechPlayback.key).toBe(start.key);expect(s.speechPlayback.startedAt).toBe(start.startedAt);expect(s.speechPlayback.positionSeconds).toBeGreaterThan(start.positionSeconds+.3);
  await page.screenshot({path:info.outputPath('publisher-original-preview.png')});
  await page.keyboard.press('Escape');expect((await snapshot(page)).speechPlayback.playing).toBe(false);
  await expect.poll(async()=>(await snapshot(page)).cityAudio.playing).toBe(true);
});

test('original studio place sound plays on entry and stops on exit',async({page},info)=>{
  const state=licenseSong(fixture(),data.songs,'Sng01');await boot(page,state);await click(page,707,350);
  expect((await snapshot(page)).modal).toBe('studio');
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.placePlaying).toBe(true);
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  await page.screenshot({path:info.outputPath('studio-original-place-audio.png')});
  await page.keyboard.press('Escape');expect((await snapshot(page)).feedbackAudio.placePlaying).toBe(false);
});

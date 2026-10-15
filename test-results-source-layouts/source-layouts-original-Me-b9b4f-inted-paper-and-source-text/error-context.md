# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: source-layouts.spec.ts >> original Media03 press review uses its printed paper and source text
- Location: tests\browser\source-layouts.spec.ts:137:52

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5174/
Call log:
  - navigating to "http://127.0.0.1:5174/", waiting until "load"

```

```
Error: page.goto: Navigation to "about:blank" is interrupted by another navigation to "chrome-error://chromewebdata/"
Call log:
  - navigating to "about:blank", waiting until "load"

```

# Test source

```ts
  1   | import {test,expect,type Page} from '@playwright/test';
  2   | import {createRequire} from 'node:module';
  3   | import {readFileSync,writeFileSync} from 'node:fs';
  4   | import {newGame,recruit,licenseSong,type GameState} from '../../src/game/model';
  5   | import {startRecording,finishRecording,signContract} from '../../src/game/recording';
  6   | import {bookRelease} from '../../src/game/design';
  7   | 
  8   | const require=createRequire(import.meta.url);
  9   | const data:typeof import('../../src/generated/game-data.json')=require('../../src/generated/game-data.json');
  10  | const {PNG}=require('pngjs');
  11  | const pressCards:typeof import('../../src/game/press-review-cards.json')=require('../../src/game/press-review-cards.json');
  12  | const base=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174';
  13  | const snapshot=(page:Page)=>page.evaluate(()=>(window as any).__rockManager.snapshot());
  14  | async function click(page:Page,x:number,y:number){await page.mouse.click(x,y);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}
  15  | async function boot(page:Page,state:GameState){
  16  |   await page.addInitScript(value=>localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value)),state);
  17  |   await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);
  18  |   if(state.recording)await click(page,170,371);else await page.keyboard.press('Escape');
  19  |   if((await snapshot(page)).running)await page.keyboard.press('Space');
  20  | }
  21  | function fixture(){return {...newGame(100000),started:true,tutorialEnabled:false,bandName:'Source Audit',bandNameChanged:true};}
> 22  | test.afterEach(async({page})=>{if(!page.isClosed())await page.goto('about:blank');});
      |                                                               ^ Error: page.goto: Navigation to "about:blank" is interrupted by another navigation to "chrome-error://chromewebdata/"
  23  | 
  24  | test('publisher paper and fixed label masks agree with original native004',async({page},info)=>{
  25  |   await boot(page,fixture());await click(page,230,460);
  26  |   const state=await snapshot(page);expect(state.modal).toBe('publisher');
  27  |   expect(state.sourceLayout.bounds).toEqual({x:177,y:78,width:496,height:448});
  28  |   expect(state.sourceLayout.paper).toEqual({x:202,y:123,width:455,height:177});
  29  |   expect(state.sourceLayout.list).toEqual({x:207,y:326,width:410,height:109});
  30  |   const bytes=await page.screenshot({path:info.outputPath('publisher-source.png')});
  31  |   const actual=PNG.sync.read(bytes),native=PNG.sync.read(readFileSync('analysis/original/runtime/reference/stage/native-004.png'));
  32  |   // Blank paper pixels exclude all text, gauges, shadow and folded corner.
  33  |   let compared=0,mismatched=0;
  34  |   for(let y=240;y<270;y++)for(let x=230;x<580;x++){
  35  |     const i=(y*800+x)*4;compared++;
  36  |     if([0,1,2].some(c=>Math.abs(actual.data[i+c]-native.data[i+c])>2))mismatched++;
  37  |   }
  38  |   expect(mismatched/compared,'original d_paper02 fill must retain source RGB').toBeLessThan(.001);
  39  |   const masks=[];
  40  |   for(const [name,x,y,w,h]of [['Description',219,160,80,13],['Style',219,180,70,13],['Hit factor',219,198,80,13],['Quality',219,215,80,13],['Price',444,198,60,13],['Royalty',444,215,60,13]]as const){
  41  |     let union=0,different=0;
  42  |     for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
  43  |       const i=(py*800+px)*4,a=actual.data[i]<50&&actual.data[i+1]<50&&actual.data[i+2]<50,b=native.data[i]<50&&native.data[i+1]<50&&native.data[i+2]<50;
  44  |       if(a||b)union++;if(a!==b)different++;
  45  |     }
  46  |     masks.push({name,union,different,ratio:different/Math.max(1,union)});
  47  |   }
  48  |   writeFileSync(info.outputPath('publisher-label-mask-comparison.json'),JSON.stringify(masks,null,2));
  49  |   for(const mask of masks){expect(mask.union,mask.name).toBeGreaterThan(20);expect(mask.ratio,mask.name+' original black glyph mask').toBeLessThan(.12);}
  50  | });
  51  | 
  52  | test('mission chooser, briefing illustration and rename expose original layout coordinates',async({page},info)=>{
  53  |   await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);
  54  |   await click(page,320,371);let s=await snapshot(page);
  55  |   expect(s.sourceLayout.id).toBe('DlgMissionChoose');
  56  |   expect(s.sourceLayout.bounds).toEqual({x:160,y:100,width:482,height:440});
  57  |   await page.screenshot({path:info.outputPath('mission-chooser-source.png')});
  58  |   await click(page,s.sourceLayout.start.x,s.sourceLayout.start.y);s=await snapshot(page);
  59  |   expect(s.modal).toBe('briefing');expect(s.sourceLayout.id).toBe('DlgMissionIntro');
  60  |   expect(s.sourceLayout.illustration).toEqual({x:128,y:139,width:324,height:228});
  61  |   await page.screenshot({path:info.outputPath('mission-intro-source.png')});
  62  |   // Rename is independently fixture-seeded; no claim of fresh gameplay here.
  63  | });
  64  | 
  65  | test('rename uses the original paper field',async({page},info)=>{
  66  |   await boot(page,fixture());await click(page,306,40);await click(page,150,517);
  67  |   const s=await snapshot(page);expect(s.sourceLayout.id).toBe('DlgRehearsal01Name');
  68  |   expect(s.sourceLayout.bounds).toEqual({x:260,y:204,width:334,height:146});
  69  |   expect(s.sourceLayout.field).toEqual({x:282,y:258,width:280});
  70  |   const capture=PNG.sync.read(await page.screenshot({path:info.outputPath('rename-source.png')}));
  71  |   let visibleNamePixels=0;
  72  |   for(let y=258;y<276;y++)for(let x=282;x<500;x++){const i=(y*800+x)*4;if(capture.data[i]>100&&capture.data[i+1]>100&&capture.data[i+2]>100)visibleNamePixels++;}
  73  |   expect(visibleNamePixels,'original field must show the editable name against its black background').toBeGreaterThan(25);
  74  | });
  75  | 
  76  | test('venue ambience is audible and city ambience returns after a song preview',async({page},info)=>{
  77  |   let state:GameState=fixture();
  78  |   for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  79  |   state=licenseSong(state,data.songs,'Sng01');
  80  |   state=finishRecording(startRecording(state,data.tutorialGameplay,'Studio01','Sng01'),data.tutorialGameplay,data.musicians,data.songs);
  81  |   await boot(page,state);await click(page,76,335);
  82  |   await expect.poll(async()=>(await snapshot(page)).feedbackAudio.placePlaying).toBe(true);
  83  |   await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.0001);
  84  |   await page.screenshot({path:info.outputPath('venue-place-audio.png')});
  85  |   await page.keyboard.press('Escape');await click(page,306,40);await click(page,550,516);
  86  |   await expect.poll(async()=>(await snapshot(page)).previewPlaying).toBe(true);
  87  |   expect((await snapshot(page)).recordingPlayback.mode).toBe('mix');
  88  |   await expect.poll(async()=>(await snapshot(page)).cityAudio.playing).toBe(false);
  89  |   await page.keyboard.press('Escape');
  90  |   await expect.poll(async()=>(await snapshot(page)).modal).toBe(null);
  91  |   await expect.poll(async()=>(await snapshot(page)).cityAudio?.playing).toBe(true);
  92  | });
  93  | 
  94  | test('closing FX restarts the full mix rather than retaining solo preview',async({page},info)=>{
  95  |   let state:GameState=fixture();
  96  |   for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  97  |   state=licenseSong(state,data.songs,'Sng01');state=startRecording(state,data.tutorialGameplay,'Studio01','Sng01');
  98  |   await boot(page,state);
  99  |   await expect.poll(async()=>(await snapshot(page)).modal).toBe('mixer');
  100 |   await click(page,320,199);expect((await snapshot(page)).modal).toBe('settings');
  101 |   const studio=data.tutorialGameplay.studios.find(s=>s.id==='Studio01')!;
  102 |   await click(page,205,studio.availableEffects.includes('FXTimeShift')?464:411);
  103 |   await expect.poll(async()=>(await snapshot(page)).recordingPlayback.mode).toBe('instrument');
  104 |   await page.keyboard.press('Escape');
  105 |   await expect.poll(async()=>(await snapshot(page)).modal).toBe('mixer');
  106 |   await expect.poll(async()=>(await snapshot(page)).previewPlaying).toBe(true);
  107 |   expect((await snapshot(page)).recordingPlayback.mode).toBe('mix');
  108 |   expect((await snapshot(page)).recordingPlayback.tracks).toHaveLength(5);
  109 |   await page.screenshot({path:info.outputPath('fx-close-full-mix.png')});
  110 | });
  111 | 
  112 | test('native mixer Save as downloads a real audible WAV',async({page},info)=>{
  113 |   test.setTimeout(120000);
  114 |   let state:GameState=fixture();
  115 |   for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  116 |   state=licenseSong(state,data.songs,'Sng01');state=startRecording(state,data.tutorialGameplay,'Studio01','Sng01');
  117 |   await boot(page,state);await click(page,170,474);
  118 |   const s=await snapshot(page);expect(s.sourceLayout.id).toBe('DlgMixerExit');
  119 |   await page.screenshot({path:info.outputPath('mixer-exit-save-as.png')});
  120 |   const downloadPromise=page.waitForEvent('download',{timeout:90000});
  121 |   await click(page,s.sourceLayout.saveAs.x,s.sourceLayout.saveAs.y);
  122 |   const download=await downloadPromise;expect(download.suggestedFilename()).toBe('Song.wav');
```
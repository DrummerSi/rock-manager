# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audio-preload.spec.ts >> a failed audio download blocks play and can be retried; cached stems play and export offline
- Location: tests\browser\audio-preload.spec.ts:38:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 2

Call Log:
- Timeout 60000ms exceeded while waiting on the predicate
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {createRequire} from 'node:module';
  3  | import {readFileSync} from 'node:fs';
  4  | import {audioAssetPaths} from '../../src/game/audio-data';
  5  | import {newGame,recruit,licenseSong,type GameState} from '../../src/game/model';
  6  | import {startRecording} from '../../src/game/recording';
  7  | const require=createRequire(import.meta.url);
  8  | const data:typeof import('../../src/generated/game-data.json')=require('../../src/generated/game-data.json');
  9  | const feedback=require('../../src/generated/feedback-audio.json'),extra=require('../../src/generated/source-window-audio.json');
  10 | const expected=audioAssetPaths(feedback.recovered,extra.recovered,data.tutorialGameplay.audio);
  11 | const base=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174';
  12 | const snapshot=(page:Page)=>page.evaluate(()=>(window as any).__rockManager.snapshot());
  13 | async function click(page:Page,x:number,y:number){await page.mouse.click(x,y,{delay:35});await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
  14 | test.afterEach(async({page})=>{await page.context().setOffline(false);await page.goto('about:blank');});
  15 | 
  16 | test('loading waits for every audio download; original narration plays after the network is disconnected',async({page},info)=>{
  17 |  test.setTimeout(120000);
  18 |  let release!:()=>void,held=false;const gate=new Promise<void>(resolve=>release=resolve);
  19 |  const finished=new Set<string>();
  20 |  page.on('requestfinished',request=>{const path=new URL(request.url()).pathname.split('/assets/')[1];if(expected.includes(path))finished.add(path);});
  21 |  await page.route('**/assets/feedback/Intro01_01.mp3',async route=>{held=true;await gate;await route.continue();});
  22 |  await page.goto(base);
  23 |  await expect.poll(()=>held,{timeout:60000}).toBe(true);
  24 |  await expect.poll(()=>finished.size,{timeout:60000}).toBe(expected.length-1);
  25 |  expect(await page.evaluate(()=>'__rockManager'in window)).toBe(false);
  26 |  await page.screenshot({path:info.outputPath('waiting-for-last-audio.png')});
  27 |  release();await page.waitForFunction(()=>'__rockManager'in window,{},{timeout:60000});
  28 |  expect(finished.size).toBe(expected.length);
  29 |  await page.context().setOffline(true);
  30 |  let s=await snapshot(page);await click(page,s.sourceLayout.newGame.x,s.sourceLayout.newGame.y);
  31 |  s=await snapshot(page);await click(page,s.sourceLayout.start.x,s.sourceLayout.start.y);
  32 |  await expect.poll(async()=>(await snapshot(page)).speechPlayback.key).toBe('Intro01_01');
  33 |  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  34 |  expect((await snapshot(page)).speechPlayback.duration).toBeGreaterThan(30);
  35 |  await page.screenshot({path:info.outputPath('offline-narration.png')});
  36 | });
  37 | 
  38 | test('a failed audio download blocks play and can be retried; cached stems play and export offline',async({page},info)=>{
  39 |  test.setTimeout(120000);
  40 |  let state:GameState={...newGame(100000),started:true,tutorialEnabled:false,bandNameChanged:true};
  41 |  for(const[slot,id,instrument]of[[0,'RMCJerka','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass'],[4,'RMCSussie','Vocals']]as const)state=recruit(state,data.musicians,slot,id,instrument);
  42 |  state=startRecording(licenseSong(state,data.songs,'Sng01'),data.tutorialGameplay,'Studio01','Sng01');
  43 |  await page.addInitScript(value=>localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value)),state);
  44 |  let attempts=0;
  45 |  await page.route('**/assets/feedback/Intro01_01.mp3',route=>++attempts===1?route.abort('failed'):route.continue());
  46 |  await page.goto(base);
> 47 |  await expect.poll(()=>attempts,{timeout:60000}).toBe(1);
     |                                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  48 |  // The menu/diagnostic API is only created after the complete loader succeeds.
  49 |  await page.waitForFunction(()=>Array.from(document.querySelectorAll('canvas')).length===1);
  50 |  await expect.poll(async()=>page.evaluate(()=>{
  51 |    const game=(window as any).__rockManager;return Boolean(game);
  52 |  })).toBe(false);
  53 |  // Wait for all other requests to finish before clicking the retry screen.
  54 |  await page.waitForLoadState('networkidle',{timeout:60000});
  55 |  expect(await page.evaluate(()=>'__rockManager'in window)).toBe(false);
  56 |  await page.screenshot({path:info.outputPath('audio-download-failed.png')});
  57 |  await click(page,400,340);
  58 |  await page.waitForFunction(()=>'__rockManager'in window,{},{timeout:60000});expect(attempts).toBe(2);
  59 |  await page.context().setOffline(true);
  60 |  const menu=(await snapshot(page)).sourceLayout;await click(page,menu.continue.x,menu.continue.y);
  61 |  await click(page,320,199);expect((await snapshot(page)).modal).toBe('settings');
  62 |  await click(page,205,464);
  63 |  await expect.poll(async()=>(await snapshot(page)).previewPlaying).toBe(true);
  64 |  expect((await snapshot(page)).recordingPlayback.mode).toBe('instrument');
  65 |  await page.keyboard.press('Escape');
  66 |  await expect.poll(async()=>(await snapshot(page)).recordingPlayback.tracks.length).toBe(5);
  67 |  await page.keyboard.press('Escape');
  68 |  const exit=(await snapshot(page)).sourceLayout;expect(exit.id).toBe('DlgMixerExit');
  69 |  const downloading=page.waitForEvent('download');await click(page,exit.saveAs.x,exit.saveAs.y);
  70 |  const download=await downloading,target=info.outputPath('offline-mix.wav');await download.saveAs(target);
  71 |  const bytes=readFileSync(target);expect(bytes.subarray(0,4).toString()).toBe('RIFF');
  72 |  let energy=0;for(let i=44;i<bytes.length;i+=2)energy+=Math.pow(bytes.readInt16LE(i)/32768,2);
  73 |  expect(Math.sqrt(energy/((bytes.length-44)/2))).toBeGreaterThan(.001);
  74 | });
  75 | 
```
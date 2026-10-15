# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mission01-completion.spec.ts >> a genuine fresh Mission01 reaches its ending through canvas gameplay and survives reload
- Location: tests\browser\mission01-completion.spec.ts:88:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "recruit"
Received: null
```

# Page snapshot

```yaml
- generic "Rock Manager canvas game" [ref=e2]
```

# Test source

```ts
  1   | import { test, expect, type Page, type TestInfo } from '@playwright/test';
  2   | import { createRequire } from 'node:module';
  3   | import { writeFileSync } from 'node:fs';
  4   | import { candidates, type GameState } from '../../src/game/model';
  5   | 
  6   | const data: typeof import('../../src/generated/game-data.json')=createRequire(import.meta.url)('../../src/generated/game-data.json');
  7   | type Snapshot=GameState&Record<string,any>;
  8   | const snapshot=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as any).__rockManager.snapshot());
  9   | const checkpoints:Record<string,unknown>[]=[];
  10  | 
  11  | async function settle(page:Page){
  12  |   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  13  | }
  14  | async function dismissGuidance(page:Page){
  15  |   for(let i=0;i<12&&(await snapshot(page)).tutorialId;i++){
  16  |     await page.keyboard.press('Enter');await settle(page);
  17  |   }
  18  | }
  19  | async function click(page:Page,x:number,y:number){
  20  |   await page.mouse.click(x,y);await settle(page);await dismissGuidance(page);
  21  | }
  22  | async function checkpoint(page:Page,name:string,info:TestInfo){
  23  |   const state=await snapshot(page);
  24  |   checkpoints.push({name,day:state.day,money:state.money,modal:state.modal,storeChart:state.publicity.chart,
  25  |     radioChart:state.publicity.radioChart,storeTop10Day:state.publicity.top10Day,
  26  |     sales:state.publicity.totalSales,missionProgress:state.missionProgress,band:state.band,
  27  |     ownedSongs:state.ownedSongs,demoQuality:state.demo?.quality,contract:state.contract,album:state.album,
  28  |     concerts:state.publicity.concerts,adverts:state.publicity.adverts,reporters:state.publicity.reporters});
  29  |   await page.screenshot({path:info.outputPath(name+'.png')});
  30  | }
  31  | async function city(page:Page){
  32  |   for(let i=0;i<12;i++){
  33  |     const state=await snapshot(page);
  34  |     if(state.modal==='mission-result')return;
  35  |     if(state.tutorialId){await dismissGuidance(page);continue;}
  36  |     if(state.modal===null)return;
  37  |     await page.keyboard.press('Escape');await settle(page);
  38  |   }
  39  |   expect((await snapshot(page)).modal).toBeNull();
  40  | }
  41  | async function hire(page:Page,slot:number,id:string){
  42  |   const points=[[150,435],[130,185],[280,150],[450,170],[450,435]];
  43  |   await click(page,...points[slot] as [number,number]);
> 44  |   expect((await snapshot(page)).modal).toBe('recruit');
      |                                        ^ Error: expect(received).toBe(expected) // Object.is equality
  45  |   const rows=candidates(await snapshot(page),data.musicians,slot),index=rows.findIndex(m=>m.id===id);
  46  |   expect(index).toBeGreaterThanOrEqual(0);
  47  |   const offset=Math.max(0,index-3);
  48  |   while((await snapshot(page)).recruitOffset<offset)await click(page,616,509);
  49  |   await click(page,421,403+(index-offset)*32);await click(page,400,547);
  50  |   expect((await snapshot(page)).band[slot]?.musicianId).toBe(id);
  51  | }
  52  | async function kit(page:Page,id:string,x:number,y:number,info:TestInfo){
  53  |   await city(page);await click(page,x,y);
  54  |   expect((await snapshot(page)).selectedMediaId).toBe(id);
  55  |   expect((await snapshot(page)).modal).toBe('media');
  56  |   await click(page,350,411);expect((await snapshot(page)).modal).toBe('media-action');
  57  |   await click(page,240,305);
  58  |   expect((await snapshot(page)).publicity.reporters.find(r=>r.mediaId===id)?.kit).toBeTruthy();
  59  |   await checkpoint(page,`press-kit-${id.toLowerCase()}`,info);
  60  |   await city(page);
  61  | }
  62  | async function cafe(page:Page,info:TestInfo){
  63  |   await city(page);await click(page,76,335);expect((await snapshot(page)).modal).toBe('venue');
  64  |   await checkpoint(page,`venue-day-${(await snapshot(page)).day}`,info);
  65  |   await click(page,331,384);expect((await snapshot(page)).modal).toBe('concert-book');
  66  |   const before=(await snapshot(page)).publicity.concerts.length;
  67  |   await click(page,330,394);
  68  |   expect((await snapshot(page)).publicity.concerts).toHaveLength(before+1);
  69  |   await city(page);
  70  | }
  71  | async function storePromotion(page:Page,info:TestInfo){
  72  |   await city(page);await click(page,472,455);expect((await snapshot(page)).selectedMediaId).toBe('Media05');
  73  |   await click(page,350,411);expect((await snapshot(page)).modal).toBe('advert');
  74  |   // Original Discount costs1K/day. A14-day store promotion stays within the
  75  |   // normal100K game budget plus the genuinely negotiated record advance.
  76  |   expect((await snapshot(page)).selectedAdvertId).toBe('AdRS01');
  77  |   for(let i=0;i<30&&(await snapshot(page)).activityDuration<14;i++)await click(page,587,163);
  78  |   for(let i=0;i<30&&(await snapshot(page)).activityDuration>14;i++)await click(page,587,180);
  79  |   expect((await snapshot(page)).activityDuration).toBe(14);
  80  |   await click(page,281,268);expect((await snapshot(page)).activityDay).toBe(1);
  81  |   await checkpoint(page,'store-discount-calendar',info);
  82  |   const before=(await snapshot(page)).publicity.adverts.length;
  83  |   await click(page,321,419);
  84  |   expect((await snapshot(page)).publicity.adverts).toHaveLength(before+1);
  85  |   await city(page);
  86  | }
  87  | 
  88  | test('a genuine fresh Mission01 reaches its ending through canvas gameplay and survives reload',async({page},info)=>{
  89  |   test.setTimeout(240000);checkpoints.length=0;
  90  |   const errors:string[]=[];
  91  |   page.on('pageerror',error=>errors.push(error.message));
  92  |   page.on('console',message=>{if(/Texture key.*not found|Failed to load resource/.test(message.text()))errors.push(message.text());});
  93  |   try{
  94  |     // Playwright supplies a fresh browser context. No save, funds, exposure,
  95  |     // sales or chart state is injected; all changes below use canvas controls.
  96  |     await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>'__rockManager'in window);
  97  |     expect((await snapshot(page)).money).toBe(100000);
  98  |     expect((await snapshot(page)).modal).toBe('menu');
  99  |     await expect(page.locator('button,input,select,textarea')).toHaveCount(0);
  100 |     await click(page,320,371);expect((await snapshot(page)).modal).toBe('missions');
  101 |     await click(page,620,512);expect((await snapshot(page)).modal).toBe('briefing');
  102 |     await checkpoint(page,'01-original-briefing',info);await click(page,628,514);
  103 |     if((await snapshot(page)).running)await page.keyboard.press('Space');
  104 |     await click(page,306,40);
  105 |     for(const [slot,id]of[[0,'RMCJerka'],[1,'RMCTony'],[2,'RMCRaymond'],[3,'RMCGurra'],[4,'RMCSussie']]as const)await hire(page,slot,id);
  106 |     await click(page,150,517);await page.keyboard.press('Control+A');await page.keyboard.type('Rebel Youth');await page.keyboard.press('Enter');await settle(page);
  107 |     expect((await snapshot(page)).bandName).toBe('Rebel Youth');await checkpoint(page,'02-band-recruited',info);
  108 |     await city(page);await click(page,230,460);expect((await snapshot(page)).modal).toBe('publisher');
  109 |     await click(page,628,518);expect((await snapshot(page)).ownedSongs).toContain('Sng01');
  110 |     await click(page,707,350);expect((await snapshot(page)).modal).toBe('studio');await click(page,449,418);
  111 |     expect((await snapshot(page)).modal).toBe('mixer');await checkpoint(page,'03-original-mixer',info);
  112 |     await click(page,190,466);await click(page,632,510);expect((await snapshot(page)).demo).toBeTruthy();
  113 |     await click(page,160,340);expect((await snapshot(page)).modal).toBe('label');await click(page,240,488);
  114 |     expect((await snapshot(page)).modal).toBe('contract');
  115 |     for(let i=0;i<10&&(await snapshot(page)).offerIndex<4;i++)await click(page,654,295);
  116 |     for(let i=0;i<10&&(await snapshot(page)).offerIndex>4;i++)await click(page,654,223);
  117 |     expect((await snapshot(page)).offerIndex).toBe(4);
  118 |     await click(page,320,477);expect((await snapshot(page)).contract?.labelId).toBe('Record01');
  119 |     await checkpoint(page,'04-negotiated-contract',info);await city(page);
  120 |     await click(page,380,371);expect((await snapshot(page)).modal).toBe('design');
  121 |     for(const[y,count]of[[174,7],[234,1],[294,1],[354,1]])for(let i=0;i<count;i++)await click(page,674,y);
  122 |     expect((await snapshot(page)).designSelection).toEqual(['DEDBGFire','DEDArtists01','DEDEfffect01','DEDFont01']);
  123 |     await checkpoint(page,'05-original-cover',info);await click(page,515,420);expect((await snapshot(page)).modal).toBe('release');
  124 |     await click(page,324,248);expect((await snapshot(page)).releaseDay).toBe(2);
  125 |     await click(page,330,394);expect((await snapshot(page)).album).toBeTruthy();
  126 |     await checkpoint(page,'06-booked-release',info);
  127 |     await kit(page,'Media02',247,247,info);await checkpoint(page,'07-radio-press-kit',info);
  128 |     await kit(page,'Media03',491,265,info);await kit(page,'Media04',271,337,info);
  129 |     await cafe(page,info);await storePromotion(page,info);await checkpoint(page,'08-first-promotion-plan',info);
  130 |     for(let steps=0;steps<90;steps++){
  131 |       const before=await snapshot(page);if(before.modal==='mission-result')break;
  132 |       await city(page);if((await snapshot(page)).modal==='mission-result')break;
  133 |       await click(page,680,570);
  134 |       const state=await snapshot(page);
  135 |       expect(state.day).toBe(before.day+1);
  136 |       if(state.modal==='activity-result')await checkpoint(page,`result-day-${state.day}`,info);
  137 |       if(state.day%7===0)await checkpoint(page,`chart-week-${state.day/7}`,info);
  138 |       if(state.modal==='mission-result')break;
  139 |       await city(page);
  140 |       // Free small-venue gigs repeat only after the actual previous booking
  141 |       // and venue spacing permit them. No direct model mutation or chart edits.
  142 |       const cafeShows=state.publicity.concerts.filter(c=>c.venueId==='Live01');
  143 |       const last=cafeShows.at(-1);
  144 |       if(state.day%7===0&&(!last||state.day-last.startDay>=7))await cafe(page,info);
```
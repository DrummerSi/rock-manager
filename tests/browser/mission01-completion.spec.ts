import { test, expect, type Page, type TestInfo } from '@playwright/test';
const baseURL=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5173';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { candidates, type GameState } from '../../src/game/model';

const data: typeof import('../../src/generated/game-data.json')=createRequire(import.meta.url)('../../src/generated/game-data.json');
type Snapshot=GameState&Record<string,any>;
const snapshot=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as any).__rockManager.snapshot());
const checkpoints:Record<string,unknown>[]=[];

async function settle(page:Page){
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
}
async function dismissGuidance(page:Page){
  for(let i=0;i<12&&(await snapshot(page)).tutorialId;i++){
    await page.keyboard.press('Enter');await settle(page);
  }
}
async function click(page:Page,x:number,y:number){
  await page.mouse.click(x,y,{delay:35});await settle(page);await dismissGuidance(page);
}
async function checkpoint(page:Page,name:string,info:TestInfo){
  const state=await snapshot(page);
  checkpoints.push({name,day:state.day,money:state.money,modal:state.modal,storeChart:state.publicity.chart,
    radioChart:state.publicity.radioChart,storeTop10Day:state.publicity.top10Day,
    sales:state.publicity.totalSales,missionProgress:state.missionProgress,band:state.band,
    ownedSongs:state.ownedSongs,demoQuality:state.demo?.quality,contract:state.contract,album:state.album,
    concerts:state.publicity.concerts,adverts:state.publicity.adverts,reporters:state.publicity.reporters});
  await page.screenshot({path:info.outputPath(name+'.png')});
}
async function city(page:Page){
  for(let i=0;i<12;i++){
    const state=await snapshot(page);
    if(state.modal==='mission-result')return;
    if(state.tutorialId){await dismissGuidance(page);continue;}
    if(state.modal===null)return;
    await page.keyboard.press('Escape');await settle(page);
  }
  expect((await snapshot(page)).modal).toBeNull();
}
async function hire(page:Page,slot:number,id:string){
  const points=[[150,435],[130,185],[280,150],[450,170],[450,435]];
  await click(page,...points[slot] as [number,number]);
  expect((await snapshot(page)).modal).toBe('recruit');
  const rows=candidates(await snapshot(page),data.musicians,slot),index=rows.findIndex(m=>m.id===id);
  expect(index).toBeGreaterThanOrEqual(0);
  const offset=Math.max(0,index-3);
  while((await snapshot(page)).recruitOffset<offset)await click(page,616,509);
  await click(page,421,403+(index-offset)*32);await click(page,400,547);
  expect((await snapshot(page)).band[slot]?.musicianId).toBe(id);
}
async function kit(page:Page,id:string,x:number,y:number,info:TestInfo){
  await city(page);await click(page,x,y);
  expect((await snapshot(page)).selectedMediaId).toBe(id);
  expect((await snapshot(page)).modal).toBe('media');
  await click(page,350,411);expect((await snapshot(page)).modal).toBe('media-action');
  await click(page,240,305);
  expect((await snapshot(page)).publicity.reporters.find(r=>r.mediaId===id)?.kit).toBeTruthy();
  await checkpoint(page,`press-kit-${id.toLowerCase()}`,info);
  await city(page);
}
async function cafe(page:Page,info:TestInfo){
  await city(page);await click(page,76,335);expect((await snapshot(page)).modal).toBe('venue');
  await checkpoint(page,`venue-day-${(await snapshot(page)).day}`,info);
  await click(page,331,384);expect((await snapshot(page)).modal).toBe('concert-book');
  const before=(await snapshot(page)).publicity.concerts.length;
  await click(page,330,394);
  expect((await snapshot(page)).publicity.concerts).toHaveLength(before+1);
  await city(page);
}
async function storePromotion(page:Page,info:TestInfo){
  await city(page);await click(page,472,455);expect((await snapshot(page)).selectedMediaId).toBe('Media05');
  await click(page,350,411);expect((await snapshot(page)).modal).toBe('advert');
  // Original Discount costs1K/day. A14-day store promotion stays within the
  // normal100K game budget plus the genuinely negotiated record advance.
  expect((await snapshot(page)).selectedAdvertId).toBe('AdRS01');
  for(let i=0;i<30&&(await snapshot(page)).activityDuration<14;i++)await click(page,587,163);
  for(let i=0;i<30&&(await snapshot(page)).activityDuration>14;i++)await click(page,587,180);
  expect((await snapshot(page)).activityDuration).toBe(14);
  await click(page,281,268);expect((await snapshot(page)).activityDay).toBe(1);
  await checkpoint(page,'store-discount-calendar',info);
  const before=(await snapshot(page)).publicity.adverts.length;
  await click(page,321,419);
  expect((await snapshot(page)).publicity.adverts).toHaveLength(before+1);
  await city(page);
}

test('a genuine fresh Mission01 reaches its ending through canvas gameplay and survives reload',async({page},info)=>{
  test.setTimeout(240000);checkpoints.length=0;
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(/Texture key.*not found|Failed to load resource/.test(message.text()))errors.push(message.text());});
  try{
    // Playwright supplies a fresh browser context. No save, funds, exposure,
    // sales or chart state is injected; all changes below use canvas controls.
    await page.goto(baseURL);await page.waitForFunction(()=>'__rockManager'in window);
    expect((await snapshot(page)).money).toBe(100000);
    expect((await snapshot(page)).modal).toBe('menu');
    await expect(page.locator('button,input,select,textarea')).toHaveCount(0);
    await click(page,320,371);expect((await snapshot(page)).modal).toBe('missions');
    const chooser=(await snapshot(page)).sourceLayout;expect(chooser.id).toBe('DlgMissionChoose');
    await click(page,chooser.start.x,chooser.start.y);expect((await snapshot(page)).modal).toBe('briefing');
    await checkpoint(page,'01-original-briefing',info);
    const briefing=(await snapshot(page)).sourceLayout;expect(briefing.id).toBe('DlgMissionIntro');
    await click(page,briefing.begin.x,briefing.begin.y);
    if((await snapshot(page)).running)await page.keyboard.press('Space');
    await click(page,306,40);
    for(const [slot,id]of[[0,'RMCJerka'],[1,'RMCTony'],[2,'RMCRaymond'],[3,'RMCGurra'],[4,'RMCSussie']]as const)await hire(page,slot,id);
    await click(page,150,517);await page.keyboard.press('Control+A');await page.keyboard.type('Rebel Youth');await page.keyboard.press('Enter');await settle(page);
    expect((await snapshot(page)).bandName).toBe('Rebel Youth');await checkpoint(page,'02-band-recruited',info);
    await city(page);await click(page,230,460);expect((await snapshot(page)).modal).toBe('publisher');
    const publisher=(await snapshot(page)).sourceLayout;expect(publisher.id).toBe('DlgPublish');
    const beforeLicense=(await snapshot(page)).money;
    await click(page,publisher.buy.x,publisher.buy.y);
    expect((await snapshot(page)).ownedSongs).not.toContain('Sng01');expect((await snapshot(page)).money).toBe(beforeLicense);
    const songRow=publisher.selectRows.find((row:{id:string})=>row.id==='Sng01');expect(songRow).toBeTruthy();
    await click(page,songRow.x,songRow.y);await click(page,publisher.buy.x,publisher.buy.y);
    expect((await snapshot(page)).ownedSongs).toContain('Sng01');expect((await snapshot(page)).money).toBe(beforeLicense-11000);
    await click(page,707,350);expect((await snapshot(page)).modal).toBe('studio');await click(page,449,418);
    expect((await snapshot(page)).modal).toBe('mixer');await checkpoint(page,'03-original-mixer',info);
    await click(page,190,466);
    const mixerExit=(await snapshot(page)).sourceLayout;expect(mixerExit.id).toBe('DlgMixerExit');
    await click(page,mixerExit.ok.x,mixerExit.ok.y);expect((await snapshot(page)).demo).toBeTruthy();
    await click(page,160,340);expect((await snapshot(page)).modal).toBe('label');await click(page,240,488);
    expect((await snapshot(page)).modal).toBe('contract');
    for(let i=0;i<10&&(await snapshot(page)).offerIndex<4;i++)await click(page,654,295);
    for(let i=0;i<10&&(await snapshot(page)).offerIndex>4;i++)await click(page,654,223);
    expect((await snapshot(page)).offerIndex).toBe(4);
    await click(page,320,477);expect((await snapshot(page)).contract?.labelId).toBe('Record01');
    await checkpoint(page,'04-negotiated-contract',info);await city(page);
    await click(page,380,371);expect((await snapshot(page)).modal).toBe('design');
    for(const[y,count]of[[174,7],[234,1],[294,1],[354,1]])for(let i=0;i<count;i++)await click(page,674,y);
    expect((await snapshot(page)).designSelection).toEqual(['DEDBGFire','DEDArtists01','DEDEfffect01','DEDFont01']);
    await checkpoint(page,'05-original-cover',info);await click(page,515,420);expect((await snapshot(page)).modal).toBe('release');
    await click(page,324,248);expect((await snapshot(page)).releaseDay).toBe(2);
    await click(page,330,394);expect((await snapshot(page)).album).toBeTruthy();
    await checkpoint(page,'06-booked-release',info);
    await kit(page,'Media02',247,247,info);await checkpoint(page,'07-radio-press-kit',info);
    await kit(page,'Media03',491,265,info);await kit(page,'Media04',271,337,info);
    await cafe(page,info);await storePromotion(page,info);await checkpoint(page,'08-first-promotion-plan',info);
    for(let steps=0;steps<90;steps++){
      const before=await snapshot(page);if(before.modal==='mission-result')break;
      await city(page);if((await snapshot(page)).modal==='mission-result')break;
      await click(page,680,570);
      const state=await snapshot(page);
      expect(state.day).toBe(before.day+1);
      if(state.modal==='activity-result')await checkpoint(page,`result-day-${state.day}`,info);
      if(state.day%7===0)await checkpoint(page,`chart-week-${state.day/7}`,info);
      if(state.modal==='mission-result')break;
      await city(page);
      // Free small-venue gigs repeat only after the actual previous booking
      // and venue spacing permit them. No direct model mutation or chart edits.
      const cafeShows=state.publicity.concerts.filter(c=>c.venueId==='Live01');
      const last=cafeShows.at(-1);
      if(state.day%7===0&&(!last||state.day-last.startDay>=7))await cafe(page,info);
    }
    const won=await snapshot(page);
    expect(won.modal).toBe('mission-result');
    expect(won.missionProgress?.status).toBe('won');
    expect(won.publicity.top10Day).not.toBeNull();
    expect(won.day).toBeGreaterThanOrEqual(won.publicity.top10Day!+1);
    expect(won.publicity.totalSales).toBeGreaterThan(0);
    await checkpoint(page,'09-earned-mission-ending',info);
    await page.reload();await page.waitForFunction(()=>'__rockManager'in window);
    const restored=await snapshot(page);
    expect(restored.money).toBe(won.money);expect(restored.day).toBe(won.day);
    expect(restored.publicity.top10Day).toBe(won.publicity.top10Day);
    expect(restored.publicity.totalSales).toBe(won.publicity.totalSales);
    expect(restored.missionProgress).toEqual(won.missionProgress);
    if(restored.modal==='menu')await click(page,170,371);
    expect((await snapshot(page)).modal).toBe('mission-result');
    await checkpoint(page,'10-ending-restored',info);expect(errors).toEqual([]);
    expect((await snapshot(page)).running).toBe(false);
    await page.keyboard.press('Enter');await settle(page);
    expect((await snapshot(page)).modal).toBe('missions');
    expect((await snapshot(page)).missionProgress?.acknowledged).toBe(true);
    await checkpoint(page,'11-ending-acknowledged',info);
    // Release the game and its audio/WebGL resources before browser teardown.
    await page.goto('about:blank');
  }finally{
    writeFileSync(info.outputPath('mission01-checkpoints.json'),JSON.stringify({checkpoints,errors},null,2));
  }
});

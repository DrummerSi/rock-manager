import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {candidates,SLOT_INSTRUMENTS} from '../../src/game/model';
const data:typeof import('../../src/generated/game-data.json')=createRequire(import.meta.url)('../../src/generated/game-data.json');
const base=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174';
const snap=(page:Page)=>page.evaluate(()=>(window as any).__rockManager.snapshot());
async function click(page:Page,x:number,y:number){await page.mouse.click(x,y,{delay:35});await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
async function respond(page:Page,key='confirm'){const p=(await snap(page)).eventCardButtons[key];expect(p).toBeTruthy();await click(page,p.x,p.y);}
async function drain(page:Page){for(let n=0;n<40;n++){const s=await snap(page);if(s.modal==='scenario-event'){if(s.scenario.queue[0]?.id==='ECOCMis4Media01RqNadia')return true;await respond(page,s.scenario.queue[0]?.id==='ECMMis4StealSong'?'third':'confirm');continue;}if(s.modal==='activity-result'||s.modal==='training-result'){await page.keyboard.press('Escape');continue;}if(s.tutorialId){await page.keyboard.press('Enter');continue;}return false;}throw Error('Unbounded scenario cards');}
async function city(page:Page){for(let n=0;n<20;n++){if(await drain(page))return;const s=await snap(page);if(s.modal===null){if(s.running){await page.keyboard.press('Space');await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}return;}if(s.modal==='mission-result')return;await page.keyboard.press('Escape');}throw Error('Could not return to city');}
async function hire(page:Page,slot:number,id:string,instrument:string){const points=[[150,435],[130,185],[280,150],[450,170]];await click(page,...points[slot]as[number,number]);expect((await snap(page)).modal).toBe('recruit');
  const state=await snap(page),rows=candidates(state,data.allMusicians,slot).flatMap(m=>(SLOT_INSTRUMENTS[slot]as readonly string[]).filter(i=>m.skills[i as keyof typeof m.skills]>0).map(i=>({id:m.id,instrument:i}))),index=rows.findIndex(r=>r.id===id&&r.instrument===instrument);expect(index).toBeGreaterThanOrEqual(0);const offset=Math.max(0,index-3);
  for(let n=0;n<100&&(await snap(page)).recruitOffset<offset;n++)await click(page,616,509);await click(page,421,403+(index-offset)*32);await click(page,400,547);expect((await snap(page)).band[slot].musicianId).toBe(id);
}
async function kit(page:Page,id:string,x:number,y:number){await city(page);await click(page,x,y);expect((await snap(page)).selectedMediaId).toBe(id);await click(page,350,411);expect((await snap(page)).modal).toBe('media-action');await click(page,240,305);expect((await snap(page)).publicity.reporters.find((r:any)=>r.mediaId===id).kit).toBeTruthy();await city(page);}
async function radioAd(page:Page,duration:number){await city(page);await click(page,247,247);expect((await snap(page)).modal).toBe('media');
  // Native category list: presskit/gifts, then one-row scroll reveals FM ads.
  await click(page,521,474);await click(page,350,461);expect((await snap(page)).modal).toBe('advert');
  for(let n=0;n<8&&(await snap(page)).selectedAdvertId!=='AdFM03';n++)await click(page,505,164);expect((await snap(page)).selectedAdvertId).toBe('AdFM03');
  for(let n=0;n<10&&(await snap(page)).activityDuration>duration;n++)await click(page,587,180);for(let n=0;n<10&&(await snap(page)).activityDuration<duration;n++)await click(page,587,164);expect((await snap(page)).activityDuration).toBe(duration);
  await click(page,281,268);const s=await snap(page);expect(s.activityDay).toBe(s.day+1);await click(page,321,419);expect((await snap(page)).publicity.adverts.at(-1).advertId).toBe('AdFM03');await city(page);
}

test('genuine fresh Mission04 completes through canvas hiring, recording, royalties, paid radio campaigns and TV',async({page},info:TestInfo)=>{
  test.setTimeout(300000);const errors:string[]=[],ledger:unknown[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/texture key.*not found|missing texture|failed to load resource/i.test(m.text()))errors.push(m.text());});
  async function checkpoint(name:string){const s=await snap(page);ledger.push({name,day:s.day,money:s.money,band:s.band,ownedSongs:s.ownedSongs,contract:s.contract,album:s.album,adverts:s.publicity.adverts,concerts:s.publicity.concerts,royalties:s.publicity.paidRoyalties,scenario:s.scenario,missionProgress:s.missionProgress});await page.screenshot({path:info.outputPath(name+'.png')});}
  try{
    // Fresh Playwright context: no localStorage writes, model mutations or seeded funds/hype.
    await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);let s=await snap(page);await click(page,s.sourceLayout.newGame.x,s.sourceLayout.newGame.y);s=await snap(page);const row=s.sourceLayout.rows.find((r:any)=>r.id==='Mission04');await click(page,row.x,row.y);s=await snap(page);await click(page,s.sourceLayout.start.x,s.sourceLayout.start.y);s=await snap(page);expect(s.money).toBe(120000);expect(s.band.filter(Boolean)).toHaveLength(1);await checkpoint('01-genuine-fresh-nadia');await click(page,s.sourceLayout.begin.x,s.sourceLayout.begin.y);await city(page);
    await click(page,306,40);for(const[slot,id,instrument]of[[0,'RMCSussie','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCGullan','Drums'],[3,'RMCGurra','Bass']]as const)await hire(page,slot,id,instrument);await checkpoint('02-canvas-band-hired');await city(page);
    await click(page,230,460);s=await snap(page);const song=s.sourceLayout.selectRows.find((r:any)=>r.id==='Sng01');expect(song).toBeTruthy();await click(page,song.x,song.y);s=await snap(page);await click(page,s.sourceLayout.buy.x,s.sourceLayout.buy.y);expect((await snap(page)).ownedSongs).toContain('Sng01');
    await click(page,353,329);expect((await snap(page)).modal).toBe('studio');await click(page,449,418);expect((await snap(page)).recording.channels).toHaveLength(7);await checkpoint('03-canvas-studio02-mix');await click(page,170,474);s=await snap(page);await click(page,s.sourceLayout.ok.x,s.sourceLayout.ok.y);await city(page);
    await click(page,160,340);await click(page,245,488);expect((await snap(page)).modal).toBe('contract');for(let n=0;n<20&&(await snap(page)).offerIndex<10;n++)await click(page,654,295);for(let n=0;n<20&&(await snap(page)).offerIndex>10;n++)await click(page,654,223);expect((await snap(page)).offerIndex).toBe(10);await click(page,320,477);await city(page);expect((await snap(page)).contract.royalty).toBe(.15);await checkpoint('04-canvas-negotiated-royalty');
    await click(page,380,371);expect((await snap(page)).modal).toBe('design');for(const[index,target]of['DEDBGrainbow','DEDArtists03','DEDEfffect01','DEDFont04'].entries()){
      for(let n=0;n<25&&(await snap(page)).designSelection[index]!==target;n++)await click(page,674,174+index*60);expect((await snap(page)).designSelection[index]).toBe(target);
    }await checkpoint('05-nadia-original-cover');await click(page,515,420);expect((await snap(page)).modal).toBe('release');await click(page,324,248);expect((await snap(page)).releaseDay).toBe(2);await click(page,342,398);await city(page);
    await kit(page,'Media02',247,247);await kit(page,'Media03',491,265);await kit(page,'Media04',271,337);await radioAd(page,3);
    await click(page,76,335);await click(page,331,384);expect((await snap(page)).modal).toBe('concert-book');await click(page,342,398);await city(page);expect((await snap(page)).publicity.concerts.at(-1).startDay).toBe(3);await checkpoint('06-genuine-first-campaign');
    let invitation=false;
    for(let n=0;n<65;n++){
      if(await drain(page)){
        invitation=true;await checkpoint('07-genuinely-earned-tv-invitation');await respond(page);expect((await snap(page)).modal).toBe('scenario-book');s=await snap(page);await click(page,s.sourceLayout.confirm.x,s.sourceLayout.confirm.y);await city(page);
      }
      s=await snap(page);if(s.missionProgress.status==='won')break;expect(s.missionProgress.status).not.toBe('lost');await city(page);s=await snap(page);if(s.modal==='mission-result')break;
      if(s.day>=5&&Object.hasOwn(s.scenario.active,'Media01RqNadia01')&&s.money>=35000)await radioAd(page,1);
      await click(page,680,570);if((await snap(page)).day%5===0)await checkpoint('campaign-day-'+(await snap(page)).day);
    }
    await drain(page);s=await snap(page);expect(invitation).toBe(true);expect(s.missionProgress.status).toBe('won');expect(s.publicity.paidRoyalties).toBeGreaterThan(0);expect(s.money).toBeGreaterThanOrEqual(0);await checkpoint('08-genuine-mission04-victory');const won=s;
    await page.reload();await page.waitForFunction(()=>'__rockManager'in window);s=await snap(page);expect(s.missionProgress).toEqual(won.missionProgress);expect(s.money).toBe(won.money);expect(s.day).toBe(won.day);expect(errors).toEqual([]);
  }finally{writeFileSync(info.outputPath('genuine-mission04-ledger.json'),JSON.stringify({ledger,errors},null,2));await page.goto('about:blank');}
});

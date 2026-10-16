import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {newMission} from '../../src/game/missions';
import {recruit,licenseSong,advanceDay,type GameState} from '../../src/game/model';
import {startRecording,finishRecording,signContract,approveContractDemo} from '../../src/game/recording';
import {bookRelease} from '../../src/game/design';
import {givePressKit,bookAdvert,bookConcert} from '../../src/game/publicity';
import {scenarioEvent} from '../../src/game/scenarios';
import {trainBandmate,giveBandmateGift} from '../../src/game/bandmates';
import {completeScenarioQuit,applyScenarioQuits} from '../../src/game/scenario-quits';
const data:typeof import('../../src/generated/game-data.json')=createRequire(import.meta.url)('../../src/generated/game-data.json');
const musicians=data.allMusicians,base=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174';
const errorsByPage=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const errors:string[]=[];errorsByPage.set(page,errors);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/texture key.*not found|missing texture|failed to load resource/i.test(message.text()))errors.push(message.text());});});
const snap=(page:Page)=>page.evaluate(()=>(window as any).__rockManager.snapshot());
async function click(page:Page,x:number,y:number){await page.mouse.click(x,y);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
async function button(page:Page,kind='confirm'){const s=await snap(page),p=s.eventCardButtons[kind];expect(p).toBeTruthy();await click(page,p.x,p.y);}
async function drain(page:Page){for(let n=0;n<30;n++){const s=await snap(page);if(s.modal==='scenario-event'){await button(page,s.scenario.queue[0]?.id==='ECMMis4StealSong'?'third':'confirm');continue;}if(s.modal==='activity-result'||s.modal==='training-result'){await page.keyboard.press('Escape');continue;}if(s.tutorialId){await page.keyboard.press('Enter');continue;}return;}}
async function boot(page:Page,state:GameState){await page.addInitScript(value=>{if(location.protocol==='http:'&&!localStorage.getItem('rock-manager.mission01.v1'))localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value));},state);await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);await page.keyboard.press('Escape');if((await snap(page)).running&&(await snap(page)).modal===null)await page.keyboard.press('Space');await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
function ack(s:GameState){for(let n=0;s.scenario!.queue.length&&!s.scenario!.outcome;n++){if(n>100)throw Error('unbounded source queue');const c=s.scenario!.queue[0];if(c.id==='ECOCQuitNow'&&c.speakerId)s=completeScenarioQuit(s,c.speakerId,musicians);s=scenarioEvent(s,{kind:'card',cardId:c.id,choice:c.id==='ECMMis4StealSong'?'Button3':'ButtonOK'},musicians);}return s;}
function band03(){let s=newMission('Mission03',musicians,new Date(2026,9,14));s.started=true;for(const[slot,id,instrument]of[[1,'RMCTony','Guitar'],[2,'RMCGullan','Drums'],[3,'RMCGurra','Bass']]as const)s=recruit(s,musicians,slot,id,instrument);return s;}
function gala69(){let s=band03();s=finishRecording(startRecording(s,data.tutorialGameplay,'Studio02','Sng18'),data.tutorialGameplay,musicians,data.songs);s=scenarioEvent(s,{kind:'recording'},musicians);s=approveContractDemo(s,data.tutorialGameplay.labels.find(l=>l.id==='Record04')!,musicians);s=bookRelease(s,musicians,['DEDBGMoon','DEDArtists01','DEDEfffect01','DEDFont04'],2);for(const id of ['Media02','Media03','Media04'])s=givePressKit(s,id,musicians);s=bookAdvert(s,'AdRS01',1,14);while(s.day<69){if(s.day%10===0&&s.day<60)for(const id of ['RMCLelle','RMCNille']){s=trainBandmate(s,id,'ActTrainMedia',s.day+1);s=scenarioEvent(s,{kind:'training',actorId:id},musicians);}if(s.day%10===0&&s.day<65)s=bookConcert(s,musicians,'Live01',s.day+5);if(s.day===18)for(const id of ['RMCLelle','RMCNille']){s=giveBandmateGift(s,id,'ActGiftStereo');s=scenarioEvent(s,{kind:'gift',actorId:id},musicians);}s=ack(scenarioEvent(s,{kind:'city'},musicians));s=ack(advanceDay(s,musicians).state);}return s;}
function earnedTV(){let s=newMission('Mission04',musicians,new Date(2026,9,14));s.started=true;for(const[slot,id,instrument]of[[0,'RMCSussie','Guitar'],[1,'RMCTony','Guitar'],[2,'RMCGullan','Drums'],[3,'RMCGurra','Bass']]as const)s=recruit(s,musicians,slot,id,instrument);s=licenseSong(s,data.songs,'Sng01');s=finishRecording(startRecording(s,data.tutorialGameplay,'Studio02','Sng01'),data.tutorialGameplay,musicians,data.songs);s=signContract(s,data.tutorialGameplay.labels.find(l=>l.id==='Record01')!,musicians,10);s=bookRelease(s,musicians,['DEDBGrainbow','DEDArtists03','DEDEfffect01','DEDFont04'],2);for(const id of ['Media02','Media03','Media04'])s=givePressKit(s,id,musicians);s=bookAdvert(s,'AdFM03',1,3);s=bookConcert(s,musicians,'Live01',3);while(s.day<60){s=advanceDay(s,musicians).state;if(s.scenario!.queue.some(c=>c.id==='ECOCMis4Media01RqNadia'))return s;s=ack(s);if(s.day>=5&&Object.hasOwn(s.scenario!.active,'Media01RqNadia01')&&s.money>=35000)s=bookAdvert(s,'AdFM03',s.day+1,1);}throw Error('Original paid actions did not earn TV invitation');}
test.afterEach(async({page})=>{if(!page.isClosed())await page.goto('about:blank');expect(errorsByPage.get(page)).toEqual([]);});

for(const id of ['Mission03','Mission04']as const)test(`fresh canvas selection starts original ${id} band, cash and narration`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);
  const menu=(await snap(page)).sourceLayout;await click(page,menu.newGame.x,menu.newGame.y);
  let s=await snap(page);const row=s.sourceLayout.rows.find((r:any)=>r.id===id);expect(row.enabled).toBe(true);await click(page,row.x,row.y);s=await snap(page);await click(page,s.sourceLayout.start.x,s.sourceLayout.start.y);
  await expect.poll(async()=>(await snap(page)).speechPlayback.key).toBe(id==='Mission03'?'intro03_01r04':'intro04_01g01');
  await expect.poll(async()=>(await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  s=await snap(page);expect(s.money).toBe(id==='Mission03'?100000:120000);expect(s.missionId).toBe(id);expect(s.band[4].musicianId).toBe(id==='Mission03'?'RMCLelle':'RMCPernille');if(id==='Mission03'){expect(s.band[0].musicianId).toBe('RMCNille');expect(s.contract.prearranged).toBe(true);expect(s.ownedSongs).toEqual(['Sng18']);}
  await page.screenshot({path:info.outputPath(id+'-fresh-original-intro.png')});await click(page,s.sourceLayout.begin.x,s.sourceLayout.begin.y);expect((await snap(page)).speechPlayback.key).not.toBe(s.speechPlayback.key);await drain(page);expect(errors).toEqual([]);
});

test('focused original Mission03 band records seven-channel Studio02 demo and gets approval without another advance',async({page},info)=>{
  await boot(page,band03());await drain(page);await page.screenshot({path:info.outputPath('mission03-before-studio-entry.png')});await click(page,353,329);if((await snap(page)).modal===null)await click(page,353,329);expect((await snap(page)).modal).toBe('studio');await click(page,449,418);expect((await snap(page)).recording.channels).toHaveLength(7);await page.screenshot({path:info.outputPath('mission03-seven-channel-mixer.png')});
  await click(page,170,474);let s=await snap(page);await click(page,s.sourceLayout.ok.x,s.sourceLayout.ok.y);await drain(page);s=await snap(page);expect(s.demo.songId).toBe('Sng18');const before=s.money;
  await click(page,365,214);expect((await snap(page)).selectedLabelId).toBe('Record04');await click(page,245,488);await drain(page);s=await snap(page);expect(s.contract.approved).toBe(true);expect(s.money).toBe(before);await page.screenshot({path:info.outputPath('mission03-prearranged-approved.png')});
});

test('focused near-day69 fixture earned through source actions reaches fixed Global Aid ending and reloads',async({page},info)=>{
  const fixture=gala69();expect(fixture.day).toBe(69);await boot(page,fixture);await drain(page);await click(page,680,570);await drain(page);let s=await snap(page);expect(s.day).toBe(70);expect(s.missionProgress.status).toBe('won');expect(s.modal).toBe('mission-result');await page.screenshot({path:info.outputPath('mission03-earned-gala-ending.png')});await page.reload();await page.waitForFunction(()=>'__rockManager'in window);const menu=(await snap(page)).sourceLayout;await click(page,menu.continue.x,menu.continue.y);expect((await snap(page)).missionProgress.status).toBe('won');expect((await snap(page)).day).toBe(70);
});

test('paid-action earned Nadia invitation has two choices, native editable TV calendar, victory and persisted save',async({page},info)=>{
  const fixture=earnedTV();writeFileSync(info.outputPath('earned-tv-fixture.json'),JSON.stringify({day:fixture.day,money:fixture.money,adverts:fixture.publicity.adverts,royalties:fixture.publicity.paidRoyalties,queue:fixture.scenario!.queue},null,2));
  await boot(page,fixture);for(let n=0;n<20&&(await snap(page)).scenario.queue[0]?.id!=='ECOCMis4Media01RqNadia';n++)await button(page);
  let s=await snap(page);expect(s.modal).toBe('scenario-event');expect(s.eventCardButtons.cancel).toBeTruthy();await page.screenshot({path:info.outputPath('mission04-earned-tv-offer.png')});await button(page);expect((await snap(page)).modal).toBe('scenario-book');await page.screenshot({path:info.outputPath('mission04-native-tv-calendar.png')});s=await snap(page);await click(page,s.sourceLayout.cancel.x,s.sourceLayout.cancel.y);expect((await snap(page)).scenario.queue[0].id).toBe('ECOCMis4Media01RqNadia');expect((await snap(page)).scenario.appointments.some((a:any)=>a.id==='DivEventWin')).toBe(false);
  await button(page);s=await snap(page);const chosen=s.day+3,x=s.sourceLayout.agenda.plotX+(chosen-s.sourceLayout.agenda.firstDay)*25+12;await click(page,x,268);s=await snap(page);expect(s.sourceLayout.selectedDay).toBe(chosen);await click(page,s.sourceLayout.confirm.x,s.sourceLayout.confirm.y);await drain(page);expect((await snap(page)).scenario.appointments.find((a:any)=>a.id==='DivEventWin').startDay).toBe(chosen);
  for(let n=0;n<10&&(await snap(page)).missionProgress.status!=='won';n++){await drain(page);if((await snap(page)).modal==='mission-result')break;await click(page,680,570);await drain(page);}
  s=await snap(page);expect(s.missionProgress.status).toBe('won');await page.screenshot({path:info.outputPath('mission04-earned-tv-ending.png')});await page.reload();await page.waitForFunction(()=>'__rockManager'in window);expect((await snap(page)).missionProgress.status).toBe('won');
});

test('focused Nadia quit-threshold fixture displays original departure and failure cards before saving loss',async({page},info)=>{
  let fixture=newMission('Mission04',musicians,new Date(2026,9,14));fixture.started=true;
  // Deliberate threshold fixture for source-card lifecycle; not a fresh playthrough.
  fixture.bandmates.modifiers.push({id:'UIQuitThresholdFixture',musicianId:'RMCPernille',stat:'mood',amount:-1,startDay:0,duration:10});
  fixture=applyScenarioQuits(fixture,musicians);await boot(page,fixture);
  let s=await snap(page);expect(s.modal).toBe('scenario-event');expect(s.scenario.queue[0].id).toBe('ECOCQuitNow');expect(s.band[4]).toBeNull();
  await page.screenshot({path:info.outputPath('nadia-original-quit-card.png')});await button(page);
  s=await snap(page);expect(s.scenario.queue[0].id).toBe('ECOCMis4NadiaQuitBand');expect(s.modal).toBe('scenario-event');await page.screenshot({path:info.outputPath('nadia-original-failure-card.png')});
  await button(page);s=await snap(page);expect(s.missionProgress.status).toBe('lost');expect(s.modal).toBe('mission-result');await page.screenshot({path:info.outputPath('nadia-original-lost-ending.png')});
  await page.reload();await page.waitForFunction(()=>'__rockManager'in window);expect((await snap(page)).missionProgress.status).toBe('lost');expect((await snap(page)).band[4]).toBeNull();
});

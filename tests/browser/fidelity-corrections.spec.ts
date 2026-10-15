const testBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
import { test, expect, type Page } from '@playwright/test';
test.afterEach(async ({page}) => { if (!page.isClosed()) await page.goto('about:blank'); });
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { newGame, recruit, licenseSong, type GameState } from '../../src/game/model';
import { bandmateMood, BANDMATE_RULES } from '../../src/game/bandmates';
import { startRecording, finishRecording, signContract } from '../../src/game/recording';

const data: typeof import('../../src/generated/game-data.json') = createRequire(import.meta.url)('../../src/generated/game-data.json');
const actorData: typeof import('../../src/generated/actor-animation.json')=createRequire(import.meta.url)('../../src/generated/actor-animation.json');
const {PNG}=createRequire(import.meta.url)('pngjs');
const snap = (page: Page) => page.evaluate(() => (window as any).__rockManager.snapshot());
async function click(page: Page, x: number, y: number) {
  await page.mouse.click(x, y);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
function fixture(singer = false): GameState {
  let state: GameState = { ...newGame(200000), started: true, tutorialEnabled: false, bandName: 'The Unknowns' };
  state = recruit(state, data.musicians, 0, 'RMCJerka', 'Guitar');
  if (singer) state = recruit(state, data.musicians, 4, 'RMCSussie', 'Vocals');
  return state;
}
async function boot(page: Page, state: GameState) {
  await page.addInitScript(value => localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(value)), state);
  await page.goto(testBaseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  if ((await snap(page)).modal === null && (await snap(page)).running) await page.keyboard.press('Space');
}
async function acknowledgeCard(page: Page) {
  const state = await snap(page);
  expect(state.tutorialButtonY).toBeGreaterThan(0);
  await click(page, 400, state.tutorialButtonY + 16);
}
async function openRehearsal(page:Page) {
  // The first city pointer also unlocks browser audio. Wait for the rendered
  // scene before sending a subsequent click to a dialog coordinate.
  for(let attempt=0;attempt<2&&(await snap(page)).modal!=='rehearsal';attempt++){
    await click(page,306,40);
    await page.waitForTimeout(80);
  }
  await expect.poll(async()=>(await snap(page)).modal).toBe('rehearsal');
}
async function expectSourcePortrait(page:Page,textureKey:string,x:number,y:number) {
  const source=actorData.staticPortraits.find(p=>p.textureKey===textureKey)!;
  expect(source).toBeTruthy();
  const expected=PNG.sync.read(readFileSync('analysis/original/'+source.path));
  const rendered=PNG.sync.read(await page.screenshot());
  let mismatches=0,compared=0;const differenceRows=new Set<number>();
  // The original drum/header badge overlaps the HUD photo's top nine rows.
  // Compare the uncovered portrait, including eyes/mouth; rehearsal has no badge.
  const firstRow=source.size==='medium'?10:4;
  for(let row=firstRow;row<source.height-4;row++)for(let column=4;column<source.width-4;column++){
    const original=(row*source.width+column)*4,pixel=((y+row)*800+x+column)*4;
    if(expected.data[original+3]!==255)continue;
    compared++;
    if([0,1,2].some(c=>Math.abs(expected.data[original+c]-rendered.data[pixel+c])>2)){mismatches++;differenceRows.add(row);}
  }
  expect(compared).toBeGreaterThan(1000);
  expect(mismatches,textureKey+' actual canvas pixels must match the recovered mood portrait; rows '+[...differenceRows].join(',')).toBe(0);
}

test('training completion uses a compact original event card within the canvas', async ({ page }) => {
  const state = fixture(true);
  const action = BANDMATE_RULES.actions.find(a => a.id === 'ActTrainMusicality')!;
  state.day = action.duration;
  state.bandmates.lastDay = state.day;
  state.bandmates.nextId = 2;
  state.bandmates.training.push({ id: 'training1', musicianId: 'RMCJerka', actionId: action.id,
    type: action.trainingType!, startDay: 0, duration: action.duration, completed: true });
  state.bandmates.completions.push({ id: 'training1', musicianId: 'RMCJerka', actionId: action.id,
    day: state.day, seen: false });
  await boot(page, state);
  await expect.poll(async () => (await snap(page)).modal).toBe('training-result');
  const bounds = (await snap(page)).eventCardBounds;
  expect(bounds).toBeTruthy();
  expect(bounds.width).toBeGreaterThanOrEqual(340);
  expect(bounds.width).toBeLessThanOrEqual(360);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(800);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(600);
  await expect.poll(async()=>(await snap(page)).speechPlayback.key).toMatch(/^a01ea2000[12]$/);
  await expect.poll(async()=>(await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  await expect.poll(async()=>(await snap(page)).actors.find((a:any)=>a.id==='actor01')?.cueIndex??-1).toBeGreaterThanOrEqual(0);
  const spoken=await snap(page),actor=spoken.actors.find((a:any)=>a.id==='actor01');
  const cues=(actorData.cues as Record<string,number[]>)[spoken.speechPlayback.key];
  expect(cues).toBeTruthy();
  const opening=Math.min(3,Math.round(cues[actor.cueIndex]/33));
  const sourceFrames=opening===0||opening===3?[5+opening]:[5+opening,8+opening];
  expect(sourceFrames.map(n=>'moves_'+String(n).padStart(4,'0'))).toContain(actor.mouth);
  await page.screenshot({ path: 'test-results/fidelity-training-event.png' });
  await page.keyboard.press('Escape');
  expect((await snap(page)).bandmates.completions[0].seen).toBe(true);
});

test('HUD and rehearsal portraits use recovered mood images and the album status has no song chooser', async ({ page }) => {
  const state = fixture(true);
  state.bandmates.people.find(p => p.musicianId === 'RMCJerka')!.mood = .05;
  const mood = bandmateMood(state, 'RMCJerka');
  const suffix = (mood === 'Furious' ? 'Angry' : mood).toLowerCase();
  await boot(page, state);
  let snapshot = await snap(page);
  expect(snapshot.moodPortraits.find((p: any) => p?.id === 'RMCJerka')).toMatchObject({
    medium: `actor-static-actor01-${suffix}-medium`, large: `actor-static-actor01-${suffix}-large`,
  });
  await expectSourcePortrait(page,`actor-static-actor01-${suffix}-medium`,272,51);
  await page.screenshot({ path: 'test-results/fidelity-hud-mood.png' });
  await openRehearsal(page);
  snapshot = await snap(page);
  expect(snapshot.modal).toBe('rehearsal');
  expect(snapshot.moodPortraits.find((p: any) => p?.id === 'RMCJerka').large).toBe(`actor-static-actor01-${suffix}-large`);
  await expectSourcePortrait(page,`actor-static-actor01-${suffix}-large`,109,390);
  const labels = snapshot.dialogTexts.map((item: any) => item.text);
  expect(labels.join('\n')).not.toMatch(/Choose song/i);
  for (const label of ['Record company', 'royalty', 'Advance', 'Album recorded', 'Sleeve designed',
    'release date', 'copies sold', 'Revenue', 'To publisher', 'To label', 'Earned', 'Incl. advance']) expect(labels.map((value:string)=>value.toLowerCase())).toContain(label.toLowerCase());
  await page.screenshot({ path: 'test-results/fidelity-rehearsal-status.png' });
});

test('missing singer guidance keeps rehearsal open after acknowledgment', async ({ page }) => {
  await boot(page, fixture());
  await openRehearsal(page);
  await click(page, 685, 516);
  let snapshot = await snap(page);
  expect(snapshot.modal).toBe('rehearsal');
  expect(snapshot.tutorialId).toBe('ECOCNeedSinger');
  await page.screenshot({ path: 'test-results/fidelity-singer-guidance.png' });
  await acknowledgeCard(page);
  snapshot = await snap(page);
  expect(snapshot.modal).toBe('rehearsal');
  expect(snapshot.tutorialId).toBe(null);
  await click(page, 685, 516);
  expect((await snap(page)).tutorialId).toBe('ECOCNeedSinger');
});

test('signed album status keeps the label name clear of the record-company heading', async ({ page }) => {
  let state = fixture(true);
  state.bandName='Fidelity Five';state.bandNameChanged=true;
  for (const [slot,id,instrument] of [[1,'RMCTony','Guitar'],[2,'RMCRaymond','Drums'],[3,'RMCGurra','Bass']] as const)
    state = recruit(state,data.musicians,slot,id,instrument);
  state = licenseSong(state,data.songs,'Sng01');
  state = finishRecording(startRecording(state,data.tutorialGameplay,'Studio01','Sng01'),data.tutorialGameplay,data.musicians,data.songs);
  const label=data.tutorialGameplay.labels.find(l=>l.id==='Record01')!;
  state = signContract(state,label,data.musicians,5);
  await boot(page,state);
  await openRehearsal(page);
  const labels=(await snap(page)).dialogTexts;
  const heading=labels.find((item:any)=>item.text==='Record company');
  const company=labels.find((item:any)=>item.text===label.name);
  expect(heading).toBeTruthy();
  expect(company).toBeTruthy();
  // The bundled help reference places values about 100 pixels after labels;
  // exact rich-text tab stops remain unrecovered. Keep the two columns clear.
  await page.screenshot({path:'test-results/fidelity-signed-album-status.png'});
  expect(company.x).toBe(627);
  expect(company.x-(heading.x+heading.width)).toBeGreaterThanOrEqual(2);
  await click(page,550,517);
  await expect.poll(async()=>(await snap(page)).previewPlaying).toBe(true);
  expect((await snap(page)).recordingPlayback.tracks).toHaveLength(5);
  await click(page,550,517);
  await expect.poll(async()=>(await snap(page)).previewPlaying).toBe(false);
  await click(page,550,517);
  await expect.poll(async()=>(await snap(page)).previewPlaying).toBe(true);
  await click(page,685,516);
  expect((await snap(page)).modal).toBe(null);
  await expect.poll(async()=>(await snap(page)).previewPlaying).toBe(false);
});

test('a singer permits leaving rehearsal after the original band-name reminder is acknowledged', async ({ page }) => {
  await boot(page, fixture(true));
  await openRehearsal(page);
  await click(page, 685, 516);
  let snapshot = await snap(page);
  expect(snapshot.modal).toBe('rehearsal');
  expect(snapshot.tutorialId).toBe('ECOCForgetBandName');
  await page.screenshot({ path: 'test-results/fidelity-name-guidance.png' });
  await acknowledgeCard(page);
  snapshot = await snap(page);
  expect(snapshot.modal).toBe('rehearsal');
  expect(snapshot.seenTutorials).toContain('ECOCForgetBandName');
  await click(page, 685, 516);
  expect((await snap(page)).modal).toBe(null);
  expect((await snap(page)).tutorialId).toBe(null);
});

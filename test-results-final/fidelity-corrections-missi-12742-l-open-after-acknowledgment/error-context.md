# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fidelity-corrections.spec.ts >> missing singer guidance keeps rehearsal open after acknowledgment
- Location: tests\browser\fidelity-corrections.spec.ts:121:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic "Rock Manager canvas game" [ref=e2]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import { createRequire } from 'node:module';
  3   | import { readFileSync } from 'node:fs';
  4   | import { newGame, recruit, licenseSong, type GameState } from '../../src/game/model';
  5   | import { bandmateMood, BANDMATE_RULES } from '../../src/game/bandmates';
  6   | import { startRecording, finishRecording, signContract } from '../../src/game/recording';
  7   | 
  8   | const data: typeof import('../../src/generated/game-data.json') = createRequire(import.meta.url)('../../src/generated/game-data.json');
  9   | const actorData: typeof import('../../src/generated/actor-animation.json')=createRequire(import.meta.url)('../../src/generated/actor-animation.json');
  10  | const {PNG}=createRequire(import.meta.url)('pngjs');
  11  | const snap = (page: Page) => page.evaluate(() => (window as any).__rockManager.snapshot());
  12  | async function click(page: Page, x: number, y: number) {
  13  |   await page.mouse.click(x, y);
  14  |   await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  15  | }
  16  | function fixture(singer = false): GameState {
  17  |   let state: GameState = { ...newGame(200000), started: true, tutorialEnabled: false, bandName: 'The Unknowns' };
  18  |   state = recruit(state, data.musicians, 0, 'RMCJerka', 'Guitar');
  19  |   if (singer) state = recruit(state, data.musicians, 4, 'RMCSussie', 'Vocals');
  20  |   return state;
  21  | }
  22  | async function boot(page: Page, state: GameState) {
  23  |   await page.addInitScript(value => localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(value)), state);
  24  |   await page.goto('http://127.0.0.1:5173');
> 25  |   await page.waitForFunction(() => '__rockManager' in window);
      |              ^ Error: page.waitForFunction: Test timeout of 30000ms exceeded.
  26  |   await page.keyboard.press('Escape');
  27  |   await page.waitForTimeout(80);
  28  |   if ((await snap(page)).modal === null && (await snap(page)).running) await page.keyboard.press('Space');
  29  | }
  30  | async function acknowledgeCard(page: Page) {
  31  |   const state = await snap(page);
  32  |   expect(state.tutorialButtonY).toBeGreaterThan(0);
  33  |   await click(page, 400, state.tutorialButtonY + 16);
  34  | }
  35  | async function openRehearsal(page:Page) {
  36  |   // The first city pointer also unlocks browser audio. Wait for the rendered
  37  |   // scene before sending a subsequent click to a dialog coordinate.
  38  |   for(let attempt=0;attempt<2&&(await snap(page)).modal!=='rehearsal';attempt++){
  39  |     await click(page,306,40);
  40  |     await page.waitForTimeout(80);
  41  |   }
  42  |   await expect.poll(async()=>(await snap(page)).modal).toBe('rehearsal');
  43  | }
  44  | async function expectSourcePortrait(page:Page,textureKey:string,x:number,y:number) {
  45  |   const source=actorData.staticPortraits.find(p=>p.textureKey===textureKey)!;
  46  |   expect(source).toBeTruthy();
  47  |   const expected=PNG.sync.read(readFileSync('analysis/original/'+source.path));
  48  |   const rendered=PNG.sync.read(await page.screenshot());
  49  |   let mismatches=0,compared=0;const differenceRows=new Set<number>();
  50  |   // The original drum/header badge overlaps the HUD photo's top nine rows.
  51  |   // Compare the uncovered portrait, including eyes/mouth; rehearsal has no badge.
  52  |   const firstRow=source.size==='medium'?10:4;
  53  |   for(let row=firstRow;row<source.height-4;row++)for(let column=4;column<source.width-4;column++){
  54  |     const original=(row*source.width+column)*4,pixel=((y+row)*800+x+column)*4;
  55  |     if(expected.data[original+3]!==255)continue;
  56  |     compared++;
  57  |     if([0,1,2].some(c=>Math.abs(expected.data[original+c]-rendered.data[pixel+c])>2)){mismatches++;differenceRows.add(row);}
  58  |   }
  59  |   expect(compared).toBeGreaterThan(1000);
  60  |   expect(mismatches,textureKey+' actual canvas pixels must match the recovered mood portrait; rows '+[...differenceRows].join(',')).toBe(0);
  61  | }
  62  | 
  63  | test('training completion uses a compact original event card within the canvas', async ({ page }) => {
  64  |   const state = fixture(true);
  65  |   const action = BANDMATE_RULES.actions.find(a => a.id === 'ActTrainMusicality')!;
  66  |   state.day = action.duration;
  67  |   state.bandmates.lastDay = state.day;
  68  |   state.bandmates.nextId = 2;
  69  |   state.bandmates.training.push({ id: 'training1', musicianId: 'RMCJerka', actionId: action.id,
  70  |     type: action.trainingType!, startDay: 0, duration: action.duration, completed: true });
  71  |   state.bandmates.completions.push({ id: 'training1', musicianId: 'RMCJerka', actionId: action.id,
  72  |     day: state.day, seen: false });
  73  |   await boot(page, state);
  74  |   await expect.poll(async () => (await snap(page)).modal).toBe('training-result');
  75  |   const bounds = (await snap(page)).eventCardBounds;
  76  |   expect(bounds).toBeTruthy();
  77  |   expect(bounds.width).toBeGreaterThanOrEqual(340);
  78  |   expect(bounds.width).toBeLessThanOrEqual(360);
  79  |   expect(bounds.x).toBeGreaterThanOrEqual(0);
  80  |   expect(bounds.y).toBeGreaterThanOrEqual(0);
  81  |   expect(bounds.x + bounds.width).toBeLessThanOrEqual(800);
  82  |   expect(bounds.y + bounds.height).toBeLessThanOrEqual(600);
  83  |   await expect.poll(async()=>(await snap(page)).speechPlayback.key).toMatch(/^a01ea2000[12]$/);
  84  |   await expect.poll(async()=>(await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  85  |   await expect.poll(async()=>(await snap(page)).actors.find((a:any)=>a.id==='actor01')?.cueIndex??-1).toBeGreaterThanOrEqual(0);
  86  |   const spoken=await snap(page),actor=spoken.actors.find((a:any)=>a.id==='actor01');
  87  |   const cues=(actorData.cues as Record<string,number[]>)[spoken.speechPlayback.key];
  88  |   expect(cues).toBeTruthy();
  89  |   const opening=Math.min(3,Math.round(cues[actor.cueIndex]/33));
  90  |   const sourceFrames=opening===0||opening===3?[5+opening]:[5+opening,8+opening];
  91  |   expect(sourceFrames.map(n=>'moves_'+String(n).padStart(4,'0'))).toContain(actor.mouth);
  92  |   await page.screenshot({ path: 'test-results/fidelity-training-event.png' });
  93  |   await page.keyboard.press('Escape');
  94  |   expect((await snap(page)).bandmates.completions[0].seen).toBe(true);
  95  | });
  96  | 
  97  | test('HUD and rehearsal portraits use recovered mood images and the album status has no song chooser', async ({ page }) => {
  98  |   const state = fixture(true);
  99  |   state.bandmates.people.find(p => p.musicianId === 'RMCJerka')!.mood = .05;
  100 |   const mood = bandmateMood(state, 'RMCJerka');
  101 |   const suffix = (mood === 'Furious' ? 'Angry' : mood).toLowerCase();
  102 |   await boot(page, state);
  103 |   let snapshot = await snap(page);
  104 |   expect(snapshot.moodPortraits.find((p: any) => p?.id === 'RMCJerka')).toMatchObject({
  105 |     medium: `actor-static-actor01-${suffix}-medium`, large: `actor-static-actor01-${suffix}-large`,
  106 |   });
  107 |   await expectSourcePortrait(page,`actor-static-actor01-${suffix}-medium`,272,51);
  108 |   await page.screenshot({ path: 'test-results/fidelity-hud-mood.png' });
  109 |   await openRehearsal(page);
  110 |   snapshot = await snap(page);
  111 |   expect(snapshot.modal).toBe('rehearsal');
  112 |   expect(snapshot.moodPortraits.find((p: any) => p?.id === 'RMCJerka').large).toBe(`actor-static-actor01-${suffix}-large`);
  113 |   await expectSourcePortrait(page,`actor-static-actor01-${suffix}-large`,109,390);
  114 |   const labels = snapshot.dialogTexts.map((item: any) => item.text);
  115 |   expect(labels.join('\n')).not.toMatch(/Choose song/i);
  116 |   for (const label of ['Record company', 'royalty', 'Advance', 'Album recorded', 'Sleeve designed',
  117 |     'release date', 'copies sold', 'Revenue', 'To publisher', 'To label', 'Earned', 'Incl. advance']) expect(labels.map((value:string)=>value.toLowerCase())).toContain(label.toLowerCase());
  118 |   await page.screenshot({ path: 'test-results/fidelity-rehearsal-status.png' });
  119 | });
  120 | 
  121 | test('missing singer guidance keeps rehearsal open after acknowledgment', async ({ page }) => {
  122 |   await boot(page, fixture());
  123 |   await openRehearsal(page);
  124 |   await click(page, 685, 516);
  125 |   let snapshot = await snap(page);
```
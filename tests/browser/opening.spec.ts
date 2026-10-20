import { test, expect, type Page } from '@playwright/test';
const baseURL=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5173';
test.afterEach(async ({page}) => { if (!page.isClosed()) await page.goto('about:blank'); });
import { createRequire } from 'node:module';
import type { GameState } from '../../src/game/model';
import { candidates } from '../../src/game/model';
import { newGame, recruit, licenseSong } from '../../src/game/model';
import { startRecording, evaluateDemo } from '../../src/game/recording';
const data: typeof import('../../src/generated/game-data.json') = createRequire(import.meta.url)('../../src/generated/game-data.json');
const { PNG } = createRequire(import.meta.url)('pngjs');
const { readFileSync } = createRequire(import.meta.url)('node:fs');

type SourceLayout = {id:string;bounds:{x:number;y:number;width:number;height:number};start?:{x:number;y:number};begin?:{x:number;y:number};buy?:{x:number;y:number};ok?:{x:number;y:number};cancel?:{x:number;y:number};close?:{x:number;y:number};selectRows?:{id:string;x:number;y:number}[]};
async function snapshot(page: Page): Promise<GameState & { sourceLayout?:SourceLayout; modal: string | null; backgroundModal: string | null; recruitOffset: number; recruitMaxOffset: number; tutorialId: string | null; tutorialButtonY: number; availablePlaces: string[]; cityFrames: { name: string; offset: number; visible: boolean }[]; selectedStudioId: string; selectedLabelId: string; offerIndex: number; previewPlaying: boolean; running: boolean; mixerKnobs: { name: string; key: string; x: number; y: number; anchorX: number; anchorY: number }[] }> {
  return page.evaluate(() => (window as unknown as { __rockManager: { snapshot(): never } }).__rockManager.snapshot());
}
async function click(page: Page, x: number, y: number, dismiss = true): Promise<void> {
  await page.mouse.click(x, y);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  if (dismiss && (await snapshot(page)).tutorialId) {
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
}

async function playback(page: Page): Promise<{ mode: string; tracks: { channel: number; duration: number; loop: boolean; file: string }[] }> {
  return page.evaluate(() => (window as any).__rockManager.snapshot().recordingPlayback);
}

async function startMission(page: Page, dismiss = true): Promise<void> {
  await click(page, 320, 371);
  expect((await snapshot(page)).modal).toBe('missions');
  await page.screenshot({ path: 'test-results/missions.png' });
  const chooser=(await snapshot(page)).sourceLayout!;
  expect(chooser.id).toBe('DlgMissionChoose');
  await click(page, chooser.start!.x, chooser.start!.y);
  expect((await snapshot(page)).modal).toBe('briefing');
  await page.screenshot({ path: 'test-results/briefing.png' });
  const briefing=(await snapshot(page)).sourceLayout!;
  expect(briefing.id).toBe('DlgMissionIntro');
  await click(page, briefing.begin!.x, briefing.begin!.y, dismiss);
}

async function buyFirstSong(page:Page,dismiss=true):Promise<void>{
  const before=await snapshot(page),layout=before.sourceLayout!;
  expect(before.modal).toBe('publisher');expect(layout.id).toBe('DlgPublish');
  // Native publisher opens with no song selected: the license control is disabled.
  await click(page,layout.buy!.x,layout.buy!.y,false);
  expect((await snapshot(page)).ownedSongs).toEqual(before.ownedSongs);
  expect((await snapshot(page)).money).toBe(before.money);
  expect((await snapshot(page)).modal).toBe('publisher');
  const row=layout.selectRows!.find(row=>row.id==='Sng01');expect(row).toBeTruthy();
  await click(page,row!.x,row!.y,false);
  const selected=(await snapshot(page)).sourceLayout!;
  await click(page,selected.buy!.x,selected.buy!.y,dismiss);
}
async function confirmMixerExit(page:Page,dismiss=true):Promise<void>{
  expect((await snapshot(page)).modal).toBe('finish-demo');
  const layout=(await snapshot(page)).sourceLayout!;expect(layout.id).toBe('DlgMixerExit');
  await click(page,layout.ok!.x,layout.ok!.y,dismiss);
}
async function discardDemo(page:Page,confirm:boolean):Promise<void>{
  expect((await snapshot(page)).modal).toBe('replace-demo');
  const buttons=await page.evaluate(()=>(window as any).__rockManager.snapshot().eventCardButtons);
  const point=confirm?buttons.confirm:buttons.cancel;expect(point).toBeTruthy();
  await click(page,point.x,point.y);
}

test('canvas opening, recruitment, payday and persistence work without HTML controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  expect((await snapshot(page)).modal).toBe('menu');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('button, input, select, textarea')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/main-menu.png' });
  // Both cap/body joins must be black, not reveal the grey parent frame.
  const skin = PNG.sync.read(await page.screenshot({ clip: { x: 251, y: 352, width: 142, height: 33 } }));
  for (const x of [5, 132]) {
    const index = (14 * skin.width + x) * 4;
    expect(Math.max(...skin.data.subarray(index, index + 3))).toBeLessThan(5);
  }
  const loadedFonts = await page.evaluate(() => Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status })));
  expect(loadedFonts.filter((face) => face.status === 'loaded')).toHaveLength(6);
  expect(loadedFonts.map((face) => face.family.replaceAll('"', '')).sort()).toEqual(['Arial', 'Arial', 'Courier New', 'Courier New', 'Verdana', 'Verdana'].sort());
  await startMission(page);
  expect((await snapshot(page)).modal).toBeNull();
  await page.screenshot({ path: 'test-results/city.png' });
  // The original one-bit masks continue the header's black sides and round
  // both city corners at y=550. The transport controls sit below that frame.
  const cityFrame = PNG.sync.read(await page.screenshot());
  const rgb = (x: number, y: number) => [...cityFrame.data.subarray((y * 800 + x) * 4, (y * 800 + x) * 4 + 3)];
  for (const [x, y] of [[10, 300], [790, 300], [30, 549], [770, 549], [40, 550], [60, 552], [400, 553], [400, 599]]) {
    expect(rgb(x, y)).toEqual([0, 0, 0]);
  }
  expect(rgb(30, 535).some((v) => v > 0)).toBe(true);
  expect(rgb(770, 535).some((v) => v > 0)).toBe(true);
  await click(page, 306, 40);
  expect((await snapshot(page)).modal).toBe('rehearsal');
  await click(page, 150, 435);
  expect((await snapshot(page)).modal).toBe('recruit');
  await page.screenshot({ path: 'test-results/recruitment.png' });
  await click(page, 400, 547);
  expect((await snapshot(page)).band[0]?.musicianId).toBe('RMCJerka');
  expect((await snapshot(page)).money).toBe(100000);
  await hireThroughCanvas(page,4,'RMCSussie');
  await click(page,648,518); // Original one-time name reminder leaves band underneath.
  await click(page,648,518);
  await click(page,230,460);
  expect((await snapshot(page)).modal).toBe('publisher');
  await page.screenshot({ path: 'test-results/publisher.png' });
  await buyFirstSong(page);
  expect((await snapshot(page)).modal).toBeNull();
  expect((await snapshot(page)).money).toBe(89000);
  expect((await snapshot(page)).ownedSongs).toEqual(['Sng01']);
  await click(page, 306, 40);
  expect((await snapshot(page)).modal).toBe('rehearsal');
  expect((await snapshot(page)).selectedSong).toBe('Sng01');
  await page.screenshot({ path: 'test-results/licensed-rehearsal.png' });
  await click(page, 648, 518);
  for (let i = 0; i < 7; i++) await click(page, 720, 581);
  expect((await snapshot(page)).day).toBe(7);
  expect((await snapshot(page)).money).toBe(88490);
  expect((await snapshot(page)).ownedSongs).toEqual(['Sng01']);
  await page.reload();
  await page.waitForFunction(() => '__rockManager' in window);
  expect((await snapshot(page)).modal).toBe('menu');
  expect((await snapshot(page)).band[0]?.musicianId).toBe('RMCJerka');
  expect((await snapshot(page)).money).toBe(88490);
  await click(page, 170, 371);
  await click(page, 306, 40);
  await click(page, 150, 517);
  expect((await snapshot(page)).modal).toBe('rename');
  for (let i = 0; i < 28; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('The Brickheads');
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).bandName).toBe('The Brickheads');
  expect(errors).toEqual([]);
});

async function hireThroughCanvas(page: Page, slot: number, id: string): Promise<void> {
  const positions = [[150, 435], [130, 185], [280, 150], [450, 170], [450, 435]];
  const [x, y] = positions[slot];
  await click(page, x, y);
  expect((await snapshot(page)).modal).toBe('recruit');
  const rows = candidates(await snapshot(page), data.musicians, slot);
  const index = rows.findIndex((m) => m.id === id);
  expect(index).toBeGreaterThanOrEqual(0);
  const desiredOffset = Math.max(0, index - 3);
  while ((await snapshot(page)).recruitOffset < desiredOffset) await click(page, 616, 509);
  await click(page, 421, 403 + (index - desiredOffset) * 32);
  await click(page, 400, 547);
  expect((await snapshot(page)).band[slot]?.musicianId).toBe(id);
}

test('complete canvas tutorial hires a band, buys a song, mixes a demo and negotiates a saved record contract', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (/Texture key.*not found|Failed to load resource/.test(message.text())) errors.push(message.text()); });
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await startMission(page);
  await click(page, 306, 40);
  for (const [slot, id] of [[0, 'RMCJerka'], [1, 'RMCTony'], [2, 'RMCRaymond'], [3, 'RMCGurra'], [4, 'RMCSussie']] as const) await hireThroughCanvas(page, slot, id);
  await click(page, 150, 517);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Rebel Youth');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).modal).toBe('rehearsal');
  expect((await snapshot(page)).bandName).toBe('Rebel Youth');
  await click(page, 680, 518, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroducePublisher');
  await page.keyboard.press('Enter');
  await click(page, 230, 460);
  await buyFirstSong(page, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceStudio');
  await page.keyboard.press('Enter');
  await click(page, 707, 350);
  expect((await snapshot(page)).modal).toBe('studio');
  expect((await snapshot(page)).selectedStudioId).toBe('Studio01');
  await page.screenshot({ path: 'test-results/studio.png' });
  await click(page, 449, 418, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceMixer');
  expect((await snapshot(page)).money).toBe(83000);
  await page.screenshot({ path: 'test-results/tutorial-mixer.png' });
  await click(page, 190, 466, false); // Tutorial shade must block finishing.
  expect((await snapshot(page)).modal).toBe('mixer');
  await page.keyboard.press('Enter');
  await page.screenshot({ path: 'test-results/mixer.png' });
  // The native volume thumb changes a persisted mixer channel.
  await page.mouse.move(310, 377);
  await page.mouse.down();
  await page.mouse.move(310, 392, { steps: 5 });
  await page.mouse.up();
  expect((await snapshot(page)).recording!.channels[0].volume).toBeLessThan(70);
  expect((await snapshot(page)).recording!.channels[0].volume).toBeGreaterThan(30);
  await click(page, 320, 324);
  expect((await snapshot(page)).recording!.channels[0].muted).toBe(true);
  await click(page, 320, 324);
  expect((await snapshot(page)).recording!.channels[0].muted).toBe(false);
  await click(page, 100, 397);
  await expect.poll(async () => (await snapshot(page)).previewPlaying).toBe(true);
  await click(page, 152, 397);
  expect((await snapshot(page)).previewPlaying).toBe(false);
  await page.reload();
  await page.waitForFunction(() => '__rockManager' in window);
  await click(page, 170, 371);
  expect((await snapshot(page)).modal).toBe('mixer');
  expect((await snapshot(page)).money).toBe(83000);
  expect((await snapshot(page)).tutorialId).toBeNull();
  await click(page, 190, 466, false);
  expect((await snapshot(page)).backgroundModal).toBe('mixer');
  await confirmMixerExit(page, false);
  expect((await snapshot(page)).demo?.quality).toBeGreaterThan(0.5);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceLabel');
  await page.screenshot({ path: 'test-results/tutorial-label.png' });
  // Reload before acknowledgement: the label introduction must resume.
  await page.reload();
  await page.waitForFunction(() => '__rockManager' in window);
  await click(page, 170, 371, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceLabel');
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).availablePlaces).toEqual(expect.arrayContaining(['record01', 'record03']));
  await click(page, 160, 340);
  expect((await snapshot(page)).modal).toBe('label');
  await page.screenshot({ path: 'test-results/label.png' });
  await click(page, 240, 488);
  expect((await snapshot(page)).modal).toBe('contract');
  expect((await snapshot(page)).backgroundModal).toBe('label');
  await page.screenshot({ path: 'test-results/contract.png' });
  await click(page, 630, 477); // Declining negotiation does not sign or pay.
  expect((await snapshot(page)).contract).toBeNull();
  expect((await snapshot(page)).money).toBe(83000);
  await click(page, 240, 488);
  const offerIndex = (await snapshot(page)).offerIndex;
  await click(page, 654, 295);
  expect((await snapshot(page)).offerIndex).toBe(offerIndex + 1);
  await click(page, 320, 477);
  const signed = await snapshot(page);
  expect(signed.contract?.labelId).toBe('Record01');
  expect(signed.contract?.royalty).toBe(0.1);
  expect(signed.money).toBe(83000 + signed.contract!.advance);
  await page.screenshot({ path: 'test-results/contract-signed.png' });
  await click(page, 510, 488, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceSleeve');
  await page.keyboard.press('Enter');
  await page.reload();
  await page.waitForFunction(() => '__rockManager' in window);
  expect((await snapshot(page)).contract).toEqual(signed.contract);
  expect((await snapshot(page)).money).toBe(signed.money);
  await click(page, 170, 371);
  await click(page, 306, 40);
  await page.screenshot({ path: 'test-results/band-with-contract.png' });
  expect((await snapshot(page)).seenTutorials).toEqual(expect.arrayContaining(['ECOCMis1IntroduceMixer', 'ECOCMis1IntroduceLabel', 'ECOCMis1IntroduceSleeve']));
  expect(errors).toEqual([]);
  await expect(page.locator('button, input, select, textarea')).toHaveCount(0);
});

test('a poor demo is rejected, the retry tutorial appears, and cancelling a replacement does not charge rental', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await startMission(page);
  await click(page, 306, 40);
  await hireThroughCanvas(page, 0, 'RMCJerka');
  await hireThroughCanvas(page,4,'RMCSussie');
  await click(page,680,518);
  await click(page,680,518);
  await click(page, 230, 460);
  await buyFirstSong(page);
  for (let i = 0; i < 3; i++) await click(page, 65, 572);
  await click(page, 180, 377);
  expect((await snapshot(page)).selectedStudioId).toBe('Studio04');
  await click(page, 449, 418);
  expect((await snapshot(page)).money).toBe(87000);
  await click(page,320,324); // Mute singer for the deliberately poor one-track demo.
  await click(page, 190, 466);
  await confirmMixerExit(page);
  expect((await snapshot(page)).demo?.quality).toBe(0);
  await click(page, 351, 340);
  await click(page, 240, 488);
  expect((await snapshot(page)).modal).toBe('rejection');
  expect((await snapshot(page)).backgroundModal).toBe('label');
  const refusal=(await snapshot(page)).sourceLayout!;
  expect(refusal.id).toBe('DlgRecordRefuse');
  const refusalTexts=await page.evaluate(()=>(window as any).__rockManager.snapshot().dialogTexts.map((entry:{text:string})=>entry.text).join('\n'));
  const refusalState=await snapshot(page),refusalLabel=data.tutorialGameplay.labels.find(label=>label.id===refusalState.selectedLabelId)!;
  const originalFeedback=evaluateDemo(refusalState,refusalLabel,data.musicians).reason;
  expect(originalFeedback.length).toBeGreaterThan(0);
  expect(refusalTexts).toContain(originalFeedback);
  expect(refusalTexts).not.toContain('The demo needs stronger musicians or a better studio.');
  await page.screenshot({ path: 'test-results/demo-rejected.png' });
  await click(page, refusal.close!.x, refusal.close!.y, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1NoContract');
  await page.screenshot({ path: 'test-results/tutorial-retry.png' });
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).contract).toBeNull();
  expect((await snapshot(page)).money).toBe(87000);
  await click(page, 180, 377);
  await click(page, 449, 418);
  expect((await snapshot(page)).modal).toBe('replace-demo');
  await discardDemo(page,false);
  expect((await snapshot(page)).modal).toBe('studio');
  expect((await snapshot(page)).money).toBe(87000);
  await click(page, 449, 418);
  await discardDemo(page,true);
  expect((await snapshot(page)).modal).toBe('mixer');
  expect((await snapshot(page)).money).toBe(85000);
  // Original DlgMixerChooseMusicianScript charges on OK, never on row selection.
  await click(page, 373, 156);
  expect((await snapshot(page)).modal).toBe('settings');
  await click(page, 175, 170);
  expect((await snapshot(page)).modal).toBe('session');
  expect((await snapshot(page)).backgroundModal).toBe('settings');
  await click(page, 192, 410);
  expect((await snapshot(page)).modal).toBe('session');
  expect((await snapshot(page)).previewPlaying).toBe(false);
  await click(page, 420, 400);
  expect((await snapshot(page)).modal).toBe('session');
  expect((await snapshot(page)).recording!.channels[1].musicianId).toBe('RMCJerka');
  expect((await snapshot(page)).money).toBe(85000);
  await page.screenshot({ path: 'test-results/session-musician.png' });
  await click(page, 568, 518);
  expect((await snapshot(page)).modal).toBe('settings');
  expect((await snapshot(page)).money).toBe(85000);
  expect((await snapshot(page)).recording!.channels[1].musicianId).toBe('RMCJerka');
  await click(page, 175, 170);
  await click(page, 420, 400);
  await click(page, 375, 518);
  expect((await snapshot(page)).recording!.channels[1].musicianId).toBe('Stud04');
  expect((await snapshot(page)).money).toBe(69000);
  await click(page, 175, 170);
  await click(page, 375, 518);
  expect((await snapshot(page)).money).toBe(69000);
  expect(errors).toEqual([]);
});

test('mixer Settings opens, effects preview works, mute updates without rebuilding, and knobs retain native anchors', async ({ page }) => {
  test.setTimeout(60000);
  // Regression: exporting these ARGB sprites as opaque produces the white desk
  // borders and solid button glow reported by the user.
  const activated = PNG.sync.read(readFileSync('public/assets/button_mute02.png'));
  const alpha = Array.from(activated.data as Uint8Array).filter((_value, index) => index % 4 === 3);
  expect(alpha.filter((a) => a === 0)).toHaveLength(60);
  expect(alpha.filter((a) => a > 0 && a < 255)).toHaveLength(255);
  let state = newGame(100000);
  for (const [slot, id, instrument] of [[0, 'RMCJerka', 'Guitar'], [1, 'RMCTony', 'Guitar'], [2, 'RMCGullan', 'Drums'], [3, 'RMCGurra', 'Bass'], [4, 'RMCSussie', 'Vocals']] as const) state = recruit(state, data.musicians, slot, id, instrument);
  state = startRecording(licenseSong({ ...state, started: true, tutorialEnabled: false }, data.songs, 'Sng01'), data.tutorialGameplay, 'Studio01', 'Sng01');
  await page.addInitScript((save) => localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(save)), state);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await click(page, 170, 371);
  const anchors = (s: Awaited<ReturnType<typeof snapshot>>) => s.mixerKnobs.map(({ name, anchorX, anchorY }) => ({ name, anchorX, anchorY }));
  const original = await snapshot(page);
  expect(original.mixerKnobs[0]).toMatchObject({ name: 'mixer-knob-master', anchorX: 286, anchorY: 370 });
  expect(original.mixerKnobs[1]).toMatchObject({ name: 'mixer-knob-pan-0', anchorX: 369, anchorY: 253 });
  await page.mouse.move(320, 274); await page.mouse.down();
  await page.mouse.move(332, 274, { steps: 6 }); await page.mouse.up();
  const turned = await snapshot(page);
  expect(turned.recording!.channels[0].pan).toBeGreaterThan(20);
  expect(turned.mixerKnobs[1].key).not.toBe(original.mixerKnobs[1].key);
  expect(anchors(turned)).toEqual(anchors(original));
  await page.mouse.move(225, 395); await page.mouse.wheel(0, -120);
  await page.waitForTimeout(100);
  expect(anchors(await snapshot(page))).toEqual(anchors(original));
  await click(page, 319, 323);
  expect((await snapshot(page)).recording!.channels[0].muted).toBe(true);
  expect(anchors(await snapshot(page))).toEqual(anchors(turned));
  await click(page, 319, 323);
  expect((await snapshot(page)).recording!.channels[0].muted).toBe(false);
  await page.screenshot({ path: 'test-results/mixer-controls-corrected.png' });
  await click(page, 320, 197);
  expect((await snapshot(page)).modal).toBe('settings');
  expect((await snapshot(page)).backgroundModal).toBe('mixer');
  await page.screenshot({ path: 'test-results/mixer-settings-before.png' });
  await click(page, 175, 293);
  expect((await snapshot(page)).recording!.channels[0].effects?.delay.active).toBe(true);
  await click(page, 175, 346);
  expect((await snapshot(page)).recording!.channels[0].effects?.timeShift.active).toBe(true);
  await click(page, 270, 336);
  expect((await snapshot(page)).recording!.channels[0].effects?.timeShift.mode).toBe(true);
  await page.screenshot({ path: 'test-results/mixer-settings.png' });
  await click(page, 192, 463);
  await expect.poll(async () => (await snapshot(page)).previewPlaying).toBe(true);
  expect(await playback(page)).toMatchObject({ mode: 'instrument', tracks: [{ channel: 0, loop: false }] });
  expect((await playback(page)).tracks).toHaveLength(1);
  await click(page, 310, 463);
  expect((await snapshot(page)).modal).toBe('mixer');
  // ClosedFX renders the edited loop and schedules Mixer.playSoon: the old
  // one-shot is cancelled and the complete synchronized mix resumes.
  await expect.poll(async () => (await snapshot(page)).previewPlaying).toBe(true);
  await expect.poll(async () => (await playback(page)).mode).toBe('mix');
  const mix = await playback(page);
  expect(mix.mode).toBe('mix');
  expect(mix.tracks).toHaveLength(5);
  expect(new Set(mix.tracks.map((t) => t.duration)).size).toBe(1);
  expect(mix.tracks.every((t) => t.loop)).toBe(true);
  await click(page, 152, 397);
  expect((await snapshot(page)).recording!.channels[0].effects?.delay.active).toBe(true);
  await click(page, 380, 197);
  expect((await snapshot(page)).recording!.channels[1].musicianId).toBe('RMCGullan');
  await page.screenshot({ path: 'test-results/mixer-settings-native-reference.png' });
  const native = PNG.sync.read(readFileSync('analysis/original/runtime/reference/stage/native-006.png'));
  const current = PNG.sync.read(await page.screenshot());
  const difference = (x: number, y: number, width: number, height: number) => {
    let error = 0;
    for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) {
      const offset = (row * 800 + column) * 4;
      for (let component = 0; component < 3; component++) error += Math.abs(native.data[offset + component] - current.data[offset + component]);
    }
    return error / (width * height * 3);
  };
  // Compare fixed regions, excluding changing skill values and animated faces.
  expect(difference(410, 104, 4, 395)).toBeLessThan(3);
  expect(difference(234, 150, 80, 58)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('original instrument audio produces audible delay, chorus and phaser output, and previews end once', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(baseURL);
  const metrics = await page.evaluate(async () => {
    const modulePath = '/src/game/recording-audio.ts';
    const { RecordingAudio } = await import(/* @vite-ignore */ modulePath);
    const effects = () => ({ delay: { active: false, mix: 0.5, time: 0.6, decay: 0.3 }, timeShift: { active: false, mode: false, mix: 0.5, depth: 0.2, freq: 0.5 } });
    const channel = { musicianId: 'RMCJerka', instrument: 'Guitar', loopId: 'LO01Gt1', volume: 0, pan: 0, muted: true, effects: effects() };
    const renders: Float32Array[] = [];
    const completed: boolean[] = [];
    for (const kind of ['dry', 'delay', 'chorus', 'phaser']) {
      const context = new OfflineAudioContext(2, 18 * 44100, 44100);
      const audio = new RecordingAudio(context);
      channel.effects = effects();
      if (kind === 'delay') channel.effects.delay.active = true;
      if (kind === 'chorus' || kind === 'phaser') { channel.effects.timeShift.active = true; channel.effects.timeShift.mode = kind === 'phaser'; }
      await audio.play([channel], ['01gt1.ogg'], 127, { previewChannel: 0, bars: 8 });
      const rendered = await context.startRendering();
      renders.push(rendered.getChannelData(0));
      completed.push(!audio.playing && audio.diagnostics.tracks.length === 0);
    }
    const rms = (samples: Float32Array) => Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
    return { rms: renders.map(rms), differences: renders.slice(1).map((samples) => rms(samples.map((x, i) => x - renders[0][i]))), completed };
  });
  for (const rms of metrics.rms) expect(rms).toBeGreaterThan(0.01);
  for (const difference of metrics.differences) expect(difference).toBeGreaterThan(0.005);
  expect(metrics.completed).toEqual([true, true, true, true]);
});

test('recruitment stays over the band; wheel, thumb drag and track clicks scroll the actual list', async ({ page }) => {
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await startMission(page);
  await click(page, 306, 40);
  await click(page, 150, 435);
  expect((await snapshot(page)).backgroundModal).toBe('rehearsal');
  await click(page, 150, 517); // Parent rename button is visible but blocked.
  expect((await snapshot(page)).modal).toBe('recruit');
  const portrait = PNG.sync.read(readFileSync('public/assets/portrait-RMCJerka.png'));
  const rendered = PNG.sync.read(await page.screenshot({ clip: { x: 328, y: 141, width: 93, height: 98 } }));
  const rgb555 = Array.from(portrait.data.subarray(0, 12) as Uint8Array).map((value, index) => index % 4 === 3 ? value : ((value >> 3) << 3) | ((value >> 3) >> 2));
  expect(Array.from(rendered.data.subarray(0, 12))).toEqual(rgb555);
  await page.mouse.move(450, 403);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  expect((await snapshot(page)).recruitOffset).toBe(1);
  let state = await snapshot(page);
  await page.mouse.move(615, 422 + state.recruitOffset / state.recruitMaxOffset * 60);
  await page.mouse.down();
  await page.mouse.move(615, 483, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  state = await snapshot(page);
  expect(state.recruitOffset).toBe(state.recruitMaxOffset);
  expect(state.backgroundModal).toBe('rehearsal');
  await page.mouse.move(615, 482);
  await page.mouse.down();
  await page.mouse.move(615, 422, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  expect((await snapshot(page)).recruitOffset).toBe(0);
  await click(page, 616, 488);
  expect((await snapshot(page)).recruitOffset).toBe((await snapshot(page)).recruitMaxOffset);
  await page.screenshot({ path: 'test-results/recruitment-stacked.png' });
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).modal).toBe('rehearsal');
  expect((await snapshot(page)).backgroundModal).toBeNull();
  const cursor = PNG.sync.read(readFileSync('public/assets/cursor_enter_building01.png'));
  for (let i = 0; i < cursor.data.length; i += 4) if (cursor.data[i + 3]) {
    expect(cursor.data[i]).toBe(cursor.data[i + 1]);
    expect(cursor.data[i + 1]).toBe(cursor.data[i + 2]);
  }
});

test('city layers animate, dialogs pause them, and native cursors follow unlocked hotspots', async ({ page }) => {
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await startMission(page);
  expect((await snapshot(page)).availablePlaces).toEqual([]);
  const before = (await snapshot(page)).cityFrames.find((f) => f.name === 'radar01_0007')!.offset;
  await page.waitForTimeout(350);
  expect((await snapshot(page)).cityFrames.find((f) => f.name === 'radar01_0007')!.offset).not.toBe(before);
  await page.mouse.move(230, 460);
  await page.waitForTimeout(100);
  expect(await page.locator('canvas').evaluate((c) => (c as HTMLCanvasElement).style.cursor)).toContain('cursor_inactive01.png');
  await click(page, 230, 460);
  expect((await snapshot(page)).modal).toBeNull();
  await click(page, 306, 40);
  const paused = (await snapshot(page)).cityFrames;
  await page.waitForTimeout(350);
  expect((await snapshot(page)).cityFrames).toEqual(paused);
  await hireThroughCanvas(page,4,'RMCSussie');
  await click(page,680,518);
  await click(page,680,518);
  expect((await snapshot(page)).availablePlaces).toEqual(['publish01']);
  await page.mouse.move(230, 460);
  await page.waitForTimeout(100);
  expect(await page.locator('canvas').evaluate((c) => (c as HTMLCanvasElement).style.cursor)).toContain('cursor_enter_building01.png');
  await page.screenshot({ path: 'test-results/animated-city.png' });
  await click(page, 230, 460);
  expect((await snapshot(page)).modal).toBe('publisher');
});

test('older saves keep their band and cash when song fields are migrated', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rock-manager.mission01.v1', JSON.stringify({
    version: 1, missionId: 'Mission01', started: true, bandName: 'Old band', money: 42000, day: 3,
    startDate: '2001-03-13', band: [{ musicianId: 'RMCJerka', instrument: 'Guitar' }, null, null, null, null], muted: true,
  })));
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  const state = await snapshot(page);
  expect(state.bandName).toBe('Old band');
  expect(state.band[0]?.musicianId).toBe('RMCJerka');
  expect(state.money).toBe(42000);
  expect(state.ownedSongs).toEqual([]);
  expect(state.selectedSong).toBeNull();
});

test('dialogs pause the running clock, and corrupted saves recover to the opening menu', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rock-manager.mission01.v1', '{bad json'));
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  expect((await snapshot(page)).money).toBe(100000);
  await startMission(page);
  expect((await snapshot(page)).running).toBe(true);
  await click(page, 306, 40);
  await page.waitForTimeout(3200);
  expect((await snapshot(page)).day).toBe(0);
  await page.screenshot({ path: 'test-results/rehearsal.png' });
  const border = PNG.sync.read(await page.screenshot({ clip: { x: 60, y: 120, width: 6, height: 250 } }));
  let visibleGrey = 0;
  for (let i = 0; i < border.data.length; i += 4) {
    const [r, g, b] = border.data.subarray(i, i + 3);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(3);
    if (r > 100) visibleGrey++;
  }
  expect(visibleGrey).toBeGreaterThan(100);
});

test('native recruitment scroll controls change the candidate actually hired', async ({ page }) => {
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await startMission(page);
  await click(page, 306, 40);
  await click(page, 150, 435);
  await click(page, 616, 510);
  await click(page, 616, 510);
  await click(page, 420, 403);
  await page.screenshot({ path: 'test-results/recruitment-scrolled.png' });
  await click(page, 400, 547);
  expect((await snapshot(page)).band[0]?.musicianId).toBe('RMCKanga');
});

test('Mission01 tutorial cards follow recovered events, block input and persist acknowledgements', async ({ page }) => {
  await page.goto(baseURL);
  await page.waitForFunction(() => '__rockManager' in window);
  await startMission(page, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceCity');
  await page.screenshot({ path: 'test-results/tutorial-city.png' });
  await click(page, 306, 40, false);
  expect((await snapshot(page)).modal).toBeNull();
  await page.keyboard.press('Enter');
  await click(page, 306, 40, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceRehearsal');
  await page.screenshot({ path: 'test-results/tutorial-rehearsal.png' });
  await click(page, 150, 435, false);
  expect((await snapshot(page)).modal).toBe('rehearsal');
  await click(page, 400, (await snapshot(page)).tutorialButtonY + 18, false);
  await click(page,680,518,false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCNeedSinger');
  await page.keyboard.press('Enter');
  await hireThroughCanvas(page,4,'RMCSussie');
  await click(page,680,518,false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCForgetBandName');
  await page.keyboard.press('Enter');
  await click(page,680,518,false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroducePublisher');
  await page.screenshot({ path: 'test-results/tutorial-publisher.png' });
  await click(page, 400, (await snapshot(page)).tutorialButtonY + 18, false);
  await page.keyboard.press('Space');
  await click(page, 230, 460, false);
  await buyFirstSong(page, false);
  expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceStudio');
  await page.screenshot({ path: 'test-results/tutorial-studio.png' });
  const day = (await snapshot(page)).day;
  await page.waitForTimeout(3200);
  expect((await snapshot(page)).day).toBe(day);
  await click(page, 400, (await snapshot(page)).tutorialButtonY + 18, false);
  expect((await snapshot(page)).seenTutorials).toEqual([
    'ECOCMis1IntroduceCity', 'ECOCMis1IntroduceRehearsal', 'ECOCNeedSinger', 'ECOCForgetBandName', 'ECOCMis1IntroducePublisher', 'ECOCMis1IntroduceStudio',
  ]);
  await page.reload();
  await page.waitForFunction(() => '__rockManager' in window);
  await click(page, 170, 371, false);
  expect((await snapshot(page)).tutorialId).toBeNull();
  await click(page, 306, 40, false);
  expect((await snapshot(page)).tutorialId).toBeNull();
});


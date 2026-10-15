const testBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { newGame, recruit } from '../../src/game/model';
const data = createRequire(import.meta.url)('../../src/generated/game-data.json');
const actorEvidence = createRequire(import.meta.url)('../../analysis/original/actor-animation-evidence.json');
const snap = (page: Page) => page.evaluate(() => (window as any).__rockManager.snapshot());
async function click(page: Page, x: number, y: number) { await page.mouse.click(x, y); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); }
async function boot(page: Page) {
  let state = { ...newGame(200000), started: true, tutorialEnabled: false, bandName: 'Test band' };
  state = recruit(state, data.musicians, 0, 'RMCJerka', 'Guitar');
  state = recruit(state, data.musicians, 2, 'RMCRaymond', 'Drums');
  state = recruit(state,data.musicians,4,'RMCSussie','Vocals');
  await page.addInitScript(value => { if (!localStorage.getItem('rock-manager.mission01.v1')) localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(value)); }, state);
  await page.goto(testBaseURL); await page.waitForFunction(() => '__rockManager' in window);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100); await page.keyboard.press('Space'); await page.waitForTimeout(100);
  await click(page, 306, 40); await click(page, 150, 435);
  return state;
}

test('bandmate click speaks with original lip cues; gifts, relations and firing use canvas controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const initial = await boot(page);
  expect((await snap(page)).modal).toBe('bandmate');
  expect((await snap(page)).backgroundModal).toBe('rehearsal');
  await expect.poll(async () => (await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  expect((await snap(page)).feedbackAudio.key).toMatch(/^a01rb0[12]00/);
  const mouths = new Set<string>();
  for (let i = 0; i < 14; i++) {
    const state = await snap(page), actor = state.actors.find((a: any) => a.id === 'actor01');
    mouths.add(actor?.mouth);
    if (state.speechPlayback.playing && actor?.cueIndex >= 0) {
      const opening = Math.min(3, Math.round(actorEvidence.cues[state.speechPlayback.key][actor.cueIndex] / 33));
      const frames = opening === 0 || opening === 3 ? [5 + opening] : [5 + opening, 8 + opening];
      expect(frames.map(n => 'moves_' + String(n).padStart(4, '0'))).toContain(actor.mouth);
    }
    await page.waitForTimeout(80);
  }
  expect(mouths.size).toBeGreaterThan(1);
  await page.screenshot({ path: 'test-results/bandmate-speaking.png' });
  await click(page, 560, 185);
  expect((await snap(page)).modal).toBe('bandmate-action');
  await page.screenshot({ path: 'test-results/bandmate-gift.png' });
  // Beer, whiskey, tickets, shades, then leather trousers.
  for (let i = 0; i < 4; i++) await click(page, 405, 331);
  await click(page, 256, 331);
  expect((await snap(page)).modal).toBe('bandmate');
  expect((await snap(page)).money).toBe(initial.money - 800);
  expect((await snap(page)).bandmates.people.find((p: any) => p.musicianId === 'RMCJerka').gifts).toContain('ActGiftPants');
  await expect.poll(async () => (await snap(page)).feedbackAudio.key).toMatch(/^a01rc0100/);
  await expect.poll(async () => (await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  await click(page, 560, 292); // Relations -> Slander.
  await click(page, 256, 331);
  expect((await snap(page)).money).toBe(initial.money - 1800);
  await expect.poll(async () => (await snap(page)).feedbackAudio.key).toMatch(/^a01re0200/);
  await page.keyboard.press('Escape');
  expect((await snap(page)).modal).toBe('rehearsal');
  expect((await snap(page)).speechPlayback.playing).toBe(false);
  await click(page, 150, 435); await click(page, 560, 350);
  await click(page, 256, 331);
  expect((await snap(page)).modal).toBe('rehearsal');
  expect((await snap(page)).band[0]).toBeNull();
  await page.reload(); await page.waitForFunction(() => '__rockManager' in window);
  expect((await snap(page)).band[0]).toBeNull();
  expect((await snap(page)).money).toBe(initial.money - 1800);
  expect(errors).toEqual([]);
});

test('training cancels without charge, books dates, completes once and survives reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const initial = await boot(page);
  await click(page, 560, 235);
  await click(page, 405, 331); await click(page, 405, 331); // Music lessons.
  await click(page, 256, 331);
  expect((await snap(page)).modal).toBe('bandmate-training');
  await page.screenshot({ path: 'test-results/bandmate-training-calendar.png' });
  await click(page, 430, 405);
  expect((await snap(page)).money).toBe(initial.money);
  expect((await snap(page)).bandmates.training).toHaveLength(0);
  await click(page, 560, 235); await click(page, 405, 331); await click(page, 405, 331); await click(page, 256, 331);
  await click(page, 331, 405);
  expect((await snap(page)).bandmates.training).toHaveLength(1);
  expect((await snap(page)).money).toBe(initial.money - 5000);
  await page.keyboard.press('Escape'); await page.waitForTimeout(80); await page.keyboard.press('Escape'); await page.waitForTimeout(80);
  for (let i = 0; i < 5; i++) await click(page, 685, 570);
  expect((await snap(page)).modal).toBe('training-result');
  await page.screenshot({ path: 'test-results/bandmate-training-complete.png' });
  expect((await snap(page)).bandmates.training[0].completed).toBe(true);
  expect((await snap(page)).bandmates.modifiers.some((m: any) => m.id === 'TrainMusicality' && m.amount > 0)).toBe(true);
  await page.keyboard.press('Escape');
  expect((await snap(page)).bandmates.completions[0].seen).toBe(true);
  await page.reload(); await page.waitForFunction(() => '__rockManager' in window);
  expect((await snap(page)).bandmates.training[0].completed).toBe(true);
  expect((await snap(page)).bandmates.completions[0].seen).toBe(true);
  expect(errors).toEqual([]);
});

test('every Mission01 bandmate has audible original speech and cue-driven portrait layers', async ({ page }) => {
  test.setTimeout(90000);
  const positions = [[150,435],[130,185],[280,150],[450,170],[450,435]];
  for (const musician of data.musicians) {
    const instrument = ['Guitar','Keyboards','Drums','Bass','Vocals'].find(i => musician.skills[i] > 0)!;
    const slot = instrument === 'Drums' ? 2 : instrument === 'Bass' ? 3 : instrument === 'Vocals' ? 4 : 0;
    let state = { ...newGame(200000), started:true, tutorialEnabled:false };
    state = recruit(state, data.musicians,slot,musician.id,instrument as any);
    if (await page.evaluate(() => location.origin).catch(() => '') === testBaseURL) {
      await page.evaluate(value => localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value)),state);
    } else await page.addInitScript(value => { if (!localStorage.getItem('rock-manager.mission01.v1')) localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value)); },state);
    await page.goto(testBaseURL); await page.waitForFunction(() => '__rockManager' in window);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    await click(page,306,40); await click(page,positions[slot][0],positions[slot][1]);
    expect((await snap(page)).modal).toBe('bandmate');
    await expect.poll(async () => (await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
    const actor = (await snap(page)).actors[0];
    expect(actor.id).toMatch(/^actor\d{2}$/);
    await expect.poll(async () => (await snap(page)).actors[0].cueIndex).toBeGreaterThanOrEqual(0);
  }
});

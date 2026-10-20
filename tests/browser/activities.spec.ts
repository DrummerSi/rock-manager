const testBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
const { PNG } = createRequire(import.meta.url)('pngjs');
const data: typeof import('../../src/generated/game-data.json') = createRequire(import.meta.url)('../../src/generated/game-data.json');
import { newGame, recruit, licenseSong } from '../../src/game/model';
import { startRecording, finishRecording, signContract } from '../../src/game/recording';
import { bookRelease } from '../../src/game/design';
const snap = (page: Page) => page.evaluate(() => (window as any).__rockManager.snapshot());
async function click(page: Page, x: number, y: number) { await page.mouse.click(x, y); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); }
function fixture() { let s = { ...newGame(200000, new Date(2001, 10, 20)), started: true, tutorialEnabled: false, bandName: 'The Unknowns' }; for (const [slot, id, instrument] of [[0, 'RMCJerka', 'Guitar'], [1, 'RMCTony', 'Guitar'], [2, 'RMCRaymond', 'Drums'], [3, 'RMCGurra', 'Bass'], [4, 'RMCSussie', 'Vocals']] as const)
    s = recruit(s, data.musicians, slot, id, instrument); s = licenseSong(s, data.songs, 'Sng01'); s = finishRecording(startRecording(s, data.tutorialGameplay, 'Studio01', 'Sng01'), data.tutorialGameplay, data.musicians, data.songs); s = signContract(s, data.tutorialGameplay.labels.find(l => l.id === 'Record01')!, data.musicians, 5); return bookRelease(s, data.musicians, ['DEDBGCurtain', 'DEDArtists01', 'DEDEfffect04', 'DEDFont03'], 6); }
async function boot(page: Page) { const s = fixture(); await page.addInitScript(value => { if (!localStorage.getItem('rock-manager.mission01.v1'))
    localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(value)); }, s); await page.goto(testBaseURL); await page.waitForFunction(() => '__rockManager' in window); await page.keyboard.press('Escape'); await page.waitForTimeout(60); await page.keyboard.press('Space'); return s; }
async function dismissResults(page: Page) { for (let i = 0; i < 8 && ['activity-result'].includes((await snap(page)).modal); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
} }
test('venue, radio kits and gifts, advert calendar and sales survive reload using canvas controls', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (/Texture key.*not found|Failed to load resource/.test(m.text()))
        errors.push(m.text()); });
    const initial = await boot(page);
    expect((await snap(page)).availablePlaces).toEqual(expect.arrayContaining(['live01', 'live02', 'live03', 'live04', 'media02', 'media03', 'media04', 'media05']));
    await click(page, 76, 335);
    expect((await snap(page)).modal).toBe('venue');
    await page.screenshot({ path: 'test-results/venue-cafe.png' });
    const rendered = PNG.sync.read(await page.screenshot());
    const native = PNG.sync.read(readFileSync('analysis/original/runtime/reference/stage/native-005.png'));
    for (const [x,y,width,height] of [[442,172,27,13],[425,265,64,13],[425,279,175,13]]) {
      let differences = 0;
      for (let row=0;row<height;row++) for (let column=0;column<width;column++) {
        const pixel=((y+row)*800+x+column)*4;
        if ((Math.max(...rendered.data.subarray(pixel,pixel+3))>150)!==(Math.max(...native.data.subarray(pixel,pixel+3))>150)) differences++;
      }
      expect(differences, 'Original font glyph mask at '+x+','+y).toBe(0);
    }
    await click(page, 331, 384);
    expect((await snap(page)).modal).toBe('concert-book');
    expect((await snap(page)).backgroundModal).toBe('venue');
    await page.screenshot({ path: 'test-results/venue-book.png' });
    await click(page, 423, 393);
    expect((await snap(page)).modal).toBe('venue');
    expect((await snap(page)).publicity.concerts).toHaveLength(0);
    expect((await snap(page)).money).toBe(initial.money);
    await click(page, 331, 384);
    await click(page, 330, 394);
    expect((await snap(page)).publicity.concerts).toHaveLength(1);
    expect((await snap(page)).publicity.concerts[0].startDay).toBe(2);
    await click(page, 247, 247);
    expect((await snap(page)).modal).toBe('media');
    await expect.poll(async () => (await snap(page)).feedbackAudio.status).toBe('playing');
    expect((await snap(page)).feedbackAudio.context).toBe('running');
    await expect.poll(async () => (await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
    expect((await snap(page)).feedbackAudio.rms).toBeGreaterThan(.001);
    await page.screenshot({ path: 'test-results/media-radio.png' });
    await click(page, 350, 411);
    expect((await snap(page)).modal).toBe('media-action');
    await page.screenshot({ path: 'test-results/media-press-kit.png' });
    await click(page, 240, 305);
    expect((await snap(page)).publicity.reporters.find((r: any) => r.mediaId === 'Media02').kit).toBe('Sng01:0');
    await expect.poll(async () => (await snap(page)).feedbackAudio.status).toBe('playing');
    expect((await snap(page)).feedbackAudio.key).toMatch(/^m02mb0400/);
    expect((await snap(page)).feedbackAudio.rms).toBeGreaterThan(.001);
    expect((await snap(page)).money).toBe(initial.money);
    await click(page, 350, 458);
    expect((await snap(page)).selectedActionId).toBe('ActMediaBr03');
    await page.screenshot({ path: 'test-results/media-gifts.png' });
    await click(page, 349, 305);
    expect((await snap(page)).money).toBe(initial.money);
    await click(page, 350, 458);
    await click(page, 240, 305);
    expect((await snap(page)).money).toBe(initial.money - 200);
    const reaction = (await snap(page)).publicity.reporters.find((r: any) => r.mediaId === 'Media02').modifiers.at(-1).amount;
    await expect.poll(async () => (await snap(page)).feedbackAudio.key).toMatch(new RegExp('^m02mb' + (reaction <= -.2 ? '0700' : reaction < 0 ? '0600' : '0400')));
    await expect.poll(async () => (await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
    await page.mouse.move(350, 458);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(100);
    expect((await snap(page)).mediaOffset).toBe(1);
    await click(page, 350, 458);
    expect((await snap(page)).modal).toBe('advert');
    await page.screenshot({ path: 'test-results/media-advert.png' });
    await click(page, 424, 419);
    expect((await snap(page)).publicity.adverts).toHaveLength(0);
    expect((await snap(page)).money).toBe(initial.money - 200);
    await click(page, 350, 458);
    for (let i = 0; i < 3; i++)
        await click(page, 587, 174);
    expect((await snap(page)).activityDuration).toBe(2);
    await click(page, 294, 268);
    expect((await snap(page)).activityDay).toBe(2);
    await click(page, 321, 419);
    expect((await snap(page)).publicity.adverts).toHaveLength(1);
    expect((await snap(page)).money).toBe(initial.money - 20200);
    await page.reload();
    await page.waitForFunction(() => '__rockManager' in window);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    expect((await snap(page)).publicity.concerts).toHaveLength(1);
    expect((await snap(page)).publicity.adverts).toHaveLength(1);
    await click(page, 710, 102);
    expect((await snap(page)).modal).toBe('agenda');
    await page.screenshot({ path: 'test-results/activity-agenda.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    for (let i = 0; i < 3; i++) {
        await click(page, 680, 570);
        if ((await snap(page)).modal === 'activity-result') {
            await expect.poll(async () => (await snap(page)).feedbackAudio.key).toMatch(/^A/);
            await expect.poll(async () => (await snap(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
            await page.screenshot({ path: 'test-results/venue-result.png' });
        }
        await dismissResults(page);
    }
    expect((await snap(page)).publicity.concerts[0].completed).toBe(true);
    const result = (await snap(page)).publicity.concertResults[0];
    expect(result.audience).toBeGreaterThan(0);
    expect(result.income).toBe(Math.round(result.audience * 25));
    expect((await snap(page)).money).toBe(initial.money - 20200 + result.income);
    for (let i = 0; i < 4; i++) {
        await click(page, 680, 570);
        await dismissResults(page);
    }
    expect((await snap(page)).day).toBe(7);
    expect((await snap(page)).publicity.totalSales).toBeGreaterThan(0);
    await click(page, 472, 455);
    expect((await snap(page)).selectedMediaId).toBe('Media05');
    await page.screenshot({ path: 'test-results/media-store.png' });
    await click(page, 350, 458);
    expect((await snap(page)).modal).toBe('chart');
    await page.screenshot({ path: 'test-results/media-sales-chart.png' });
    await expect(page.locator('button,input,select,textarea')).toHaveCount(0);
    expect(errors).toEqual([]);
});
test('newspaper and magazine kits are separate; store promotions and original charts work', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const initial = await boot(page);
    for (const [id, x, y] of [['Media03', 491, 265], ['Media04', 271, 337]] as const) {
        await click(page, x, y);
        expect((await snap(page)).selectedMediaId).toBe(id);
        await page.screenshot({ path: id === 'Media03' ? 'test-results/media-news.png' : 'test-results/media-magazine.png' });
        await click(page, 350, 411);
        await click(page, 240, 305);
        expect((await snap(page)).publicity.reporters.find((r: any) => r.mediaId === id).kit).toBe('Sng01:0');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(60);
    }
    expect((await snap(page)).publicity.reporters.find((r: any) => r.mediaId === 'Media02').kit).toBeNull();
    expect((await snap(page)).money).toBe(initial.money);
    await click(page, 472, 455);
    await click(page, 350, 411);
    expect((await snap(page)).selectedAdvertId).toBe('AdRS01');
    expect((await snap(page)).modal).toBe('advert');
    await page.screenshot({ path: 'test-results/media-store-promotion.png' });
    for (let i = 0; i < 4; i++)
        await click(page, 587, 174);
    expect((await snap(page)).activityDuration).toBe(1);
    await click(page, 294, 268);
    await click(page, 321, 419);
    expect((await snap(page)).money).toBe(initial.money - 1000);
    expect((await snap(page)).publicity.adverts[0].mediaId).toBe('Media05');
    for (let i = 0; i < 10; i++) {
        await click(page, 680, 570);
        if ((await snap(page)).modal === 'activity-result')
            await page.screenshot({ path: 'test-results/media-review.png' });
        await dismissResults(page);
    }
    expect((await snap(page)).publicity.reviews.length).toBeGreaterThan(0);
    const saved = await snap(page);
    await page.reload();
    await page.waitForFunction(() => '__rockManager' in window);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    expect((await snap(page)).modal).toBeNull();
    expect((await snap(page)).money).toBe(saved.money);
    expect((await snap(page)).publicity.seenResults).toEqual(saved.publicity.seenResults);
    expect((await snap(page)).publicity.firstMediaVisitDay).toBe(0);
    expect(errors).toEqual([]);
});
test('a pre-publicity save retains its recorded album, cover, contract, money and band', async ({ page }) => {
    const previous = fixture();
    const legacy = structuredClone(previous) as any;
    delete legacy.publicity;
    await page.addInitScript(value => localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(value)), legacy);
    await page.goto(testBaseURL);
    await page.waitForFunction(() => '__rockManager' in window);
    const loaded = await snap(page);
    expect(loaded.band).toEqual(previous.band);
    expect(loaded.album).toEqual(previous.album);
    expect(loaded.demo).toEqual(previous.demo);
    expect(loaded.contract).toEqual(previous.contract);
    expect(loaded.money).toBe(previous.money);
    expect(loaded.publicity.concerts).toEqual([]);
    expect(loaded.publicity.reporters.every((r: any) => r.kit === null)).toBe(true);
});

test('time advances automatically in the city and pauses inside a venue', async ({ page }) => {
  await boot(page); await page.keyboard.press('Space');
  const day = (await snap(page)).day;
  expect((await snap(page)).running).toBe(true);
  await expect.poll(async () => (await snap(page)).day, { timeout: 7000 }).toBe(day + 1);
  await click(page, 76, 335);
  const paused = (await snap(page)).day;
  await page.waitForTimeout(3300);
  expect((await snap(page)).day).toBe(paused);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snap(page)).day, { timeout: 7000 }).toBe(paused + 1);
});

test('legacy saves gain audible feedback once and an explicit mute survives reload', async ({ page }) => {
  const legacy = fixture() as any; delete legacy.audioVersion; legacy.muted = true;
  await page.addInitScript(value => { if (!localStorage.getItem('rock-manager.mission01.v1')) localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(value)); }, legacy);
  await page.goto(testBaseURL); await page.waitForFunction(() => '__rockManager' in window);
  expect((await snap(page)).muted).toBe(false);
  expect((await snap(page)).money).toBe(legacy.money);
  await page.keyboard.press('m');
  expect((await snap(page)).muted).toBe(true);
  await page.reload(); await page.waitForFunction(() => '__rockManager' in window);
  expect((await snap(page)).muted).toBe(true);
  await page.keyboard.press('Escape'); await click(page, 247, 247);
  await page.waitForTimeout(250);
  expect((await snap(page)).feedbackAudio.playing).toBe(false);
});

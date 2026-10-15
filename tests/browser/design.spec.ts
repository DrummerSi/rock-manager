const testBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const data: typeof import('../../src/generated/game-data.json') = createRequire(import.meta.url)('../../src/generated/game-data.json');
import { newGame, recruit, licenseSong } from '../../src/game/model';
import { startRecording, finishRecording, signContract } from '../../src/game/recording';
const snapshot = (page: any) => page.evaluate(() => (window as any).__rockManager.snapshot());
async function click(page: any, x: number, y: number) { await page.mouse.click(x, y); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); }
test('original cover layers, cancelled booking, draggable release date and persisted sleeve', async ({ page }) => {
    let state = { ...newGame(100000, new Date(2001, 10, 20)), started: true, tutorialEnabled: true, seenTutorials: data.tutorials.filter(t => t.id !== 'ECOCMis1IntroduceMedia').map(t => t.id), bandName: 'The Unknowns' };
    for (const [slot, id, instrument] of [[0, 'RMCJerka', 'Guitar'], [1, 'RMCTony', 'Guitar'], [2, 'RMCRaymond', 'Drums'], [3, 'RMCGurra', 'Bass'], [4, 'RMCSussie', 'Vocals']] as const)
        state = recruit(state, data.musicians, slot, id, instrument);
    state = licenseSong(state, data.songs, 'Sng01');
    state = finishRecording(startRecording(state, data.tutorialGameplay, 'Studio01', 'Sng01'), data.tutorialGameplay, data.musicians, data.songs);
    state = signContract(state, data.tutorialGameplay.labels.find(l => l.id === 'Record01')!, data.musicians, 5);
    const initialMoney = state.money;
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (/Texture key.*not found|Failed to load resource/.test(message.text()))
        errors.push(message.text()); });
    await page.addInitScript(value => { if (!localStorage.getItem('rock-manager.mission01.v1'))
        localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(value)); }, state);
    await page.goto(testBaseURL);
    await page.waitForFunction(() => '__rockManager' in window);
    await page.keyboard.press('Escape');
    await click(page, 380, 371);
    expect((await snapshot(page)).modal).toBe('design');
    await page.screenshot({ path: 'test-results/design-empty.png' });
    const empty = await page.screenshot({ clip: { x: 117, y: 127, width: 300, height: 300 } });
    for (const [y, count] of [[174, 3], [234, 1], [294, 4], [354, 3]])
        for (let i = 0; i < count; i++)
            await click(page, 674, y);
    expect((await snapshot(page)).designSelection).toEqual(['DEDBGCurtain', 'DEDArtists01', 'DEDEfffect04', 'DEDFont03']);
    expect(await page.screenshot({ clip: { x: 117, y: 127, width: 300, height: 300 } })).not.toEqual(empty);
    await page.screenshot({ path: 'test-results/design-studio.png' });
    await click(page, 515, 420);
    expect((await snapshot(page)).backgroundModal).toBe('design');
    expect((await snapshot(page)).releaseDay).toBe(6);
    await page.screenshot({ path: 'test-results/design-release.png' });
    await click(page, 427, 393);
    expect((await snapshot(page)).modal).toBe('design');
    expect((await snapshot(page)).money).toBe(initialMoney);
    expect((await snapshot(page)).album).toBeNull();
    await click(page, 515, 420);
    await page.mouse.move(423, 246);
    await page.mouse.down();
    await page.mouse.move(286, 246, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(80);
    expect((await snapshot(page)).releaseDay).toBe(1);
    await click(page, 330, 394);
    expect((await snapshot(page)).money).toBe(initialMoney - 3500);
    expect((await snapshot(page)).album.releaseDay).toBe(1);
    expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceMedia');
    await page.screenshot({ path: 'test-results/tutorial-media.png' });
    await page.keyboard.press('Enter');
    await page.reload();
    await page.waitForFunction(() => '__rockManager' in window);
    await page.keyboard.press('Escape');
    await click(page, 380, 371);
    expect((await snapshot(page)).modal).toBe('design');
    await page.screenshot({ path: 'test-results/design-saved.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    await click(page, 680, 570);
    expect((await snapshot(page)).day).toBe(1);
    expect((await snapshot(page)).money).toBe(initialMoney - 3500);
    await expect(page.locator('input,select,button,textarea')).toHaveCount(0);
    expect(errors).toEqual([]);
});

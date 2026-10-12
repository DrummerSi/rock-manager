import { test, expect, type Page } from '@playwright/test';

async function snapshot(page: Page): Promise<{ modal: string | null; day: number; money: number; band: ({ musicianId: string } | null)[]; bandName: string; running: boolean }> {
  return page.evaluate(() => (window as unknown as { __rockManager: { snapshot(): never } }).__rockManager.snapshot());
}
async function click(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.click(x, y);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('canvas opening, recruitment, payday and persistence work without HTML controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => '__rockManager' in window);
  expect((await snapshot(page)).modal).toBe('briefing');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('button, input, select, textarea')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/briefing.png' });
  await click(page, 628, 514);
  expect((await snapshot(page)).modal).toBeNull();
  await page.screenshot({ path: 'test-results/city.png' });
  await click(page, 166, 86);
  expect((await snapshot(page)).modal).toBe('rehearsal');
  await click(page, 130, 328);
  expect((await snapshot(page)).modal).toBe('recruit');
  await page.screenshot({ path: 'test-results/recruitment.png' });
  await click(page, 653, 512);
  expect((await snapshot(page)).band[0]?.musicianId).toBe('RMCJerka');
  expect((await snapshot(page)).money).toBe(100000);
  await click(page, 648, 518);
  for (let i = 0; i < 7; i++) await click(page, 720, 581);
  expect((await snapshot(page)).day).toBe(7);
  expect((await snapshot(page)).money).toBe(99870);
  await page.reload();
  await page.waitForFunction(() => '__rockManager' in window);
  expect((await snapshot(page)).modal).toBe('menu');
  expect((await snapshot(page)).band[0]?.musicianId).toBe('RMCJerka');
  expect((await snapshot(page)).money).toBe(99870);
  await click(page, 491, 290);
  await click(page, 167, 86);
  await click(page, 150, 517);
  expect((await snapshot(page)).modal).toBe('rename');
  for (let i = 0; i < 28; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('The Brickheads');
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).bandName).toBe('The Brickheads');
  expect(errors).toEqual([]);
});

test('dialogs pause the running clock, and corrupted saves recover to a new briefing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rock-manager.mission01.v1', '{bad json'));
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => '__rockManager' in window);
  expect((await snapshot(page)).money).toBe(100000);
  await click(page, 628, 514);
  await click(page, 575, 581);
  expect((await snapshot(page)).running).toBe(true);
  await click(page, 167, 86);
  await page.waitForTimeout(3200);
  expect((await snapshot(page)).day).toBe(0);
  await page.screenshot({ path: 'test-results/rehearsal.png' });
});

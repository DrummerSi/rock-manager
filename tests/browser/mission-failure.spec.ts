const testBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {newGame,recruit} from '../../src/game/model';
const data:typeof import('../../src/generated/game-data.json')=createRequire(import.meta.url)('../../src/generated/game-data.json');
const snapshot=(page:any)=>page.evaluate(()=>(window as any).__rockManager.snapshot());

test('unpaid wages require warning acknowledgment, preserve failure and stop the clock',async({page},info)=>{
  // A focused failure fixture, separate from the genuine fresh-game completion test.
  const state={...recruit(newGame(100000,new Date(2001,9,1)),data.musicians,4,'RMCSussie','Vocals'),money:0,day:6,started:true,tutorialEnabled:false};
  await page.addInitScript(value=>{
    if(!localStorage.getItem('rock-manager.mission01.v1'))localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value));
  },state);
  await page.goto(testBaseURL);await page.waitForFunction(()=>'__rockManager'in window);
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await snapshot(page)).modal).toBeNull();
  if((await snapshot(page)).running)await page.keyboard.press('Space');
  // Space rebuilds HUD hit areas; let Phaser register the new display list
  // before pressing the freshly created Advance button.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.mouse.click(680,570);
  await expect.poll(async()=>(await snapshot(page)).day).toBe(7);
  await expect.poll(async()=>(await snapshot(page)).modal).toBe('mission-warning');
  expect((await snapshot(page)).missionProgress.status).toBe('pending');
  await page.screenshot({path:info.outputPath('unpaid-wages-warning.png')});
  await page.keyboard.press('Enter');
  await expect.poll(async()=>(await snapshot(page)).modal).toBe('mission-result');
  await expect.poll(async()=>(await snapshot(page)).speechPlayback.key).toBe('A131');
  await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
  const failureVoice=(await snapshot(page)).speechPlayback;
  expect(failureVoice.playing).toBe(true);expect(failureVoice.duration).toBeGreaterThan(8.8);expect(failureVoice.duration).toBeLessThan(9.1);
  const lost=await snapshot(page);
  expect(lost.missionProgress.status).toBe('lost');expect(lost.missionEnding.score.total).toBeNull();
  expect(lost.running).toBe(false);
  await page.screenshot({path:info.outputPath('unpaid-wages-ending.png')});
  await page.reload();await page.waitForFunction(()=>'__rockManager'in window);
  await page.keyboard.press('Escape');
  await expect.poll(async()=>(await snapshot(page)).modal).toBe('mission-result');
  expect((await snapshot(page)).missionProgress).toEqual(lost.missionProgress);
  await page.keyboard.press('Enter');
  await expect.poll(async()=>(await snapshot(page)).modal).toBe('missions');
  expect((await snapshot(page)).missionProgress.acknowledged).toBe(true);
  expect((await snapshot(page)).day).toBe(7);
});

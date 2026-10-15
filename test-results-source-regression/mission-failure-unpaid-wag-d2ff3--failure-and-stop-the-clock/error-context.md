# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mission-failure.spec.ts >> unpaid wages require warning acknowledgment, preserve failure and stop the clock
- Location: tests\browser\mission-failure.spec.ts:8:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "mission-warning"
Received: null

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic "Rock Manager canvas game" [ref=e2]
```

# Test source

```ts
  1  | const testBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
  2  | import {test,expect} from '@playwright/test';
  3  | import {createRequire} from 'node:module';
  4  | import {newGame,recruit} from '../../src/game/model';
  5  | const data:typeof import('../../src/generated/game-data.json')=createRequire(import.meta.url)('../../src/generated/game-data.json');
  6  | const snapshot=(page:any)=>page.evaluate(()=>(window as any).__rockManager.snapshot());
  7  | 
  8  | test('unpaid wages require warning acknowledgment, preserve failure and stop the clock',async({page},info)=>{
  9  |   // A focused failure fixture, separate from the genuine fresh-game completion test.
  10 |   const state={...recruit(newGame(100000,new Date(2001,9,1)),data.musicians,4,'RMCSussie','Vocals'),money:0,day:6,started:true,tutorialEnabled:false};
  11 |   await page.addInitScript(value=>{
  12 |     if(!localStorage.getItem('rock-manager.mission01.v1'))localStorage.setItem('rock-manager.mission01.v1',JSON.stringify(value));
  13 |   },state);
  14 |   await page.goto(testBaseURL);await page.waitForFunction(()=>'__rockManager'in window);
  15 |   await page.keyboard.press('Escape');
  16 |   await expect.poll(async()=>(await snapshot(page)).modal).toBeNull();
  17 |   if((await snapshot(page)).running)await page.keyboard.press('Space');
  18 |   await page.mouse.click(680,570);
> 19 |   await expect.poll(async()=>(await snapshot(page)).modal).toBe('mission-warning');
     |                                                            ^ Error: expect(received).toBe(expected) // Object.is equality
  20 |   expect((await snapshot(page)).missionProgress.status).toBe('pending');
  21 |   await page.screenshot({path:info.outputPath('unpaid-wages-warning.png')});
  22 |   await page.keyboard.press('Enter');
  23 |   await expect.poll(async()=>(await snapshot(page)).modal).toBe('mission-result');
  24 |   const lost=await snapshot(page);
  25 |   expect(lost.missionProgress.status).toBe('lost');expect(lost.missionEnding.score.total).toBeNull();
  26 |   expect(lost.running).toBe(false);
  27 |   await page.screenshot({path:info.outputPath('unpaid-wages-ending.png')});
  28 |   await page.reload();await page.waitForFunction(()=>'__rockManager'in window);
  29 |   await page.keyboard.press('Escape');
  30 |   await expect.poll(async()=>(await snapshot(page)).modal).toBe('mission-result');
  31 |   expect((await snapshot(page)).missionProgress).toEqual(lost.missionProgress);
  32 |   await page.keyboard.press('Enter');
  33 |   await expect.poll(async()=>(await snapshot(page)).modal).toBe('missions');
  34 |   expect((await snapshot(page)).missionProgress.acknowledged).toBe(true);
  35 |   expect((await snapshot(page)).day).toBe(7);
  36 | });
  37 | 
```
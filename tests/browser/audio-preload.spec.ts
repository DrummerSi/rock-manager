import {test,expect,type Page} from '@playwright/test';
const base=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174';
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).__rockManager.snapshot());
async function click(page:Page,x:number,y:number){await page.mouse.click(x,y,{delay:35});await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}

test('menu does not fetch bulk audio; narration loads and plays on demand',async({page})=>{
 test.setTimeout(60000);
 const requests:string[]=[];
 page.on('request',request=>{if(/\/assets\/(feedback|music)\//.test(request.url()))requests.push(request.url());});
 await page.goto(base);await page.waitForFunction(()=>'__rockManager'in window);
 expect((await snapshot(page)).modal).toBe('menu');expect(requests).toEqual([]);
 let s=await snapshot(page);await click(page,s.sourceLayout.newGame.x,s.sourceLayout.newGame.y);
 s=await snapshot(page);await click(page,s.sourceLayout.start.x,s.sourceLayout.start.y);
 await expect.poll(async()=>(await snapshot(page)).speechPlayback.key).toBe('Intro01_01');
 await expect.poll(async()=>(await snapshot(page)).feedbackAudio.outputRms).toBeGreaterThan(.001);
 expect(requests.filter(url=>url.endsWith('/Intro01_01.mp3'))).toHaveLength(1);
 await page.goto('about:blank');
});

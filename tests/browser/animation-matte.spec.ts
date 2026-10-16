const testBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url), {PNG}=require('pngjs');
const evidence=require('../../src/generated/actor-animation.json');

test('original ink36 leaves no stray white pixels in all recovered animated portraits',async({page})=>{
  test.setTimeout(120000);
  // The score's live FaceAnim layers120..124 all use ink36 with white index0.
  // This checks painted WebGL output, not merely the decoded images or state.
  // The previous exterior-only matte fails this sweep with >1,600 white pixels/frame.
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:960});
  await page.goto(testBaseURL + '/tests/browser/fixtures/actor-animation.html');
  await page.waitForFunction(()=>(window as any).__actorAudit?.ready);
  const dimensions=await page.evaluate(()=>(window as any).__actorAudit.dimensions);await page.setViewportSize(dimensions);
  const regions=await page.evaluate(()=>(window as any).__actorAudit.regions);
  for(const region of regions){expect(region.x).toBeGreaterThanOrEqual(0);expect(region.y).toBeGreaterThanOrEqual(0);expect(region.x+region.width,region.id).toBeLessThanOrEqual(dimensions.width);expect(region.y+region.height,region.id).toBeLessThanOrEqual(dimensions.height);}
  expect(regions).toHaveLength(evidence.portraits.length);
  const covered=new Map<string,Set<string>>();
  const checkPixels=async(label:string)=>{
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    const capture=PNG.sync.read(await page.screenshot());
    let stray=0;
    for(const r of regions)for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
      const i=((r.y+y)*capture.width+r.x+x)*4;
      // There are no opaque white or near-white (all channels>=248) pixels in
      // these source layers under native ink36, including their backdrops.
      if(capture.data[i]===255&&capture.data[i+1]===255&&capture.data[i+2]===255)stray++;
    }
    if(stray)await page.screenshot({path:'test-results/animation-matte-failure.png'});
    expect(stray,label+' contains white color-key artifacts').toBe(0);
  };
  for(let frame=0;frame<80;frame++){
    const states=await page.evaluate(()=>(window as any).__actorAudit.advance());
    for(const state of states){if(!covered.has(state.id))covered.set(state.id,new Set());covered.get(state.id)!.add(state.mouth);}
    await checkPixels('speech sample '+frame);
  }
  for(const [id,mouths]of covered)expect(mouths.size,id+' must actually animate through several mouth shapes').toBeGreaterThanOrEqual(4);
  for(const mood of Object.keys(evidence.moodStates)){
    await page.evaluate(value=>(window as any).__actorAudit.setMood(value),mood);
    await checkPixels('idle mood '+mood);
  }
  // Every imported pose/transition also needs native ink36, not just pose1
  // currently used by the UI. Verify all atlas layers against that source rule.
  for(const p of evidence.portraits){
    const atlas=PNG.sync.read(readFileSync('public/assets/'+require('../../src/generated/game-data.json').images[p.atlas.textureKey]));
    let opaqueWhite=0;
    for(let i=0;i<atlas.data.length;i+=4)
      if(atlas.data[i]===255&&atlas.data[i+1]===255&&atlas.data[i+2]===255&&atlas.data[i+3]!==0)opaqueWhite++;
    expect(opaqueWhite,p.id+' opaque white atlas pixels').toBe(0);
  }
  expect(errors).toEqual([]);
  await page.screenshot({path:'test-results/animation-matte-all-characters.png'});
});

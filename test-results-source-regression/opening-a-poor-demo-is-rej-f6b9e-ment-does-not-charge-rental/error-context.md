# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: opening.spec.ts >> a poor demo is rejected, the retry tutorial appears, and cancelling a replacement does not charge rental
- Location: tests\browser\opening.spec.ts:261:1

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "Rebel Records think that the recording sounds horrible. Try hiring skilled musicians or licensing a prolific song or using a better studio. They also think that the band's sound and style need a rebel punk attitude."
Received string:    ""
```

# Test source

```ts
  194 |   await page.mouse.down();
  195 |   await page.mouse.move(310, 392, { steps: 5 });
  196 |   await page.mouse.up();
  197 |   expect((await snapshot(page)).recording!.channels[0].volume).toBeLessThan(70);
  198 |   expect((await snapshot(page)).recording!.channels[0].volume).toBeGreaterThan(30);
  199 |   await click(page, 320, 324);
  200 |   expect((await snapshot(page)).recording!.channels[0].muted).toBe(true);
  201 |   await click(page, 320, 324);
  202 |   expect((await snapshot(page)).recording!.channels[0].muted).toBe(false);
  203 |   await click(page, 100, 397);
  204 |   await expect.poll(async () => (await snapshot(page)).previewPlaying).toBe(true);
  205 |   await click(page, 152, 397);
  206 |   expect((await snapshot(page)).previewPlaying).toBe(false);
  207 |   await page.reload();
  208 |   await page.waitForFunction(() => '__rockManager' in window);
  209 |   await click(page, 170, 371);
  210 |   expect((await snapshot(page)).modal).toBe('mixer');
  211 |   expect((await snapshot(page)).money).toBe(83000);
  212 |   expect((await snapshot(page)).tutorialId).toBeNull();
  213 |   await click(page, 190, 466, false);
  214 |   expect((await snapshot(page)).backgroundModal).toBe('mixer');
  215 |   await confirmMixerExit(page, false);
  216 |   expect((await snapshot(page)).demo?.quality).toBeGreaterThan(0.5);
  217 |   expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceLabel');
  218 |   await page.screenshot({ path: 'test-results/tutorial-label.png' });
  219 |   // Reload before acknowledgement: the label introduction must resume.
  220 |   await page.reload();
  221 |   await page.waitForFunction(() => '__rockManager' in window);
  222 |   await click(page, 170, 371, false);
  223 |   expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceLabel');
  224 |   await page.keyboard.press('Enter');
  225 |   expect((await snapshot(page)).availablePlaces).toEqual(expect.arrayContaining(['record01', 'record03']));
  226 |   await click(page, 160, 340);
  227 |   expect((await snapshot(page)).modal).toBe('label');
  228 |   await page.screenshot({ path: 'test-results/label.png' });
  229 |   await click(page, 240, 488);
  230 |   expect((await snapshot(page)).modal).toBe('contract');
  231 |   expect((await snapshot(page)).backgroundModal).toBe('label');
  232 |   await page.screenshot({ path: 'test-results/contract.png' });
  233 |   await click(page, 630, 477); // Declining negotiation does not sign or pay.
  234 |   expect((await snapshot(page)).contract).toBeNull();
  235 |   expect((await snapshot(page)).money).toBe(83000);
  236 |   await click(page, 240, 488);
  237 |   const offerIndex = (await snapshot(page)).offerIndex;
  238 |   await click(page, 654, 295);
  239 |   expect((await snapshot(page)).offerIndex).toBe(offerIndex + 1);
  240 |   await click(page, 320, 477);
  241 |   const signed = await snapshot(page);
  242 |   expect(signed.contract?.labelId).toBe('Record01');
  243 |   expect(signed.contract?.royalty).toBe(0.1);
  244 |   expect(signed.money).toBe(83000 + signed.contract!.advance);
  245 |   await page.screenshot({ path: 'test-results/contract-signed.png' });
  246 |   await click(page, 510, 488, false);
  247 |   expect((await snapshot(page)).tutorialId).toBe('ECOCMis1IntroduceSleeve');
  248 |   await page.keyboard.press('Enter');
  249 |   await page.reload();
  250 |   await page.waitForFunction(() => '__rockManager' in window);
  251 |   expect((await snapshot(page)).contract).toEqual(signed.contract);
  252 |   expect((await snapshot(page)).money).toBe(signed.money);
  253 |   await click(page, 170, 371);
  254 |   await click(page, 306, 40);
  255 |   await page.screenshot({ path: 'test-results/band-with-contract.png' });
  256 |   expect((await snapshot(page)).seenTutorials).toEqual(expect.arrayContaining(['ECOCMis1IntroduceMixer', 'ECOCMis1IntroduceLabel', 'ECOCMis1IntroduceSleeve']));
  257 |   expect(errors).toEqual([]);
  258 |   await expect(page.locator('button, input, select, textarea')).toHaveCount(0);
  259 | });
  260 | 
  261 | test('a poor demo is rejected, the retry tutorial appears, and cancelling a replacement does not charge rental', async ({ page }) => {
  262 |   test.setTimeout(60000);
  263 |   const errors: string[] = [];
  264 |   page.on('pageerror', (error) => errors.push(error.message));
  265 |   await page.goto(baseURL);
  266 |   await page.waitForFunction(() => '__rockManager' in window);
  267 |   await startMission(page);
  268 |   await click(page, 306, 40);
  269 |   await hireThroughCanvas(page, 0, 'RMCJerka');
  270 |   await hireThroughCanvas(page,4,'RMCSussie');
  271 |   await click(page,680,518);
  272 |   await click(page,680,518);
  273 |   await click(page, 230, 460);
  274 |   await buyFirstSong(page);
  275 |   for (let i = 0; i < 3; i++) await click(page, 65, 572);
  276 |   await click(page, 180, 377);
  277 |   expect((await snapshot(page)).selectedStudioId).toBe('Studio04');
  278 |   await click(page, 449, 418);
  279 |   expect((await snapshot(page)).money).toBe(87000);
  280 |   await click(page,320,324); // Mute singer for the deliberately poor one-track demo.
  281 |   await click(page, 190, 466);
  282 |   await confirmMixerExit(page);
  283 |   expect((await snapshot(page)).demo?.quality).toBe(0);
  284 |   await click(page, 351, 340);
  285 |   await click(page, 240, 488);
  286 |   expect((await snapshot(page)).modal).toBe('rejection');
  287 |   expect((await snapshot(page)).backgroundModal).toBe('label');
  288 |   const refusal=(await snapshot(page)).sourceLayout!;
  289 |   expect(refusal.id).toBe('DlgRecordRefuse');
  290 |   const refusalTexts=await page.evaluate(()=>(window as any).__rockManager.snapshot().dialogTexts.map((entry:{text:string})=>entry.text).join('\n'));
  291 |   const refusalState=await snapshot(page),refusalLabel=data.tutorialGameplay.labels.find(label=>label.id===refusalState.selectedLabelId)!;
  292 |   const originalFeedback=evaluateDemo(refusalState,refusalLabel,data.musicians).reason;
  293 |   expect(originalFeedback.length).toBeGreaterThan(0);
> 294 |   expect(refusalTexts).toContain(originalFeedback);
      |                        ^ Error: expect(received).toContain(expected) // indexOf
  295 |   expect(refusalTexts).not.toContain('The demo needs stronger musicians or a better studio.');
  296 |   await page.screenshot({ path: 'test-results/demo-rejected.png' });
  297 |   await click(page, refusal.close!.x, refusal.close!.y, false);
  298 |   expect((await snapshot(page)).tutorialId).toBe('ECOCMis1NoContract');
  299 |   await page.screenshot({ path: 'test-results/tutorial-retry.png' });
  300 |   await page.keyboard.press('Enter');
  301 |   expect((await snapshot(page)).contract).toBeNull();
  302 |   expect((await snapshot(page)).money).toBe(87000);
  303 |   await click(page, 180, 377);
  304 |   await click(page, 449, 418);
  305 |   expect((await snapshot(page)).modal).toBe('replace-demo');
  306 |   await discardDemo(page,false);
  307 |   expect((await snapshot(page)).modal).toBe('studio');
  308 |   expect((await snapshot(page)).money).toBe(87000);
  309 |   await click(page, 449, 418);
  310 |   await discardDemo(page,true);
  311 |   expect((await snapshot(page)).modal).toBe('mixer');
  312 |   expect((await snapshot(page)).money).toBe(85000);
  313 |   // Original DlgMixerChooseMusicianScript charges on OK, never on row selection.
  314 |   await click(page, 373, 156);
  315 |   expect((await snapshot(page)).modal).toBe('settings');
  316 |   await click(page, 175, 170);
  317 |   expect((await snapshot(page)).modal).toBe('session');
  318 |   expect((await snapshot(page)).backgroundModal).toBe('settings');
  319 |   await click(page, 192, 410);
  320 |   expect((await snapshot(page)).modal).toBe('session');
  321 |   expect((await snapshot(page)).previewPlaying).toBe(false);
  322 |   await click(page, 420, 400);
  323 |   expect((await snapshot(page)).modal).toBe('session');
  324 |   expect((await snapshot(page)).recording!.channels[1].musicianId).toBe('RMCJerka');
  325 |   expect((await snapshot(page)).money).toBe(85000);
  326 |   await page.screenshot({ path: 'test-results/session-musician.png' });
  327 |   await click(page, 568, 518);
  328 |   expect((await snapshot(page)).modal).toBe('settings');
  329 |   expect((await snapshot(page)).money).toBe(85000);
  330 |   expect((await snapshot(page)).recording!.channels[1].musicianId).toBe('RMCJerka');
  331 |   await click(page, 175, 170);
  332 |   await click(page, 420, 400);
  333 |   await click(page, 375, 518);
  334 |   expect((await snapshot(page)).recording!.channels[1].musicianId).toBe('Stud04');
  335 |   expect((await snapshot(page)).money).toBe(69000);
  336 |   await click(page, 175, 170);
  337 |   await click(page, 375, 518);
  338 |   expect((await snapshot(page)).money).toBe(69000);
  339 |   expect(errors).toEqual([]);
  340 | });
  341 | 
  342 | test('mixer Settings opens, effects preview works, mute updates without rebuilding, and knobs retain native anchors', async ({ page }) => {
  343 |   test.setTimeout(60000);
  344 |   // Regression: exporting these ARGB sprites as opaque produces the white desk
  345 |   // borders and solid button glow reported by the user.
  346 |   const activated = PNG.sync.read(readFileSync('public/assets/button_mute02.png'));
  347 |   const alpha = Array.from(activated.data as Uint8Array).filter((_value, index) => index % 4 === 3);
  348 |   expect(alpha.filter((a) => a === 0)).toHaveLength(60);
  349 |   expect(alpha.filter((a) => a > 0 && a < 255)).toHaveLength(255);
  350 |   let state = newGame(100000);
  351 |   for (const [slot, id, instrument] of [[0, 'RMCJerka', 'Guitar'], [1, 'RMCTony', 'Guitar'], [2, 'RMCGullan', 'Drums'], [3, 'RMCGurra', 'Bass'], [4, 'RMCSussie', 'Vocals']] as const) state = recruit(state, data.musicians, slot, id, instrument);
  352 |   state = startRecording(licenseSong({ ...state, started: true, tutorialEnabled: false }, data.songs, 'Sng01'), data.tutorialGameplay, 'Studio01', 'Sng01');
  353 |   await page.addInitScript((save) => localStorage.setItem('rock-manager.mission01.v1', JSON.stringify(save)), state);
  354 |   const errors: string[] = [];
  355 |   page.on('pageerror', (error) => errors.push(error.message));
  356 |   await page.goto(baseURL);
  357 |   await page.waitForFunction(() => '__rockManager' in window);
  358 |   await click(page, 170, 371);
  359 |   const anchors = (s: Awaited<ReturnType<typeof snapshot>>) => s.mixerKnobs.map(({ name, anchorX, anchorY }) => ({ name, anchorX, anchorY }));
  360 |   const original = await snapshot(page);
  361 |   expect(original.mixerKnobs[0]).toMatchObject({ name: 'mixer-knob-master', anchorX: 286, anchorY: 370 });
  362 |   expect(original.mixerKnobs[1]).toMatchObject({ name: 'mixer-knob-pan-0', anchorX: 369, anchorY: 253 });
  363 |   await page.mouse.move(320, 274); await page.mouse.down();
  364 |   await page.mouse.move(332, 274, { steps: 6 }); await page.mouse.up();
  365 |   const turned = await snapshot(page);
  366 |   expect(turned.recording!.channels[0].pan).toBeGreaterThan(20);
  367 |   expect(turned.mixerKnobs[1].key).not.toBe(original.mixerKnobs[1].key);
  368 |   expect(anchors(turned)).toEqual(anchors(original));
  369 |   await page.mouse.move(225, 395); await page.mouse.wheel(0, -120);
  370 |   await page.waitForTimeout(100);
  371 |   expect(anchors(await snapshot(page))).toEqual(anchors(original));
  372 |   await click(page, 319, 323);
  373 |   expect((await snapshot(page)).recording!.channels[0].muted).toBe(true);
  374 |   expect(anchors(await snapshot(page))).toEqual(anchors(turned));
  375 |   await click(page, 319, 323);
  376 |   expect((await snapshot(page)).recording!.channels[0].muted).toBe(false);
  377 |   await page.screenshot({ path: 'test-results/mixer-controls-corrected.png' });
  378 |   await click(page, 320, 197);
  379 |   expect((await snapshot(page)).modal).toBe('settings');
  380 |   expect((await snapshot(page)).backgroundModal).toBe('mixer');
  381 |   await page.screenshot({ path: 'test-results/mixer-settings-before.png' });
  382 |   await click(page, 175, 293);
  383 |   expect((await snapshot(page)).recording!.channels[0].effects?.delay.active).toBe(true);
  384 |   await click(page, 175, 346);
  385 |   expect((await snapshot(page)).recording!.channels[0].effects?.timeShift.active).toBe(true);
  386 |   await click(page, 270, 336);
  387 |   expect((await snapshot(page)).recording!.channels[0].effects?.timeShift.mode).toBe(true);
  388 |   await page.screenshot({ path: 'test-results/mixer-settings.png' });
  389 |   await click(page, 192, 463);
  390 |   await expect.poll(async () => (await snapshot(page)).previewPlaying).toBe(true);
  391 |   expect(await playback(page)).toMatchObject({ mode: 'instrument', tracks: [{ channel: 0, loop: false }] });
  392 |   expect((await playback(page)).tracks).toHaveLength(1);
  393 |   await click(page, 310, 463);
  394 |   expect((await snapshot(page)).modal).toBe('mixer');
```
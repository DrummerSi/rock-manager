![RockManager logo](/public/assets/logo.png)

# Rock Manager recreation

A browser-first TypeScript/Phaser 3 recreation of Rock Manager’s game mechanics. Every game screen, control, dialog and text input is rendered inside one 800×600 canvas. HTML only hosts the canvas and fits it to the window.

## Run in a browser

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173 . Asset preparation copies selected recovered media and creates typed scenario data before development and production builds. It uses `analysis/original/` and does not require the CD to remain mounted. Built assets and scenario data are present in this checkout.

```powershell
npm run build
npm run preview
```

`dist/` is a standalone static web build with relative paths, suitable for embedding in Tauri. The original game files and the large analysis folder are not included in it.

## Sprite atlases

`npm run prepare:assets` also generates lossless Phaser atlases in `public/assets/atlases` and the loader manifest in `src/generated/sprite-atlases.json`. To repack already prepared images, run `node scripts/build-sprite-atlases.mjs`. Unchanged inputs reuse the existing pages.

Original extracted images remain intact. Frames retain their dimensions and alpha, with no trimming or rotation and two pixels of edge padding. Existing asset keys and Director registration points are preserved. Actor/font atlases, large backgrounds and fractionally scaled studio photos remain separate. Atlas URLs include a content version for browser caching. This bundles requests; loading assets by mission is a separate optimization.


Mission song previews preload as compressed audio during initial loading and before a new mission briefing. Selecting a studio song warms only that song's loops and eligible vocal variants, with four downloads at a time. Record waits for missing stems before charging or entering the mixer; failed downloads can be retried. Playback and mixdown reuse those downloaded bytes, and unused variants remain undecoded.

## Additional

Graphics and city ambience load at startup. Speech, previews and recording stems load when needed and remain cached in memory for the session; the larger mission audio library is not downloaded before the menu.

## Desktop

The same web build is wrapped by Tauri 2, with no native plugins or remote services.

```powershell
npm run tauri -- dev
npm run tauri -- build --no-bundle
# To create the configured Windows NSIS installer:
npm run tauri -- build
```

Windows development needs Rust, Visual Studio C++ build tools and WebView2. The wrapper uses the recovered game icon and a restricted production CSP. Setup follows https://v2.tauri.app/start/frontend/vite/ .

## Scope and evidence

Band child dialogs preserve the rehearsal window underneath and disable its input until the child closes. Recruitment scrolling supports wheel input across the list, arrows, track clicks and thumb dragging; redraws preserve the drag state. Buttons require a matching press/release so a scrollbar release cannot click a control beneath it. Portrait placement uses the 3px frame border, excluding its 8px shadow. Recruitment text columns align to the recovered stat-meter anchors. Cursor selection now respects CAS* cast-slot order for duplicate names: the correct monochrome building cursor is member 4701, not the older coloured member 3765.

City composition now includes 25 original building layers and 16 recovered animation tracks (seven ambient tracks plus nine building tracks). Frame order and pause counts come from the cast's `*f` text members; placement uses each frame's registration point, including negative values and changing frame sizes. Main.dxr DRCF specifies 30 fps; CityAnimScript advances every three ticks. Animations pause with dialogs and when the page is hidden. Some vehicle tracks deliberately wait around 45/90 seconds.

Building layers and hit regions follow the opening unlock rules: Melody Publishing after leaving rehearsal; Garage/Strawberry studios after owning a song. Advanced buildings and their sign animations remain locked until their gameplay systems exist. Hover rectangles are removed. Cursor images use the recovered Windows palette and original Xtra hotspots: default NoClickPointer, button ActivePointer, building GoPointer. `analysis/original/city-animation-evidence.json` and `city-cursor-evidence.json` retain the source records. Frames without PNGs were checked against the original cast: their stored dimensions are 0×0, so they are intentional empty frames and render invisible.

`analysis/ui-review/city-animations.html` is an inspection preview with every recovered track enabled, including locked venue signs. Regenerate with `node scripts/build-city-review.mjs`; it references prepared assets in this repository and does not change mission unlocks.

Button seam repair: raw 32-bit BITD strips are decoded as interleaved ARGB instead of RLE, and the fixed-size controls use the 14+19-pixel cap height. Captions follow DlgButton2Data offsets (after the icon, y=6); icons use the source's y=13 registration anchor. The frame compositor assembles source tiles into one cached texture with integer coordinates and no image smoothing. Main menu uses RockDialog artwork; inset frames now use RockFrame2 artwork rather than drawn approximations.

Fonts load before Phaser starts, using hashed, pinned files from the installed Windows fonts. Buttons use recovered Courier New bold 14 and information headings Verdana bold 11. These are current Windows font versions, not proven original 2001 files. Titlebar XMED run/glyph-cache decoding and matching original screenshots are still needed to establish pixel-perfect font rasterization. See `analysis/original/ui-font-evidence.json` and `titlebar-xmed.bin`. Source bitmap layout was cross-checked against https://github.com/scummvm/scummvm/blob/master/engines/director/images.cpp . Titlebar and action icons are taken from DataDialogs00 plus original button/icon definitions; registrations are retained in `ui-icon-registrations.json`.

Opening flow now starts at the main menu, with Continue/New game/Web site/Quit in the recovered horizontal layout, followed by mission selection and briefing. Mission01, Mission03 and Mission04 can be played; the original website entry is disabled. Quit saves and returns to the menu in this browser-first implementation. Sound/fullscreen/help below the original row are recreation controls. The menu autosave notice is translated from the installed Swedish fallback strings; its original English wording is not recovered.

Mission01 guidance uses recovered English cards through the city, rehearsal, publisher, studio, mixer, labels, cover design, venue, media, chart, calendar and advance steps. Rehearsal exit now requires a vocalist and reminds you once to name the band. Cards block input, pause time and persist acknowledgment days. Training and tutorial cards use original content-sized layouts, centered at(400,305), instead of large fixed windows. Existing saves retain progress. See [the fidelity correction evidence](analysis/original/fidelity-corrections.md) for source rules, repaired tutorial edges and remaining layout limits.

Visual fidelity pass: dialog borders now use RockDialog tiles and black title bars; raw 16-bit border BITD payloads are decoded correctly rather than treated as RLE. Button tiles follow native corner-first composition, with original icons, grey/white captions and disabled corners. The city header uses recovered BandIcons/MoneyDisplay/DateDisplay coordinates; rehearsal has silhouettes and a framed album panel; recruitment has portrait/instrument rows, native scroll arrows and two meters. Sound is accessible in the menu. Raw 32-bit inset frame tiles are now decoded and used directly.

`analysis/ui-review/index.html` compares captured screens with bundled original help screenshots. These reduced-resolution references do not establish pixel-perfect fidelity. To regenerate after browser tests, run `node scripts/build-ui-review.mjs` (requires the original installed help images). Raw border evidence is in `analysis/original/ui-raw-bitmaps.json`; normal builds use retained bytes without requiring the original installation.

Implemented: briefing, animated scrolling city, original HUD and recovered surround masks, corrected button tiles, rehearsal diagram/instrument sprites, layered recruitment, nine recruitable musicians, five positions, naming, song licensing/selection, studios, mixer controls and audio previews, paid session musicians, demo quality, label acceptance/rejection, linked contract offers and signing, tutorial progression through release, promotion and sales-chart completion, payroll, local saves, ambience and fullscreen. Existing saves migrate automatically.

Mission01 supports cover design, release, gigs, promotion, dated sales/charts and bandmate needs, relationships, gifts and training. Mission01 now ends after the original one-day delay following Record Store sales Top10 entry, with recovered ending artwork/text and score accounting. Unpaid mandatory wages and losing all singers have failure paths. The broader random event engine and missions after Mission04 remain unfinished. The tutorial advance card explains the implemented signing advance; additional conditional label advances are not implemented. Original office and musician layers animate to recovered speech cues. Mixer delay/timeshift use WebAudio and are not bit-exact legacy Xtra DSP. Exact original text rasterization and all layout metrics remain unverified; matching fixed regions does not establish whole-game equivalence.

Recovered behavior used here:

- Dialog geometry, registration points and button compositing: `analysis/original/ui-layout-recovery.json` and `.md`.
- Mission song catalog and license terms: `DataSongs00.json`, `DataBuildings00.json`, Mission01.AvailableSongs; purchase/filtering: `scripts/cd/Main.dxr/00029-DlgPublishScript.lingo`. Royalty rates and dated sales accounting are implemented.

- Mission01 funds, candidate data and briefing: `analysis/original/data/mission01-recovered.json`.
- Positions, eligibility and salary sorting: `analysis/original/scripts/cd/Main.dxr/00015-DlgRehearsal01ChooseScript.lingo`.
- Payroll schedule: `analysis/original/scripts/installed/RockGeneral.cxt/00016-ClassBandScript.lingo`, timeTick; amounts: ClassRealMusicianScript.Pay.
- HUD positioning and opaque-copy rendering: `analysis/original/scripts/installed/RockUtil.cxt/00074-InterfaceBarScript.lingo`.
- City hotspots: Main.dxr HotspotsField, preserved in `analysis/original/data/city-hotspots.txt`.
- Recording and contract rules, source references and scope: `analysis/original/tutorial-flow-findings.md`, with retained data/layout/media evidence alongside it.

The HUD's unused alpha byte is set opaque during import, matching Director's ink=0 copy behavior. White surround mattes are color-keyed during import. Unmodified recovery images/source hashes remain in the analysis folder. `public/assets/provenance.json` records selected media and import rules. Other sprite masks and ink modes still need reconciliation.

## Code layout

- `src/game/`: renderer-independent state, recruitment, payroll/calendar and save-store interface.
- `src/scenes/`: Phaser presentation, input and transitions.
- `src/ui/`: canvas controls assembled from original border tiles.
- `scripts/prepare-assets.mjs`: local asset/scenario preparation.
- `src-tauri/`: desktop wrapper of the same compiled application.
- `analysis/original/`: recovery evidence, reconstructed scripts and decoded data.

## Checks

The current studio comparison ledger is in
[analysis/original/studio-validation.md](analysis/original/studio-validation.md).
Fourteen original Windows captures are indexed in
[the native reference gallery](analysis/original/runtime/reference/index.html).
They now guide mixer/Settings geometry, original fixed-label glyphs and RGB555
WebGL output. Fixed image regions pass native comparisons; dynamic fonts, audio
and complete runtime equivalence remain unverified. The original
musician chooser confirmation flow now selects first and hires/charges only on
OK; Cancel leaves both cash and the channel unchanged.

Original sleeve design and release booking are now playable with recovered backgrounds, musician poses, effects and fourteen bitmap logo fonts. Confirming books a future release and charges once; saved covers reopen read-only. See [the Design Studio validation notes](analysis/original/design-validation.md).

Venues/gigs, radio and newspaper promotion, Record Store campaigns, audience exposure and sales/charts are now connected. Press kits belong to individual reporters; adverts and gigs use a shared calendar. Concerts settle once, and royalties repay the signing advance before paying the band. Click the Date display to inspect bookings. Existing saves retain their band, contract and cover when publicity state is added.

Source rules and remaining fidelity limits are in [publicity-validation.md](analysis/original/publicity-validation.md). Neutral source actor composites are used for media portraits; the remaining original random character events and additional media requests remain unfinished.

```powershell
npm test
npm run test:browser
npm run build
```

Simulation checks include paid-action completion paths for Mission03 and Mission04, scenario save migration, native quit-card ordering, and cover design/release booking, recruitment/payroll, studio prerequisites and one-time rental, quality weighting, session fees, label rejection, offer rounding, signing and save validation. Browser checks cover gigs, cancellations, press kits, gifts, advertising, newspapers, store promotion, dated sales, result acknowledgements, charts and save migration. They also complete cover selection, cancelled booking, dragging a release date, one-time costs and reload; they also complete the tutorial through a negotiated contract, resume paid recording after reload, recover pending tutorial cards, exercise rejection/retry and cancellation, verify mixer/audio controls and check the earlier hiring/clock/cursor behavior. Screenshots go under `test-results/`. The fresh-game completion test follows a normal100000 budget through release/promotion to the sales-chart ending without injecting game state; separate fixtures cover failure branches. See [Mission01 completion evidence](analysis/original/mission01-completion-validation.md) and [Mission03/04 implementation boundaries](analysis/original/mission34-implementation.md).

Generated test screenshots, logs and reports belong only in the ignored `test-results/` directory and should not be committed. A fresh clone does not need previous test runs; keep the test code/configuration and original reference images in `analysis/original/runtime/reference/`. Required game media in `public/assets/` remains visible to Git.

Browser tests use installed Edge on Windows when available. If automatic temporary-server shutdown hangs on Windows, run `npm run dev` in another terminal and set `$env:PLAYWRIGHT_EXTERNAL_SERVER='1'` before testing. Otherwise install Playwright Chromium (`npx playwright install chromium`) or set `PLAYWRIGHT_EXECUTABLE_PATH` to an existing Chromium browser.


Original English media/label greetings, gift/press-kit reactions and concert crowd feedback now play from recovered SWA streams (retained unchanged as MP3). Sound is enabled by default; legacy saves migrate once, preserving band/cash/progress, and subsequent Sound off choices persist. Time runs automatically at the source nominal three seconds per day, pauses in dialogs/tutorials and when the tab is hidden, and resumes on return to the city. See [feedback audio provenance](analysis/original/feedback-audio-evidence.json). Browser audio diagnostics report decoded-file RMS and live output RMS; these checks do not prove physical speaker output or complete native visual equivalence.

The source UI audit now retains115 original Director dialog definitions, bitmap registrations and text-template settings. Main menu, briefing, publisher, name field, mixer exit, refusal and press reviews use these recovered layouts; artist/action, media, design and booking controls have specific source corrections. See [the source audit and limits](analysis/original/ui-source-audit-2026-10-14.md). Original CD narration, five publisher previews, studio entrance cues and review/failure effects are recovered and connected. Scrolling preserves the current publisher preview; closing its window stops it. City ambience stops under windows. These assets are prepared locally, so browser playback does not require the CD.

For faster playtest startup, only graphics and city ambience preload. Speech, effects, song previews and instrument tracks load when used and stay cached in memory for reuse during that visit. Full audio preloading is deferred until staged loading and asset bundling are addressed. See [loading history and verification](analysis/audio-preloading-validation.md).

Bandmate windows now play original character speech with source-cue lip syncing. Gifts, booked training/holidays, praise/slander and firing are playable and saved; training affects subsequent recordings and gigs. English mood/health feedback and training completion cards use recovered original localization. Exact font masks are verified for several venue/media samples, while antialiased title/HUD text remains a documented fidelity limit. See [bandmate/font validation](analysis/original/bandmate-font-validation.md).

Rehearsal now uses original mood-specific portraits and the native album status fields. Play song previews the recorded mix and stops when the band window closes; song selection belongs in the studio. Actor decoding now follows the native live-score ink36 rule: every matching white pixel is transparent, including enclosed regions. The prior exterior-only matte was incorrect. See [animation transparency evidence](analysis/original/animation-white-artifacts.md). The audio export includes training completion voices and original lip-sync cues. Five focused browser checks compare painted portraits with source bitmaps, inspect compact cards, enforce rehearsal guidance and verify playback.


## AI Use

Codex AI, alongside REA (https://rea.tools/) was used to analyse the original 2001 game binary, and recreate it in Typescript for use on the web
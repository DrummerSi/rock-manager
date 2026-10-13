# Rock Manager recreation

A browser-first TypeScript/Phaser 3 recreation of the opening of Rock Manager's Mission01. Every game screen, control, dialog and text input is rendered inside one 800×600 canvas. HTML only hosts the canvas and fits it to the window.

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

## Play this milestone

1. Read the First Steps briefing and begin the mission.
2. Click Rehearsal in the original top bar.
3. Choose one of five band positions. Select a candidate and instrument, then recruit them. Candidates are filtered by recovered skills and ordered by weekly salary.
4. Name the band using the canvas text field. Enter saves; Escape cancels. Ctrl/Cmd+A clears the current draft.
5. Return to the city. Play advances a day every three seconds; Advance one day steps manually. Wages are charged every seventh day. Dialogs pause time.
6. Buy a song license at Melody Publishing, then visit Strawberry Studios or Garage Studio. Rental is paid once on entering the mixer.
7. Drag volume sliders vertically and turn knobs by dragging horizontally. Mute uses the original pressed/unpressed sprites. Click Settings, a portrait or an instrument to open the channel window: choose tracks, adjust effects and use Preview. Click the portrait inside Settings to choose a session musician for non-vocal channels. Session fees are paid immediately. Play/Stop preview the recovered Ogg stems.
8. Click OK to finish the demo, then approach Rebel Records or Rainbow Records. A label can reject the demo based on band style, song type or quality. Try a different lineup, song or studio after rejection.
9. Negotiate the advance/royalty trade-off in Contract Proposal. OK signs the contract and pays the advance; Cancel leaves it unsigned. Leaving the label shows the original cover-design introduction, which marks the next development stage.

Arrow keys, the bottom arrows, or hovering near the city's horizontal edges scroll the panorama. Escape opens/closes the menu. Space toggles the clock. Sound and fullscreen controls are canvas buttons.

Progress automatically saves in browser storage. Reloading offers Continue. New mission asks for confirmation before replacing progress. Invalid saves fall back to the briefing. Desktop and browser saves currently occupy separate webview/browser origins.

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

Opening flow now starts at the main menu, with Continue/New game/Web site/Quit in the recovered horizontal layout, followed by mission selection and briefing. Only Mission01 can be played; the original website entry is disabled. Quit saves and returns to the menu in this browser-first implementation. Sound/fullscreen/help below the original row are recreation controls. The menu autosave notice is translated from the installed Swedish fallback strings; its original English wording is not recovered.

Mission01 tutorial cards use recovered English text and event triggers through city, rehearsal, publisher, studio, mixer, labels, rejection/retry and the post-contract cover introduction. They block input, pause time and persist acknowledgements. Reloading resumes a paid mixer session without charging rental again, and restores an unacknowledged label introduction. Existing started saves migrate with tutorials disabled to preserve their current flow. Thirteen cards and their trigger rules are retained in `analysis/original/opening-ui-evidence.json`; media, charts and calendar tutorials await their gameplay systems. Popup width/font metrics remain approximate, while height follows rendered content and the source center point (400,305). REA opened the original EXE successfully; its native UI capture tool targets macOS and cannot capture this Windows Director game.

Visual fidelity pass: dialog borders now use RockDialog tiles and black title bars; raw 16-bit border BITD payloads are decoded correctly rather than treated as RLE. Button tiles follow native corner-first composition, with original icons, grey/white captions and disabled corners. The city header uses recovered BandIcons/MoneyDisplay/DateDisplay coordinates; rehearsal has silhouettes and a framed album panel; recruitment has portrait/instrument rows, native scroll arrows and two meters. Sound is accessible in the menu. Raw 32-bit inset frame tiles are now decoded and used directly.

`analysis/ui-review/index.html` compares captured screens with bundled original help screenshots. These reduced-resolution references do not establish pixel-perfect fidelity. To regenerate after browser tests, run `node scripts/build-ui-review.mjs` (requires the original installed help images). Raw border evidence is in `analysis/original/ui-raw-bitmaps.json`; normal builds use retained bytes without requiring the original installation.

Implemented: briefing, animated scrolling city, original HUD and recovered surround masks, corrected button tiles, rehearsal diagram/instrument sprites, layered recruitment, nine recruitable musicians, five positions, naming, song licensing/selection, studios, mixer controls and audio previews, paid session musicians, demo quality, label acceptance/rejection, linked contract offers and signing, tutorial progression through the first contract, payroll, local saves, ambience and fullscreen. Existing saves migrate automatically.

This milestone reaches the first record contract; it does not complete Mission01’s Top 10 objective. Cover design, release, gigs, media, sales, chart success and musician needs/relationships remain unimplemented. Delay and timeshift settings use WebAudio implementations of the original control ranges; the legacy Xtra DSP is not bit-exact. Slice jitter and musician reactions remain unimplemented. Label office actors use recovered static poses. Existing signed demos cannot yet be discarded and re-recorded, although the original permits that after a warning. Live reputation/hype bonuses are zero until those systems exist. Dialog sizes and legacy font rasterization remain approximate; bundled help screenshots do not establish pixel-perfect runtime fidelity.

Recovered behavior used here:

- Dialog geometry, registration points and button compositing: `analysis/original/ui-layout-recovery.json` and `.md`.
- Mission song catalog and license terms: `DataSongs00.json`, `DataBuildings00.json`, Mission01.AvailableSongs; purchase/filtering: `scripts/cd/Main.dxr/00029-DlgPublishScript.lingo`. Royalty rates are displayed; sales accounting is not yet implemented.

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

```powershell
npm test
npm run test:browser
npm run build
```

Simulation checks cover recruitment/payroll, studio prerequisites and one-time rental, quality weighting, session fees, label rejection, offer rounding, signing and save validation. Browser checks complete the tutorial through a negotiated contract, resume paid recording after reload, recover pending tutorial cards, exercise rejection/retry and cancellation, verify mixer/audio controls and check the earlier hiring/clock/cursor behavior. Screenshots go under `test-results/`.

Browser tests use installed Edge on Windows when available. Otherwise install Playwright Chromium (`npx playwright install chromium`) or set `PLAYWRIGHT_EXECUTABLE_PATH` to an existing Chromium browser.


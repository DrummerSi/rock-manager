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

Implemented: briefing, scrolling city, original HUD and UI border sprites, nine recruitable musicians, five instrument positions, band naming, manual/automatic calendar progression, weekly payroll, local saves, ambience and fullscreen.

This is an opening prototype, not a completed Mission01 or a pixel-exact port. Recording, licensing, contracts, media, sales, chart success, animation sequences, musician needs/relationships and the full tutorial system are not implemented. City building clicks explain this limitation. Removing a musician currently has no relationship consequences. The simulation batches daily updates rather than reproducing Director's random frame groups.

Recovered behavior used here:

- Mission01 funds, candidate data and briefing: `analysis/original/data/mission01-recovered.json`.
- Positions, eligibility and salary sorting: `analysis/original/scripts/cd/Main.dxr/00015-DlgRehearsal01ChooseScript.lingo`.
- Payroll schedule: `analysis/original/scripts/installed/RockGeneral.cxt/00016-ClassBandScript.lingo`, timeTick; amounts: ClassRealMusicianScript.Pay.
- HUD positioning and opaque-copy rendering: `analysis/original/scripts/installed/RockUtil.cxt/00074-InterfaceBarScript.lingo`.
- City hotspots: Main.dxr HotspotsField, preserved in `analysis/original/data/city-hotspots.txt`.

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

Simulation checks cover eligibility, duplicate recruitment, payday boundaries, insufficient cash, save validation and leap days. Browser checks click the actual canvas through briefing, recruitment, payroll, reload and naming; verify no HTML form controls exist; and check dialog clock pausing. Screenshots go under `test-results/`.

Browser tests use installed Edge on Windows when available. Otherwise install Playwright Chromium (`npx playwright install chromium`) or set `PLAYWRIGHT_EXECUTABLE_PATH` to an existing Chromium browser.

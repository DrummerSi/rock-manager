# Mission01 playable loop — 14 October 2026

Implemented the original sales-chart success trigger and one-day delay, ending text/artwork, economy/concert/review scoring, terminal clock pause, result acknowledgment and save restoration. Unpaid mandatory payroll queues the original warning; its OK confirms failure. Losing the available singers uses the original failure transition. Zero cash alone does not end the mission.

Source: `DataDBRest01.json` TRMis1Succeeded/TRMis1Succeeded02, `DataDBEC00.json` nested ButtonOK.ExecuteThis, ClassPlayerScript.transactMoney, ClassMissionScript and DlgMissionOutroScript. Artwork/coordinates/font metadata: `mission-ending-layout-evidence.json`. The ending images and four score icons are retained original media; runtime preparation requires neither the CD nor installed game.

## Fresh browser evidence

`tests/browser/mission01-completion.spec.ts` starts in a fresh browser context with normal100000 funds, no injected save, money, chart, sales or exposure. It uses canvas controls to hire Jerka/Tony/Raymond/Gurra/Sussie, name Rebel Youth, license Sng01, rent Strawberry Studios, finish a demo, negotiate Record01 offer4 (58000advance), design the9500cover and release day2, send three free press kits, book Café Lizette and a14-day Discount store campaign (14000).

Observed Store Top10 day15, success day16, money116615, total sales16071.0347. Reload preserved money/day/sales/chart/outcome; Enter acknowledged and returned to mission selection. Original later missions remain disabled. Actual ending, cover and failure screenshots were visually inspected. The test writes its full ledger alongside captures. Initial two runners finished all gameplay assertions and screenshots but hung during browser cleanup; they were interrupted and are not reported as passing test runs. A separately managed Vite server isolated the Windows temporary-server shutdown hang. The final isolated completion run exited0: 1passed (28.7s), with the same day16/money/sales result. A later rerun initially missed a zero-duration canvas click; a35ms press duration made the test input reliable without changing game state or assertions. Missing-singer guidance and tutorial-card checks also passed with clean runner exit.

A separate focused low-cash fixture in `mission-failure.spec.ts` verifies unpaid wages warning → acknowledgment → loss → reload → acknowledgment/mission selection. This fixture is not evidence of fresh-game completion.

## Limits and adaptations

This establishes a completable Mission01 path, not whole-game or pixel-perfect equivalence. The broader random event engine, later missions and conditional extra label advances are unfinished. The original extra-advance tutorial points at actions absent from the recovered label action categories; the displayed guidance instead explains the implemented signing advance, recoup and wages. The original intro text is retained unchanged in the evidence data. Request-CD random cards are withheld until their Yes/No transactions and illustration layout exist. Original failure sound a131 was subsequently recovered from the CD and wired to the failure ending; success uses the recorded mix loop. Legacy Xtra effects use WebAudio equivalents.

## Build and model checks

All46 simulation/source tests passed; TypeScript checking and production Vite build passed. Tauri release build (--no-bundle) passed and produced src-tauri/target/release/rock-manager.exe. This is build validation, not a claim that the Windows executable was manually played through.


Final full browser run against the independently managed development server: 28passed (5.7m), exit0. Output: test-results-verified/.last-run.json. Fresh ledger: test-results-verified/mission01-completion-a-gen-04521-ameplay-and-survives-reload/mission01-checkpoints.json. This includes actual canvas fresh-game completion, reload and acknowledgment as well as the focused failure fixture, animation matte, mixer/audio, hiring, tutorial, publicity and save regressions.

